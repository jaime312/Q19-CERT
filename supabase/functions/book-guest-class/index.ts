import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, clase_id, nombre, apellidos, email } = await req.json()

    if (!session_id || !clase_id || !nombre) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos (session_id, clase_id, nombre).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY no está configurado.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // 1. Retrieve the Checkout Session from Stripe to verify payment and guest status
    console.log(`Verificando sesión Stripe para reserva invitado: ${session_id}`)
    const session = await stripe.checkout.sessions.retrieve(session_id)

    if (session.payment_status !== 'paid') {
      return new Response(JSON.stringify({ error: 'La sesión de pago no está completada/pagada.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (session.client_reference_id !== 'guest') {
      return new Response(JSON.stringify({ error: 'Esta sesión no corresponde a una compra de invitado.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 3. Verify if this session was already used to prevent duplicate bookings
    const { data: existingProfiles, error: duplicateCheckError } = await supabase
      .from('profiles')
      .select('id')
      .like('apellidos', `%[Stripe: ${session_id}]%`)

    if (duplicateCheckError) {
      console.error("Database query error checking duplicate session:", duplicateCheckError)
      return new Response(JSON.stringify({ error: 'Error al comprobar si la compra ya fue canjeada.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(JSON.stringify({ error: 'Esta compra ya ha sido utilizada para reservar una clase.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Retrieve class to check free spots
    const { data: clase, error: classError } = await supabase
      .from('clases')
      .select('capacidad_max')
      .eq('id', clase_id)
      .single()

    if (classError || !clase) {
      return new Response(JSON.stringify({ error: 'No se encontró la clase seleccionada.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check capacity limits
    const { data: bookings, error: bookingsError } = await supabase
      .from('reservas_yoga')
      .select('id')
      .eq('clase_id', clase_id)

    if (bookingsError) {
      console.error("Error checking bookings:", bookingsError)
    }

    const currentBookingsCount = bookings ? bookings.length : 0
    if (currentBookingsCount >= (clase.capacidad_max || 0)) {
      return new Response(JSON.stringify({ error: 'Lo sentimos, esta clase ya está completa. Por favor, selecciona otro horario.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Create guest auth user and profile
    const guestEmail = email || `guest_${session_id}@genyoga.es`
    console.log(`Creando usuario de autenticación temporal para invitado: ${guestEmail}`)

    const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
      email: guestEmail,
      email_confirm: true,
      user_metadata: { nombre, apellidos }
    })

    if (authError || !authUserData?.user) {
      console.error("Error creating guest auth user:", authError)
      return new Response(JSON.stringify({ error: `Error al registrar el usuario: ${authError?.message || 'No se recibió información del usuario.'}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const guestUserId = authUserData.user.id
    console.log(`Insertando/actualizando perfil temporal para invitado: ${guestUserId}`)

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: guestUserId,
        email: guestEmail,
        nombre: nombre,
        apellidos: `${apellidos} [Stripe: ${session_id}]`,
        rol: 'alumno',
        bonos: 0
      })

    if (profileError) {
      console.error("Error creating guest profile:", profileError)
      // Clean up created auth user
      await supabase.auth.admin.deleteUser(guestUserId)
      return new Response(JSON.stringify({ error: `Error al registrar el perfil: ${profileError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Create booking
    console.log(`Insertando reserva en clase ${clase_id} para el invitado ${guestUserId}`)
    const { error: bookingError } = await supabase
      .from('reservas_yoga')
      .insert([{
        clase_id: clase_id,
        user_id: guestUserId,
        estado: 'confirmada',
        usado_bono_mensual: false
      }])

    if (bookingError) {
      console.error("Error creating guest booking:", bookingError)
      // Clean up the profile and the auth user so they can retry
      await supabase.from('profiles').delete().eq('id', guestUserId)
      await supabase.auth.admin.deleteUser(guestUserId)

      return new Response(JSON.stringify({ error: `Error al registrar la reserva: ${bookingError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Reserva completada con éxito. Usuario temporal: ${nombre} ${apellidos}`)
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Error en book-guest-class:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

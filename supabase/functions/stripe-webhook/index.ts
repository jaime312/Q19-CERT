import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  
  if (!stripeKey) {
    return new Response("Missing STRIPE_SECRET_KEY", { status: 500 })
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
  })
  
  const signature = req.headers.get("stripe-signature")
  let event

  try {
    const body = await req.text()
    if (endpointSecret && signature) {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        endpointSecret
      )
    } else {
      // Unverified mode (local/testing fallback if secret is missing)
      event = JSON.parse(body)
      console.warn("⚠️ Webhook running without webhook signature verification secret.")
    }
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  console.log(`Recibido evento webhook de Stripe: ${event.type}`)

  try {
    if (event.type === 'checkout.session.completed') {
      const sessionObject = event.data.object
      
      console.log(`Buscando detalles de línea para la sesión: ${sessionObject.id}`)
      // Retrieve the session with line_items expanded to verify which product was purchased
      const session = await stripe.checkout.sessions.retrieve(
        sessionObject.id,
        { expand: ['line_items'] }
      )

      const userId = session.client_reference_id
      const lineItem = session.line_items?.data?.[0]
      const priceId = lineItem?.price?.id

      if (userId && priceId) {
        console.log(`Procesando compra de precio ${priceId} para el usuario: ${userId}`)
        
        if (userId === 'guest') {
          console.log(`Fulfillment de invitado: Pago completado para Stripe Session. No se requiere saldo de cuenta.`)
          return new Response(JSON.stringify({ received: true, isGuest: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        const priceClaseSuelta = Deno.env.get('STRIPE_PRICE_CLASE_SUELTA') || 'price_1TqVYPC3eulgiYPc2k62Sapd'
        const priceBonoMensual = Deno.env.get('STRIPE_PRICE_BONO_MENSUAL') || 'price_1TqVZ8C3eulgiYPciTZlAY6B'

        // Purchase of Single Class (Clase suelta)
        if (priceId === priceClaseSuelta) {
          // Fetch current profile to increment balance
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('bonos')
            .eq('id', userId)
            .maybeSingle()

          if (!profile) {
            console.warn(`Perfil no encontrado para usuario ${userId}. Creando uno nuevo con 1 clase suelta...`)
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                bonos: 1,
                rol: 'alumno'
              })

            if (insertError) {
              console.error(`Error al crear perfil con clase suelta:`, insertError)
              return new Response(`Insert profile error: ${insertError.message}`, { status: 500 })
            }
            console.log(`Éxito: Se creó perfil con 1 clase suelta para el usuario ${userId}`)
          } else {
            const currentBonos = profile ? (parseInt(profile.bonos, 10) || 0) : 0
            const newBonos = currentBonos + 1

            const { error: updateError } = await supabase
              .from('profiles')
              .update({ bonos: newBonos })
              .eq('id', userId)

            if (updateError) {
              console.error(`Error al actualizar bonos para clase suelta:`, updateError)
              return new Response(`Update profile error: ${updateError.message}`, { status: 500 })
            }
            console.log(`Éxito: Se añadió 1 clase suelta al usuario ${userId}. Nuevo saldo: ${newBonos}`)
          }
        } 
        // Purchase of Monthly Voucher (Bono mensual)
        else if (priceId === priceBonoMensual) {
          const now = new Date()
          const oneMonthLater = new Date()
          oneMonthLater.setMonth(now.getMonth() + 1)

          console.log(`Activando bono mensual para el usuario ${userId}`)

          // Check if profile exists
          const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .maybeSingle()

          if (!profile) {
            console.warn(`Perfil no encontrado para usuario ${userId}. Creando uno nuevo con bono mensual...`)
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                bonos: 0,
                rol: 'alumno',
                bono_mensual_activo: true,
                bono_mensual_inicio: now.toISOString(),
                bono_mensual_fin: oneMonthLater.toISOString()
              })

            if (insertError) {
              console.error(`Error al crear perfil con bono mensual:`, insertError)
              return new Response(`Insert monthly profile error: ${insertError.message}`, { status: 500 })
            }
            console.log(`Éxito: Se creó perfil y se activó bono mensual para el usuario ${userId}`)
          } else {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                bono_mensual_activo: true,
                bono_mensual_inicio: now.toISOString(),
                bono_mensual_fin: oneMonthLater.toISOString()
              })
              .eq('id', userId)

            if (updateError) {
              console.error(`Error al activar bono mensual:`, updateError)
              return new Response(`Update monthly profile error: ${updateError.message}`, { status: 500 })
            }
            console.log(`Éxito: Bono mensual activado automáticamente para el usuario ${userId}`)
          }
        } 
        else {
          console.warn(`⚠️ Compra completada con un ID de precio desconocido: ${priceId}`)
        }
      } else {
        console.warn("⚠️ checkout.session.completed recibido pero falta el client_reference_id (userId) o el priceId.")
      }
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(`Error procesando evento Stripe: ${error.message}`)
    return new Response(`Internal Webhook Error: ${error.message}`, { status: 500 })
  }
})

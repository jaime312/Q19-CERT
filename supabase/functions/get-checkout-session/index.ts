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
    const { session_id } = await req.json()

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'Falta el session_id.' }), {
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

    console.log(`Buscando sesión de checkout: ${session_id}`)
    const session = await stripe.checkout.sessions.retrieve(session_id)

    const isGuest = session.client_reference_id === 'guest'
    const email = session.customer_details?.email || ''
    const rawName = session.customer_details?.name || ''
    
    // Split Stripe customer name into first name and last name
    const nameParts = rawName.trim().split(/\s+/)
    const nombre = nameParts[0] || ''
    const apellidos = nameParts.slice(1).join(' ') || ''

    // Verify if this session is already redeemed
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: profiles, error: dbError } = await supabase
      .from('profiles')
      .select('id')
      .like('apellidos', `%[Stripe: ${session_id}]%`)

    if (dbError) {
      console.error("Database query error checking duplicate session:", dbError)
    }

    const alreadyRedeemed = profiles && profiles.length > 0

    return new Response(JSON.stringify({
      isGuest,
      email,
      nombre,
      apellidos,
      alreadyRedeemed,
      paymentStatus: session.payment_status,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Error en get-checkout-session:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, site_url } = await req.json()

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
    const checkoutSession = await stripe.checkout.sessions.retrieve(session_id)

    if (!checkoutSession.customer) {
      return new Response(JSON.stringify({ error: 'No se encontró un cliente asociado a esta compra.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine the site URL and validate its scheme
    let siteUrl = site_url || Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:5500'
    if (!siteUrl || siteUrl === 'null' || !siteUrl.startsWith('http')) {
      siteUrl = 'http://localhost:5500'
    }
    
    const returnUrl = `${siteUrl}/profile.html`

    console.log(`Creando Billing Portal para cliente: ${checkoutSession.customer}. URL de retorno: ${returnUrl}`)
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: checkoutSession.customer as string,
      return_url: returnUrl,
    })

    return new Response(JSON.stringify({ url: portalSession.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Error en create-portal-session:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

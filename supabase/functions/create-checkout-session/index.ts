import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS options request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { lookup_key, user_id, site_url, from } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Falta el ID de usuario (user_id).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY no está configurado en Supabase.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Resolve generic keys to actual price IDs from environment variables, with live defaults
    let priceId = ''
    const key = (lookup_key || '').trim()

    if (key === 'clase_suelta') {
      priceId = Deno.env.get('STRIPE_PRICE_CLASE_SUELTA') || 'price_1TqVYPC3eulgiYPc2k62Sapd'
    } else if (key === 'bono_mensual') {
      priceId = Deno.env.get('STRIPE_PRICE_BONO_MENSUAL') || 'price_1TqVZ8C3eulgiYPciTZlAY6B'

      // Check if user already has an active monthly plan to prevent double purchase
      console.log(`Verificando si el usuario ${user_id} ya tiene un bono mensual activo...`)
      const { data: profile } = await supabase
        .from('profiles')
        .select('bono_mensual_activo')
        .eq('id', user_id)
        .maybeSingle()

      if (profile && profile.bono_mensual_activo) {
        return new Response(JSON.stringify({ error: 'Ya tienes una suscripción activa al Bono Mensual. No es necesario adquirir otra.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else if (key.startsWith('price_')) {
      priceId = key
    } else {
      // Fallback
      priceId = Deno.env.get('STRIPE_PRICE_CLASE_SUELTA') || 'price_1TqVYPC3eulgiYPc2k62Sapd'
    }

    // Retrieve the price from Stripe to determine mode
    let mode = 'payment'
    try {
      console.log(`Verificando precio en Stripe: ${priceId}`)
      const priceObj = await stripe.prices.retrieve(priceId)
      mode = priceObj.type === 'recurring' ? 'subscription' : 'payment'
    } catch (e) {
      console.warn("No se pudo verificar el tipo de precio en Stripe, usando valor predeterminado", e)
      // Fallback logic
      if (priceId === (Deno.env.get('STRIPE_PRICE_BONO_MENSUAL') || 'price_1TqVZ8C3eulgiYPciTZlAY6B')) {
        mode = 'subscription'
      } else {
        mode = 'payment'
      }
    }

    // Determine the site URL. Validate that it starts with a valid scheme (http/https).
    let siteUrl = site_url || Deno.env.get('SITE_URL') || req.headers.get('origin') || 'http://localhost:5500'
    
    // Clean null origins (common when opening static files directly via file://) or invalid values
    if (!siteUrl || siteUrl === 'null' || !siteUrl.startsWith('http')) {
      siteUrl = 'http://localhost:5500'
    }

    console.log(`Creando Checkout Session para usuario: ${user_id}. Price ID: ${priceId}. Modo: ${mode}. URL de retorno: ${siteUrl}`)

    const sessionParams: any = {
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode,
      client_reference_id: user_id,
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}${user_id === 'guest' ? '&guest=true' : ''}${from ? `&from=${from}` : ''}`,
      cancel_url: `${siteUrl}/cancel.html${from ? `?from=${from}` : ''}`,
      payment_method_types: ['card'],
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error("Error en create-checkout-session:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

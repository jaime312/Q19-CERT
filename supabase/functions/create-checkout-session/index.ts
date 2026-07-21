import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.22.0?target=deno"
import {
  PURCHASE_TYPES,
  HttpError,
  assertAllowedOrigin,
  corsHeaders,
  createAdminClient,
  createStripeClient,
  getAuthenticatedUser,
  getValidatedCatalog,
  handleOptions,
  jsonResponse,
  readProductionConfig,
  requirePost,
  safeErrorResponse,
} from "../_shared/stripe-production.ts"

serve(async (req) => {
  let headers: Record<string, string> = {}
  try {
    const config = readProductionConfig()
    headers = corsHeaders(req, config)
    const preflight = handleOptions(req, config)
    if (preflight) return preflight

    assertAllowedOrigin(req, config)
    requirePost(req)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'El cuerpo de la solicitud no es válido.')
    }

    const lookupKey = String(body.lookup_key || '').trim()
    if (lookupKey !== PURCHASE_TYPES.CLASE_SUELTA && lookupKey !== PURCHASE_TYPES.BONO_MENSUAL) {
      throw new HttpError(400, 'Producto no permitido.')
    }

    const requestedUserId = String(body.user_id || '').trim()
    const isGuest = requestedUserId === 'guest'
    if (isGuest && lookupKey !== PURCHASE_TYPES.CLASE_SUELTA) {
      throw new HttpError(400, 'Los invitados solo pueden adquirir una clase suelta.')
    }

    const stripe = createStripeClient(config)
    const supabase = createAdminClient(config)
    const catalog = await getValidatedCatalog(stripe, config)

    const user = isGuest ? null : await getAuthenticatedUser(req, supabase, true)
    if (!isGuest && requestedUserId !== user?.id) {
      throw new HttpError(403, 'El usuario de la compra no coincide con la sesión autenticada.')
    }

    let stripeCustomerId: string | null = null
    if (user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('bono_mensual_activo, bono_mensual_fin, stripe_subscription_status, stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (error || !profile) throw new Error('No se pudo cargar el perfil del comprador.')

      const manualMonthlyEnd = profile.bono_mensual_fin
        ? Date.parse(String(profile.bono_mensual_fin))
        : Number.NaN
      const hasCurrentManualMonthly = Boolean(profile.bono_mensual_activo) && (
        !profile.bono_mensual_fin ||
        Number.isNaN(manualMonthlyEnd) ||
        manualMonthlyEnd > Date.now()
      )

      if (
        lookupKey === PURCHASE_TYPES.BONO_MENSUAL &&
        (hasCurrentManualMonthly || ['active', 'trialing', 'past_due'].includes(profile.stripe_subscription_status || ''))
      ) {
        throw new HttpError(409, 'Ya tienes un Bono Mensual vinculado a tu cuenta.')
      }
      if (profile.stripe_customer_id && !String(profile.stripe_customer_id).startsWith('cus_')) {
        throw new Error('El identificador Stripe del perfil no es válido.')
      }
      stripeCustomerId = profile.stripe_customer_id || null
    }

    const purchaseType = lookupKey
    const price = purchaseType === PURCHASE_TYPES.CLASE_SUELTA
      ? catalog.claseSuelta
      : catalog.bonoMensual
    const appUserId = isGuest ? 'guest' : user!.id
    const source = body.from === 'profile' ? 'profile' : 'tarifas'
    const metadata: Stripe.MetadataParam = {
      app: 'gen_yoga',
      environment: 'production',
      purchase_type: purchaseType,
      app_user_id: appUserId,
      source,
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      line_items: [{ price: price.id, quantity: 1 }],
      mode: purchaseType === PURCHASE_TYPES.BONO_MENSUAL ? 'subscription' : 'payment',
      client_reference_id: appUserId,
      success_url: `${config.siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}${isGuest ? '&guest=true' : ''}&from=${source}`,
      cancel_url: `${config.siteUrl}/cancel.html?from=${source}`,
      payment_method_types: ['card'],
      metadata,
    }

    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId
    } else if (user?.email) {
      sessionParams.customer_email = user.email
    }

    if (purchaseType === PURCHASE_TYPES.CLASE_SUELTA) {
      if (!stripeCustomerId) sessionParams.customer_creation = 'always'
      sessionParams.payment_intent_data = { metadata }
    } else {
      sessionParams.subscription_data = { metadata }
    }

    // Reuse the same Checkout Session for rapid retries/double-clicks. This keeps
    // two concurrent requests from creating two immediately payable subscriptions.
    const idempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000))
    const idempotencyKey = [
      'genyoga',
      'production',
      'checkout',
      purchaseType,
      appUserId,
      idempotencyWindow,
    ].join(':')
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey })
    if (!session.livemode || !session.url) {
      throw new Error('Stripe no devolvió una sesión LIVE válida.')
    }

    return jsonResponse({ url: session.url }, 200, headers)
  } catch (error) {
    return safeErrorResponse(error, headers)
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405)
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
    }

    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return jsonResponse({ error: 'Sesión no encontrada.' }, 401)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await admin.auth.getUser(token)
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Sesión no válida.' }, 401)
    }

    const { data: callerProfile, error: callerError } = await admin
      .from('profiles')
      .select('rol')
      .eq('id', authData.user.id)
      .single()

    if (callerError || (callerProfile?.rol || '').toLowerCase().trim() !== 'admin') {
      return jsonResponse({ error: 'Solo un administrador puede crear clientes de mostrador.' }, 403)
    }

    const body = await req.json()
    const nombre = String(body.nombre || '').trim()
    const apellidos = String(body.apellidos || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const bonos = Math.max(0, Number.parseInt(String(body.bonos || '0'), 10) || 0)

    if (!nombre || !email || !/^mostrador\+.+@genyoga\.studio$/i.test(email)) {
      return jsonResponse({ error: 'Datos de cliente de mostrador no válidos.' }, 400)
    }

    let { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        nombre,
        apellidos,
        cliente_mostrador: true,
      },
    })

    if (createError && /password/i.test(createError.message || '')) {
      const password = `${crypto.randomUUID()}${crypto.randomUUID()}`
      const retry = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          apellidos,
          cliente_mostrador: true,
        },
      })
      created = retry.data
      createError = retry.error
    }

    if (createError || !created.user) {
      return jsonResponse({ error: createError?.message || 'No se pudo crear el usuario sin contraseña.' }, 400)
    }

    const perfil = {
      id: created.user.id,
      email,
      nombre,
      apellidos,
      rol: 'cliente',
      bonos,
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .upsert(perfil, { onConflict: 'id' })
      .select()
      .single()

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 400)
    }

    return jsonResponse({ user: created.user, profile })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Error inesperado.' }, 400)
  }
})

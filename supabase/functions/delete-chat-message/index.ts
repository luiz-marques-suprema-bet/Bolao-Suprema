import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

type ChatMessageRow = {
  id: string
  user_id: string
  media_url?: string | null
  image_url?: string | null
  audio_url?: string | null
  gif_url?: string | null
  media_thumbnail_url?: string | null
}

type StorageTarget = {
  bucket: 'chat-media' | 'user-media'
  path: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS })
}

function storageTargetFromUrl(url?: string | null): StorageTarget | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const marker = '/storage/v1/object/public/'
    const index = parsed.pathname.indexOf(marker)
    if (index < 0) return null

    const objectPath = decodeURIComponent(parsed.pathname.slice(index + marker.length))
    const slash = objectPath.indexOf('/')
    if (slash < 0) return null

    const bucket = objectPath.slice(0, slash)
    const path = objectPath.slice(slash + 1)
    if ((bucket !== 'chat-media' && bucket !== 'user-media') || !path.startsWith('chat/')) return null
    return { bucket, path }
  } catch {
    return null
  }
}

function collectStorageTargets(message: ChatMessageRow): Map<StorageTarget['bucket'], Set<string>> {
  const targets = new Map<StorageTarget['bucket'], Set<string>>()

  for (const target of [
    storageTargetFromUrl(message.media_url),
    storageTargetFromUrl(message.image_url),
    storageTargetFromUrl(message.audio_url),
    storageTargetFromUrl(message.gif_url),
    storageTargetFromUrl(message.media_thumbnail_url),
  ]) {
    if (!target) continue
    const paths = targets.get(target.bucket) ?? new Set<string>()
    paths.add(target.path)
    targets.set(target.bucket, paths)
  }

  return targets
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Missing required environment variables.' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return json({ error: 'Unauthorized.' }, 401)

  let id = ''
  try {
    const body = await req.json()
    id = typeof body?.id === 'string' ? body.id : ''
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return json({ error: 'Invalid message id.' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  const user = userData?.user
  if (userError || !user) return json({ error: 'Unauthorized.' }, 401)

  const { data: message, error: messageError } = await admin
    .from('chat_messages')
    .select('id,user_id,media_url,image_url,audio_url,gif_url,media_thumbnail_url')
    .eq('id', id)
    .maybeSingle()

  if (messageError) return json({ error: messageError.message }, 500)
  if (!message) return json({ ok: true, deletedMessage: false, deletedFiles: 0 })

  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('is_admin,is_owner,user_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return json({ error: profileError.message }, 500)
  const canDelete =
    message.user_id === user.id ||
    profile?.is_admin === true ||
    profile?.is_owner === true ||
    profile?.user_role === 'admin' ||
    profile?.user_role === 'owner'

  if (!canDelete) return json({ error: 'Forbidden.' }, 403)

  const targets = collectStorageTargets(message as ChatMessageRow)
  let deletedFiles = 0
  for (const [bucket, paths] of targets) {
    if (paths.size === 0) continue
    const { error } = await admin.storage.from(bucket).remove(Array.from(paths))
    if (error) return json({ error: error.message }, 500)
    deletedFiles += paths.size
  }

  const { error: deleteError } = await admin
    .from('chat_messages')
    .delete()
    .eq('id', id)

  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ ok: true, deletedMessage: true, deletedFiles })
})

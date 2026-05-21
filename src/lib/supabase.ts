import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
const explicitMockMode = import.meta.env.VITE_MOCK_AUTH === 'true'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Environment variables not set. Persistent product features are unavailable.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const isExplicitMockMode = explicitMockMode
export const isMockMode = explicitMockMode || !isSupabaseConfigured

export async function uploadFile(
  userId: string,
  filename: string,
  file: File,
): Promise<string> {
  const maxBytes = 5 * 1024 * 1024
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (file.size > maxBytes) throw new Error('Arquivo muito grande. Maximo: 5 MB.')
  if (!allowed.includes(file.type)) throw new Error('Formato invalido. Use JPEG, PNG, WebP ou GIF.')

  const path = `${userId}/${filename}`
  const primaryBucket = filename === 'banner' ? 'banners' : 'avatars'

  let lastError = ''
  for (const bucket of [primaryBucket, 'user-media']) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type })
    if (!error) {
      const { publicUrl } = supabase.storage.from(bucket).getPublicUrl(path).data
      return `${publicUrl}?v=${Date.now()}`
    }
    console.error(`[Storage] ${bucket}/${path}:`, error.message)
    lastError = error.message
  }

  throw new Error(`Falha ao enviar ${filename === 'banner' ? 'banner' : 'foto'}: ${lastError}`)
}

export async function uploadChatMedia(
  userId: string,
  file: File | Blob,
  kind: 'image' | 'audio' | 'video' | 'video_note',
): Promise<string> {
  const maxBytes = kind === 'audio'
    ? 10 * 1024 * 1024
    : kind === 'image'
      ? 8 * 1024 * 1024
      : 25 * 1024 * 1024
  if (file.size > maxBytes) {
    const limit = kind === 'audio' ? '10' : kind === 'image' ? '8' : '25'
    throw new Error(`Arquivo muito grande. Maximo: ${limit} MB.`)
  }

  const type = file.type || ''
  const allowed = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    audio: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'],
    video: ['video/webm', 'video/mp4', 'video/quicktime'],
    video_note: ['video/webm', 'video/mp4', 'video/quicktime'],
  }[kind]
  if (type && !allowed.includes(type)) {
    throw new Error('Formato de midia nao suportado para a Resenha.')
  }

  const ext = kind === 'audio'
    ? (type.includes('mp4') ? 'mp4' : type.includes('mpeg') ? 'mp3' : type.includes('ogg') ? 'ogg' : type.includes('wav') ? 'wav' : 'webm')
    : kind === 'video' || kind === 'video_note'
      ? (type.includes('quicktime') ? 'mov' : type.includes('mp4') ? 'mp4' : 'webm')
      : (type.includes('png') ? 'png' : type.includes('gif') ? 'gif' : type.includes('webp') ? 'webp' : 'jpg')

  const path = `chat/${kind}/${userId}/${Date.now()}.${ext}`

  for (const bucket of ['chat-media', 'user-media']) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: false,
        contentType: type || (kind === 'audio' ? 'audio/webm' : kind === 'image' ? 'image/jpeg' : 'video/webm'),
      })
    if (!error) {
      const { publicUrl } = supabase.storage.from(bucket).getPublicUrl(path).data
      return publicUrl
    }
    console.error(`[Storage] ${bucket}/${path}:`, error.message)
  }

  throw new Error(`Falha ao enviar ${kind === 'audio' ? 'audio' : kind === 'image' ? 'imagem' : 'video'}.`)
}

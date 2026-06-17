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

// Redimensiona/comprime a imagem NO CLIENTE antes de subir. Fotos de celular
// chegavam com 4–5 MB e, servidas a centenas de pessoas, estouraram a cota de
// egress do Supabase (derrubou o projeto). Avatar -> 512px, banner -> 1280px,
// webp q~0.82 → caem pra ~50–300 KB. GIF passa direto (preserva animação) e,
// em qualquer falha, devolve o arquivo original (nunca bloqueia o upload).
async function compressImage(file: File, maxDim: number, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    return file
  }
}

export async function uploadFile(
  userId: string,
  filename: string,
  file: File,
): Promise<string> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) throw new Error('Formato invalido. Use JPEG, PNG, WebP ou GIF.')

  const upload = await compressImage(file, filename === 'banner' ? 1280 : 512)

  const maxBytes = 5 * 1024 * 1024
  if (upload.size > maxBytes) throw new Error('Arquivo muito grande. Maximo: 5 MB.')

  const path = `${userId}/${filename}`
  const primaryBucket = filename === 'banner' ? 'banners' : 'avatars'

  let lastError = ''
  for (const bucket of [primaryBucket, 'user-media']) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, upload, { upsert: true, contentType: upload.type })
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
  // Comprime fotos do chat antes de subir (mesma razão de egress dos avatares):
  // uma foto de 8 MB servida a toda a Resenha pesa demais. Áudio/vídeo passam direto.
  if (kind === 'image' && file instanceof File) {
    file = await compressImage(file, 1600)
  }
  const maxBytes = kind === 'audio'
    ? 10 * 1024 * 1024
    : kind === 'image'
      ? 8 * 1024 * 1024
      : 25 * 1024 * 1024
  if (file.size > maxBytes) {
    const limit = kind === 'audio' ? '10' : kind === 'image' ? '8' : '25'
    throw new Error(`Arquivo muito grande. Maximo: ${limit} MB.`)
  }

  const originalType = file.type || ''
  const fileName = file instanceof File ? file.name.toLowerCase() : ''
  const isVideoKind = kind === 'video' || kind === 'video_note'
  const looksLikeVideoFile = /\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|3gp|wmv)$/i.test(fileName)
  const allowed = {
    image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    audio: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'],
    video: ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/avi', 'video/mpeg', 'video/3gpp', 'video/x-ms-wmv'],
    video_note: ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/avi', 'video/mpeg', 'video/3gpp', 'video/x-ms-wmv'],
  }[kind]

  if (kind === 'image' && originalType && !allowed.includes(originalType)) {
    throw new Error('Formato de midia nao suportado para a Resenha.')
  }
  if (kind === 'audio' && originalType && !allowed.includes(originalType) && !originalType.startsWith('audio/')) {
    throw new Error('Formato de midia nao suportado para a Resenha.')
  }
  if (isVideoKind && originalType && !originalType.startsWith('video/') && originalType !== 'application/octet-stream' && !looksLikeVideoFile) {
    throw new Error('Formato de midia nao suportado para a Resenha.')
  }

  const type = allowed.includes(originalType)
    ? originalType
    : isVideoKind
      ? 'video/mp4'
      : kind === 'audio' && originalType.startsWith('audio/')
        ? 'audio/webm'
        : originalType

  const ext = kind === 'audio'
    ? (originalType.includes('mp4') ? 'mp4' : originalType.includes('mpeg') ? 'mp3' : originalType.includes('ogg') ? 'ogg' : originalType.includes('wav') ? 'wav' : 'webm')
    : kind === 'video' || kind === 'video_note'
      ? (fileName.match(/\.(mp4|mov|m4v|webm|mkv|avi|mpeg|mpg|3gp|wmv)$/i)?.[1] ?? (originalType.includes('quicktime') ? 'mov' : originalType.includes('matroska') ? 'mkv' : originalType.includes('avi') || originalType.includes('x-msvideo') ? 'avi' : originalType.includes('mpeg') ? 'mpeg' : originalType.includes('3gpp') ? '3gp' : originalType.includes('wmv') ? 'wmv' : originalType.includes('mp4') ? 'mp4' : 'webm'))
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

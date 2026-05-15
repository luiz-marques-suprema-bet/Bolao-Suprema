import { supabase } from '@/lib/supabase'

export const USER_MEDIA_BUCKET = 'user-media'
export const USER_MEDIA_MAX_BYTES = 5 * 1024 * 1024
export const USER_MEDIA_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function validateUserMediaImage(file: File): string | null {
  if (file.size > USER_MEDIA_MAX_BYTES) return 'Imagem acima de 5 MB.'
  if (!USER_MEDIA_IMAGE_TYPES.includes(file.type)) return 'Use JPG, PNG, WEBP ou GIF.'
  return null
}

export async function uploadUserMedia(
  userId: string,
  filename: string,
  file: File,
): Promise<string | null> {
  const validation = validateUserMediaImage(file)
  if (validation) {
    console.error('[Storage]', validation)
    return null
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${filename}.${ext}`
  const { error } = await supabase.storage
    .from(USER_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    console.error('[Storage]', error)
    return null
  }

  return supabase.storage.from(USER_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

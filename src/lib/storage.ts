import { supabase } from '@/lib/supabase'
import type { StorageBucket } from '@/types'

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
  bucket: StorageBucket | typeof USER_MEDIA_BUCKET = USER_MEDIA_BUCKET,
): Promise<string | null> {
  const validation = validateUserMediaImage(file)
  if (validation) {
    console.error('[Storage]', validation)
    return null
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = bucket === 'bulletins'
    ? `${userId}/bulletins/${Date.now()}-${filename}.${ext}`
    : `${userId}/${filename}.${ext}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) {
    console.error('[Storage]', error)
    return null
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function uploadAvatar(userId: string, file: File) {
  return uploadUserMedia(userId, 'avatar', file, 'avatars')
}

export async function uploadBanner(userId: string, file: File) {
  return uploadUserMedia(userId, 'banner', file, 'banners')
}

export async function uploadBulletinImage(userId: string, file: File) {
  return uploadUserMedia(userId, 'image', file, 'bulletins')
}

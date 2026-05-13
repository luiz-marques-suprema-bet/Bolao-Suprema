import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Environment variables not set — running in mock mode')
}

export const supabase = createClient(
  supabaseUrl    || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      autoRefreshToken:  true,
      persistSession:    true,
      detectSessionInUrl: true,
    },
  }
)

export const isMockMode =
  import.meta.env.VITE_MOCK_AUTH === 'true' || !supabaseUrl || !supabaseAnonKey

// Both 'user-media' (new) and 'avatars' (legacy) are public buckets.
// New uploads go to 'user-media'; 'avatars' bucket kept for backwards compat.
const MEDIA_BUCKET = 'user-media'

export async function uploadFile(
  userId:   string,
  filename: string,
  file:     File,
): Promise<string | null> {
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${filename}.${ext}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) { console.error('[Storage]', error); return null }
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

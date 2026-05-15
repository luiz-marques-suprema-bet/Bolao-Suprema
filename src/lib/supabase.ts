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
  }
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const isExplicitMockMode = explicitMockMode
export const isMockMode = explicitMockMode || !isSupabaseConfigured

export async function uploadFile(
  userId: string,
  filename: string,
  file: File,
): Promise<string | null> {
  const maxBytes = 5 * 1024 * 1024
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (file.size > maxBytes || !allowed.includes(file.type)) return null
  const ext = file.name.split('.').pop() ?? 'jpg'
  const bucket = filename === 'banner' ? 'banners' : 'avatars'
  const path = `${userId}/${filename}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type })
  if (error) return null
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

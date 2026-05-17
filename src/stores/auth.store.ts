import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppUser } from '@/types'
import { supabase, isExplicitMockMode, isSupabaseConfigured, uploadFile } from '@/lib/supabase'
import { MOCK_ME } from '@/data/mock'
import { getInitials } from '@/lib/utils'
import { usePredictionStore } from './prediction.store'
import { useBracketStore } from './bracket.store'

function syncUserStores(userId: string) {
  const preds = usePredictionStore.getState()
  preds.setUserId(userId)
  preds.syncFromSupabase(userId)

  const bracket = useBracketStore.getState()
  bracket.setUserId(userId)
  bracket.syncFromSupabase(userId)
}

// ─── DB row → AppUser ─────────────────────────────────────────────────────────

interface UserRow {
  id: string; email: string; first_name: string; last_name: string
  dept: string; initials: string; color: string
  avatar_url?: string | null; banner_url?: string | null; bio?: string | null
  favorite_team?: string | null; favorite_player?: string | null
  favorite_player_img?: string | null
  champion_pick?: string | null; vice_pick?: string | null; scorer_pick?: string | null
  since: string; is_admin: boolean; is_marketing: boolean; is_owner?: boolean
  user_role?: 'user' | 'marketing' | 'admin' | 'owner'
  participant_status?: 'pending' | 'active' | 'blocked' | 'removed'
  privacy_hide_email?: boolean; privacy_hide_profile?: boolean
  created_at: string
}

function mapUser(row: UserRow): AppUser {
  return {
    id:                row.id,
    email:             row.email,
    firstName:         row.first_name  ?? '',
    lastName:          row.last_name   ?? '',
    dept:              row.dept        ?? '',
    initials:          row.initials    ?? '',
    color:             row.color       ?? '#00A651',
    avatarUrl:         row.avatar_url  ?? undefined,
    bannerUrl:         row.banner_url  ?? undefined,
    bio:               row.bio         ?? undefined,
    favoriteTeam:      row.favorite_team      ?? undefined,
    favoritePlayer:    row.favorite_player     ?? undefined,
    favoritePlayerImg: row.favorite_player_img ?? undefined,
    since:             row.since ?? String(new Date().getFullYear()),
    isAdmin:           row.is_admin    ?? false,
    isMarketing:       row.is_marketing ?? false,
    isOwner:           row.is_owner ?? false,
    userRole:          row.user_role ?? (row.is_admin ? 'admin' : row.is_marketing ? 'marketing' : 'user'),
    participantStatus: row.participant_status ?? 'active',
    privacyHideEmail:  row.privacy_hide_email ?? true,
    privacyHideProfile: row.privacy_hide_profile ?? false,
    createdAt:         row.created_at  ?? new Date().toISOString(),
  }
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface AuthState {
  user: AppUser | null
  isLoading: boolean
  isAuthenticated: boolean
  profileComplete: boolean
  rememberMe: boolean

  setUser: (user: AppUser | null) => void
  setRememberMe: (v: boolean) => void
  sendOtp: (email: string) => Promise<{ error?: string }>
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  loadSession: () => Promise<void>
  updateProfile: (data: Partial<AppUser>, photoFile?: File, bannerFile?: File) => Promise<void>
  refreshProfile: () => Promise<void>
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      profileComplete: false,
      rememberMe: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          profileComplete: !!(user?.firstName && user?.dept),
          isLoading: false,
        }),

      setRememberMe: (v) => set({ rememberMe: v }),

      sendOtp: async (email) => {
        const normalized = email.trim().toLowerCase()
        if (!normalized.endsWith('@suprema.group')) {
          return { error: 'Use seu e-mail corporativo @suprema.group' }
        }
        if (isExplicitMockMode) return {}
        if (!isSupabaseConfigured) return { error: 'Supabase nao esta configurado. Login real indisponivel.' }
        const { error } = await supabase.auth.signInWithOtp({
          email: normalized,
          options: { shouldCreateUser: true },
        })
        if (error) {
          const msg = error.message.toLowerCase()
          if (msg.includes('rate limit') || msg.includes('rate_limit') || msg.includes('too many')) {
            return { error: 'Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código.' }
          }
          return { error: error.message }
        }
        return {}
      },

      verifyOtp: async (email, token) => {
        if (isExplicitMockMode) {
          set({ user: MOCK_ME, isAuthenticated: true, profileComplete: true, isLoading: false })
          syncUserStores(MOCK_ME.id)
          return {}
        }
        if (!isSupabaseConfigured) return { error: 'Supabase nao esta configurado. Login real indisponivel.' }

        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          type: 'email',
        })
        if (error) return { error: 'Código inválido ou expirado.' }
        if (!data.user) return { error: 'Erro ao validar código.' }

        // Se "manter conectado" estiver desmarcado, usamos sessionStorage
        // (limpo ao fechar o browser) para rastrear a sessão atual
        if (!get().rememberMe) {
          sessionStorage.setItem('bolao-session', data.user.id)
        }

        const { data: profile } = await supabase
          .from('users').select('*').eq('id', data.user.id).single()

        if (profile) {
          const user = mapUser(profile as UserRow)
          set({
            user,
            isAuthenticated: true,
            profileComplete: !!(user.firstName && user.dept),
            isLoading: false,
          })
          syncUserStores(user.id)
        } else {
          const stub: AppUser = {
            id: data.user.id,
            email: data.user.email ?? email,
            firstName: '',
            lastName: '',
            dept: '',
            initials: '',
            color: '#00A651',
            since: String(new Date().getFullYear()),
            isAdmin: false,
            isMarketing: false,
            isOwner: false,
            userRole: 'user',
            participantStatus: 'pending',
            privacyHideEmail: true,
            privacyHideProfile: false,
            createdAt: new Date().toISOString(),
          }
          set({ user: stub, isAuthenticated: true, profileComplete: false, isLoading: false })
        }
        return {}
      },

      signOut: async () => {
        if (isSupabaseConfigured) await supabase.auth.signOut()
        usePredictionStore.getState().clearAllPredictions()
        usePredictionStore.getState().setUserId(undefined)
        useBracketStore.getState().setUserId(undefined)
        set({ user: null, isAuthenticated: false, profileComplete: false })
      },

      loadSession: async () => {
        if (isExplicitMockMode) {
          const stored = get().user
          set({
            user: stored,
            isAuthenticated: !!stored,
            profileComplete: !!(stored?.firstName && stored?.dept),
            isLoading: false,
          })
          return
        }
        if (!isSupabaseConfigured) {
          set({ user: null, isAuthenticated: false, profileComplete: false, isLoading: false })
          return
        }
        const { data } = await supabase.auth.getSession()
        if (data.session?.user) {
          // Se o usuário não quis "manter conectado", verificamos se há uma
          // entrada em sessionStorage (apagada ao fechar o browser). Sem ela
          // significa que o browser foi fechado e reaberto → deslogar.
          const rememberMe = get().rememberMe
          if (!rememberMe) {
            const sessionId = sessionStorage.getItem('bolao-session')
            if (!sessionId) {
              await supabase.auth.signOut()
              set({ user: null, isAuthenticated: false, isLoading: false })
              return
            }
          }

          const { data: profile } = await supabase
            .from('users').select('*').eq('id', data.session.user.id).single()
          const user = profile ? mapUser(profile as UserRow) : null
          set({
            user,
            isAuthenticated: true,
            profileComplete: !!(user?.firstName && user?.dept),
            isLoading: false,
          })
          if (user?.id) syncUserStores(user.id)
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },

      refreshProfile: async () => {
        const uid = get().user?.id
        if (!uid || isExplicitMockMode || !isSupabaseConfigured) return
        const { data } = await supabase.from('users').select('*').eq('id', uid).single()
        if (data) set({ user: mapUser(data as UserRow) })
      },

      updateProfile: async (data, photoFile, bannerFile) => {
        const current = get().user
        if (!current) return

        let avatarUrl = current.avatarUrl
        let bannerUrl = current.bannerUrl
        let mediaError: string | null = null

        if (isSupabaseConfigured) {
          // Upload each file independently — a failed banner must not block the text save.
          if (photoFile) {
            try { avatarUrl = await uploadFile(current.id, 'avatar', photoFile) }
            catch (e) { mediaError = e instanceof Error ? e.message : 'Erro ao enviar foto.' }
          }
          if (bannerFile) {
            try { bannerUrl = await uploadFile(current.id, 'banner', bannerFile) }
            catch (e) { mediaError ??= e instanceof Error ? e.message : 'Erro ao enviar banner.' }
          }
        } else if (!isExplicitMockMode) {
          throw new Error('Supabase nao esta configurado. Perfil nao pode ser salvo.')
        }

        const updated: AppUser = { ...current, ...data, avatarUrl, bannerUrl }
        const initials = getInitials(`${updated.firstName} ${updated.lastName}`) || updated.initials
        updated.initials = initials

        set({
          user: updated,
          profileComplete: !!(updated.firstName && updated.dept),
        })

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('users').upsert({
            id: current.id,
            email: current.email,
            first_name: updated.firstName,
            last_name: updated.lastName,
            dept: updated.dept,
            initials,
            color: updated.color,
            avatar_url: avatarUrl,
            banner_url: bannerUrl,
            bio: updated.bio,
            favorite_team:       updated.favoriteTeam,
            favorite_player:     updated.favoritePlayer,
            favorite_player_img: updated.favoritePlayerImg ?? null,
            since:               updated.since,
            // Auto-approve on profile save — only upgrades pending→active, never unblocks
            ...(current.participantStatus !== 'blocked' && current.participantStatus !== 'removed'
              && { participant_status: 'active' }),
          })
          if (error) {
            console.error('[Profile] Erro ao salvar perfil:', error.message)
            throw new Error(error.message)
          }
        }

        // Text info saved — now surface any media upload failure so the UI shows it.
        if (mediaError) throw new Error(mediaError)
      },
    }),
    {
      name: 'bolao-auth',
      partialize: (state) => ({ user: state.user, rememberMe: state.rememberMe }),
    }
  )
)

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/shared/Avatar'
import { ImageViewer } from '@/screens/ResenhaV2/components/ImageViewer'
import { Flag } from '@/components/shared/Flag'
import { Stamp } from '@/components/shared/Stamp'
import { useAuthStore } from '@/stores/auth.store'
import { supabase, isMockMode } from '@/lib/supabase'
import { TEAMS } from '@/data/teams'
import { cn } from '@/lib/utils'
import { normalizeParticipantStatus } from '@/lib/participantStatus'
import type { AppUser } from '@/types'

// ─── Map DB row → AppUser ─────────────────────────────────────────────────────
function mapUser(row: any): AppUser {
  return {
    id: row.id, email: row.email ?? '',
    firstName: row.first_name ?? '', lastName: row.last_name ?? '',
    dept: row.dept ?? '', initials: row.initials ?? '',
    color: row.color ?? '#00A651',
    avatarUrl: row.avatar_url ?? undefined,
    bannerUrl: row.banner_url ?? undefined,
    bio: row.bio ?? undefined,
    favoriteTeam: row.favorite_team ?? undefined,
  favoritePlayer:    row.favorite_player     ?? undefined,
  favoritePlayerImg: row.favorite_player_img ?? undefined,
  since: row.since ?? '2026',
  isAdmin: row.is_admin ?? false,
  isMarketing: row.is_marketing ?? false,
  isOwner: row.is_owner ?? false,
  userRole: row.user_role ?? (row.is_admin ? 'admin' : row.is_marketing ? 'marketing' : 'user'),
  participantStatus: normalizeParticipantStatus(row.participant_status),
  privacyHideEmail: row.privacy_hide_email ?? true,
  privacyHideProfile: row.privacy_hide_profile ?? false,
  createdAt: row.created_at ?? '',
  }
}

export function UserProfileScreen() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const me = useAuthStore(s => s.user)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<string | null>(null)

  // If viewing own profile, redirect to /profile
  useEffect(() => {
    if (userId && me?.id === userId) { navigate('/profile', { replace: true }); return }

    if (!userId) { setLoading(false); return }

    if (isMockMode) {
      setProfile(null)
      setLoading(false)
      return
    }

    supabase.from('public_profiles').select('*').eq('id', userId).single()
      .then(({ data }) => {
        const mapped = data ? mapUser(data) : null
        if (mapped?.privacyHideProfile && !me?.isAdmin && me?.id !== mapped.id) {
          setProfile(null)
        } else {
          setProfile(mapped)
        }
        setLoading(false)
      })
  }, [userId, me, navigate])

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-paper">
        <span className="font-mono text-[11px] tracking-eyebrow text-ink-3 animate-pulse">CARREGANDO…</span>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex flex-col h-dvh items-center justify-center bg-paper gap-4">
        <p className="font-display text-3xl">PERFIL NÃO ENCONTRADO</p>
        <button onClick={() => navigate(-1)} className="btn-ghost text-[11px]">← VOLTAR</button>
      </div>
    )
  }

  const favTeam = profile.favoriteTeam ? TEAMS[profile.favoriteTeam] : undefined

  return (
    <div className="min-h-dvh bg-paper pb-24 md:pb-10">

      {/* Banner */}
      <div className="relative h-40 md:h-52 bg-ink overflow-hidden">
        {profile.bannerUrl ? (
          <button
            type="button"
            onClick={() => setViewer(profile.bannerUrl!)}
            className="block w-full h-full cursor-zoom-in"
            aria-label="Ver banner"
          >
            <img src={profile.bannerUrl} alt="" className="w-full h-full object-cover opacity-80" />
          </button>
        ) : (
          <div
            className="w-full h-full opacity-30"
            style={{ background: `linear-gradient(135deg, ${profile.color} 0%, #0D0D0D 100%)` }}
          />
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 font-mono text-[10px] text-paper/80 tracking-eyebrow bg-ink/50 hover:bg-ink/80 px-3 py-1.5 transition-colors"
        >
          ← VOLTAR
        </button>
      </div>

      <div className="app-shell">

        {/* Avatar + name row — relative z-10 ensures it paints above the positioned banner */}
        <div className="relative z-10 flex items-end justify-between -mt-10 md:-mt-12 mb-4">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 border-paper bg-paper flex-shrink-0">
            {profile.avatarUrl ? (
              <button
                type="button"
                onClick={() => setViewer(profile.avatarUrl!)}
                className="block w-full h-full cursor-zoom-in"
                aria-label="Ver foto"
              >
                <img src={profile.avatarUrl} alt={profile.firstName} className="w-full h-full object-cover" />
              </button>
            ) : (
              <Avatar initials={profile.initials} color={profile.color} size={96} />
            )}
          </div>

          {me?.id !== profile.id && (
            <Stamp color={profile.color} rotation={1} className="mb-1">
              {profile.dept || 'FIRMA'}
            </Stamp>
          )}
        </div>

        <div className="mb-4">
          <h1 className="font-display text-3xl md:text-4xl leading-none">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="font-mono text-[11px] text-ink-3 mt-1 tracking-eyebrow">{profile.dept}</p>
          {profile.bio && (
            <p className="font-sans text-[14px] text-ink-2 mt-3 leading-relaxed max-w-lg">{profile.bio}</p>
          )}
        </div>

        {/* Info grid */}
        <div className={cn(
          'grid gap-3 mb-6',
          (favTeam || profile.favoritePlayer) ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'
        )}>
          <div className="ui-card p-3 text-center">
            <div className="font-display text-3xl">—</div>
            <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow mt-0.5">PONTOS</div>
          </div>
          <div className="ui-card p-3 text-center">
            <div className="font-display text-3xl">—</div>
            <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow mt-0.5">ACERTOS</div>
          </div>
          {favTeam && (
            <div className="ui-card p-3 flex flex-col items-center gap-1">
              <Flag team={favTeam} size={28} />
              <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">TORCE POR</div>
              <div className="font-mono text-[9px] font-bold">{favTeam.name}</div>
            </div>
          )}
          {profile.favoritePlayer && (
            <div className="ui-card p-3 flex flex-col items-center justify-center text-center gap-1 overflow-hidden relative">
              {profile.favoritePlayerImg && (
                <img
                  src={profile.favoritePlayerImg}
                  alt={profile.favoritePlayer}
                  className="w-14 h-14 object-contain object-bottom"
                />
              )}
              {!profile.favoritePlayerImg && <span className="text-xl">○</span>}
              <div className="font-mono text-[9px] text-ink-4 tracking-eyebrow">FAVORITO</div>
              <div className="font-mono text-[9px] font-bold leading-tight">{profile.favoritePlayer}</div>
            </div>
          )}
        </div>

        {/* Since */}
        <p className="font-mono text-[10px] text-ink-4 tracking-eyebrow border-t border-hairline pt-4">
          NO BOLÃO DESDE {profile.since} · SUPREMA GAMING
        </p>
      </div>

      <AnimatePresence>
        {viewer && <ImageViewer url={viewer} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  )
}

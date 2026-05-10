import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from '@/components/shared/Logo'
import { Avatar } from '@/components/shared/Avatar'
import { Flag } from '@/components/shared/Flag'
import { Stamp } from '@/components/shared/Stamp'
import { useAuthStore } from '@/stores/auth.store'
import { usePredictionStore } from '@/stores/prediction.store'
import { useIsDesktop } from '@/hooks/useBreakpoint'
import { WC2026_GROUPS } from '@/data/wc2026'
import { TEAMS } from '@/data/teams'
import { getInitials } from '@/lib/utils'
import type { TeamCode } from '@/types'

const AVATAR_COLORS = [
  '#00A651', '#007A3E', '#E63946', '#1D3557',
  '#FFCB05', '#6FB4FF', '#C9A856', '#FF6600',
]

export function ProfileScreen() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <ProfileDesktop /> : <ProfileMobile />
}

function useProfileForm() {
  const { user, updateProfile, signOut } = useAuthStore()
  const { championPick, vicePick, scorerPick, clearAllPredictions } = usePredictionStore()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(user?.firstName ?? '')
  const [lastName, setLastName] = useState(user?.lastName ?? '')
  const [dept, setDept] = useState(user?.dept ?? '')
  const [avatarColor, setAvatarColor] = useState(user?.color ?? '#00A651')
  const [favoriteTeam, setFavoriteTeam] = useState<TeamCode | undefined>(user?.favoriteTeam)
  const [saving, setSaving] = useState(false)

  const initials = getInitials(`${firstName} ${lastName}`) || user?.initials || 'FS'

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ firstName, lastName, dept, color: avatarColor, initials, favoriteTeam })
    setSaving(false)
    navigate('/home')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleClearPredictions = () => {
    if (window.confirm('Apagar todos os palpites? Esta ação não pode ser desfeita.')) {
      clearAllPredictions()
    }
  }

  return {
    user,
    firstName, setFirstName,
    lastName, setLastName,
    dept, setDept,
    avatarColor, setAvatarColor,
    favoriteTeam, setFavoriteTeam,
    initials, saving,
    handleSave, handleSignOut, handleClearPredictions,
    championPick, vicePick, scorerPick,
  }
}

// ─── All 48 teams picker ──────────────────────────────────────────────────────

function AllTeamsPicker({ value, onChange }: { value?: string; onChange: (code: string) => void }) {
  return (
    <div className="border-2 border-hairline overflow-hidden">
      <div className="max-h-64 overflow-y-auto p-3 space-y-3">
        {WC2026_GROUPS.map(group => (
          <div key={group.id}>
            <p className="font-mono text-[8px] tracking-eyebrow text-ink-4 mb-1.5 sticky top-0 bg-paper py-0.5">
              GRUPO {group.id}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {group.teams.map(code => {
                const team = TEAMS[code]
                if (!team) return null
                const selected = value === code
                return (
                  <button
                    key={code}
                    onClick={() => onChange(code)}
                    className={[
                      'flex flex-col items-center gap-1 py-2 px-1 border-2 transition-colors',
                      selected ? 'border-ink bg-yellow' : 'border-transparent hover:border-hairline',
                    ].join(' ')}
                  >
                    <Flag team={team} size={22} />
                    <span className="font-mono text-[7px] font-bold">{code}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Apostas gerais summary (read-only) ──────────────────────────────────────

function ApostasGeraisSummary({
  championPick, vicePick, scorerPick,
  onEdit,
}: {
  championPick: string | null
  vicePick: string | null
  scorerPick: string | null
  onEdit: () => void
}) {
  const allSet = championPick && vicePick && scorerPick
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] tracking-eyebrow text-ink-3">APOSTAS GERAIS</p>
        <button onClick={onEdit} className="font-mono text-[10px] text-ink-4 hover:text-ink tracking-eyebrow">
          {allSet ? 'ALTERAR →' : 'FAZER →'}
        </button>
      </div>
      {allSet ? (
        <div className="grid grid-cols-3 gap-2">
          <div className="border-2 border-green/60 bg-green/5 p-2 flex flex-col items-center gap-1 text-center">
            <Flag team={TEAMS[championPick!]} size={22} />
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">CAMPEÃO</span>
            <span className="font-mono text-[8px] font-bold">{TEAMS[championPick!]?.code}</span>
          </div>
          <div className="border-2 border-hairline p-2 flex flex-col items-center gap-1 text-center">
            <Flag team={TEAMS[vicePick!]} size={22} />
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">VICE</span>
            <span className="font-mono text-[8px] font-bold">{TEAMS[vicePick!]?.code}</span>
          </div>
          <div className="border-2 border-hairline p-2 flex flex-col items-center justify-center text-center gap-0.5">
            <span className="font-mono text-[9px] font-bold leading-tight break-words">{scorerPick}</span>
            <span className="font-mono text-[7px] text-ink-3 tracking-eyebrow">ARTILHEIRO</span>
          </div>
        </div>
      ) : (
        <div className="border-2 border-hairline p-3 flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-ink-3 leading-relaxed">
            Obrigatório antes de 11 Jun. Vale +50 pts no total.
          </p>
          <button onClick={onEdit} className="btn-yellow text-[10px] px-3 py-2 flex-shrink-0">
            FAZER →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Mobile ───────────────────────────────────────────────────────────────────

function ProfileMobile() {
  const form = useProfileForm()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-paper pb-28">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-hairline">
        <Logo height={44} />
        <span className="font-mono text-[10px] tracking-eyebrow text-ink-3">MEU PERFIL</span>
      </div>

      {/* Avatar preview */}
      <div className="flex flex-col items-center py-6 border-b border-hairline bg-paper-deep">
        <Avatar initials={form.initials} color={form.avatarColor} size={72} />
        <div className="mt-3 text-center">
          <div className="font-display text-2xl leading-none">
            {form.firstName || 'NOME'} {form.lastName || 'SOBRENOME'}
          </div>
          <div className="font-mono text-[11px] text-ink-3 mt-1">{form.dept || '—'}</div>
        </div>
      </div>

      <div className="px-5 pt-5 space-y-5">

        {/* Name */}
        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">NOME</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.firstName}
              onChange={e => form.setFirstName(e.target.value)}
              placeholder="Felipe"
              className="border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none"
            />
            <input
              value={form.lastName}
              onChange={e => form.setLastName(e.target.value)}
              placeholder="Souza"
              className="border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        {/* Dept */}
        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">ÁREA NA FIRMA</label>
          <input
            value={form.dept}
            onChange={e => form.setDept(e.target.value)}
            placeholder="ex: Design, Engenharia…"
            className="w-full border-2 border-ink px-3 py-2.5 font-sans text-sm bg-transparent outline-none"
          />
        </div>

        {/* Avatar color */}
        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">COR DO AVATAR</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                onClick={() => form.setAvatarColor(c)}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: form.avatarColor === c ? '#0D0D0D' : 'transparent' }}
              />
            ))}
          </div>
        </div>

        {/* Favorite team */}
        <div>
          <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">
            TORCE POR
            {form.favoriteTeam && TEAMS[form.favoriteTeam] && (
              <span className="ml-2 text-green">· {TEAMS[form.favoriteTeam].name}</span>
            )}
          </label>
          <AllTeamsPicker value={form.favoriteTeam} onChange={form.setFavoriteTeam} />
        </div>

        {/* Apostas gerais */}
        <ApostasGeraisSummary
          championPick={form.championPick}
          vicePick={form.vicePick}
          scorerPick={form.scorerPick}
          onEdit={() => navigate('/prediction', { state: { tab: 'champion' } })}
        />

        {/* Save */}
        <button
          onClick={form.handleSave}
          disabled={form.saving}
          className="btn-yellow w-full justify-center"
        >
          {form.saving ? 'SALVANDO…' : 'SALVAR PERFIL →'}
        </button>

        {/* Clear predictions */}
        <button
          onClick={form.handleClearPredictions}
          className="w-full py-3 font-mono text-[11px] tracking-eyebrow text-ink-4 hover:text-red transition-colors border-2 border-hairline hover:border-red"
        >
          LIMPAR TODOS OS PALPITES
        </button>

        {/* Logout */}
        <button
          onClick={form.handleSignOut}
          className="w-full py-3 font-mono text-[11px] tracking-eyebrow text-ink-4 hover:text-red transition-colors border-2 border-hairline hover:border-red"
        >
          SAIR DA CONTA
        </button>
      </div>
    </div>
  )
}

// ─── Desktop ──────────────────────────────────────────────────────────────────

function ProfileDesktop() {
  const form = useProfileForm()
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-paper">
      <div className="max-w-screen-lg mx-auto px-8 py-10">

        <div className="flex items-center justify-between mb-10">
          <Logo height={56} />
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] tracking-eyebrow text-ink-3">MEU PERFIL</span>
            <button
              onClick={form.handleSignOut}
              className="font-mono text-[10px] tracking-eyebrow text-ink-4 hover:text-red transition-colors"
            >
              SAIR →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_320px] gap-10">

          {/* Form */}
          <div className="space-y-7">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">NOME</label>
                <input
                  value={form.firstName}
                  onChange={e => form.setFirstName(e.target.value)}
                  placeholder="Felipe"
                  className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">SOBRENOME</label>
                <input
                  value={form.lastName}
                  onChange={e => form.setLastName(e.target.value)}
                  placeholder="Souza"
                  className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-1.5">ÁREA NA FIRMA</label>
              <input
                value={form.dept}
                onChange={e => form.setDept(e.target.value)}
                placeholder="ex: Design, Engenharia, Marketing…"
                className="w-full border-2 border-ink px-4 py-3 font-sans text-sm bg-transparent outline-none"
              />
            </div>

            <div>
              <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">COR DO AVATAR</label>
              <div className="flex items-center gap-3">
                <Avatar initials={form.initials} color={form.avatarColor} size={52} />
                <div className="flex gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => form.setAvatarColor(c)}
                      className="w-9 h-9 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ background: c, borderColor: form.avatarColor === c ? '#0D0D0D' : '#ECE6D6' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-2">
                SELEÇÃO DO CORAÇÃO
                {form.favoriteTeam && TEAMS[form.favoriteTeam] && (
                  <span className="ml-2 text-green normal-case">· {TEAMS[form.favoriteTeam].name}</span>
                )}
              </label>
              <AllTeamsPicker value={form.favoriteTeam} onChange={form.setFavoriteTeam} />
            </div>

            {/* Apostas gerais */}
            <ApostasGeraisSummary
              championPick={form.championPick}
              vicePick={form.vicePick}
              scorerPick={form.scorerPick}
              onEdit={() => navigate('/prediction', { state: { tab: 'champion' } })}
            />

            <div className="flex gap-3">
              <button
                onClick={form.handleSave}
                disabled={form.saving}
                className="btn-yellow flex-1 justify-center text-base"
              >
                {form.saving ? 'SALVANDO…' : 'SALVAR PERFIL →'}
              </button>
              <button
                onClick={form.handleClearPredictions}
                className="btn-ghost px-4 text-[10px] text-ink-4 hover:text-red"
              >
                LIMPAR PALPITES
              </button>
              <button
                onClick={form.handleSignOut}
                className="btn-ghost px-5 text-[11px]"
              >
                SAIR
              </button>
            </div>
          </div>

          {/* Preview card */}
          <div>
            <label className="font-mono text-[10px] tracking-eyebrow text-ink-3 block mb-3">
              COMO VOCÊ APARECE
            </label>
            <motion.div
              animate={{ rotate: -1 }}
              className="bg-paper border-2 border-ink p-5 shadow-card"
            >
              <div className="flex items-center gap-3 mb-4">
                <Avatar initials={form.initials} color={form.avatarColor} size={52} />
                <div>
                  <div className="font-display text-2xl leading-none">
                    {form.firstName || 'NOME'} {form.lastName || 'SOBRENOME'}
                  </div>
                  <div className="font-mono text-[11px] text-ink-3 mt-0.5">{form.dept || 'ÁREA'}</div>
                </div>
              </div>

              <div className="border-t border-hairline pt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-display text-2xl">0</div>
                  <div className="font-mono text-[9px] text-ink-4">PTS</div>
                </div>
                <div>
                  <div className="font-display text-2xl">—</div>
                  <div className="font-mono text-[9px] text-ink-4">ACERTOS</div>
                </div>
                <div>
                  <div className="font-display text-2xl">—</div>
                  <div className="font-mono text-[9px] text-ink-4">EXATOS</div>
                </div>
              </div>

              {form.favoriteTeam && TEAMS[form.favoriteTeam] && (
                <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
                  <Flag team={TEAMS[form.favoriteTeam]} size={18} />
                  <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">
                    TORCE POR: {TEAMS[form.favoriteTeam].name.toUpperCase()}
                  </span>
                </div>
              )}

              {form.championPick && TEAMS[form.championPick] && (
                <div className="mt-2 flex items-center gap-2">
                  <Flag team={TEAMS[form.championPick]} size={18} />
                  <span className="font-mono text-[10px] text-ink-3 tracking-eyebrow">
                    CAMPEÃO: {TEAMS[form.championPick].name.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] text-green ml-auto">+25 PTS</span>
                </div>
              )}

              <div className="mt-3 flex justify-between items-center">
                <Stamp color="#6B6B66" rotation={-1}>NOVATO '26</Stamp>
                <span className="font-mono text-[10px] text-ink-4">BOLÃO DA SUPREMA</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

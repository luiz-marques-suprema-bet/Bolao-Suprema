import type { ChatProfile } from '@/stores/chat.store'

interface MentionTextProps {
  text: string
  profiles: ChatProfile[]
}

export function MentionText({ text, profiles }: MentionTextProps) {
  if (!text) return null

  const tokens = text.split(/(\s+)/)
  return (
    <p className="whitespace-pre-wrap break-words pr-7 font-sans text-[14px] leading-relaxed">
      {tokens.map((token, index) => {
        if (!token.startsWith('@')) return <span key={`${token}-${index}`}>{token}</span>
        const clean = token.slice(1).replace(/[.,!?;:]$/, '').toLocaleLowerCase('pt-BR')
        const found = profiles.find(profile => {
          const first = profile.firstName.toLocaleLowerCase('pt-BR')
          const full = `${profile.firstName} ${profile.lastName}`.trim().toLocaleLowerCase('pt-BR')
          return clean === first || clean === full
        })
        return (
          <span
            key={`${token}-${index}`}
            className="rounded bg-yellow/35 px-1 font-bold text-ink"
            title={found ? `${found.firstName} ${found.lastName}`.trim() : undefined}
          >
            {token}
          </span>
        )
      })}
    </p>
  )
}

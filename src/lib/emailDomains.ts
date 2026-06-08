const ALLOWED_EMAIL_DOMAINS = ['suprema.group', 'sx-co.com', 'agencia505.com.br', 'ilotto.com.br'] as const

export function isAllowedCorporateEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.some(domain => normalized.endsWith(`@${domain}`))
}

export function allowedCorporateDomainsLabel() {
  return ALLOWED_EMAIL_DOMAINS.map(domain => `@${domain}`).join(', ')
}

// Exceção operacional: e-mails liberados a entrar por SENHA (ex.: usuário sem
// acesso ao e-mail para receber o código OTP). Mantenha a lista curta.
// Atenção: isto é apenas UX (mostra o campo de senha a quem precisa). A garantia
// real de "só este usuário" é que apenas a conta dele tem senha definida no
// Supabase Auth — todas as outras só têm OTP e não conseguem login por senha.
const PASSWORD_LOGIN_EMAILS = ['vasco.tavares@suprema.group'] as const

export function isPasswordLoginEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return (PASSWORD_LOGIN_EMAILS as readonly string[]).includes(normalized)
}

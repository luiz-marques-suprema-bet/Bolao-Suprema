const ALLOWED_EMAIL_DOMAINS = ['suprema.group', 'sx-co.com', 'agencia505.com.br', 'ilotto.com.br'] as const

export function isAllowedCorporateEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.some(domain => normalized.endsWith(`@${domain}`))
}

export function allowedCorporateDomainsLabel() {
  return ALLOWED_EMAIL_DOMAINS.map(domain => `@${domain}`).join(', ')
}

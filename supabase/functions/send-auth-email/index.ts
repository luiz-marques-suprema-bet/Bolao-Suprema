import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
const projectUrl = Deno.env.get('SUPABASE_URL') ?? 'https://mklmnxquvslflgljhgqn.supabase.co'
const fromEmail = 'Bolao Suprema <bolao@suprema.group>'

const subjects: Record<string, string> = {
  signup: 'Seu codigo de acesso - Bolao Suprema',
  magiclink: 'Seu codigo de acesso - Bolao Suprema',
  recovery: 'Recuperacao de acesso - Bolao Suprema',
  invite: 'Convite - Bolao Suprema',
  email_change: 'Confirme seu e-mail - Bolao Suprema',
  reauthentication: 'Confirme seu acesso - Bolao Suprema',
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildVerifyUrl(emailData: Record<string, string>) {
  const params = new URLSearchParams({
    token: emailData.token_hash ?? '',
    type: emailData.email_action_type ?? 'magiclink',
    redirect_to:
      emailData.redirect_to ??
      emailData.site_url ??
      'https://luiz-marques-suprema-bet.github.io/Bolao-Suprema/',
  })

  return `${projectUrl}/auth/v1/verify?${params.toString()}`
}

function buildHtml(email: string, emailData: Record<string, string>) {
  const token = escapeHtml(emailData.token ?? '')
  const verifyUrl = buildVerifyUrl(emailData)
  const safeEmail = escapeHtml(email)

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;color:#111">
    <main style="max-width:560px;margin:0 auto;padding:28px 16px">
      <section style="background:#0d0d0d;color:#fff;padding:28px 32px;border-radius:0">
        <p style="margin:0 0 10px;color:#ffcb05;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700">Bolao Suprema 2026</p>
        <h1 style="margin:0;font-size:34px;line-height:1;text-transform:uppercase">Seu codigo de acesso</h1>
      </section>
      <section style="background:#fff;border:1px solid #e8e7e3;padding:32px">
        <p style="margin:0 0 18px;color:#555;font-size:15px;line-height:1.5">Digite este codigo na tela de login:</p>
        <div style="background:#f5f4f0;border:1px solid #ddd;padding:22px;text-align:center;margin-bottom:22px">
          <strong style="font-size:34px;letter-spacing:8px;color:#111">${token}</strong>
        </div>
        <p style="margin:0 0 20px;color:#555;font-size:14px;line-height:1.6">O codigo e de uso unico. Se preferir, voce tambem pode acessar pelo link abaixo.</p>
        <p style="margin:0 0 22px"><a href="${verifyUrl}" style="display:inline-block;background:#ffcb05;color:#111;padding:14px 22px;text-decoration:none;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:12px">Abrir Bolao</a></p>
        <p style="margin:0;color:#999;font-size:12px;line-height:1.5">Solicitado para ${safeEmail}. Se nao foi voce, ignore este e-mail.</p>
      </section>
    </main>
  </body>
</html>`
}

async function sendWithResend(message: { to: string; subject: string; html: string }) {
  let lastError = ''

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      const jitter = Math.floor(Math.random() * 900)
      await sleep(850 + attempt * 450 + jitter)
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    })

    if (response.ok) return

    const text = await response.text()
    lastError = `${response.status} ${text}`
    const retryable = response.status === 429 || text.toLowerCase().includes('too many requests')
    if (!retryable) break
  }

  throw new Error(lastError || 'Resend failed')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 405 })
  }

  try {
    if (!resendApiKey || !hookSecret) throw new Error('Missing email hook secrets')

    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const event = new Webhook(hookSecret).verify(payload, headers) as {
      user: { email: string }
      email_data: Record<string, string>
    }

    const email = event.user.email
    const action = event.email_data.email_action_type ?? 'magiclink'

    await sendWithResend({
      to: email,
      subject: subjects[action] ?? 'Bolao Suprema',
      html: buildHtml(email, event.email_data),
    })

    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('send-auth-email failed', error)
    return new Response(
      JSON.stringify({
        error: { http_code: 500, message: error instanceof Error ? error.message : 'Email hook failed' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

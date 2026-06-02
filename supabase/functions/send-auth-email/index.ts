import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'

const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY') ?? ''
const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'no-reply@ultra.bet.br'
const fromName = Deno.env.get('SENDGRID_FROM_NAME') ?? 'Bolao da Copa'
const replyToEmail = Deno.env.get('SENDGRID_REPLY_TO_EMAIL') ?? ''
const replyToName = Deno.env.get('SENDGRID_REPLY_TO_NAME') ?? fromName

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

function buildHtml(email: string, emailData: Record<string, string>) {
  const token = escapeHtml(emailData.token ?? '')
  const safeEmail = escapeHtml(email)
  const appUrl = 'https://bolao.suprema.group/#/login'

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#2c2c2c;font-family:Arial,Helvetica,sans-serif;color:#f8f8f8">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#2c2c2c;margin:0;padding:0">
      <tr>
        <td align="center" style="padding:32px 14px">
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#101010;border:1px solid #6a6a6a">
            <tr>
              <td style="padding:28px 40px 18px;background:#101010">
                <div style="font-size:18px;line-height:16px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#ffffff">Suprema Gaming</div>
                <div style="font-size:11px;line-height:14px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#ffcb05">Bolao Copa 2026</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:12px 24px;background:#008a25;color:#ffffff;font-size:11px;line-height:16px;font-weight:900;letter-spacing:3px;text-transform:uppercase">
                USA · CAN · MEX · 11 Jun - 19 Jul 2026 · 48 selecoes · 104 partidas
              </td>
            </tr>
            <tr>
              <td style="padding:44px 40px 48px;background:#101010">
                <div style="font-size:12px;line-height:14px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#ffcb05;margin-bottom:14px">Acesso exclusivo</div>
                <div style="font-size:46px;line-height:42px;font-weight:900;letter-spacing:0;text-transform:uppercase;color:#ffffff">Seu codigo<br><span style="color:#00b765">de acesso</span></div>
                <div style="font-size:14px;line-height:22px;font-style:italic;color:#a8a8a8;margin-top:14px">use em ate 10 minutos</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 40px;background:#2f2f2f;border-top:1px solid #9a9a9a">
                <div style="font-size:11px;line-height:14px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#bdbdbd;margin-bottom:16px">Codigo de verificacao</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:2px solid #c9c9c9;background:#5d5d5a">
                  <tr>
                    <td align="center" style="padding:26px 14px">
                      <div style="font-size:11px;line-height:14px;font-weight:900;letter-spacing:4px;text-transform:uppercase;color:#cfcfcf;margin-bottom:14px">Copie este codigo no app</div>
                      <div style="font-size:40px;line-height:44px;font-weight:900;letter-spacing:10px;color:#ffffff">${token}</div>
                      <div style="font-size:11px;line-height:18px;color:#cfcfcf;margin-top:10px">Expira em 10 minutos · uso unico</div>
                    </td>
                  </tr>
                </table>
                <p style="margin:26px 0 0;color:#ffffff;font-size:15px;line-height:24px">
                  Voce solicitou acesso ao <strong>Bolao Suprema 2026</strong>. Selecione o codigo acima, copie e cole na tela de login. Se nao foi voce, ignore este e-mail.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:28px 0 0;border-top:1px solid #9a9a9a;border-bottom:1px solid #4a4a4a">
                  <tr>
                    <td align="center" style="width:25%;padding:18px 6px;border-right:1px solid #777">
                      <div style="font-size:24px;line-height:26px;font-weight:900;color:#ffffff">104</div>
                      <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#d0d0d0">partidas</div>
                    </td>
                    <td align="center" style="width:25%;padding:18px 6px;border-right:1px solid #777">
                      <div style="font-size:24px;line-height:26px;font-weight:900;color:#ffffff">48</div>
                      <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#d0d0d0">selecoes</div>
                    </td>
                    <td align="center" style="width:25%;padding:18px 6px;border-right:1px solid #777">
                      <div style="font-size:24px;line-height:26px;font-weight:900;color:#ffffff">+25</div>
                      <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#d0d0d0">pts campeao</div>
                    </td>
                    <td align="center" style="width:25%;padding:18px 6px">
                      <div style="font-size:24px;line-height:26px;font-weight:900;color:#ffffff">11 Jun</div>
                      <div style="font-size:10px;line-height:14px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#d0d0d0">inicio</div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto 0">
                  <tr>
                    <td align="center" bgcolor="#b38400" style="background:#b38400">
                      <a href="${appUrl}" style="display:inline-block;padding:16px 36px;color:#ffffff;text-decoration:none;font-size:13px;line-height:16px;font-weight:900;letter-spacing:3px;text-transform:uppercase">Abrir o Bolao -></a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:30px;background:#5e5742;border-left:4px solid #ffcb05">
                  <tr>
                    <td style="padding:18px 22px;color:#ffdc55;font-size:12px;line-height:20px">
                      <strong>Atencao:</strong> nunca compartilhe este codigo. A Suprema Gaming jamais pedira seu codigo por telefone, WhatsApp ou outro canal.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 40px;background:#151515;color:#8f8f8f;font-size:11px;line-height:18px">
                Este e-mail foi enviado para <strong style="color:#ffcb05">${safeEmail}</strong> porque alguem solicitou acesso ao Bolao Suprema Copa 2026.<br>
                © 2026 Suprema Gaming & Co · Uso interno · Acesso restrito a colaboradores.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildText(email: string, emailData: Record<string, string>) {
  return `Bolao Suprema 2026

Seu codigo de acesso: ${emailData.token ?? ''}

Copie este codigo e cole na tela do Bolao.
Este e-mail nao possui link clicavel por seguranca.

Abrir o Bolao: https://bolao.suprema.group/#/login

Solicitado para ${email}. Se nao foi voce, ignore este e-mail.`
}

async function sendWithSendGrid(message: { to: string; subject: string; html: string; text: string }) {
  let lastError = ''

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) {
      const jitter = Math.floor(Math.random() * 900)
      await sleep(850 + attempt * 450 + jitter)
    }

    const payload: Record<string, unknown> = {
      personalizations: [
        {
          to: [{ email: message.to }],
          subject: message.subject,
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      content: [
        {
          type: 'text/plain',
          value: message.text,
        },
        {
          type: 'text/html',
          value: message.html,
        },
      ],
      tracking_settings: {
        click_tracking: {
          enable: false,
          enable_text: false,
        },
        open_tracking: {
          enable: false,
        },
        subscription_tracking: {
          enable: false,
        },
      },
    }

    if (replyToEmail) {
      payload.reply_to = {
        email: replyToEmail,
        name: replyToName,
      }
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) return

    const text = await response.text()
    lastError = `${response.status} ${text}`
    const retryable = response.status === 429 || response.status >= 500 || text.toLowerCase().includes('too many requests')
    if (!retryable) break
  }

  throw new Error(lastError || 'SendGrid failed')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 405 })
  }

  try {
    if (!sendgridApiKey || !hookSecret) throw new Error('Missing email hook secrets')

    const payload = await req.text()
    const headers = Object.fromEntries(req.headers)
    const event = new Webhook(hookSecret).verify(payload, headers) as {
      user: { email: string }
      email_data: Record<string, string>
    }

    const email = event.user.email
    const action = event.email_data.email_action_type ?? 'magiclink'

    const message = {
      to: email,
      subject: subjects[action] ?? 'Bolao Suprema',
      html: buildHtml(email, event.email_data),
      text: buildText(email, event.email_data),
    }

    await sendWithSendGrid(message)

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

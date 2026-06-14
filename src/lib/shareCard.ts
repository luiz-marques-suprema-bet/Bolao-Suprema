import { asset } from '@/lib/utils'

// ─── Card de "CRAVOU" pra compartilhar (Instagram/WhatsApp) ───────────────────
// PNG 1080×1920 (story). Fundo ESCURO com clima de Copa: gradiente, glows de cor,
// grão, bolas de futebol e tipografia gigante em camadas — na paleta do Bolão.
// Client-side. Imagens externas passam pelo proxy weserv (CORS).

export interface CravadaCardData {
  home: { code: string; flag?: string }
  away: { code: string; flag?: string }
  homeScore: number
  awayScore: number
  points: number
  stageLabel: string
  userName: string
  userInitials: string
  userColor: string
  userAvatarUrl?: string
  rank?: number
  className?: string
}

const W = 1080
const H = 1920

function proxied(url: string, w: number): string {
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) return url
  const clean = url.replace(/^https?:\/\//i, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean)}&w=${w}&output=png`
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) { resolve(null); return }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('400 200px "Anton"'),
      document.fonts.load('700 40px "JetBrains Mono"'),
      document.fonts.load('800 40px "Manrope"'),
    ])
    await document.fonts.ready
  } catch { /* cai pro fallback do canvas se falhar */ }
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, startPx: number, minPx: number): number {
  let px = startPx
  ctx.font = `400 ${px}px "Anton"`
  while (px > minPx && ctx.measureText(text).width > maxW) {
    px -= 4
    ctx.font = `400 ${px}px "Anton"`
  }
  return px
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Mancha de cor orgânica (glow) — gradiente radial → transparente.
function softBlob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(${rgb},${alpha})`)
  g.addColorStop(1, `rgba(${rgb},0)`)
  ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore()
}

function pentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = rot + i * (Math.PI * 2 / 5)
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

// Bola de futebol estilizada (decorativa).
function soccerBall(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
  ctx.fillStyle = '#0D0D0D'
  pentagon(ctx, cx, cy, r * 0.42, -Math.PI / 2); ctx.fill()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5)
    pentagon(ctx, cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78, r * 0.26, a + Math.PI)
    ctx.fill()
  }
  ctx.restore()
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = Math.max(2, r * 0.05)
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

// Grão de filme (textura sutil).
function grain(ctx: CanvasRenderingContext2D, count: number) {
  ctx.save()
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.045})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  ctx.restore()
}

function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, d: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(img, cx - d / 2, cy - d / 2, d, d)
  ctx.restore()
}

export async function generateCravadaCard(data: CravadaCardData): Promise<Blob> {
  await ensureFonts()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const YELLOW = '#FFCB05'
  const GREEN = '#00A651'
  const PAPER = '#F7F3E9'

  // ── Fundo escuro com profundidade ───────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0E1410')
  bg.addColorStop(0.5, '#0C0F0C')
  bg.addColorStop(1, '#0A130D')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // glows de cor — vibram no escuro
  softBlob(ctx, W * 0.92, H * 0.10, 760, '0,166,81', 0.45)   // verde topo-direita
  softBlob(ctx, W * 0.05, H * 0.80, 820, '0,166,81', 0.34)   // verde base-esquerda
  softBlob(ctx, W * 0.16, H * 0.08, 520, '255,203,5', 0.20)  // amarelo topo-esquerda
  softBlob(ctx, W * 0.92, H * 0.94, 520, '29,53,87', 0.34)   // azul canto-inferior

  // bolas de futebol decorativas (cantos)
  soccerBall(ctx, W * 0.90, H * 0.28, 66, 0.07)
  soccerBall(ctx, W * 0.10, H * 0.46, 52, 0.06)
  soccerBall(ctx, W * 0.84, H * 0.70, 44, 0.05)
  soccerBall(ctx, W * 0.16, H * 0.80, 58, 0.06)

  // listras diagonais + grão (textura)
  ctx.save()
  ctx.globalAlpha = 0.045
  ctx.strokeStyle = PAPER
  ctx.lineWidth = 8
  for (let i = -H; i < W; i += 48) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke() }
  ctx.restore()
  grain(ctx, 2400)

  // barras amarelas (moldura)
  ctx.fillStyle = YELLOW
  ctx.fillRect(0, 0, W, 14)
  ctx.fillRect(0, H - 14, W, 14)

  const cx = W / 2

  const [logo, homeFlag, awayFlag, avatar] = await Promise.all([
    loadImage(asset('assets/logo-bolao.png')),
    loadImage(proxied(data.home.flag ?? '', 240)),
    loadImage(proxied(data.away.flag ?? '', 240)),
    data.userAvatarUrl ? loadImage(proxied(data.userAvatarUrl, 240)) : Promise.resolve(null),
  ])

  // ── Logo + eyebrow ──────────────────────────────────────────────
  if (logo) {
    const lh = 104
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, cx - lw / 2, 104, lw, lh)
  } else {
    ctx.fillStyle = PAPER
    ctx.font = '400 84px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText('BOLÃO SUPREMA', cx, 196)
  }
  ctx.fillStyle = 'rgba(247,243,233,0.55)'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('C O P A   D O   M U N D O   2 0 2 6', cx, 276)

  // ── Hero "CRAVOU!" — gigante, em camada (sombra verde + amarelo) ──
  ctx.textAlign = 'center'
  fitText(ctx, 'CRAVOU!', W - 64, 320, 180) // define ctx.font; reusado nas 2 camadas
  ctx.fillStyle = GREEN
  ctx.fillText('CRAVOU!', cx + 13, 614)
  ctx.fillStyle = YELLOW
  ctx.fillText('CRAVOU!', cx, 600)
  ctx.fillStyle = 'rgba(247,243,233,0.7)'
  ctx.font = '700 30px "JetBrains Mono"'
  ctx.fillText('PLACAR EXATO · NA MOSCA', cx, 672)

  // ── Card do confronto (sticker claro com sombra-bloco amarela) ──
  const cardX = 70, cardY = 752, cardW = W - 140, cardH = 462
  ctx.fillStyle = YELLOW
  roundRect(ctx, cardX + 18, cardY + 18, cardW, cardH, 30); ctx.fill()
  ctx.fillStyle = PAPER
  roundRect(ctx, cardX, cardY, cardW, cardH, 30); ctx.fill()
  ctx.strokeStyle = '#0D0D0D'; ctx.lineWidth = 4
  roundRect(ctx, cardX, cardY, cardW, cardH, 30); ctx.stroke()

  ctx.fillStyle = '#6B6B66'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText(data.stageLabel.toUpperCase(), cx, cardY + 70)

  const flagD = 150
  const flagY = cardY + 236
  const homeFlagX = cardX + 150
  const awayFlagX = cardX + cardW - 150
  if (homeFlag) drawCircleImage(ctx, homeFlag, homeFlagX, flagY, flagD)
  if (awayFlag) drawCircleImage(ctx, awayFlag, awayFlagX, flagY, flagD)

  ctx.fillStyle = '#0D0D0D'
  ctx.font = '400 64px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(data.home.code, homeFlagX, flagY + flagD / 2 + 80)
  ctx.fillText(data.away.code, awayFlagX, flagY + flagD / 2 + 80)

  ctx.fillStyle = '#0D0D0D'
  ctx.font = '400 184px "Anton"'
  ctx.fillText(`${data.homeScore} × ${data.awayScore}`, cx, flagY + 62)

  // ── Selo de pontos ──────────────────────────────────────────────
  const pillW = 380, pillH = 116, pillY = cardY + cardH + 64
  ctx.fillStyle = GREEN
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, 58); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, 58); ctx.stroke()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '400 80px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(`+${data.points} PTS`, cx, pillY + 86)

  // ── Palpiteiro ──────────────────────────────────────────────────
  const userY = pillY + pillH + 150
  const avD = 132
  if (avatar) {
    drawCircleImage(ctx, avatar, cx, userY, avD)
  } else {
    ctx.fillStyle = data.userColor || '#777'
    ctx.beginPath(); ctx.arc(cx, userY, avD / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '400 56px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText((data.userInitials || '?').slice(0, 2).toUpperCase(), cx, userY + 20)
  }
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 8
  ctx.beginPath(); ctx.arc(cx, userY, avD / 2 + 5, 0, Math.PI * 2); ctx.stroke()

  ctx.fillStyle = PAPER
  ctx.textAlign = 'center'
  fitText(ctx, data.userName.toUpperCase(), W - 140, 74, 34)
  ctx.fillText(data.userName.toUpperCase(), cx, userY + avD / 2 + 92)

  const bits: string[] = []
  if (data.className) bits.push(data.className)
  if (data.rank) bits.push(`${data.rank}º no ranking`)
  if (bits.length) {
    ctx.fillStyle = YELLOW
    ctx.font = '700 30px "JetBrains Mono"'
    ctx.fillText(bits.join('  ·  ').toUpperCase(), cx, userY + avD / 2 + 152)
  }

  // ── Rodapé (marca, sem link) ────────────────────────────────────
  ctx.fillStyle = 'rgba(247,243,233,0.38)'
  ctx.font = '700 28px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('B O L Ã O   S U P R E M A', cx, H - 86)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem'))), 'image/png')
  })
}

// ─── Compartilhamento ─────────────────────────────────────────────────────────

export type ShareResult = 'shared' | 'downloaded' | 'error'

export async function shareCravadaCard(blob: Blob, caption: string): Promise<ShareResult> {
  const file = new File([blob], 'cravei-bolao-suprema.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  try {
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({ files: [file], text: caption })
      return 'shared'
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cravei-bolao-suprema.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return 'downloaded'
  } catch {
    return 'error'
  }
}

import { asset } from '@/lib/utils'

// ─── Card de "CRAVOU" pra compartilhar ────────────────────────────────────────
// PNG 1080×1920 (story) inspirado na identidade da Copa 2026: formas concêntricas
// coloridas (a cor sai do TIME VENCEDOR), chips de bandeira, pill de data e
// tipografia gigante. Sem foto de pessoa — grafismo puro. 100% client-side; a
// imagem é gerada só sob demanda (não fica salva em lugar nenhum).

export interface CravadaCardData {
  home: { code: string; flag?: string; color?: string }
  away: { code: string; flag?: string; color?: string }
  homeScore: number
  awayScore: number
  points: number
  stageLabel: string
  dateLabel?: string
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
  } catch { /* fallback do canvas */ }
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

// ─── cor ──────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function clamp(n: number) { return Math.max(0, Math.min(255, Math.round(n))) }
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${clamp(r + (255 - r) * amt)},${clamp(g + (255 - g) * amt)},${clamp(b + (255 - b) * amt)})`
}
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${clamp(r * (1 - amt))},${clamp(g * (1 - amt))},${clamp(b * (1 - amt))})`
}
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}
// Garante uma cor legível sobre fundo CLARO (escurece cores muito claras).
function readableOnLight(hex: string): string {
  return luminance(hex) > 0.6 ? darken(hex, 0.5) : hex
}

// Anéis concêntricos a partir de um canto (motivo da identidade da Copa).
function rings(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number, count: number, colors: string[]) {
  for (let i = 0; i < count; i++) {
    const r = maxR * (1 - i / count)
    ctx.fillStyle = colors[i % colors.length]
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawCircleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cx: number, cy: number, d: number) {
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
  ctx.drawImage(img, cx - d / 2, cy - d / 2, d, d)
  ctx.restore()
}

// Chip de bandeira retangular arredondado (estilo FIFA).
function flagChip(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
  ctx.save()
  roundRect(ctx, x, y, w, h, 10); ctx.clip()
  if (img) ctx.drawImage(img, x, y, w, h)
  else { ctx.fillStyle = '#2A2A2A'; ctx.fillRect(x, y, w, h) }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, 10); ctx.stroke()
}

export async function generateCravadaCard(data: CravadaCardData): Promise<Blob> {
  await ensureFonts()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const YELLOW = '#FFCB05'
  const GREEN = '#00A651'
  const INK = '#0D0D0D'
  const INK3 = '#6B6B66'
  const PAPER = '#F5F1E8'
  const WHITE = '#FFFCF5'

  const homeWon = data.homeScore > data.awayScore
  const awayWon = data.awayScore > data.homeScore
  const winColor = homeWon ? (data.home.color || GREEN) : awayWon ? (data.away.color || GREEN) : '#C9A856'
  const accent = readableOnLight(winColor)
  const pal = [winColor, lighten(winColor, 0.40), darken(winColor, 0.12), lighten(winColor, 0.64), lighten(winColor, 0.16)]

  // ── Fundo CLARO + anéis concêntricos (cor do vencedor) nos cantos ──
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  rings(ctx, -70, H + 70, 660, 6, pal)     // inferior esquerdo
  rings(ctx, W + 70, H + 70, 560, 5, pal)  // inferior direito
  rings(ctx, W + 90, -90, 380, 5, pal)     // superior direito
  rings(ctx, -90, -90, 320, 4, pal)        // superior esquerdo
  // scrim claro: deixa os anéis em pastel e garante a leitura do texto
  ctx.fillStyle = 'rgba(245,241,232,0.5)'
  ctx.fillRect(0, 0, W, H)
  // grão sutil
  ctx.save()
  for (let i = 0; i < 2000; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.028})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2) }
  ctx.restore()

  // Zona segura do story (a UI do Instagram cobre topo e base).
  const SAFE_TOP = 286
  const cx = W / 2

  const [logo, homeFlag, awayFlag, avatar] = await Promise.all([
    loadImage(asset('assets/logo-bolao.png')),
    loadImage(proxied(data.home.flag ?? '', 200)),
    loadImage(proxied(data.away.flag ?? '', 200)),
    data.userAvatarUrl ? loadImage(proxied(data.userAvatarUrl, 220)) : Promise.resolve(null),
  ])

  // ── Logo (centro) + eyebrow ─────────────────────────────────────
  if (logo) {
    const lh = 80
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, cx - lw / 2, SAFE_TOP, lw, lh)
  } else {
    ctx.fillStyle = INK
    ctx.font = '400 70px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText('BOLÃO SUPREMA', cx, SAFE_TOP + 66)
  }
  // ── Hero "CRAVOU!" (cor do vencedor, legível) ───────────────────
  ctx.textAlign = 'center'
  fitText(ctx, 'CRAVOU!', W - 120, 204, 110)
  ctx.fillStyle = 'rgba(13,13,13,0.14)'
  ctx.fillText('CRAVOU!', cx + 6, SAFE_TOP + 232)
  ctx.fillStyle = accent
  ctx.fillText('CRAVOU!', cx, SAFE_TOP + 226)
  ctx.fillStyle = INK3
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.fillText('PLACAR EXATO · NA MOSCA', cx, SAFE_TOP + 284)

  // ── Pill data · fase (escura, contrasta no claro) ───────────────
  const pillText = `${(data.dateLabel || '').toUpperCase()}${data.dateLabel ? '  ·  ' : ''}${data.stageLabel.toUpperCase()}`
  ctx.font = '700 24px "JetBrains Mono"'
  const pillW = Math.min(W - 160, ctx.measureText(pillText).width + 60)
  const pillY = SAFE_TOP + 324
  ctx.fillStyle = INK
  roundRect(ctx, cx - pillW / 2, pillY, pillW, 54, 27); ctx.fill()
  ctx.fillStyle = PAPER
  ctx.textAlign = 'center'
  ctx.fillText(pillText, cx, pillY + 36)

  // ── Card do placar (sticker claro, sombra-bloco na cor do time) ──
  const cardX = 70, cardW = W - 140, cardH = 340
  const cardY = pillY + 88
  ctx.fillStyle = winColor
  roundRect(ctx, cardX + 14, cardY + 14, cardW, cardH, 28); ctx.fill()
  ctx.fillStyle = WHITE
  roundRect(ctx, cardX, cardY, cardW, cardH, 28); ctx.fill()
  ctx.strokeStyle = INK; ctx.lineWidth = 4
  roundRect(ctx, cardX, cardY, cardW, cardH, 28); ctx.stroke()

  const chipW = 100, chipH = 70
  const leftX = cardX + 40
  const goalX = cardX + cardW - 44
  const drawRow = (y: number, code: string, flag: HTMLImageElement | null, goals: number, won: boolean) => {
    flagChip(ctx, flag, leftX, y - chipH / 2, chipW, chipH)
    ctx.textAlign = 'left'
    ctx.fillStyle = INK
    ctx.font = '400 84px "Anton"'
    ctx.fillText(code, leftX + chipW + 26, y + 30)
    ctx.textAlign = 'right'
    ctx.fillStyle = won ? accent : 'rgba(13,13,13,0.38)'
    ctx.font = '400 108px "Anton"'
    ctx.fillText(String(goals), goalX, y + 38)
  }
  drawRow(cardY + 106, data.home.code, homeFlag, data.homeScore, homeWon)
  ctx.strokeStyle = 'rgba(13,13,13,0.12)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(leftX, cardY + cardH / 2); ctx.lineTo(goalX, cardY + cardH / 2); ctx.stroke()
  drawRow(cardY + 234, data.away.code, awayFlag, data.awayScore, awayWon)

  // ── Selo de pontos ──────────────────────────────────────────────
  const ptW = 360, ptH = 98, ptY = cardY + cardH + 42
  ctx.fillStyle = GREEN
  roundRect(ctx, cx - ptW / 2, ptY, ptW, ptH, 49); ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '400 72px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(`+${data.points} PTS`, cx, ptY + 72)

  // ── Palpiteiro ──────────────────────────────────────────────────
  const userY = ptY + ptH + 124
  const avD = 110
  if (avatar) {
    drawCircleImage(ctx, avatar, cx, userY, avD)
  } else {
    ctx.fillStyle = data.userColor || '#777'
    ctx.beginPath(); ctx.arc(cx, userY, avD / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '400 48px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText((data.userInitials || '?').slice(0, 2).toUpperCase(), cx, userY + 18)
  }
  ctx.strokeStyle = winColor; ctx.lineWidth = 8
  ctx.beginPath(); ctx.arc(cx, userY, avD / 2 + 5, 0, Math.PI * 2); ctx.stroke()

  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  fitText(ctx, data.userName.toUpperCase(), W - 160, 66, 32)
  ctx.fillText(data.userName.toUpperCase(), cx, userY + avD / 2 + 76)

  const bits: string[] = []
  if (data.className) bits.push(data.className)
  if (data.rank) bits.push(`${data.rank}º no ranking`)
  if (bits.length) {
    ctx.fillStyle = accent
    ctx.font = '700 26px "JetBrains Mono"'
    ctx.fillText(bits.join('  ·  ').toUpperCase(), cx, userY + avD / 2 + 124)
  }

  // ── Marca (sem link) ────────────────────────────────────────────
  ctx.fillStyle = '#2A2A2A'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('B O L Ã O   S U P R E M A', cx, userY + avD / 2 + 182)

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

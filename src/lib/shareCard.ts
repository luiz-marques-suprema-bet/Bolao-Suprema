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

function grain(ctx: CanvasRenderingContext2D, count: number) {
  ctx.save()
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2)
  }
  ctx.restore()
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
  const homeWon = data.homeScore > data.awayScore
  const awayWon = data.awayScore > data.homeScore
  const winColor = homeWon ? (data.home.color || '#00A651') : awayWon ? (data.away.color || '#00A651') : '#C9A856'
  // Paleta concêntrica derivada do vencedor.
  const pal = [winColor, lighten(winColor, 0.30), darken(winColor, 0.32), lighten(winColor, 0.55), darken(winColor, 0.55)]

  // ── Fundo escuro + anéis concêntricos coloridos nos cantos ──────
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0A0E16'); bg.addColorStop(1, '#0B1118')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  rings(ctx, -80, H + 80, 1060, 6, pal)        // canto inferior esquerdo
  rings(ctx, W + 90, -90, 760, 5, pal)         // canto superior direito
  rings(ctx, W + 40, H + 40, 420, 5, pal)      // canto inferior direito (menor)

  // Scrim escuro p/ leitura do texto + grão.
  ctx.fillStyle = 'rgba(7,10,18,0.46)'
  ctx.fillRect(0, 0, W, H)
  grain(ctx, 2200)

  const cx = W / 2
  const [logo, homeFlag, awayFlag, avatar] = await Promise.all([
    loadImage(asset('assets/logo-bolao.png')),
    loadImage(proxied(data.home.flag ?? '', 200)),
    loadImage(proxied(data.away.flag ?? '', 200)),
    data.userAvatarUrl ? loadImage(proxied(data.userAvatarUrl, 220)) : Promise.resolve(null),
  ])

  // ── Topo: logo (esq) + eyebrow (dir) ────────────────────────────
  if (logo) {
    const lh = 92
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, 64, 70, lw, lh)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '700 24px "JetBrains Mono"'
  ctx.textAlign = 'right'
  ctx.fillText('COPA DO MUNDO 2026', W - 64, 128)

  // ── Hero "CRAVOU!" ──────────────────────────────────────────────
  ctx.textAlign = 'center'
  fitText(ctx, 'CRAVOU!', W - 110, 300, 150)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillText('CRAVOU!', cx + 8, 468)
  ctx.fillStyle = YELLOW
  ctx.fillText('CRAVOU!', cx, 460)
  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '700 28px "JetBrains Mono"'
  ctx.fillText('PLACAR EXATO · NA MOSCA', cx, 524)

  // ── Pill de data + fase ─────────────────────────────────────────
  const pillText = `${(data.dateLabel || '').toUpperCase()}${data.dateLabel ? '  ·  ' : ''}${data.stageLabel.toUpperCase()}`
  ctx.font = '700 26px "JetBrains Mono"'
  const pillW = Math.min(W - 160, ctx.measureText(pillText).width + 64)
  const pillX = cx - pillW / 2, pillY = 580
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, pillX, pillY, pillW, 60, 30); ctx.fill()
  ctx.fillStyle = '#0B1118'
  ctx.textAlign = 'center'
  ctx.fillText(pillText, cx, pillY + 40)

  // ── Placar / confronto (estilo placar FIFA, 2 linhas) ───────────
  const rowH = 168
  const board0 = 720
  const chipW = 104, chipH = 74
  const leftX = 96
  const goalX = W - 110

  const drawTeamRow = (y: number, code: string, flag: HTMLImageElement | null, goals: number, won: boolean) => {
    flagChip(ctx, flag, leftX, y - chipH / 2, chipW, chipH)
    ctx.textAlign = 'left'
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '400 104px "Anton"'
    ctx.fillText(code, leftX + chipW + 34, y + 36)
    // gols (cor do time vencedor; perdedor em branco suave)
    ctx.textAlign = 'right'
    ctx.fillStyle = won ? winColor : 'rgba(255,255,255,0.85)'
    ctx.font = '400 132px "Anton"'
    ctx.fillText(String(goals), goalX, y + 44)
    if (won) {
      // marcador do vencedor
      ctx.fillStyle = winColor
      ctx.beginPath(); ctx.arc(leftX - 22, y, 9, 0, Math.PI * 2); ctx.fill()
    }
  }
  drawTeamRow(board0, data.home.code, homeFlag, data.homeScore, homeWon)
  // divisor
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(leftX, board0 + rowH / 2); ctx.lineTo(goalX, board0 + rowH / 2); ctx.stroke()
  drawTeamRow(board0 + rowH, data.away.code, awayFlag, data.awayScore, awayWon)

  // ── Selo de pontos ──────────────────────────────────────────────
  const ptPillW = 360, ptPillH = 112, ptY = board0 + rowH + 150
  ctx.fillStyle = YELLOW
  roundRect(ctx, cx - ptPillW / 2, ptY, ptPillW, ptPillH, 56); ctx.fill()
  ctx.fillStyle = '#0B1118'
  ctx.font = '400 78px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(`+${data.points} PTS`, cx, ptY + 82)

  // ── Palpiteiro ──────────────────────────────────────────────────
  const userY = ptY + ptPillH + 150
  const avD = 128
  if (avatar) {
    drawCircleImage(ctx, avatar, cx, userY, avD)
  } else {
    ctx.fillStyle = data.userColor || '#777'
    ctx.beginPath(); ctx.arc(cx, userY, avD / 2, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '400 54px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText((data.userInitials || '?').slice(0, 2).toUpperCase(), cx, userY + 20)
  }
  ctx.strokeStyle = YELLOW; ctx.lineWidth = 8
  ctx.beginPath(); ctx.arc(cx, userY, avD / 2 + 5, 0, Math.PI * 2); ctx.stroke()

  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  fitText(ctx, data.userName.toUpperCase(), W - 140, 72, 34)
  ctx.fillText(data.userName.toUpperCase(), cx, userY + avD / 2 + 88)

  const bits: string[] = []
  if (data.className) bits.push(data.className)
  if (data.rank) bits.push(`${data.rank}º no ranking`)
  if (bits.length) {
    ctx.fillStyle = YELLOW
    ctx.font = '700 28px "JetBrains Mono"'
    ctx.fillText(bits.join('  ·  ').toUpperCase(), cx, userY + avD / 2 + 146)
  }

  // ── Rodapé (marca, sem link) ────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('B O L Ã O   S U P R E M A', cx, H - 80)

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

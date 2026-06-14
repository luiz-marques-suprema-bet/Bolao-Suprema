import { asset } from '@/lib/utils'

// ─── Card de "CRAVOU" pra compartilhar (Instagram/WhatsApp) ───────────────────
// Desenha um PNG 1080×1920 (formato story) na IDV do Bolão: fundo ink, amarelo,
// logo, o confronto cravado, os pontos, e o palpiteiro (nome/classe/colocação).
// Tudo client-side, sem servidor. Imagens externas passam pelo proxy weserv pra
// não "sujar" o canvas (CORS).

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

// Rota imagens externas pelo weserv (CORS *) — evita canvas "tainted". Imagens
// locais (mesma origem, sem http) passam direto.
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
  } catch { /* a fonte cai pro fallback do canvas se falhar */ }
}

// Ajusta o tamanho da fonte pra um texto caber na largura máxima (Anton).
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

  const INK = '#0D0D0D'
  const YELLOW = '#FFCB05'
  const GREEN = '#00A651'
  const PAPER = '#F5F1E8'

  // Fundo ink + listras diagonais sutis (padrão da marca) no topo direito.
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = YELLOW
  ctx.lineWidth = 10
  for (let i = -H; i < W; i += 40) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke()
  }
  ctx.restore()

  // Barra amarela no topo e na base (moldura editorial).
  ctx.fillStyle = YELLOW
  ctx.fillRect(0, 0, W, 16)
  ctx.fillRect(0, H - 16, W, 16)

  const cx = W / 2

  // Carrega imagens em paralelo.
  const [logo, homeFlag, awayFlag, avatar] = await Promise.all([
    loadImage(asset('assets/logo-bolao.png')),
    loadImage(proxied(data.home.flag ?? '', 240)),
    loadImage(proxied(data.away.flag ?? '', 240)),
    data.userAvatarUrl ? loadImage(proxied(data.userAvatarUrl, 240)) : Promise.resolve(null),
  ])

  // ── Logo + eyebrow ──────────────────────────────────────────────
  if (logo) {
    const lh = 96
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, cx - lw / 2, 110, lw, lh)
  } else {
    ctx.fillStyle = PAPER
    ctx.font = '400 84px "Anton"'
    ctx.textAlign = 'center'
    ctx.fillText('BOLÃO SUPREMA', cx, 190)
  }
  ctx.fillStyle = 'rgba(245,241,232,0.55)'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('C O P A   D O   M U N D O   2 0 2 6', cx, 268)

  // ── Hero "CRAVOU!" ──────────────────────────────────────────────
  ctx.fillStyle = YELLOW
  ctx.textAlign = 'center'
  fitText(ctx, 'CRAVOU!', W - 120, 280, 160)
  ctx.fillText('CRAVOU!', cx, 600)
  ctx.fillStyle = PAPER
  ctx.font = '700 30px "JetBrains Mono"'
  ctx.fillText('PLACAR EXATO · NA MOSCA', cx, 660)

  // ── Card do confronto ───────────────────────────────────────────
  const cardX = 70, cardY = 740, cardW = W - 140, cardH = 460
  ctx.fillStyle = '#161616'
  roundRect(ctx, cardX, cardY, cardW, cardH, 32); ctx.fill()
  ctx.strokeStyle = 'rgba(245,241,232,0.12)'; ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 32); ctx.stroke()

  // stage label
  ctx.fillStyle = 'rgba(245,241,232,0.5)'
  ctx.font = '700 26px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText(data.stageLabel.toUpperCase(), cx, cardY + 70)

  // bandeiras + placar
  const flagD = 150
  const flagY = cardY + 235
  const homeFlagX = cardX + 150
  const awayFlagX = cardX + cardW - 150
  if (homeFlag) drawCircleImage(ctx, homeFlag, homeFlagX, flagY, flagD)
  if (awayFlag) drawCircleImage(ctx, awayFlag, awayFlagX, flagY, flagD)

  ctx.fillStyle = PAPER
  ctx.font = '400 64px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(data.home.code, homeFlagX, flagY + flagD / 2 + 80)
  ctx.fillText(data.away.code, awayFlagX, flagY + flagD / 2 + 80)

  // placar grande no centro
  ctx.fillStyle = YELLOW
  ctx.font = '400 180px "Anton"'
  ctx.fillText(`${data.homeScore} × ${data.awayScore}`, cx, flagY + 60)

  // ── Selo de pontos ──────────────────────────────────────────────
  const pillW = 360, pillH = 110, pillY = cardY + cardH + 60
  ctx.fillStyle = GREEN
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, 55); ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '400 78px "Anton"'
  ctx.textAlign = 'center'
  ctx.fillText(`+${data.points} PTS`, cx, pillY + 82)

  // ── Palpiteiro ──────────────────────────────────────────────────
  const userY = pillY + pillH + 150
  const avD = 130
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
  ctx.fillStyle = PAPER
  ctx.textAlign = 'center'
  fitText(ctx, data.userName.toUpperCase(), W - 160, 72, 34)
  ctx.fillText(data.userName.toUpperCase(), cx, userY + avD / 2 + 90)

  // classe + colocação
  const bits: string[] = []
  if (data.className) bits.push(data.className)
  if (data.rank) bits.push(`${data.rank}º no ranking`)
  if (bits.length) {
    ctx.fillStyle = YELLOW
    ctx.font = '700 30px "JetBrains Mono"'
    ctx.fillText(bits.join('  ·  ').toUpperCase(), cx, userY + avD / 2 + 150)
  }

  // ── Rodapé ──────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(245,241,232,0.55)'
  ctx.font = '700 30px "JetBrains Mono"'
  ctx.textAlign = 'center'
  ctx.fillText('bolao.suprema.group', cx, H - 90)

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
    // usuário cancelou o share → não é erro de verdade
    if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
  }
  // Fallback: baixa a imagem.
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

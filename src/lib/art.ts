/**
 * Generative renderers for the Night Archive.
 *
 * Every work is drawn deterministically from a seed onto a canvas and exported
 * as a blob URL, so the archive never depends on a remote image host and can
 * never show a broken image.
 */

export type ArtStyle =
  | 'trails'
  | 'tower'
  | 'ridges'
  | 'topo'
  | 'facade'
  | 'sea'
  | 'bokeh'
  | 'type'
  | 'glitch'
  | 'garage'
  | 'haze'
  | 'phases'

type Ctx = CanvasRenderingContext2D
type Rand = () => number
type Renderer = (c: Ctx, w: number, h: number, r: Rand) => void

const INK = '#090909'
const BONE = '#F1F0E8'
const ACID = '#C7FF3D'
const SODIUM = '#FF7A2F'
const RED = '#FF3B2F'
const DISPLAY = '"Big Shoulders Display", "Arial Narrow", Impact, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

function seeded(seed: number): Rand {
  let s = seed * 9301 + 49297
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Smooth 1D noise from summed sines with random phases. */
function wave1d(r: Rand, octaves = 4) {
  const parts = Array.from({ length: octaves }, (_, i) => ({
    f: (i + 1) * (1.3 + r()) * Math.pow(1.9, i),
    p: r() * Math.PI * 2,
    a: Math.pow(0.52, i),
  }))
  const norm = parts.reduce((s, p) => s + p.a, 0)
  return (x: number) => parts.reduce((s, p) => s + Math.sin(x * p.f + p.p) * p.a, 0) / norm
}

/** 2D value noise with smoothstep interpolation. */
function noise2d(r: Rand, size = 64) {
  const grid = Array.from({ length: size * size }, () => r())
  const at = (x: number, y: number) => grid[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const tx = sm(x - xi)
    const ty = sm(y - yi)
    const a = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * tx
    const b = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * tx
    return a + (b - a) * ty
  }
}

function grain(c: Ctx, w: number, h: number, r: Rand, amount = 22) {
  const img = c.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  c.putImageData(img, 0, 0)
}

function vignette(c: Ctx, w: number, h: number, strength = 0.6) {
  const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
}

function glow(c: Ctx, x: number, y: number, radius: number, color: string, alpha = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, radius)
  g.addColorStop(0, withAlpha(color, alpha))
  g.addColorStop(0.25, withAlpha(color, alpha * 0.35))
  g.addColorStop(1, withAlpha(color, 0))
  c.fillStyle = g
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function skyGradient(c: Ctx, w: number, h: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, 0, 0, h)
  for (const [o, col] of stops) g.addColorStop(o, col)
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
}

// ─── Renderers ──────────────────────────────────────────────────────────────

const trails: Renderer = (c, w, h, r) => {
  skyGradient(c, w, h, [
    [0, '#07080b'],
    [0.5, '#120c09'],
    [0.56, '#1a0f08'],
    [1, '#050505'],
  ])
  const vx = w * 0.72
  const vy = h * 0.52
  // street lamps receding
  for (let i = 0; i < 9; i++) {
    const t = Math.pow(i / 9, 1.6)
    const x = w * 0.02 + (vx - w * 0.02) * t
    const top = h * 0.12 + (vy - h * 0.12 - 30) * t
    c.strokeStyle = 'rgba(30,24,20,0.9)'
    c.lineWidth = Math.max(1, 8 * (1 - t))
    c.beginPath()
    c.moveTo(x, h)
    c.lineTo(x, top)
    c.stroke()
    glow(c, x + 14 * (1 - t), top, 120 * (1 - t) + 20, SODIUM, 0.9)
  }
  c.globalCompositeOperation = 'lighter'
  const lanes = [
    { col: '#ffd7a8', n: 34, off: -0.12 },
    { col: SODIUM, n: 26, off: 0.02 },
    { col: RED, n: 38, off: 0.16 },
    { col: '#ff2a1f', n: 20, off: 0.3 },
  ]
  for (const lane of lanes) {
    for (let i = 0; i < lane.n; i++) {
      const spread = (r() - 0.5) * 0.06 + lane.off
      c.strokeStyle = withAlpha(lane.col, 0.08 + r() * 0.25)
      c.lineWidth = 0.6 + r() * 2.4
      c.shadowColor = lane.col
      c.shadowBlur = 8
      c.beginPath()
      c.moveTo(-20, h * (0.82 + spread * 1.8))
      c.bezierCurveTo(w * 0.3, h * (0.74 + spread), w * 0.55, h * (0.6 + spread * 0.4), vx, vy + spread * 12)
      c.stroke()
    }
  }
  c.shadowBlur = 0
  c.globalCompositeOperation = 'source-over'
  vignette(c, w, h, 0.7)
  grain(c, w, h, r, 26)
}

const tower: Renderer = (c, w, h, r) => {
  skyGradient(c, w, h, [
    [0, '#05070c'],
    [0.7, '#0d1117'],
    [1, '#16130f'],
  ])
  // haze stars
  for (let i = 0; i < 70; i++) {
    c.fillStyle = `rgba(241,240,232,${r() * 0.35})`
    c.fillRect(r() * w, r() * h * 0.6, 1.2, 1.2)
  }
  const tx = w * 0.34
  const tw = w * 0.36
  const top = h * 0.14
  // tower body with subtle vertical gradient
  const body = c.createLinearGradient(tx, 0, tx + tw, 0)
  body.addColorStop(0, '#111214')
  body.addColorStop(0.5, '#17181a')
  body.addColorStop(1, '#0c0c0d')
  c.fillStyle = body
  c.fillRect(tx, top, tw, h - top)
  // crown and mast
  c.fillStyle = '#0e0f10'
  c.fillRect(tx + tw * 0.2, top - h * 0.03, tw * 0.6, h * 0.03)
  c.fillRect(tx + tw * 0.48, top - h * 0.1, 3, h * 0.07)
  glow(c, tx + tw * 0.48 + 1.5, top - h * 0.1, 60, RED, 1)
  c.fillStyle = '#ff6a5a'
  c.fillRect(tx + tw * 0.48 - 1, top - h * 0.1 - 2, 6, 5)
  // windows
  const cols = 9
  const rows = 44
  const gx = tw / cols
  const gy = (h - top - h * 0.02) / rows
  const lit = new Set<number>()
  while (lit.size < 6) lit.add(Math.floor(r() * cols * rows))
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const k = y * cols + x
      const px = tx + x * gx + gx * 0.18
      const py = top + h * 0.01 + y * gy + gy * 0.22
      if (lit.has(k)) {
        glow(c, px + gx * 0.3, py + gy * 0.3, gx * 1.6, '#f6dca0', 0.35)
        c.fillStyle = '#f6e3b4'
      } else {
        c.fillStyle = `rgba(40,42,46,${0.25 + r() * 0.25})`
      }
      c.fillRect(px, py, gx * 0.64, gy * 0.56)
    }
  }
  // neighbouring blocks
  for (const [x0, bw, bh] of [
    [0, w * 0.22, h * 0.32],
    [w * 0.74, w * 0.3, h * 0.4],
    [w * 0.18, w * 0.18, h * 0.22],
  ]) {
    c.fillStyle = '#0a0a0b'
    c.fillRect(x0, h - bh, bw, bh)
    for (let i = 0; i < 6; i++) {
      if (r() < 0.5) continue
      c.fillStyle = r() < 0.2 ? ACID : '#e9d29a'
      c.fillRect(x0 + r() * bw * 0.9, h - bh + r() * bh * 0.9, 4, 3)
    }
  }
  vignette(c, w, h, 0.5)
  grain(c, w, h, r, 20)
}

const ridges: Renderer = (c, w, h, r) => {
  skyGradient(c, w, h, [
    [0, '#06080a'],
    [0.55, '#10151a'],
    [1, '#090909'],
  ])
  const mx = w * (0.62 + r() * 0.2)
  const my = h * 0.24
  glow(c, mx, my, h * 0.6, '#dfe6e8', 0.14)
  c.fillStyle = '#ecebe3'
  c.beginPath()
  c.arc(mx, my, h * 0.055, 0, Math.PI * 2)
  c.fill()
  const layers = 7
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1)
    const n = wave1d(r, 5)
    const base = h * (0.42 + t * 0.42)
    const amp = h * (0.06 + t * 0.07)
    c.beginPath()
    c.moveTo(0, h)
    for (let x = 0; x <= w; x += 3) c.lineTo(x, base + n(x / w + i * 0.37) * amp)
    c.lineTo(w, h)
    c.closePath()
    const shade = Math.round(28 - t * 22)
    const g = c.createLinearGradient(0, base - amp, 0, h)
    g.addColorStop(0, `rgb(${shade + 4},${shade + 8},${shade + 12})`)
    g.addColorStop(1, `rgb(${shade - 2},${shade},${shade + 2})`)
    c.fillStyle = g
    c.fill()
    c.strokeStyle = `rgba(241,240,232,${0.06 + (1 - t) * 0.18})`
    c.lineWidth = 1
    c.stroke()
    // mist between layers
    const mist = c.createLinearGradient(0, base - amp * 0.2, 0, base + amp * 1.4)
    mist.addColorStop(0, 'rgba(160,175,185,0.07)')
    mist.addColorStop(1, 'rgba(160,175,185,0)')
    c.fillStyle = mist
    c.fillRect(0, base - amp, w, amp * 2.4)
  }
  grain(c, w, h, r, 18)
}

const topo: Renderer = (c, w, h, r) => {
  c.fillStyle = '#0b0b0b'
  c.fillRect(0, 0, w, h)
  const n = noise2d(r)
  const eyes = [
    { x: 0.32 + r() * 0.1, y: 0.38 + r() * 0.1, s: 0.9 },
    { x: 0.66 + r() * 0.1, y: 0.62 + r() * 0.1, s: -0.7 },
  ]
  const field = (x: number, y: number) => {
    let v = n(x * 3.2, y * 3.2) * 0.55 + n(x * 7 + 20, y * 7 + 20) * 0.18
    for (const e of eyes) v += e.s * Math.exp(-((x - e.x) ** 2 + (y - e.y) ** 2) / 0.025)
    return v
  }
  const res = 4
  const gw = Math.ceil(w / res) + 1
  const gh = Math.ceil(h / res) + 1
  const vals = new Float32Array(gw * gh)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) vals[j * gw + i] = field((i * res) / w, (j * res) / w)
  const levels = 34
  let min = Infinity
  let max = -Infinity
  for (const v of vals) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  const hot = Math.floor(levels * 0.8)
  for (let l = 1; l < levels; l++) {
    const iso = min + ((max - min) * l) / levels
    c.strokeStyle = l === hot ? ACID : `rgba(241,240,232,${l % 5 === 0 ? 0.6 : 0.22})`
    c.lineWidth = l === hot ? 1.6 : l % 5 === 0 ? 1.1 : 0.7
    c.beginPath()
    for (let j = 0; j < gh - 1; j++) {
      for (let i = 0; i < gw - 1; i++) {
        const a = vals[j * gw + i]
        const b = vals[j * gw + i + 1]
        const cc = vals[(j + 1) * gw + i + 1]
        const d = vals[(j + 1) * gw + i]
        const pts: [number, number][] = []
        const edge = (v0: number, v1: number, x0: number, y0: number, x1: number, y1: number) => {
          if (v0 < iso !== v1 < iso) {
            const t = (iso - v0) / (v1 - v0)
            pts.push([(x0 + (x1 - x0) * t) * res, (y0 + (y1 - y0) * t) * res])
          }
        }
        edge(a, b, i, j, i + 1, j)
        edge(b, cc, i + 1, j, i + 1, j + 1)
        edge(d, cc, i, j + 1, i + 1, j + 1)
        edge(a, d, i, j, i, j + 1)
        for (let p = 0; p + 1 < pts.length; p += 2) {
          c.moveTo(pts[p][0], pts[p][1])
          c.lineTo(pts[p + 1][0], pts[p + 1][1])
        }
      }
    }
    c.stroke()
  }
  const e = eyes[0]
  glow(c, e.x * w, e.y * w, w * 0.08, ACID, 0.5)
  c.fillStyle = ACID
  c.beginPath()
  c.arc(e.x * w, e.y * w, 4, 0, Math.PI * 2)
  c.fill()
  c.font = `500 ${Math.round(w * 0.016)}px ${MONO}`
  c.fillStyle = 'rgba(241,240,232,0.7)'
  c.fillText(`${(e.x * 90).toFixed(2)}°N  ${(e.y * 180).toFixed(2)}°W`, e.x * w + 14, e.y * w - 10)
  grain(c, w, h, r, 14)
}

const facade: Renderer = (c, w, h, r) => {
  c.fillStyle = '#141412'
  c.fillRect(0, 0, w, h)
  const cols = 9
  const rows = 13
  const bw = w / cols
  const bh = h / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * bw
      const py = y * bh
      // concrete frame with stains
      const tone = 18 + r() * 8
      c.fillStyle = `rgb(${tone},${tone},${tone - 2})`
      c.fillRect(px, py, bw, bh)
      c.fillStyle = 'rgba(0,0,0,0.35)'
      c.fillRect(px, py + bh * 0.82, bw, bh * 0.18)
      const wx = px + bw * 0.16
      const wy = py + bh * 0.14
      const ww = bw * 0.68
      const wh = bh * 0.6
      const roll = r()
      if (roll < 0.06) {
        const g = c.createLinearGradient(wx, wy, wx, wy + wh)
        g.addColorStop(0, '#f8e2a6')
        g.addColorStop(1, '#c98a3c')
        c.fillStyle = g
        c.fillRect(wx, wy, ww, wh)
        glow(c, wx + ww / 2, wy + wh / 2, bw * 0.9, '#f8d48a', 0.18)
        c.fillStyle = 'rgba(20,14,8,0.55)'
        c.fillRect(wx + ww * (0.55 + r() * 0.2), wy, ww * 0.25, wh)
      } else if (roll < 0.075) {
        c.fillStyle = ACID
        c.fillRect(wx, wy, ww, wh)
        glow(c, wx + ww / 2, wy + wh / 2, bw * 1.1, ACID, 0.22)
      } else if (roll < 0.11) {
        c.fillStyle = '#16232b'
        c.fillRect(wx, wy, ww, wh)
        c.fillStyle = 'rgba(120,170,200,0.15)'
        c.fillRect(wx, wy + wh * 0.3, ww, wh * 0.4)
      } else {
        c.fillStyle = '#070707'
        c.fillRect(wx, wy, ww, wh)
      }
    }
  }
  // vertical weathering
  for (let i = 0; i < 40; i++) {
    const x = r() * w
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${0.08 + r() * 0.1})`)
    c.fillStyle = g
    c.fillRect(x, 0, 2 + r() * 10, h)
  }
  vignette(c, w, h, 0.55)
  grain(c, w, h, r, 30)
}

const sea: Renderer = (c, w, h, r) => {
  const horizon = h * 0.46
  skyGradient(c, w, h, [
    [0, '#05070a'],
    [0.46, '#11181c'],
    [0.461, '#070a0c'],
    [1, '#030303'],
  ])
  const mx = w * 0.58
  const my = h * 0.16
  glow(c, mx, my, w * 0.3, '#e9eee6', 0.12)
  c.fillStyle = '#efeee6'
  c.beginPath()
  c.arc(mx, my, w * 0.022, 0, Math.PI * 2)
  c.fill()
  // reflection
  let y = horizon + 2
  let gap = 1.5
  while (y < h) {
    const depth = (y - horizon) / (h - horizon)
    const width = w * (0.02 + depth * 0.22)
    for (let k = 0; k < 3; k++) {
      const off = (r() - 0.5) * width * 1.6
      const len = width * (0.1 + r() * 0.5)
      const a = Math.max(0, 0.75 - Math.abs(off) / width) * (0.4 + r() * 0.6)
      c.fillStyle = `rgba(239,238,230,${a})`
      c.fillRect(mx + off - len / 2, y, len, Math.max(1, gap * 0.35))
    }
    // ambient swell lines
    c.fillStyle = `rgba(150,180,190,${0.04 + depth * 0.05})`
    for (let k = 0; k < 4; k++) c.fillRect(r() * w, y, w * (0.05 + r() * 0.15), 1)
    gap *= 1.045
    y += gap
  }
  c.fillStyle = 'rgba(241,240,232,0.2)'
  c.fillRect(0, horizon, w, 1)
  vignette(c, w, h, 0.5)
  grain(c, w, h, r, 20)
}

const bokeh: Renderer = (c, w, h, r) => {
  c.fillStyle = '#070707'
  c.fillRect(0, 0, w, h)
  const band = c.createLinearGradient(0, h * 0.3, 0, h * 0.8)
  band.addColorStop(0, 'rgba(255,122,47,0)')
  band.addColorStop(0.5, 'rgba(255,122,47,0.08)')
  band.addColorStop(1, 'rgba(255,122,47,0)')
  c.fillStyle = band
  c.fillRect(0, 0, w, h)
  c.globalCompositeOperation = 'lighter'
  const cols = ['#ffb36b', '#ffb36b', SODIUM, '#fff3dc', RED, '#7fe3da']
  for (let i = 0; i < 70; i++) {
    const x = r() * w
    const y = h * (0.25 + r() * 0.6)
    const rad = w * (0.015 + Math.pow(r(), 2) * 0.09)
    const col = i === 7 ? ACID : cols[Math.floor(r() * cols.length)]
    const a = 0.12 + r() * 0.25
    const g = c.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, withAlpha(col, a * 0.7))
    g.addColorStop(0.82, withAlpha(col, a))
    g.addColorStop(0.92, withAlpha(col, a * 1.4))
    g.addColorStop(1, withAlpha(col, 0))
    c.fillStyle = g
    c.beginPath()
    c.arc(x, y, rad, 0, Math.PI * 2)
    c.fill()
  }
  c.globalCompositeOperation = 'source-over'
  vignette(c, w, h, 0.6)
  grain(c, w, h, r, 24)
}

const type: Renderer = (c, w, h, r) => {
  c.fillStyle = BONE
  c.fillRect(0, 0, w, h)
  c.fillStyle = INK
  c.textBaseline = 'alphabetic'
  // masthead
  c.font = `900 ${Math.round(h * 0.42)}px ${DISPLAY}`
  c.fillText('AFTER', -w * 0.04, h * 0.4)
  c.font = `900 ${Math.round(h * 0.42)}px ${DISPLAY}`
  c.fillText('00', w * 0.46, h * 0.86)
  // rules + labels
  c.fillRect(w * 0.05, h * 0.46, w * 0.9, 2)
  c.font = `500 ${Math.round(w * 0.024)}px ${MONO}`
  c.fillText('ISSUE 00 — INSOMNIA', w * 0.05, h * 0.5)
  c.fillText('AUTUMN / WINTER 2026', w * 0.05, h * 0.53)
  c.fillText('PRINTED BETWEEN 00:00 AND 06:00', w * 0.05, h * 0.56)
  c.font = `italic 400 ${Math.round(w * 0.07)}px "Instrument Serif", Georgia, serif`
  c.fillText('the quiet', w * 0.05, h * 0.67)
  c.fillText('hours', w * 0.05, h * 0.73)
  // barcode
  let x = w * 0.05
  while (x < w * 0.32) {
    const bw = 1 + Math.floor(r() * 4)
    if (r() > 0.4) c.fillRect(x, h * 0.86, bw, h * 0.08)
    x += bw + 1
  }
  // sticker
  const sx = w * 0.78
  const sy = h * 0.58
  c.fillStyle = ACID
  c.beginPath()
  c.arc(sx, sy, w * 0.11, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = INK
  c.textAlign = 'center'
  c.font = `900 ${Math.round(w * 0.06)}px ${DISPLAY}`
  c.fillText('NO', sx, sy - w * 0.005)
  c.fillText('SLEEP', sx, sy + w * 0.05)
  c.textAlign = 'left'
  grain(c, w, h, r, 16)
}

const glitch: Renderer = (c, w, h, r) => {
  // base: a soft abstract landscape
  skyGradient(c, w, h, [
    [0, '#0a0c10'],
    [0.6, '#1c1712'],
    [1, '#070707'],
  ])
  glow(c, w * 0.3, h * 0.55, w * 0.4, SODIUM, 0.3)
  glow(c, w * 0.75, h * 0.4, w * 0.3, '#3FD6C8', 0.18)
  // colour bars partially
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']
  const top = h * 0.12
  const bh = h * 0.18
  bars.forEach((col, i) => {
    c.fillStyle = withAlpha(col, 0.35)
    c.fillRect(w * 0.52 + (i * w * 0.4) / bars.length, top, (w * 0.4) / bars.length, bh)
  })
  c.font = `900 ${Math.round(h * 0.34)}px ${DISPLAY}`
  c.fillStyle = 'rgba(241,240,232,0.85)'
  c.fillText('04:00', w * 0.06, h * 0.78)
  // horizontal slice displacement
  const img = c.getImageData(0, 0, w, h)
  const src = new Uint8ClampedArray(img.data)
  let y = 0
  while (y < h) {
    const sh = 2 + Math.floor(r() * 28)
    const shift = r() < 0.35 ? Math.floor((r() - 0.5) * w * 0.18) : 0
    const split = r() < 0.5 ? Math.floor(4 + r() * 10) : 0
    for (let yy = y; yy < Math.min(h, y + sh); yy++) {
      for (let x = 0; x < w; x++) {
        const di = (yy * w + x) * 4
        const sx = (((x - shift) % w) + w) % w
        const si = (yy * w + sx) * 4
        const si2 = (yy * w + ((((sx - split) % w) + w) % w)) * 4
        img.data[di] = src[si2]
        img.data[di + 1] = src[si + 1]
        img.data[di + 2] = src[si + 2]
      }
    }
    y += sh
  }
  c.putImageData(img, 0, 0)
  // scanlines + accents
  c.fillStyle = 'rgba(0,0,0,0.32)'
  for (let s = 0; s < h; s += 3) c.fillRect(0, s, w, 1)
  for (let i = 0; i < 5; i++) {
    c.fillStyle = r() < 0.5 ? ACID : RED
    c.fillRect(r() * w, r() * h, w * (0.05 + r() * 0.2), 2 + r() * 4)
  }
  grain(c, w, h, r, 22)
}

const garage: Renderer = (c, w, h, r) => {
  c.fillStyle = '#0c0c0c'
  c.fillRect(0, 0, w, h)
  const vx = w * 0.5
  const vy = h * 0.42
  const project = (x: number, y: number, z: number) => [vx + (x * w * 0.5) / z, vy + (y * h * 0.5) / z]
  // ceiling & floor gradient
  const ceil = c.createLinearGradient(0, 0, 0, vy)
  ceil.addColorStop(0, '#2a2a28')
  ceil.addColorStop(1, '#0d0d0d')
  c.fillStyle = ceil
  c.fillRect(0, 0, w, vy)
  const floor = c.createLinearGradient(0, vy, 0, h)
  floor.addColorStop(0, '#0d0d0d')
  floor.addColorStop(1, '#1e1d1a')
  c.fillStyle = floor
  c.fillRect(0, vy, w, h - vy)
  // fluorescent tubes
  for (let z = 0.75; z < 26; z += 1.3) {
    for (const lx of [-0.5, 0.5]) {
      const [x1, y1] = project(lx - 0.18, -0.95, z)
      const [x2] = project(lx + 0.18, -0.95, z)
      const thick = Math.max(1, 10 / z)
      const flicker = z > 8 && r() < 0.12 ? 0.25 : 1
      glow(c, (x1 + x2) / 2, y1, (x2 - x1) * 0.9, '#e8f4ef', 0.12 * flicker)
      c.fillStyle = withAlpha('#f4fbf6', flicker)
      c.fillRect(x1, y1, x2 - x1, thick)
    }
  }
  // pillars
  for (let k = 9; k >= 0; k--) {
    const z = 0.9 + k * 2.6
    for (const side of [-1, 1]) {
      const [x1, y1] = project(side * 1.05, -1, z)
      const [x2, y2] = project(side * 1.05 + side * 0.22, 1.1, z)
      const shade = Math.max(10, 40 - z * 2)
      c.fillStyle = `rgb(${shade},${shade},${shade - 2})`
      c.fillRect(Math.min(x1, x2), y1, Math.abs(x2 - x1), y2 - y1)
      if (k === 1 && side === 1) {
        const pw = Math.abs(x2 - x1)
        c.fillStyle = ACID
        c.fillRect(Math.min(x1, x2), y1 + (y2 - y1) * 0.35, pw, pw * 0.8)
        c.fillStyle = INK
        c.font = `900 ${Math.round(pw * 0.6)}px ${DISPLAY}`
        c.textAlign = 'center'
        c.fillText('−2', Math.min(x1, x2) + pw / 2, y1 + (y2 - y1) * 0.35 + pw * 0.62)
        c.textAlign = 'left'
      }
    }
  }
  // lane markings
  c.fillStyle = 'rgba(241,240,232,0.55)'
  for (let z = 1; z < 26; z += 1.2) {
    const [x1, y1] = project(-0.02, 1, z)
    const [, y2] = project(-0.02, 1, z + 0.6)
    const lw = Math.max(1, 14 / z)
    c.fillRect(x1 - lw / 2, y2, lw, y1 - y2)
  }
  vignette(c, w, h, 0.65)
  grain(c, w, h, r, 26)
}

const haze: Renderer = (c, w, h, r) => {
  skyGradient(c, w, h, [
    [0, '#0d0b09'],
    [0.6, '#1c1712'],
    [1, '#0b0a09'],
  ])
  const lx = w * 0.62
  const ly = h * 0.3
  // light cone
  const cone = c.createLinearGradient(0, ly, 0, h)
  cone.addColorStop(0, 'rgba(255,190,120,0.28)')
  cone.addColorStop(1, 'rgba(255,190,120,0)')
  c.fillStyle = cone
  c.beginPath()
  c.moveTo(lx - 6, ly)
  c.lineTo(lx - w * 0.38, h)
  c.lineTo(lx + w * 0.34, h)
  c.lineTo(lx + 6, ly)
  c.fill()
  glow(c, lx, ly, w * 0.75, '#ffb46e', 0.32)
  glow(c, lx, ly, w * 0.14, '#fff1d8', 0.9)
  // fog wisps
  const n = noise2d(r)
  const img = c.getImageData(0, 0, w, h)
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const f = n(x / 140, y / 70) * 26 - 8
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        const i = ((y + dy) * w + x + dx) * 4
        if (i >= img.data.length) continue
        img.data[i] += f
        img.data[i + 1] += f * 0.9
        img.data[i + 2] += f * 0.8
      }
    }
  }
  c.putImageData(img, 0, 0)
  // post
  c.fillStyle = '#060606'
  c.fillRect(lx + w * 0.05, ly - 6, 6, h)
  c.fillRect(lx - 10, ly - 12, w * 0.05 + 16, 5)
  c.fillRect(lx - 14, ly - 8, 28, 8)
  // ground
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, h * 0.92, w, h * 0.08)
  vignette(c, w, h, 0.6)
  grain(c, w, h, r, 34)
}

const phases: Renderer = (c, w, h, r) => {
  c.fillStyle = '#0b0b0a'
  c.fillRect(0, 0, w, h)
  const cols = 6
  const rows = 5
  const mx = w * 0.08
  const cw = (w - mx * 2) / cols
  const ch = (h - mx * 2.2) / rows
  const marked = 3 + Math.floor(r() * 24)
  c.font = `500 ${Math.round(w * 0.015)}px ${MONO}`
  c.fillStyle = 'rgba(241,240,232,0.55)'
  c.fillText('INDEX OF NIGHTS — 30 OBSERVATIONS', mx, mx * 0.7)
  for (let i = 0; i < 30; i++) {
    const cx = mx + (i % cols) * cw + cw / 2
    const cy = mx * 1.2 + Math.floor(i / cols) * ch + ch * 0.42
    const rad = Math.min(cw, ch) * 0.3
    const phase = i / 29.53
    c.fillStyle = '#1c1c1a'
    c.beginPath()
    c.arc(cx, cy, rad, 0, Math.PI * 2)
    c.fill()
    // lit portion: half disc + terminator ellipse
    const lit = Math.cos(phase * Math.PI * 2)
    const waxing = phase < 0.5
    c.fillStyle = BONE
    c.beginPath()
    c.arc(cx, cy, rad, -Math.PI / 2, Math.PI / 2, !waxing)
    c.ellipse(cx, cy, Math.abs(lit) * rad, rad, 0, Math.PI / 2, -Math.PI / 2, lit > 0 ? waxing : !waxing)
    c.fill()
    if (i === marked) {
      c.strokeStyle = ACID
      c.lineWidth = 2
      c.beginPath()
      c.arc(cx, cy, rad + 9, 0, Math.PI * 2)
      c.stroke()
    }
    c.fillStyle = i === marked ? ACID : 'rgba(241,240,232,0.5)'
    c.fillText(String(i + 1).padStart(2, '0'), cx - rad, cy + rad + 22)
  }
  grain(c, w, h, r, 14)
}

const RENDERERS: Record<ArtStyle, Renderer> = {
  trails,
  tower,
  ridges,
  topo,
  facade,
  sea,
  bokeh,
  type,
  glitch,
  garage,
  haze,
  phases,
}

// ─── Public API ─────────────────────────────────────────────────────────────

const cache = new Map<string, Promise<string>>()
let queue: Promise<unknown> = Promise.resolve()

const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 16))

async function fontsReady() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load(`900 100px ${DISPLAY}`),
      document.fonts.load(`500 20px ${MONO}`),
      document.fonts.load(`italic 400 40px "Instrument Serif"`),
    ])
  } catch {
    // fall back to whatever is available; renderers use font stacks
  }
}

/**
 * Renders a work once and returns a blob URL. Calls are serialised with a
 * frame gap between them so rendering never blocks scrolling for long.
 */
export function renderArtwork(id: string, style: ArtStyle, seed: number, ratio: number, width = 960): Promise<string> {
  const key = `${id}@${width}`
  const hit = cache.get(key)
  if (hit) return hit
  const job = (queue = queue.then(async () => {
    await nextFrame()
    await fontsReady()
    const w = width
    const h = Math.round(width / ratio)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canvas 2D is unavailable')
    RENDERERS[style](ctx, w, h, seeded(seed))
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
    if (!blob) throw new Error('Could not encode artwork')
    return URL.createObjectURL(blob)
  })) as Promise<string>
  // a failed render must not poison the queue or the cache
  queue = job.catch(() => undefined)
  job.catch(() => cache.delete(key))
  cache.set(key, job)
  return job
}

/** Textures made with code: no image is downloaded. (Ported from the prototype; board-driven bits are the bonus.) */
import type * as THREE from 'three'
import { canvasTex, ctx, noise, pick, rand } from './util'

export type Textures = Record<
  | 'brick' | 'oak' | 'oakDark' | 'maple' | 'tile' | 'concrete' | 'persian' | 'kilim' | 'ahRug' | 'gridRug' | 'stripeRug' | 'mood' | 'fromVision'
  | 'specimen' | 'typeCase' | 'chips' | 'swatchTable' | 'draft' | 'sky' | 'neon' | 'tag' | 'fabric' | 'hair' | 'skin' | 'laptop' | 'hoodie'
  | 'stripes' | 'hazard' | 'doormat' | 'cover1' | 'cover2' | 'photo',
  THREE.CanvasTexture
> & { label: (t: string) => THREE.CanvasTexture }

const CHIPS_DEFAULT = ['#141414', '#5e5d58', '#8f8e87', '#F1F0E8', '#C7FF3D', '#9fd12a', '#e86a3a', '#b5543a', '#3f6fd1', '#9ec5e8']
const SWATCH_DEFAULT = ['#141414', '#F1F0E8', '#C7FF3D', '#e86a3a', '#3f6fd1']

export function makeTextures(): Textures {
  const { theme } = ctx()
  const TX = {} as Textures
  TX.brick = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d6cbbb'
    g.fillRect(0, 0, w, h)
    const bw = 64,
      bh = 25,
      m = 3
    for (let r = 0; r < h / bh + 1; r++)
      for (let c = -1; c < w / bw + 1; c++) {
        const x = c * bw + (r % 2 ? bw / 2 : 0),
          y = r * bh
        const base = pick(['#a6513a', '#97452f', '#ad5c40', '#8f412c', '#a3503a', '#b4664a', '#8a3d2a', '#9c4b33'])
        g.fillStyle = base
        g.fillRect(x + m / 2, y + m / 2, bw - m, bh - m)
        g.fillStyle = `rgba(255,230,210,${rand() * 0.14})`
        g.fillRect(x + m / 2, y + m / 2, bw - m, (bh - m) * 0.35)
        g.fillStyle = `rgba(30,10,5,${rand() * 0.18})`
        g.fillRect(x + m / 2 + rand() * 30, y + m / 2 + rand() * 10, 10 + rand() * 20, 4 + rand() * 6)
      }
    noise(g, w, h, 9000, 0.22)
    noise(g, w, h, 3000, 0.18, true)
    for (let i = 0; i < 6; i++) {
      const x = rand() * w
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, 'rgba(10,8,6,0.0)')
      gr.addColorStop(1, 'rgba(10,8,6,0.35)')
      g.fillStyle = gr
      g.fillRect(x, rand() * h * 0.5, 4 + rand() * 30, h)
    }
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `rgba(240,235,225,${0.08 + rand() * 0.12})`
      g.fillRect(rand() * w, rand() * h, 30 + rand() * 80, 12 + rand() * 30)
    }
  })
  const planks = (cols: string[]) =>
    canvasTex(1024, 1024, (g, w, h) => {
      const ph = 64
      for (let r = 0; r < h / ph; r++) {
        let x = -rand() * 400
        while (x < w) {
          const len = 300 + rand() * 420
          g.fillStyle = pick(cols)
          g.fillRect(x, r * ph, len, ph)
          for (let k = 0; k < 9; k++) {
            g.strokeStyle = `rgba(90,55,25,${0.05 + rand() * 0.1})`
            g.lineWidth = 1 + rand() * 1.5
            g.beginPath()
            const yy = r * ph + rand() * ph
            g.moveTo(x, yy)
            g.bezierCurveTo(x + len * 0.3, yy + rand() * 6 - 3, x + len * 0.6, yy + rand() * 6 - 3, x + len, yy + rand() * 4 - 2)
            g.stroke()
          }
          g.fillStyle = 'rgba(60,35,15,0.45)'
          g.fillRect(x, r * ph, 2, ph)
          x += len
        }
        g.fillStyle = 'rgba(60,35,15,0.5)'
        g.fillRect(0, r * ph, w, 2)
      }
      noise(g, w, h, 6000, 0.08)
      for (let i = 0; i < 10; i++) {
        const x = rand() * w,
          y = rand() * h,
          r = 20 + rand() * 70
        const gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, 'rgba(40,22,8,0.22)')
        gr.addColorStop(1, 'rgba(40,22,8,0)')
        g.fillStyle = gr
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.strokeStyle = 'rgba(255,255,255,0.10)'
      for (let i = 0; i < 30; i++) {
        g.lineWidth = 1
        g.beginPath()
        const x = rand() * w,
          y = rand() * h
        g.moveTo(x, y)
        g.lineTo(x + rand() * 60 - 30, y + rand() * 8 - 4)
        g.stroke()
      }
    })
  TX.oak = planks(['#9c7b55', '#8f6f4b', '#a5835c', '#94734f', '#876846'])
  TX.oakDark = planks(['#6e4f33', '#654730', '#76563a', '#5e432c'])
  TX.maple = planks(['#a88a66', '#9d805e', '#b0916d', '#a08362'])
  TX.tile = canvasTex(512, 512, (g, w, h) => {
    const s = 128
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        g.fillStyle = (r + c) % 2 ? '#d9d2c3' : '#c8bfac'
        g.fillRect(c * s, r * s, s, s)
      }
    noise(g, w, h, 6000, 0.08)
    noise(g, w, h, 3000, 0.1, true)
    g.strokeStyle = 'rgba(90,80,70,0.55)'
    g.lineWidth = 3
    for (let i = 0; i <= 4; i++) {
      g.beginPath()
      g.moveTo(i * s, 0)
      g.lineTo(i * s, h)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i * s)
      g.lineTo(w, i * s)
      g.stroke()
    }
  })
  TX.concrete = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9b968c'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 40; i++) {
      const x = rand() * w,
        y = rand() * h,
        r = 20 + rand() * 80
      const gr = g.createRadialGradient(x, y, 0, x, y, r)
      gr.addColorStop(0, `rgba(${rand() < 0.5 ? '0,0,0' : '255,255,255'},0.06)`)
      gr.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    }
    noise(g, w, h, 14000, 0.16)
    noise(g, w, h, 6000, 0.12, true)
  })
  TX.persian = canvasTex(
    1024,
    1024,
    (g, w, h) => {
      g.fillStyle = '#a8462f'
      g.fillRect(0, 0, w, h)
      const band = (inset: number, wd: number, col: string) => {
        g.fillStyle = col
        g.fillRect(inset, inset, w - inset * 2, wd)
        g.fillRect(inset, h - inset - wd, w - inset * 2, wd)
        g.fillRect(inset, inset, wd, h - inset * 2)
        g.fillRect(w - inset - wd, inset, wd, h - inset * 2)
      }
      band(0, 70, '#2c3b55')
      band(70, 8, '#e4cfa4')
      band(78, 52, '#7a2e22')
      band(130, 8, '#e4cfa4')
      g.fillStyle = '#e4cfa4'
      const diamond = ([x, y]: number[]) => {
        g.beginPath()
        g.moveTo(x, y - 12)
        g.lineTo(x + 10, y)
        g.lineTo(x, y + 12)
        g.lineTo(x - 10, y)
        g.fill()
      }
      for (let i = 100; i < w - 100; i += 34) {
        ;[[i, 104], [i, h - 104]].forEach(diamond)
        ;[[104, i], [w - 104, i]].forEach(diamond)
      }
      for (let x = 30; x < w; x += 60) {
        g.fillStyle = '#c7a46a'
        for (const [cx, cy] of [[x, 35], [x, h - 35], [35, x], [w - 35, x]]) {
          g.beginPath()
          g.arc(cx, cy, 9, 0, 6.3)
          g.fill()
        }
      }
      g.strokeStyle = 'rgba(70,25,18,0.45)'
      g.lineWidth = 3
      for (let x = 170; x < w - 150; x += 56)
        for (let y = 170; y < h - 150; y += 56) {
          g.beginPath()
          g.moveTo(x, y - 14)
          g.lineTo(x + 14, y)
          g.lineTo(x, y + 14)
          g.lineTo(x - 14, y)
          g.closePath()
          g.stroke()
        }
      const star = (r1: number, r2: number, n: number, col: string) => {
        g.fillStyle = col
        g.beginPath()
        for (let i = 0; i < n * 2; i++) {
          const a = (i / (n * 2)) * Math.PI * 2,
            r = i % 2 ? r2 : r1
          g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r * 1.25)
        }
        g.fill()
      }
      star(260, 200, 16, '#2c3b55')
      star(220, 175, 16, '#e4cfa4')
      star(190, 150, 12, '#8a3426')
      star(120, 95, 8, '#2c3b55')
      star(70, 50, 8, '#e4cfa4')
      star(30, 22, 6, '#8a3426')
      ;[[150, 150], [w - 150, 150], [150, h - 150], [w - 150, h - 150]].forEach(([x, y]) => {
        g.fillStyle = '#2c3b55'
        g.beginPath()
        g.arc(x, y, 60, 0, 6.3)
        g.fill()
        g.fillStyle = '#e4cfa4'
        g.beginPath()
        g.arc(x, y, 30, 0, 6.3)
        g.fill()
      })
      for (let i = 0; i < 70; i++) {
        const x = rand() * w,
          y = rand() * h,
          r = 30 + rand() * 120
        const gr = g.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, 'rgba(240,215,185,0.22)')
        gr.addColorStop(1, 'rgba(240,215,185,0)')
        g.fillStyle = gr
        g.fillRect(0, 0, w, h)
      }
      noise(g, w, h, 30000, 0.18)
      noise(g, w, h, 12000, 0.12, true)
    },
    false,
  )
  TX.kilim = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#e9e2d2'
      g.fillRect(0, 0, w, h)
      const cols = ['#141414', '#C7FF3D', '#b5543a', '#141414']
      for (let y = 40, i = 0; y < h - 40; y += 36, i++) {
        g.fillStyle = cols[i % cols.length]
        g.fillRect(40, y, w - 80, i % 2 ? 6 : 12)
      }
      g.strokeStyle = '#141414'
      g.lineWidth = 24
      g.strokeRect(12, 12, w - 24, h - 24)
      noise(g, w, h, 9000, 0.12)
    },
    false,
  )
  TX.ahRug = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#141414'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#C7FF3D'
      g.lineWidth = 18
      g.beginPath()
      g.arc(w / 2, h / 2, 190, 0, 6.3)
      g.stroke()
      g.fillStyle = '#F1F0E8'
      g.font = '900 180px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('AH', w / 2, h / 2 + 8)
      noise(g, w, h, 12000, 0.25, true)
    },
    false,
  )
  TX.gridRug = canvasTex(
    512,
    256,
    (g, w, h) => {
      g.fillStyle = '#ece7da'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#141414'
      g.lineWidth = 4
      for (let x = 0; x <= w; x += 32) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
      }
      for (let y = 0; y <= h; y += 32) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(w, y)
        g.stroke()
      }
      g.lineWidth = 16
      g.strokeRect(0, 0, w, h)
      noise(g, w, h, 6000, 0.1)
    },
    false,
  )
  TX.stripeRug = canvasTex(
    512,
    256,
    (g, w, h) => {
      const c = ['#141414', '#F1F0E8', '#C7FF3D', '#8f8e87']
      for (let i = 0; i < 16; i++) {
        g.fillStyle = c[i % 4]
        g.fillRect(i * 32, 0, 32, h)
      }
      g.strokeStyle = '#141414'
      g.lineWidth = 18
      g.strokeRect(0, 0, w, h)
      noise(g, w, h, 6000, 0.12)
    },
    false,
  )
  // bonus: the Studio's wall moodboard takes the colours of the board's photos
  const mc = theme.photoColors.length ? theme.photoColors : null
  const moodCol = (i: number, fallback: string[]) => (mc ? [mc[i % mc.length], mc[(i + 3) % mc.length]] : fallback)
  TX.mood = canvasTex(
    1024,
    440,
    (g, w, h) => {
      g.fillStyle = '#141414'
      g.fillRect(0, 0, w, h)
      const cells: [number, number, number, number, string[]][] = [
        [20, 20, 330, 400, moodCol(0, ['#f2b36b', '#c4562a', '#2a1a12'])],
        [370, 20, 150, 190, moodCol(1, ['#9ec5e8', '#3f6fd1'])],
        [540, 20, 150, 190, moodCol(2, ['#C7FF3D', '#C7FF3D'])],
        [710, 20, 294, 190, moodCol(3, ['#e9e4d8', '#8f8e87'])],
        [370, 230, 150, 190, ['#F1F0E8', '#F1F0E8']],
        [540, 230, 150, 190, moodCol(5, ['#5e5d58', '#141414'])],
        [710, 230, 140, 190, moodCol(6, ['#d8c9a8', '#7a5233'])],
        [870, 230, 134, 190, moodCol(7, ['#e86a3a', '#b5543a'])],
      ]
      cells.forEach(([x, y, cw, ch, cs]) => {
        const gr = g.createLinearGradient(0, y, 0, y + ch)
        cs.forEach((c, i) => gr.addColorStop(i / Math.max(1, cs.length - 1), c))
        g.fillStyle = gr
        g.fillRect(x, y, cw, ch)
      })
      g.fillStyle = '#141414'
      g.font = theme.type ? `${theme.type.displayWeight} 120px ${theme.type.display}` : '120px "Instrument Serif", Georgia, serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('Aa', 445, 330)
      g.fillStyle = 'rgba(20,20,20,0.6)'
      g.beginPath()
      g.arc(185, 150, 46, 0, 6.3)
      g.fill()
      noise(g, w, h, 12000, 0.1)
      ;[[30, 30], [994, 30]].forEach(([x, y]) => {
        g.fillStyle = '#C7FF3D'
        g.beginPath()
        g.arc(x, y, 10, 0, 6.3)
        g.fill()
      })
    },
    false,
  )
  TX.fromVision = canvasTex(
    400,
    520,
    (g) => {
      g.fillStyle = '#C7FF3D'
      g.fillRect(0, 0, 400, 520)
      g.fillStyle = '#141414'
      g.font = '900 92px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textBaseline = 'top'
      ;['FROM', 'VISION'].forEach((t, i) => g.fillText(t, 26, 24 + i * 84))
      ;['TO', 'VISUAL'].forEach((t, i) => g.fillText(t, 26, 330 + i * 84))
    },
    false,
  )
  TX.specimen = canvasTex(
    400,
    520,
    (g) => {
      g.fillStyle = '#F1F0E8'
      g.fillRect(0, 0, 400, 520)
      g.fillStyle = '#141414'
      g.font = '300px "Instrument Serif", Georgia, serif'
      g.textBaseline = 'top'
      g.fillText('Rr', 24, 0)
      g.fillRect(28, 400, 300, 10)
      g.fillStyle = '#8f8e87'
      g.fillRect(28, 430, 240, 8)
      g.fillRect(28, 452, 270, 8)
      g.font = '24px "JetBrains Mono", monospace'
      g.fillStyle = '#141414'
      g.fillText('SERIF · 01', 28, 478)
    },
    false,
  )
  TX.typeCase = canvasTex(
    512,
    256,
    (g, w, h) => {
      g.fillStyle = '#7a5233'
      g.fillRect(0, 0, w, h)
      const L = 'AaBbGgRrQ&@?!%#KkMmXxYy'
      g.font = '30px "JetBrains Mono", monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 8; c++) {
          g.fillStyle = '#4a3220'
          g.fillRect(12 + c * 62, 12 + r * 80, 54, 72)
          g.fillStyle = '#e9e2d2'
          g.fillText(L[(r * 8 + c) % L.length], 12 + c * 62 + 27, 12 + r * 80 + 36)
        }
      noise(g, w, h, 4000, 0.15)
    },
    false,
  )
  // bonus: the Color Lab's wall chart and swatch table take the board's palette
  const pal = theme.palette && theme.palette.length ? theme.palette : null
  TX.chips = canvasTex(
    512,
    160,
    (g, w, h) => {
      g.fillStyle = '#141414'
      g.fillRect(0, 0, w, h)
      const cols = pal ? Array.from({ length: 10 }, (_, i) => pal[i % pal.length]) : CHIPS_DEFAULT
      cols.forEach((c, i) => {
        g.fillStyle = '#ffffff'
        g.fillRect(10 + i * 50, 10, 42, 140)
        g.fillStyle = c
        g.fillRect(14 + i * 50, 14, 34, 100)
      })
    },
    false,
  )
  TX.swatchTable = canvasTex(
    512,
    256,
    (g, w, h) => {
      g.fillStyle = '#f7f6f1'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#e0ded6'
      g.lineWidth = 1
      for (let x = 0; x < w; x += 16) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
      }
      for (let y = 0; y < h; y += 16) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(w, y)
        g.stroke()
      }
      const cols = pal ? pal.slice(0, 6) : SWATCH_DEFAULT
      const step = Math.min(66, 340 / cols.length)
      cols.forEach((c, i) => {
        g.fillStyle = c
        g.fillRect(40 + i * step, 110, step - 6, 90)
      })
      g.strokeStyle = '#c9c7be'
      g.strokeRect(40 + step, 110, step - 6, 90)
    },
    false,
  )
  // bonus: the Type Lab's drawing board shows the board's type pair
  TX.draft = canvasTex(
    512,
    280,
    (g, w, h) => {
      g.fillStyle = '#FAFAF7'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#dcdad2'
      for (let x = 0; x < w; x += 20) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
      }
      for (let y = 0; y < h; y += 20) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(w, y)
        g.stroke()
      }
      g.fillStyle = '#141414'
      g.textBaseline = 'middle'
      g.font = theme.type ? `400 150px ${theme.type.text}` : '150px "Instrument Serif", Georgia, serif'
      g.fillText('Aa', 50, 140)
      g.font = theme.type ? `${theme.type.displayWeight} 130px ${theme.type.display}` : '900 130px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.fillText('Aa', 290, 145)
    },
    false,
  )
  TX.sky = canvasTex(
    256,
    256,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, '#04070d')
      gr.addColorStop(0.7, '#0e1828')
      gr.addColorStop(1, '#18202e')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,255,255,${rand() * 0.6})`
        g.fillRect(rand() * w, rand() * h * 0.5, 1, 1)
      }
      const m = g.createRadialGradient(190, 50, 0, 190, 50, 30)
      m.addColorStop(0, '#f4f1e0')
      m.addColorStop(0.3, '#f4f1e0')
      m.addColorStop(0.36, 'rgba(244,241,224,0.25)')
      m.addColorStop(1, 'rgba(244,241,224,0)')
      g.fillStyle = m
      g.fillRect(150, 10, 80, 80)
      let x = 0
      while (x < w) {
        const bw = 18 + rand() * 30,
          bh = 40 + rand() * 100
        g.fillStyle = '#070a10'
        g.fillRect(x, h - bh, bw, bh)
        for (let k = 0; k < 14; k++) {
          g.fillStyle = rand() < 0.2 ? '#C7FF3D' : '#ffcf70'
          g.globalAlpha = 0.5 + rand() * 0.5
          g.fillRect(x + 2 + rand() * (bw - 5), h - bh + 4 + rand() * (bh - 8), 2, 2)
        }
        g.globalAlpha = 1
        x += bw + 2
      }
    },
    false,
  )
  TX.neon = canvasTex(
    1024,
    256,
    (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.font = '900 170px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.lineJoin = 'round'
      g.strokeStyle = '#ffffff'
      g.lineWidth = 10
      g.strokeText('AFTERHOURS', w / 2, h / 2 + 6)
    },
    false,
  )
  TX.tag = canvasTex(
    512,
    384,
    (g, w, h) => {
      g.clearRect(0, 0, w, h)
      g.font = '900 230px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.save()
      g.translate(w / 2, h / 2 - 20)
      g.rotate(-0.12)
      g.lineWidth = 26
      g.strokeStyle = '#141414'
      g.strokeText('AH', 0, 0)
      g.fillStyle = '#C7FF3D'
      g.fillText('AH', 0, 0)
      g.restore()
      g.fillStyle = '#C7FF3D'
      for (let i = 0; i < 9; i++) {
        const x = 130 + rand() * 260,
          y = 220 + rand() * 30
        g.fillRect(x, y, 5, 30 + rand() * 90)
        g.beginPath()
        g.arc(x + 2.5, y + 40 + rand() * 60, 5, 0, 6.3)
        g.fill()
      }
      for (let i = 0; i < 400; i++) {
        g.fillStyle = `rgba(199,255,61,${rand() * 0.5})`
        const a = rand() * 6.3,
          r = 120 + rand() * 120
        g.fillRect(w / 2 + Math.cos(a) * r * 1.2, h / 2 - 20 + Math.sin(a) * r * 0.6, 2, 2)
      }
    },
    false,
  )
  TX.fabric = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(0,0,0,${0.08 + rand() * 0.1})`
      g.fillRect(0, y, w, 1)
    }
    for (let x = 0; x < w; x += 3) {
      g.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.06})`
      g.fillRect(x, 0, 1, h)
    }
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = 'rgba(0,0,0,0.18)'
      g.lineWidth = 2 + rand() * 4
      g.beginPath()
      const x = rand() * w
      g.moveTo(x, 0)
      g.bezierCurveTo(x + 20, h * 0.3, x - 20, h * 0.6, x + rand() * 30, h)
      g.stroke()
    }
    noise(g, w, h, 5000, 0.15)
  })
  TX.hair = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d8d8d8'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 900; i++) {
      const x = rand() * w
      g.strokeStyle = rand() < 0.5 ? `rgba(0,0,0,${0.15 + rand() * 0.35})` : `rgba(255,255,255,${0.15 + rand() * 0.3})`
      g.lineWidth = 0.6 + rand() * 1.4
      g.beginPath()
      g.moveTo(x, 0)
      g.bezierCurveTo(x + rand() * 16 - 8, h * 0.33, x + rand() * 16 - 8, h * 0.66, x + rand() * 20 - 10, h)
      g.stroke()
    }
  })
  TX.skin = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808080'
    g.fillRect(0, 0, w, h)
    noise(g, w, h, 20000, 0.12)
    noise(g, w, h, 12000, 0.1, true)
  })
  TX.laptop = canvasTex(
    256,
    160,
    (g, w, h) => {
      g.fillStyle = '#2c2c2a'
      g.fillRect(0, 0, w, h)
      g.shadowColor = '#C7FF3D'
      g.shadowBlur = 18
      g.fillStyle = '#C7FF3D'
      g.font = '900 70px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('AH', w / 2, h / 2 + 4)
    },
    false,
  )
  TX.hoodie = canvasTex(
    128,
    64,
    (g, w, h) => {
      g.fillStyle = '#161616'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#C7FF3D'
      g.font = '900 46px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('AH', w / 2, h / 2 + 2)
    },
    false,
  )
  TX.stripes = canvasTex(64, 64, (g, w) => {
    g.fillStyle = '#F1F0E8'
    g.fillRect(0, 0, w, 64)
    g.fillStyle = '#141414'
    g.fillRect(0, 0, w, 12)
    g.fillRect(0, 32, w, 12)
  })
  TX.hazard = canvasTex(
    256,
    32,
    (g, w, h) => {
      g.fillStyle = '#C7FF3D'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#141414'
      for (let x = -32; x < w; x += 40) {
        g.beginPath()
        g.moveTo(x, h)
        g.lineTo(x + 20, 0)
        g.lineTo(x + 36, 0)
        g.lineTo(x + 16, h)
        g.fill()
      }
      g.fillRect(84, 4, 88, 24)
      g.fillStyle = '#F1F0E8'
      g.font = '16px "JetBrains Mono", monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('EN OBRA', 128, 17)
    },
    false,
  )
  TX.doormat = canvasTex(
    256,
    96,
    (g, w, h) => {
      g.fillStyle = '#3a3a37'
      g.fillRect(0, 0, w, h)
      noise(g, w, h, 5000, 0.3)
      g.fillStyle = '#C7FF3D'
      g.font = '40px "JetBrains Mono", monospace'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('H O L A', w / 2, h / 2 + 2)
    },
    false,
  )
  TX.cover1 = canvasTex(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#F1F0E8'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#141414'
      g.beginPath()
      g.arc(64, 64, 50, 0, 6.3)
      g.fill()
      g.fillStyle = '#C7FF3D'
      g.beginPath()
      g.arc(64, 64, 14, 0, 6.3)
      g.fill()
    },
    false,
  )
  TX.cover2 = canvasTex(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#141414'
      g.fillRect(0, 0, w, h)
      g.fillStyle = '#C7FF3D'
      g.font = '900 40px "Big Shoulders Display", "Arial Narrow", sans-serif'
      g.textBaseline = 'top'
      g.fillText('AFTER', 10, 44)
      g.fillText('HOURS', 10, 80)
    },
    false,
  )
  TX.photo = canvasTex(
    128,
    160,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, '#9ec5e8')
      gr.addColorStop(0.55, '#3f6fd1')
      gr.addColorStop(0.56, '#d8c9a8')
      gr.addColorStop(1, '#c9b48a')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    },
    false,
  )
  TX.label = (t: string) =>
    canvasTex(
      128,
      48,
      (g, w, h) => {
        g.fillStyle = '#F1F0E8'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#141414'
        g.font = '22px "JetBrains Mono", monospace'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(t, w / 2, h / 2)
      },
      false,
    )
  return TX
}

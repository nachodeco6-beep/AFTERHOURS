/**
 * Color Lab · Explorar: palettes that don't come from photos. Colour
 * harmonies on the HSL wheel from a base colour, kept inside ranges that give
 * usable palettes (a dark and a light to set text on, saturated colours in the
 * middle), and «Otra» that only changes what isn't locked. Pure, no DOM.
 */
import { deltaE, hexToRgb, rgbToHex, rgbToLab } from './color.ts'
import { assignRoles, MAX_COLORS, MIN_COLORS, MIN_DISTANCE, type LabColor } from './colorLab.ts'

export type Harmony = 'analogos' | 'complementarios' | 'dividido' | 'triada' | 'tetrada' | 'monocromatica'

export const HARMONIES: { id: Harmony; label: string; hint: string }[] = [
  { id: 'analogos', label: 'Análogos', hint: 'Vecinos en la rueda, a 30°' },
  { id: 'complementarios', label: 'Complementarios', hint: 'Opuestos, a 180°' },
  { id: 'dividido', label: 'Complementario dividido', hint: 'Los dos vecinos del opuesto, a 150° y 210°' },
  { id: 'triada', label: 'Tríada', hint: 'Tres tonos a 120°' },
  { id: 'tetrada', label: 'Tétrada', hint: 'Cuatro tonos a 90°' },
  { id: 'monocromatica', label: 'Monocromática', hint: 'Un solo tono, de oscuro a claro' },
]

/** Hue offsets of each harmony, in degrees from the base. */
export const HARMONY_ANGLES: Record<Harmony, number[]> = {
  analogos: [0, -30, 30],
  complementarios: [0, 180],
  dividido: [0, 150, 210],
  triada: [0, 120, 240],
  tetrada: [0, 90, 180, 270],
  monocromatica: [0],
}

const wrap = (h: number) => ((h % 360) + 360) % 360

/** The hues of a harmony around a base hue (0–360). */
export const harmonyHues = (base: number, harmony: Harmony) => HARMONY_ANGLES[harmony].map((a) => wrap(base + a))

// ─── HSL ────────────────────────────────────────────────────────────────────

export type Hsl = [number, number, number]

export function hexToHsl(hex: string): Hsl {
  const [r, g, b] = (hexToRgb(hex) ?? [0, 0, 0]).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

export function hslToHex([h, s, l]: Hsl): string {
  const S = Math.max(0, Math.min(100, s)) / 100
  const L = Math.max(0, Math.min(100, l)) / 100
  const k = (n: number) => (n + wrap(h) / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255])
}

/** Small seeded generator (mulberry32): the same seed gives the same palettes. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (rand: () => number, [lo, hi]: [number, number]) => lo + (hi - lo) * rand()
const pickOne = <T>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length) % list.length]

/** Ranges that keep a palette usable. */
const DARK = { s: [12, 38] as [number, number], l: [7, 17] as [number, number] }
const LIGHT = { s: [14, 42] as [number, number], l: [90, 96] as [number, number] }
const MID = { s: [48, 86] as [number, number], l: [40, 64] as [number, number] }

/** «Sorprendeme»: a base colour that works (not grey, not washed out). */
export const surprise = (rand: () => number) => hslToHex([between(rand, [0, 360]), between(rand, [55, 88]), between(rand, [42, 60])])

// ─── Distance ───────────────────────────────────────────────────────────────

const lab = (hex: string) => rgbToLab(hexToRgb(hex) ?? [0, 0, 0])
export const distance = (a: string, b: string) => deltaE(lab(a), lab(b))
const farFrom = (hex: string, others: string[], min = MIN_DISTANCE) => others.every((o) => distance(hex, o) >= min)

/**
 * Moves `hex` until it's at least MIN_DISTANCE from every colour in `others`:
 * first lighter/darker in growing steps, then round the hue. Always ends with a
 * valid, distinct colour (a palette of 8 leaves plenty of room in Lab).
 */
export function separate(hex: string, others: string[]): string {
  if (farFrom(hex, others)) return hex
  const [h, s, l] = hexToHsl(hex)
  for (let step = 6; step <= 60; step += 6)
    for (const dir of l > 50 ? [-1, 1] : [1, -1]) {
      const c = hslToHex([h, s, Math.max(4, Math.min(97, l + dir * step))])
      if (farFrom(c, others)) return c
    }
  for (let turn = 30; turn < 360; turn += 30)
    for (const light of [l, 30, 55, 80]) {
      const c = hslToHex([h + turn, Math.max(s, 50), light])
      if (farFrom(c, others)) return c
    }
  // a last resort that can't fail for ≤ 8 colours: walk a grid of the whole space
  for (let light = 8; light <= 95; light += 7)
    for (let hue = 0; hue < 360; hue += 24) {
      const c = hslToHex([hue, 70, light])
      if (farFrom(c, others)) return c
    }
  return hex
}

// ─── Building palettes ──────────────────────────────────────────────────────

/**
 * `n` colours (3–8) in a harmony around `base`, which stays as it is. Shape:
 * a dark and a light (tinted with the harmony's hues), and saturated colours
 * going round the harmony's hues. Monochromatic: one hue from dark to light.
 * `jitter` (0–1) varies tone, saturation and light inside the usable ranges.
 */
export function harmonyPalette(base: string, harmony: Harmony, n: number, rand: () => number, jitter = 0.5): string[] {
  const count = Math.max(MIN_COLORS, Math.min(MAX_COLORS, Math.round(n)))
  const baseHex = (hexToRgb(base) ? rgbToHex(hexToRgb(base)!) : '#C7FF3D').toUpperCase()
  const [h0, s0] = hexToHsl(baseHex)
  const hues = harmonyHues(h0, harmony)
  const vary = (h: number) => h + (rand() - 0.5) * 24 * jitter
  const out: string[] = [baseHex]
  const add = (hex: string) => out.push(separate(hex, out))

  if (harmony === 'monocromatica') {
    // a lightness ladder on the base hue, the base somewhere in the middle
    const steps = count - 1
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1)
      const l = 9 + t * 86 + (rand() - 0.5) * 6 * jitter
      const s = Math.max(10, Math.min(90, s0 * (0.35 + 0.65 * Math.sin(Math.PI * t)) + (rand() - 0.5) * 16 * jitter))
      add(hslToHex([h0, s, l]))
    }
    return out
  }

  // the dark and the light carry a hue of the harmony (not the base's, unless it's the only one)
  const tint = hues[1] ?? hues[0]
  add(hslToHex([vary(tint), between(rand, DARK.s), between(rand, DARK.l)]))
  if (count > 2) add(hslToHex([vary(hues[hues.length - 1] ?? tint), between(rand, LIGHT.s), between(rand, LIGHT.l)]))
  // the rest go round the harmony, starting after the base
  for (let i = 0; out.length < count; i++) {
    const hue = hues[(i + 1) % hues.length]
    add(hslToHex([vary(hue), between(rand, MID.s), between(rand, MID.l)]))
  }
  return out.slice(0, count)
}

/** A whole palette of `n` colours with default roles, from a base and a harmony. */
export function fromHarmony(base: string, harmony: Harmony, n: number, rand: () => number): LabColor[] {
  return assignRoles(harmonyPalette(base, harmony, n, rand, 0.4).map((hex) => ({ hex, locked: false, role: null, photoId: null })))
}

/**
 * «Otra» (or the space bar): only the colours without a lock change. The new
 * ones follow a harmony anchored on the first locked colour (or on a fresh
 * base when nothing is locked); with `wander`, the harmony itself may change
 * too. Locked colours keep their place, colour and role. Returns the harmony used.
 */
export function regenerateFree(colors: LabColor[], harmony: Harmony, rand: () => number, wander = false): { colors: LabColor[]; harmony: Harmony } {
  const locked = colors.filter((c) => c.locked)
  if (locked.length === colors.length) return { colors, harmony }
  const used: Harmony = wander && rand() < 0.35 ? pickOne(rand, HARMONIES).id : harmony
  const anchor = locked[0]?.hex ?? surprise(rand)
  const fresh = harmonyPalette(anchor, used, colors.length, rand, 1)
  // the locked colours stand for the harmony colours closest to them
  const spare = [...fresh]
  for (const c of locked) {
    let best = 0
    spare.forEach((f, i) => {
      if (distance(f, c.hex) < distance(spare[best], c.hex)) best = i
    })
    spare.splice(best, 1)
  }
  const taken = locked.map((c) => c.hex)
  const next = colors.map((c) => {
    if (c.locked) return { ...c }
    const hex = separate(spare.shift() ?? surprise(rand), taken)
    taken.push(hex)
    return { ...c, hex, photoId: null }
  })
  return { colors: assignRoles(next), harmony: used }
}

/** One more colour (up to 8) that fits the harmony and isn't like any other; fewer drops unlocked ones from the end. */
export function growFree(colors: LabColor[], harmony: Harmony, rand: () => number): LabColor[] {
  if (colors.length >= MAX_COLORS) return colors
  const anchor = colors.find((c) => c.locked)?.hex ?? colors[0]?.hex ?? surprise(rand)
  const candidates = harmonyPalette(anchor, harmony, MAX_COLORS, rand, 1)
  const hexes = colors.map((c) => c.hex)
  const hex = separate(candidates.find((c) => farFrom(c, hexes)) ?? candidates[candidates.length - 1], hexes)
  return [...colors, { hex, locked: false, role: null, photoId: null }]
}

// ─── Light ──────────────────────────────────────────────────────────────────

export type Light = 'claras' | 'oscuras' | 'mixtas'
export const LIGHTS: Light[] = ['claras', 'oscuras', 'mixtas']
export const LIGHT_LABEL: Record<Light, string> = { claras: 'Claras', oscuras: 'Oscuras', mixtas: 'Mixtas' }

/** Light palettes, dark ones, or a mix, by the Lab lightness of the middle colour and the average. */
export function lightOf(hexes: string[]): Light {
  const L = hexes.map((h) => lab(h)[0]).sort((a, b) => a - b)
  const median = L[Math.floor(L.length / 2)]
  const mean = L.reduce((a, b) => a + b, 0) / L.length
  if (median > 66 && mean > 60) return 'claras'
  if (median < 42 || mean < 46) return 'oscuras'
  return 'mixtas'
}

/**
 * Color Lab: work the board's palette like a designer. Pure, no DOM.
 *
 * The palette's raw material is a «pool» of colours present in the board's
 * photos (k-means clusters, each with the photo it mostly comes from).
 * Regenerating only ever draws from that pool: no invented colours. Colours can
 * be locked, take a role (background, text, accent, secondary), be checked for
 * WCAG contrast and be exported.
 */
import { deltaE, hexToRgb, labToRgb, luminance, rgbToHex, rgbToLab, type Lab, type RGB } from './color.ts'
import { kmeans } from './palette.ts'

export type Role = 'fondo' | 'texto' | 'acento' | 'secundario'
export const ROLES: Role[] = ['fondo', 'texto', 'acento', 'secundario']
export const ROLE_LABEL: Record<Role, string> = { fondo: 'Fondo', texto: 'Texto', acento: 'Acento', secundario: 'Secundario' }

export const MIN_COLORS = 3
export const MAX_COLORS = 8
export const DEFAULT_COLORS = 5
/** Two palette colours closer than this (CIE76 ΔE) read as the same colour. */
export const MIN_DISTANCE = 10

/** A colour present in the photos. `photo`: index of the photo it mostly comes from. */
export interface PoolColor {
  hex: string
  /** Share of the sampled pixels, 0–1. */
  weight: number
  photo: number
}

export interface LabColor {
  hex: string
  locked: boolean
  role: Role | null
  /** Photo it comes from, when known. */
  photoId: string | null
}

/** The palette as edited in the Color Lab. Saved with the board; null on the board = automatic. */
export interface PaletteEdit {
  colors: LabColor[]
  /** The photos it was made from (order ignored), to notice when they change. */
  basis: string
}

const lab = (hex: string): Lab => rgbToLab(hexToRgb(hex) ?? [0, 0, 0])
const dist = (a: string, b: string) => deltaE(lab(a), lab(b))
const chroma = (hex: string) => {
  const [, a, b] = lab(hex)
  return Math.hypot(a, b)
}

export const basisOf = (photoIds: string[]) => [...photoIds].sort().join('|')

// ─── Pool ───────────────────────────────────────────────────────────────────

/** Colours present in the photos, most present first, each with the photo it mostly comes from. */
export function colorPool(samples: RGB[][], size = 24): PoolColor[] {
  const perPhoto = 400
  const points: Lab[] = []
  const owner: number[] = []
  samples.forEach((sample, photo) => {
    if (!sample.length) return
    const step = Math.max(1, sample.length / perPhoto)
    for (let i = 0; i < sample.length; i += step) {
      points.push(rgbToLab(sample[Math.floor(i)]))
      owner.push(photo)
    }
  })
  if (!points.length) return []
  const clusters = kmeans(points, size, 10, 11)
  const counts = clusters.map(() => new Map<number, number>())
  points.forEach((p, i) => {
    let best = 0
    let bestD = Infinity
    clusters.forEach((c, k) => {
      const d = deltaE(c.center, p)
      if (d < bestD) {
        bestD = d
        best = k
      }
    })
    counts[best].set(owner[i], (counts[best].get(owner[i]) ?? 0) + 1)
  })
  return clusters
    .map((c, k) => {
      const byPhoto = [...counts[k].entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])
      return { hex: rgbToHex(labToRgb(c.center)), weight: c.size / points.length, photo: byPhoto[0]?.[0] ?? 0 }
    })
    .filter((c, i, all) => all.findIndex((o) => o.hex === c.hex) === i)
}

/** Fallback pool: the dominant colour Unsplash reports for each photo. */
export function poolFromReported(colors: (string | null)[]): PoolColor[] {
  const valid = colors.map((hex, photo) => ({ hex: hex && hexToRgb(hex) ? rgbToHex(hexToRgb(hex)!) : null, photo })).filter((c): c is { hex: string; photo: number } => c.hex !== null)
  return valid.map((c) => ({ ...c, weight: 1 / valid.length }))
}

/** The pool colour this hex is (or is close to), if any: where it «comes from». */
export function sourceOf(hex: string, pool: PoolColor[]): PoolColor | null {
  let best: PoolColor | null = null
  let bestD = Infinity
  for (const p of pool) {
    const d = dist(hex, p.hex)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return best && bestD <= 16 ? best : null
}

// ─── Roles ──────────────────────────────────────────────────────────────────

/**
 * Default roles: the darkest or the lightest colour is the background
 * (whichever leaves the stronger text; on a tie, the palette's overall tone), the one with the most contrast against
 * it is the text, the most saturated of the rest is the accent and the next one
 * in order is the secondary.
 */
export function defaultRoles(hexes: string[], taken: Partial<Record<Role, number>> = {}, eligible: (i: number) => boolean = () => true): (Role | null)[] {
  const roles: (Role | null)[] = hexes.map(() => null)
  for (const [role, i] of Object.entries(taken) as [Role, number][]) roles[i] = role
  const free = () => hexes.map((_, i) => i).filter((i) => roles[i] === null && eligible(i))

  let bg = taken.fondo
  if (bg === undefined) {
    const f = free()
    if (!f.length) return roles
    const lum = (i: number) => luminance(hexToRgb(hexes[i]) ?? [0, 0, 0])
    const darkest = f.reduce((a, i) => (lum(i) < lum(a) ? i : a), f[0])
    const lightest = f.reduce((a, i) => (lum(i) > lum(a) ? i : a), f[0])
    const bestText = (b: number) => Math.max(0, ...hexes.map((h, i) => (i === b ? 0 : contrastRatio(h, hexes[b]))))
    const [dark, light] = [bestText(darkest), bestText(lightest)]
    // a tie (the same pair either way): follow the palette's overall tone
    const lightPalette = hexes.reduce((sum, h) => sum + luminance(hexToRgb(h) ?? [0, 0, 0]), 0) / hexes.length > 0.4
    bg = Math.abs(dark - light) < 0.05 ? (lightPalette ? lightest : darkest) : dark > light ? darkest : lightest
    roles[bg] = 'fondo'
  }
  if (taken.texto === undefined) {
    const f = free()
    if (f.length) roles[f.reduce((a, i) => (contrastRatio(hexes[i], hexes[bg]) > contrastRatio(hexes[a], hexes[bg]) ? i : a), f[0])] = 'texto'
  }
  if (taken.acento === undefined) {
    const f = free()
    if (f.length) roles[f.reduce((a, i) => (chroma(hexes[i]) > chroma(hexes[a]) ? i : a), f[0])] = 'acento'
  }
  if (taken.secundario === undefined) {
    const f = free()
    if (f.length) roles[f[0]] = 'secundario'
  }
  return roles
}

/** Roles of locked colours stay; the rest are worked out again for the unlocked ones. */
export function assignRoles(colors: LabColor[]): LabColor[] {
  const taken: Partial<Record<Role, number>> = {}
  colors.forEach((c, i) => {
    if (c.locked && c.role) taken[c.role] = i
  })
  const roles = defaultRoles(
    colors.map((c) => c.hex),
    taken,
    (i) => !colors[i].locked,
  )
  return colors.map((c, i) => ({ ...c, role: c.locked ? c.role : roles[i] }))
}

/** Only the roles nobody has go to colours without a role (what the user chose stays). */
export function fillRoles(colors: LabColor[]): LabColor[] {
  const taken: Partial<Record<Role, number>> = {}
  colors.forEach((c, i) => {
    if (c.role) taken[c.role] = i
  })
  const roles = defaultRoles(
    colors.map((c) => c.hex),
    taken,
    (i) => colors[i].role === null,
  )
  return colors.map((c, i) => ({ ...c, role: c.role ?? roles[i] }))
}

/** Gives `role` to colour `index`; whoever had it takes this colour's old role (a swap). null clears it. */
export function setRole(colors: LabColor[], index: number, role: Role | null): LabColor[] {
  const previous = colors[index]?.role ?? null
  return colors.map((c, i) => (i === index ? { ...c, role } : role && c.role === role ? { ...c, role: previous } : c))
}

export const roleIndex = (colors: LabColor[], role: Role) => colors.findIndex((c) => c.role === role)

// ─── Building and regenerating ──────────────────────────────────────────────

const photoIdOf = (p: PoolColor | null, photoIds: string[]) => (p ? (photoIds[p.photo] ?? null) : null)

/** The automatic palette as a starting point, with default roles. */
export function fromAuto(hexes: string[], pool: PoolColor[], photoIds: string[]): PaletteEdit {
  const roles = defaultRoles(hexes)
  return {
    colors: hexes.map((hex, i) => ({ hex, locked: false, role: roles[i], photoId: photoIdOf(sourceOf(hex, pool), photoIds) })),
    basis: basisOf(photoIds),
  }
}

/**
 * Picks `n` pool colours far enough from `keep` and from each other, starting
 * at `offset` in the pool (most present first) and going round. `avoid`: try
 * not to land on these either (so «Regenerar» really changes something).
 */
function draw(pool: PoolColor[], n: number, keep: string[], avoid: string[], offset: number): PoolColor[] {
  const picked: PoolColor[] = []
  for (const [minD, dodge] of [
    [MIN_DISTANCE, true],
    [MIN_DISTANCE, false],
    [MIN_DISTANCE / 2, false],
  ] as const) {
    for (let k = 0; k < pool.length && picked.length < n; k++) {
      const c = pool[(offset + k) % pool.length]
      if (picked.includes(c)) continue
      const others = [...keep, ...picked.map((p) => p.hex)]
      if (others.some((h) => dist(h, c.hex) < minD)) continue
      if (dodge && avoid.some((h) => dist(h, c.hex) < MIN_DISTANCE)) continue
      picked.push(c)
    }
    if (picked.length >= n) break
  }
  return picked
}

/**
 * «Regenerar»: unlocked colours get other tones from the photos; locked ones
 * stay. `step` moves through the pool, so pressing again gives something else.
 * If the photos don't have enough different colours, the palette keeps fewer
 * changes rather than inventing any.
 */
export function regenerate(colors: LabColor[], pool: PoolColor[], photoIds: string[], step: number): LabColor[] {
  if (!pool.length) return colors
  const locked = colors.filter((c) => c.locked).map((c) => c.hex)
  const slots = colors.map((c, i) => (c.locked ? -1 : i)).filter((i) => i >= 0)
  const fresh = draw(
    pool,
    slots.length,
    locked,
    colors.filter((c) => !c.locked).map((c) => c.hex),
    (step * Math.max(1, slots.length)) % pool.length,
  )
  const next = colors.map((c) => ({ ...c }))
  slots.forEach((slot, k) => {
    const p = fresh[k]
    if (p) next[slot] = { ...next[slot], hex: p.hex, photoId: photoIdOf(p, photoIds) }
  })
  return assignRoles(next)
}

/** Recalculate after the photos changed: locked colours stay, the rest come from the new photos. */
export function recalc(edit: PaletteEdit, pool: PoolColor[], photoIds: string[]): PaletteEdit {
  const locked = edit.colors.filter((c) => c.locked).map((c) => c.hex)
  const slots = edit.colors.map((c, i) => (c.locked ? -1 : i)).filter((i) => i >= 0)
  const fresh = draw(pool, slots.length, locked, [], 0)
  const colors = edit.colors.map((c) => ({ ...c }))
  slots.forEach((slot, k) => {
    const p = fresh[k]
    if (p) colors[slot] = { ...colors[slot], hex: p.hex, photoId: photoIdOf(p, photoIds) }
  })
  return { colors: assignRoles(colors), basis: basisOf(photoIds) }
}

/** 3 to 8 colours: more come from the photos; fewer drop unlocked colours from the end. Missing roles are filled. */
export function setCount(colors: LabColor[], n: number, pool: PoolColor[], photoIds: string[]): LabColor[] {
  const target = Math.max(MIN_COLORS, Math.min(MAX_COLORS, Math.round(n)))
  if (target === colors.length) return colors
  if (target > colors.length) {
    const extra = draw(pool, target - colors.length, colors.map((c) => c.hex), [], 0)
    return fillRoles([...colors, ...extra.map((p) => ({ hex: p.hex, locked: false, role: null, photoId: photoIdOf(p, photoIds) }))])
  }
  const next = [...colors]
  for (let i = next.length - 1; i >= 0 && next.length > target; i--) if (!next[i].locked) next.splice(i, 1)
  // everything locked: drop from the end anyway
  next.length = Math.min(next.length, target)
  // a role that left with a dropped colour goes to another one
  return fillRoles(next)
}

// ─── Contrast (WCAG 2.x) ────────────────────────────────────────────────────

export function contrastRatio(a: string, b: string): number {
  const la = luminance(hexToRgb(a) ?? [0, 0, 0])
  const lb = luminance(hexToRgb(b) ?? [0, 0, 0])
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export interface Wcag {
  aa: boolean
  aaa: boolean
  aaLarge: boolean
  aaaLarge: boolean
}

export const wcag = (ratio: number): Wcag => ({ aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3, aaaLarge: ratio >= 4.5 })

/** «7,2:1». Never rounds up: 4,49 shows as 4,4 (it doesn't pass AA). */
export const formatRatio = (ratio: number) => `${(Math.floor(ratio * 10) / 10).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}:1`

/**
 * «Ajustar»: lightens or darkens the text colour just enough to reach
 * `target` against the background, keeping its hue. Picks the direction that
 * needs the smaller change.
 */
export function adjustText(text: string, bg: string, target = 4.5): { hex: string; changed: boolean; ratio: number } {
  const start = contrastRatio(text, bg)
  if (start >= target) return { hex: text.toUpperCase(), changed: false, ratio: start }
  const [L, a, b] = lab(text)
  const candidates: string[] = []
  for (const dir of [1, -1]) {
    const end = dir > 0 ? 100 : 0
    const at = (t: number) => rgbToHex(labToRgb([L + (end - L) * t, a * (1 - t), b * (1 - t)]))
    if (contrastRatio(at(1), bg) < target) continue
    // smallest step towards white / black that reaches the target
    let lo = 0
    let hi = 1
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (contrastRatio(at(mid), bg) >= target) hi = mid
      else lo = mid
    }
    candidates.push(at(hi))
  }
  const best = candidates.sort((x, y) => dist(x, text) - dist(y, text))[0] ?? (contrastRatio('#FFFFFF', bg) > contrastRatio('#000000', bg) ? '#FFFFFF' : '#000000')
  return { hex: best, changed: true, ratio: contrastRatio(best, bg) }
}

/** Text colour that reads best on a colour (for the accent button). */
export const inkOn = (bg: string, options: string[] = ['#090909', '#F1F0E8']) => options.reduce((a, c) => (contrastRatio(c, bg) > contrastRatio(a, bg) ? c : a), options[0])

// ─── Export ─────────────────────────────────────────────────────────────────

/** Token names: the role when it has one, otherwise «color-N». */
export function tokenNames(colors: LabColor[]): string[] {
  let n = 0
  return colors.map((c) => (c.role ? c.role : `color-${++n}`))
}

export const toHexList = (colors: LabColor[]) => colors.map((c) => c.hex.toUpperCase()).join('\n')

export function toCss(colors: LabColor[]): string {
  const names = tokenNames(colors)
  return `:root {\n${colors.map((c, i) => `  --color-${names[i].replace(/^color-/, '')}: ${c.hex.toUpperCase()};`).join('\n')}\n}\n`
}

/** Design tokens (W3C format), with roles. */
export function toTokens(colors: LabColor[]): string {
  const names = tokenNames(colors)
  const color = Object.fromEntries(colors.map((c, i) => [names[i], { $type: 'color', $value: c.hex.toUpperCase(), ...(c.role ? { $description: ROLE_LABEL[c.role] } : {}) }]))
  const roles = Object.fromEntries(ROLES.filter((r) => colors.some((c) => c.role === r)).map((r) => [r, `{color.${r}}`]))
  return `${JSON.stringify({ color, roles }, null, 2)}\n`
}

/** Adobe Swatch Exchange (.ase), version 1.0, RGB swatches. */
export function toAse(colors: LabColor[]): Uint8Array {
  const names = tokenNames(colors)
  const blocks = colors.map((c, i) => {
    const name = names[i]
    const nameLen = name.length + 1 // UTF-16 code units incl. the final 0
    const len = 2 + nameLen * 2 + 4 + 12 + 2
    const buf = new DataView(new ArrayBuffer(2 + 4 + len))
    let o = 0
    buf.setUint16(o, 0x0001) // colour entry
    o += 2
    buf.setUint32(o, len)
    o += 4
    buf.setUint16(o, nameLen)
    o += 2
    for (let k = 0; k < name.length; k++, o += 2) buf.setUint16(o, name.charCodeAt(k))
    o += 2 // terminating 0
    ;['R', 'G', 'B', ' '].forEach((ch, k) => buf.setUint8(o + k, ch.charCodeAt(0)))
    o += 4
    const [r, g, b] = hexToRgb(c.hex) ?? [0, 0, 0]
    for (const v of [r, g, b]) {
      buf.setFloat32(o, v / 255)
      o += 4
    }
    buf.setUint16(o, 2) // normal (not global/spot)
    return new Uint8Array(buf.buffer)
  })
  const head = new DataView(new ArrayBuffer(12))
  ;['A', 'S', 'E', 'F'].forEach((ch, k) => head.setUint8(k, ch.charCodeAt(0)))
  head.setUint16(4, 1)
  head.setUint16(6, 0)
  head.setUint32(8, blocks.length)
  const out = new Uint8Array(12 + blocks.reduce((a, b) => a + b.length, 0))
  out.set(new Uint8Array(head.buffer), 0)
  let at = 12
  for (const b of blocks) {
    out.set(b, at)
    at += b.length
  }
  return out
}

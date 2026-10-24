/**
 * Palette extraction: k-means over pixels in Lab space, so clusters follow
 * how colours look rather than raw RGB numbers. Pure and deterministic.
 */
import { deltaE, hexToRgb, labToRgb, rgbToHex, rgbToLab, type Lab, type RGB } from './color.ts'

export const PALETTE_SIZE = 5

/** Small seeded PRNG so the same photos always give the same palette. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Cluster {
  center: Lab
  size: number
}

/** k-means with k-means++ seeding. Returns clusters sorted by size (most dominant first). */
export function kmeans(points: Lab[], k: number, iterations = 12, seed = 7): Cluster[] {
  if (!points.length) return []
  k = Math.min(k, points.length)
  const rand = rng(seed)
  const centers: Lab[] = [points[Math.floor(rand() * points.length)]]
  const dist = new Float64Array(points.length)
  while (centers.length < k) {
    let total = 0
    for (let i = 0; i < points.length; i++) {
      dist[i] = Math.min(...centers.map((c) => deltaE(c, points[i]))) ** 2
      total += dist[i]
    }
    if (total === 0) break
    let r = rand() * total
    let pick = 0
    for (; pick < points.length - 1 && r > dist[pick]; pick++) r -= dist[pick]
    centers.push(points[pick])
  }

  const assign = new Int32Array(points.length)
  for (let it = 0; it < iterations; it++) {
    let moved = false
    for (let i = 0; i < points.length; i++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < centers.length; c++) {
        const d = deltaE(centers[c], points[i])
        if (d < bestD) {
          bestD = d
          best = c
        }
      }
      if (assign[i] !== best) moved = true
      assign[i] = best
    }
    const sums = centers.map(() => [0, 0, 0, 0])
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]]
      s[0] += points[i][0]
      s[1] += points[i][1]
      s[2] += points[i][2]
      s[3]++
    }
    sums.forEach((s, c) => {
      if (s[3]) centers[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]
    })
    if (!moved && it > 0) break
  }
  const sizes = centers.map(() => 0)
  for (let i = 0; i < points.length; i++) sizes[assign[i]]++
  return centers.map((center, i) => ({ center, size: sizes[i] })).filter((c) => c.size > 0).sort((a, b) => b.size - a.size)
}

/**
 * Up to `size` HEX colours from per-photo pixel samples. Every photo weighs
 * the same, whatever its sample size, so one busy photo can't take over.
 */
export function paletteFromPixels(samples: RGB[][], size = PALETTE_SIZE): string[] {
  const perPhoto = 400
  const points: Lab[] = []
  for (const sample of samples) {
    if (!sample.length) continue
    const step = Math.max(1, sample.length / perPhoto)
    for (let i = 0; i < sample.length; i += step) points.push(rgbToLab(sample[Math.floor(i)]))
  }
  // a few extra clusters, then drop near-duplicates so the 5 colours read as different
  const clusters = kmeans(points, size + 3)
  const picked: Lab[] = []
  for (const c of clusters) {
    if (picked.length >= size) break
    if (picked.every((p) => deltaE(p, c.center) > 10)) picked.push(c.center)
  }
  for (const c of clusters) {
    if (picked.length >= size) break
    if (!picked.includes(c.center)) picked.push(c.center)
  }
  return picked.map((lab) => rgbToHex(labToRgb(lab)))
}

/**
 * Fallback: the dominant colours Unsplash reports, one per photo, reduced to
 * at most `size`. With fewer photos than that, fewer colours: nothing invented.
 */
export function paletteFromReported(colors: (string | null)[], size = PALETTE_SIZE): string[] {
  const labs = colors.map((c) => (c ? hexToRgb(c) : null)).filter((c): c is RGB => c !== null).map(rgbToLab)
  if (labs.length <= size) {
    return labs.filter((l, i) => labs.findIndex((o) => deltaE(o, l) < 3) === i).map((l) => rgbToHex(labToRgb(l)))
  }
  return kmeans(labs, size).map((c) => rgbToHex(labToRgb(c.center)))
}

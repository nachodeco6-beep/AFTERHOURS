import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hexDistance, hexToRgb, labToRgb, rgbToLab, type RGB } from '../src/lib/color.ts'
import { kmeans, paletteFromPixels, paletteFromReported } from '../src/lib/palette.ts'

const BASE = ['#1B2A41', '#C9A227', '#E8E1D5', '#7A1F2B', '#4F7C5A']

function noisy(hex: string, n: number, seed: number): RGB[] {
  const [r, g, b] = hexToRgb(hex)!
  let s = seed
  const jitter = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 16
  return Array.from({ length: n }, () => [r + jitter(), g + jitter(), b + jitter()] as RGB)
}

test('Lab round trip', () => {
  for (const hex of BASE) {
    const rgb = hexToRgb(hex)!
    assert.deepEqual(labToRgb(rgbToLab(rgb)), rgb)
  }
})

test('k-means is deterministic and finds the clusters', () => {
  const points = BASE.flatMap((h, i) => noisy(h, 50, i + 1)).map(rgbToLab)
  const a = kmeans(points, 5)
  const b = kmeans(points, 5)
  assert.deepEqual(a, b)
  assert.equal(a.length, 5)
  assert.ok(a.every((c) => c.size === 50))
})

test('palette from pixels recovers the five photo colours', () => {
  // each "photo" mixes two of the base colours
  const samples = BASE.map((h, i) => [...noisy(h, 300, i + 10), ...noisy(BASE[(i + 1) % 5], 100, i + 20)])
  const palette = paletteFromPixels(samples)
  assert.equal(palette.length, 5)
  for (const base of BASE) {
    const closest = Math.min(...palette.map((p) => hexDistance(p, base)!))
    assert.ok(closest < 8, `${base} not found (closest ΔE ${closest.toFixed(1)}) in ${palette}`)
  }
  assert.ok(palette.every((p) => /^#[0-9A-F]{6}$/.test(p)))
})

test('every photo weighs the same', () => {
  const big = noisy('#FF0000', 5000, 1)
  const small = [noisy('#0000FF', 50, 2), noisy('#00FF00', 50, 3), noisy('#FFFF00', 50, 4), noisy('#FFFFFF', 50, 5)]
  const palette = paletteFromPixels([big, ...small])
  for (const c of ['#0000FF', '#00FF00', '#FFFF00', '#FFFFFF']) {
    assert.ok(Math.min(...palette.map((p) => hexDistance(p, c)!)) < 10, `${c} lost next to a huge photo`)
  }
})

test('fallback uses only the reported colours', () => {
  assert.deepEqual(paletteFromReported(['#112233', null, '#112233', '#AABBCC']), ['#112233', '#AABBCC'])
  const many = paletteFromReported(['#101010', '#121212', '#F0F0F0', '#EEEEEE', '#FF0000', '#FE0101', '#0000FF', '#00FF00'])
  assert.equal(many.length, 5)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deltaE, hexToRgb, rgbToLab } from '../src/lib/color.ts'
import { defaultRoles } from '../src/lib/colorLab.ts'
import { DIVERGENCE_THRESHOLD, paletteDistance, REWARN_DELTA, shouldWarn } from '../src/lib/divergence.ts'

const lab = (hex: string) => rgbToLab(hexToRgb(hex)!)
const d = (a: string, b: string) => deltaE(lab(a), lab(b))
const backgroundOf = (hexes: string[]) => hexes[Math.max(0, defaultRoles(hexes).indexOf('fondo'))]

const AI = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']

// ─── paletteDistance ────────────────────────────────────────────────────────

test('identical palettes are at distance 0', () => {
  assert.equal(paletteDistance(AI, [...AI]), 0)
})

test('a case put together by hand: half backgrounds, half the average of the matching', () => {
  const fotos = ['#000000', '#888888']
  // same background on both sides (black); the matching pairs black→black and grey→white
  assert.equal(backgroundOf(AI), '#000000')
  assert.equal(backgroundOf(fotos), '#000000')
  const expected = 0.5 * 0 + 0.5 * ((0 + d('#888888', '#FFFFFF')) / 2)
  assert.ok(Math.abs(paletteDistance(AI, fotos)! - expected) < 1e-9, `esperaba ${expected}, dio ${paletteDistance(AI, fotos)}`)
})

test('the matching is the cheapest one, not the greedy one', () => {
  // picked so that pairing each photo colour with its nearest (in order) loses:
  // greedy sends #808080 to #96707A and leaves #9A6E76 against #5A9A66 (total 71), the optimum crosses them (total 42)
  const fotos = ['#808080', '#9A6E76']
  const ai = ['#96707A', '#5A9A66']
  const straight = d(fotos[0], ai[0]) + d(fotos[1], ai[1])
  const crossed = d(fotos[0], ai[1]) + d(fotos[1], ai[0])
  assert.ok(d(fotos[0], ai[0]) < d(fotos[0], ai[1]), 'precondición: el codicioso elige derecho')
  assert.ok(crossed < straight, 'precondición: el óptimo cruza')
  const backgrounds = d(backgroundOf(ai), backgroundOf(fotos))
  const expected = 0.5 * backgrounds + 0.5 * (crossed / 2)
  const greedy = 0.5 * backgrounds + 0.5 * (straight / 2)
  const got = paletteDistance(ai, fotos)!
  assert.ok(Math.abs(got - expected) < 1e-9, `esperaba el óptimo ${expected}, dio ${got}`)
  assert.ok(Math.abs(got - greedy) > 1, 'el valor codicioso es otro')
})

test('with k < 5 each photo colour pairs with a different AI colour and the average is over k', () => {
  // one photo colour: D = 0.5·ΔE(fondos) + 0.5·(su mejor pareja)
  const fotos = ['#111111']
  const expected = 0.5 * d('#000000', '#111111') + 0.5 * d('#111111', '#000000')
  assert.ok(Math.abs(paletteDistance(AI, fotos)! - expected) < 1e-9)
})

test('with no photo colours there is nothing to compare: null', () => {
  assert.equal(paletteDistance(AI, []), null)
  assert.equal(paletteDistance([], ['#000000']), null)
})

// ─── shouldWarn (D20, N6, N7) ───────────────────────────────────────────────

const photoIds = ['a', 'b', 'c', 'd']
const base = { origin: 'ia' as const, d: DIVERGENCE_THRESHOLD, dismissal: null, photoIds }

test('warns from D ≥ 45 exactly (N7), and only with an AI palette', () => {
  assert.equal(shouldWarn(base), true)
  assert.equal(shouldWarn({ ...base, d: DIVERGENCE_THRESHOLD - 0.01 }), false)
  assert.equal(shouldWarn({ ...base, origin: 'manual', d: 90 }), false)
  assert.equal(shouldWarn({ ...base, origin: 'fotos', d: 90 }), false)
  assert.equal(shouldWarn({ ...base, d: null }), false)
})

test('dismissed, it comes back when D grew by 10 or more', () => {
  const dismissal = { d: 50, photoIds }
  assert.equal(shouldWarn({ ...base, d: 50, dismissal }), false)
  assert.equal(shouldWarn({ ...base, d: 50 + REWARN_DELTA - 0.01, dismissal }), false)
  assert.equal(shouldWarn({ ...base, d: 50 + REWARN_DELTA, dismissal }), true)
})

test('dismissed, it comes back when more than half of the photos of now were not there (N6)', () => {
  const dismissal = { d: 60, photoIds: ['a', 'b', 'c', 'd'] }
  // 2 de 4 fotos nuevas: la mitad justa, no vuelve
  assert.equal(shouldWarn({ ...base, d: 60, dismissal, photoIds: ['a', 'b', 'x', 'y'] }), false)
  // 3 de 4 nuevas: vuelve
  assert.equal(shouldWarn({ ...base, d: 60, dismissal, photoIds: ['a', 'x', 'y', 'z'] }), true)
  // muchas fotos nuevas pero D bajó del umbral: no hay aviso
  assert.equal(shouldWarn({ ...base, d: DIVERGENCE_THRESHOLD - 1, dismissal, photoIds: ['x', 'y', 'z', 'w'] }), false)
})

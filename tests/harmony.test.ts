import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MIN_DISTANCE, type LabColor } from '../src/lib/colorLab.ts'
import { distance, fromHarmony, growFree, HARMONIES, harmonyHues, harmonyPalette, hexToHsl, hslToHex, regenerateFree, rng, separate, surprise, type Harmony } from '../src/lib/harmony.ts'

const HEX = /^#[0-9A-F]{6}$/
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const minPairwise = (hexes: string[]) => {
  let min = Infinity
  for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) min = Math.min(min, distance(hexes[i], hexes[j]))
  return min
}

test('each harmony gives the right hue angles', () => {
  assert.deepEqual(harmonyHues(10, 'analogos'), [10, 340, 40])
  assert.deepEqual(harmonyHues(10, 'complementarios'), [10, 190])
  assert.deepEqual(harmonyHues(10, 'dividido'), [10, 160, 220])
  assert.deepEqual(harmonyHues(10, 'triada'), [10, 130, 250])
  assert.deepEqual(harmonyHues(10, 'tetrada'), [10, 100, 190, 280])
  assert.deepEqual(harmonyHues(10, 'monocromatica'), [10])
  // wraps round the wheel
  assert.deepEqual(harmonyHues(300, 'triada'), [300, 60, 180])
})

test('the saturated colours of a palette sit on the harmony hues', () => {
  const base = hslToHex([200, 70, 50])
  for (const h of HARMONIES.map((x) => x.id).filter((x) => x !== 'monocromatica')) {
    const hues = harmonyHues(hexToHsl(base)[0], h)
    const out = harmonyPalette(base, h, 8, rng(3), 0)
    assert.equal(out[0], base, 'the base stays as it is')
    for (const hex of out) {
      const [hue, s] = hexToHsl(hex)
      if (s < 40) continue // the tinted dark and light
      assert.ok(
        hues.some((x) => hueGap(x, hue) <= 8),
        `${h}: ${hex} (${hue.toFixed(0)}°) is on ${hues.join(', ')}`,
      )
    }
  }
  // monochromatic: one hue only
  const mono = harmonyPalette(base, 'monocromatica', 6, rng(5), 0)
  for (const hex of mono) {
    const [hue, s] = hexToHsl(hex)
    if (s > 3) assert.ok(hueGap(hue, 200) <= 8, `${hex} keeps the hue`)
  }
})

test('every palette is valid HEX, with no repeated or nearly equal colours', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rand = rng(seed)
    for (const { id } of HARMONIES) {
      for (const n of [3, 5, 8]) {
        const out = harmonyPalette(surprise(rand), id, n, rand)
        assert.equal(out.length, n)
        assert.ok(out.every((h) => HEX.test(h)), out.join(' '))
        assert.ok(minPairwise(out) >= MIN_DISTANCE, `${id} ×${n} (seed ${seed}): ${out.join(' ')}`)
      }
    }
  }
})

test('«Otra» keeps locked colours (place, colour and role) and changes the rest', () => {
  const rand = rng(42)
  let colors = fromHarmony('#C7FF3D', 'triada', 5, rand)
  colors = colors.map((c, i) => (i === 1 || i === 3 ? { ...c, locked: true } : c))
  for (let k = 0; k < 40; k++) {
    const before = colors
    const { colors: next } = regenerateFree(before, 'triada', rand, true)
    assert.equal(next.length, before.length)
    for (const i of [1, 3]) assert.deepEqual(next[i], before[i], 'locked colour untouched')
    assert.ok(
      [0, 2, 4].some((i) => next[i].hex !== before[i].hex),
      'something changed',
    )
    assert.ok(next.every((c) => HEX.test(c.hex)))
    assert.ok(minPairwise(next.map((c) => c.hex)) >= MIN_DISTANCE, next.map((c) => c.hex).join(' '))
    colors = next
  }
})

test('with everything locked, «Otra» changes nothing', () => {
  const colors: LabColor[] = fromHarmony('#336699', 'analogos', 4, rng(1)).map((c) => ({ ...c, locked: true }))
  assert.deepEqual(regenerateFree(colors, 'analogos', rng(2)).colors, colors)
})

test('a colour can always be pushed away from the others', () => {
  const crowd = ['#808080', '#7F7F7F', '#858585', '#F0F0F0', '#101010', '#FF0000', '#00FF00']
  const out = separate('#818181', crowd)
  assert.ok(HEX.test(out))
  assert.ok(crowd.every((c) => distance(c, out) >= MIN_DISTANCE))
})

test('growing adds a distinct colour, up to 8', () => {
  const rand = rng(9)
  let colors = fromHarmony('#E63946', 'complementarios' as Harmony, 3, rand)
  while (colors.length < 8) {
    colors = growFree(colors, 'complementarios', rand)
    assert.ok(minPairwise(colors.map((c) => c.hex)) >= MIN_DISTANCE)
  }
  assert.equal(growFree(colors, 'complementarios', rand).length, 8)
})

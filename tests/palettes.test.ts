import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isMood, MOODS } from '../src/data/moods.ts'
import { PALETTES } from '../src/data/palettes.ts'
import { MIN_DISTANCE } from '../src/lib/colorLab.ts'
import { distance, lightOf, LIGHTS } from '../src/lib/harmony.ts'

test('the inspiration palettes are valid: well-formed HEX, 5 colours, a known clima', () => {
  assert.ok(PALETTES.length >= 55 && PALETTES.length <= 65, `${PALETTES.length} palettes`)
  for (const p of PALETTES) {
    assert.equal(p.colors.length, 5, p.name)
    for (const c of p.colors) assert.match(c, /^#[0-9A-F]{6}$/, `${p.name}: ${c}`)
    assert.ok(isMood(p.mood), `${p.name}: ${p.mood}`)
    assert.ok(p.name.trim().length > 0)
  }
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length, 'unique ids')
  assert.equal(new Set(PALETTES.map((p) => p.name)).size, PALETTES.length, 'unique names')
})

test('no palette repeats a colour (nor two nearly equal ones)', () => {
  for (const p of PALETTES)
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(distance(p.colors[i], p.colors[j]) >= MIN_DISTANCE, `${p.name}: ${p.colors[i]} ~ ${p.colors[j]}`)
})

test('every clima and every light has palettes; the brand’s come first', () => {
  for (const m of MOODS)
    assert.ok(
      PALETTES.some((p) => p.mood === m),
      m,
    )
  for (const l of LIGHTS) assert.ok(PALETTES.filter((p) => lightOf(p.colors) === l).length >= 5, l)
  const brand = PALETTES.filter((p) => p.brand)
  assert.ok(brand.length >= 1)
  assert.deepEqual(PALETTES.slice(0, brand.length), brand)
  assert.deepEqual(PALETTES[0].colors.slice(0, 3), ['#090909', '#F1F0E8', '#C7FF3D'], '«After hours»')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addPair, addPalette, EMPTY_LABS, findPair, LABS_KEY, LABS_VERSION, migrateLabs, readLabs, removePair, removePalette, setLastPair, writeLabs } from '../src/lib/labs.ts'
import type { KeyValue } from '../src/lib/saved.ts'
import { DEFAULT_TYPE_STYLE } from '../src/lib/typography.ts'

class Memory implements KeyValue {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

const style = { ...DEFAULT_TYPE_STYLE, weight: 700, tracking: 0.02 }
const colors = [
  { hex: '#090909', role: 'fondo' as const },
  { hex: '#F1F0E8', role: 'texto' as const },
  { hex: '#C7FF3D', role: 'acento' as const },
]

test('favourites are written and read back', () => {
  const store = new Memory()
  let r = addPair(EMPTY_LABS, { display: 1, text: 1 }, style, 'p1', 10)
  r = addPalette(r, 'After hours', colors, 'c1', 20)
  r = setLastPair(r, { display: 4, text: 2 })
  assert.equal(writeLabs(store, r), 'ok')
  assert.ok(store.data.has(LABS_KEY))
  assert.deepEqual(readLabs(store), r)
  // removing
  r = removePalette(removePair(r, 'p1'), 'c1')
  assert.deepEqual([r.pairs, r.palettes], [[], []])
})

test('saving the same pair or palette again doesn’t duplicate it', () => {
  let r = addPair(EMPTY_LABS, { display: 1, text: 1 }, DEFAULT_TYPE_STYLE, 'p1', 10)
  r = addPair(r, { display: 2, text: 2 }, DEFAULT_TYPE_STYLE, 'p2', 11)
  r = addPair(r, { display: 1, text: 1 }, style, 'p3', 12)
  assert.deepEqual(
    r.pairs.map((p) => p.id),
    ['p1', 'p2'],
    'same id, moved first',
  )
  assert.deepEqual(findPair(r, { display: 1, text: 1 })?.style, style)
  r = addPalette(r, 'Una', colors, 'c1', 1)
  r = addPalette(r, 'Otra vez', colors, 'c2', 2)
  assert.equal(r.palettes.length, 1)
})

test('migration: an earlier shape (no version, bare fonts, bare HEX lists) is upgraded', () => {
  const r = migrateLabs({
    pairs: [{ display: 6, text: 6 }],
    palettes: [['#ff0000', '#00ff00', '#0000ff']],
  })
  assert.equal(r.version, LABS_VERSION)
  assert.deepEqual(r.pairs[0].fonts, { display: 6, text: 6 })
  assert.deepEqual(r.pairs[0].style, DEFAULT_TYPE_STYLE)
  assert.deepEqual(
    r.palettes[0].colors.map((c) => c.hex),
    ['#FF0000', '#00FF00', '#0000FF'],
  )
  assert.equal(r.palettes[0].name, 'Paleta')
  assert.equal(r.lastPair, null)
})

test('broken data is dropped without breaking anything', () => {
  const store = new Memory()
  store.setItem(LABS_KEY, '{not json')
  assert.deepEqual(readLabs(store), EMPTY_LABS)
  store.setItem(LABS_KEY, JSON.stringify([1, 2, 3]))
  assert.deepEqual(readLabs(store), EMPTY_LABS)
  const r = migrateLabs({
    version: 1,
    pairs: [
      { id: 'ok', savedAt: 5, fonts: { display: 1, text: 3 }, style: { weight: 'heavy', leading: 99 } },
      { id: 'gone', fonts: { display: 999, text: 1 } }, // a pair that doesn't exist
      'nope',
      null,
    ],
    palettes: [
      { id: 'ok', name: '  Noche  ', colors: [{ hex: '#000000', role: 'fondo' }, { hex: '#ffffff', role: 'fondo' }, { hex: '#c7ff3d', role: 'raro' }] },
      { id: 'bad-hex', colors: ['#000', 'blue', '#ffffff'] },
      { id: 'too-few', colors: ['#000000', '#ffffff'] },
      { id: 'too-many', colors: Array.from({ length: 9 }, (_, i) => `#0${i}0000`) },
    ],
    lastPair: { display: 'x', text: 2 },
  })
  assert.deepEqual(
    r.pairs.map((p) => p.id),
    ['ok'],
  )
  assert.equal(r.pairs[0].style.weight, null, 'a bad weight falls back')
  assert.equal(r.pairs[0].style.leading, DEFAULT_TYPE_STYLE.leading)
  assert.deepEqual(
    r.palettes.map((p) => p.id),
    ['ok'],
  )
  assert.equal(r.palettes[0].name, 'Noche')
  assert.deepEqual(
    r.palettes[0].colors.map((c) => c.role),
    ['fondo', null, null],
    'one role per colour, known roles only',
  )
  assert.equal(r.lastPair, null)
  assert.deepEqual(readLabs(null), EMPTY_LABS)
})

test('a full or blocked storage is reported, not thrown', () => {
  const full: KeyValue = {
    getItem: () => null,
    setItem: () => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    },
  }
  assert.equal(writeLabs(full, EMPTY_LABS), 'full')
  assert.equal(writeLabs(null, EMPTY_LABS), 'unavailable')
})

// Tests for the brandbook validator, with the real schema. Run with «npm test».
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Validator } from '@cfworker/json-schema'
import { test } from 'node:test'
import { MOODS } from '../../src/data/moods.ts'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import { validateBrandbook } from '../src/validate.ts'

const SCHEMA = JSON.parse(readFileSync(new URL('../../shared/ai/brandbook.schema.json', import.meta.url), 'utf8'))
const CATALOG = { pairs: TYPE_PAIRS, palettes: PALETTES }

const good = (extra = {}) => ({
  mood: 'urbano',
  pair_id: 12,
  palette_id: 'neon-y-asfalto',
  concepts: ['La noche empieza cuando cierra el taller', 'Ruido de calle, luz de sodio'],
  search_queries: ['neon alley at night', 'urban concrete texture'],
  applications: ['web', 'social', 'print'],
  rationale: 'El concepto pide una marca callejera y nocturna.',
  ...extra,
})

const check = (doc, catalog = CATALOG) => validateBrandbook(doc, catalog, SCHEMA)

function assertInvalid(doc, expected, catalog) {
  const { valid, errors } = check(doc, catalog)
  assert.equal(valid, false, `tenía que ser inválido: ${JSON.stringify(doc)}`)
  assert.ok(errors.some((e) => expected.test(e)), `se esperaba ${expected}, llegó: ${JSON.stringify(errors)}`)
}

test('a good brandbook is valid', () => {
  assert.deepEqual(check(good()), { valid: true, errors: [] })
})

test('something that is not an object is invalid', () => {
  for (const doc of [null, 'texto', 42, ['a']]) assertInvalid(doc, /no es un objeto JSON/)
})

test('the schema rejects bad shapes', () => {
  const missing = good()
  delete missing.palette_id
  assertInvalid(missing, /^schema:/)
  assertInvalid(good({ mood: 'Elegante' }), /^schema: #\/mood/)
  assertInvalid(good({ pair_id: 99 }), /^schema: #\/pair_id/)
  assertInvalid(good({ pair_id: 0 }), /^schema: #\/pair_id/)
  assertInvalid(good({ pair_id: 1.5 }), /^schema: #\/pair_id/)
  assertInvalid(good({ palette_id: '#FFF' }), /^schema: #\/palette_id/)
  assertInvalid(good({ color_palette: ['#FFF', '#000'] }), /^schema:/)
  assertInvalid(good({ concepts: ['una sola'] }), /^schema: #\/concepts/)
  assertInvalid(good({ search_queries: ['a', 'b', 'c', 'd', 'e'] }), /^schema: #\/search_queries/)
  assertInvalid(good({ applications: [] }), /^schema: #\/applications/)
  assertInvalid(good({ applications: ['Web'] }), /^schema: #\/applications/)
  assertInvalid(good({ rationale: '' }), /^schema: #\/rationale/)
})

test('pair_id has to exist in the catalog, even if the schema allows it', () => {
  const catalog = { pairs: TYPE_PAIRS.filter((p) => p.id !== 12), palettes: PALETTES }
  assertInvalid(good(), /^pair_id: 12 no existe/, catalog)
})

test('a pair without font families is incomplete', () => {
  const incomplete = { id: 12, display: { family: '' }, text: { family: 'Inter' } }
  assertInvalid(good(), /^pair_id: 12 esta incompleto/, { pairs: [incomplete], palettes: PALETTES })
})

test('palette_id has to exist in the catalog, even if the schema allows it', () => {
  const catalog = { pairs: TYPE_PAIRS, palettes: PALETTES.filter((p) => p.id !== 'neon-y-asfalto') }
  assertInvalid(good(), /^palette_id: 'neon-y-asfalto' no existe/, catalog)
})

test('the referenced palette has to have 5 unique 6-digit HEX colours', () => {
  const withColors = (colors) => ({
    pairs: TYPE_PAIRS,
    palettes: [{ id: 'neon-y-asfalto', mood: 'urbano', colors }],
  })
  assertInvalid(good(), /tiene 4 colores/, withColors(['#111111', '#222222', '#333333', '#444444']))
  assertInvalid(good(), /color\[1\] '#FFF' no es HEX/, withColors(['#111111', '#FFF', '#333333', '#444444', '#555555']))
  assertInvalid(good(), /color\[4\] '#aaaaaa' esta duplicado/, withColors(['#AAAAAA', '#222222', '#333333', '#444444', '#aaaaaa']))
})

test('search queries have to look like English', () => {
  const query = (q) => good({ search_queries: [q, 'urban concrete texture'] })
  assertInvalid(query('café brutalista'), /^search_queries\[0\].*no ASCII/)
  assertInvalid(query('1234 !!'), /^search_queries\[0\].*no tiene letras/)
  assertInvalid(query('luz de la calle'), /^search_queries\[0\].*palabras del espanol: de, la/)
  assert.equal(check(query('no son of a concrete wall')).valid, true, 'palabras que también son inglesas')
})

test('text that is only spaces counts as empty', () => {
  assertInvalid(good({ concepts: ['   ', 'Ruido de calle'] }), /^concepts\[0\]: esta vacio/)
  assertInvalid(good({ search_queries: ['neon alley', '   '] }), /^search_queries\[1\]: esta vacio/)
  assertInvalid(good({ rationale: '   ' }), /^rationale: esta vacio/)
})

test('the mood has to be the mood of the palette', () => {
  assertInvalid(good({ mood: 'lujo' }), /^mood: 'lujo' no coincide con el de la paleta 'neon-y-asfalto' \(urbano\)/)
})

test('the schema matches the catalog in src/data', () => {
  const { mood, pair_id, palette_id } = SCHEMA.anyOf[0].properties
  assert.deepEqual(mood.enum, MOODS)
  assert.deepEqual(palette_id.enum, PALETTES.map((p) => p.id))
  const ids = TYPE_PAIRS.map((p) => p.id)
  assert.equal(pair_id.minimum, Math.min(...ids))
  assert.equal(pair_id.maximum, Math.max(...ids))
  assert.equal(new Set(ids).size, ids.length, 'hay pair_id duplicados')
})

// ─── D16: off-topic ─────────────────────────────────────────────────────────

test('the off-topic answer is valid and skips the catalog', () => {
  assert.deepEqual(check({ fuera_de_tema: true }, { pairs: [], palettes: [] }), { valid: true, errors: [] })
})

test('nothing else passes as off-topic', () => {
  for (const doc of [
    { fuera_de_tema: false },
    { fuera_de_tema: 'true' },
    { fuera_de_tema: 1 },
    { fuera_de_tema: null },
    { fuera_de_tema: true, motivo: 'x' },
    { ...good(), fuera_de_tema: true },
    { ...good(), fuera_de_tema: false },
  ]) assertInvalid(doc, /^schema:/)
})

test('an empty object is invalid, and the errors are those of the brandbook', () => {
  assertInvalid({}, /^schema:/)
  assert.ok(!check({}).errors.some((e) => e.includes('fuera_de_tema')), JSON.stringify(check({}).errors))
})

test('choosing the branch gives the same verdict as the whole schema', () => {
  const whole = new Validator(SCHEMA, '2020-12', false)
  const docs = [
    good(),
    { fuera_de_tema: true },
    { fuera_de_tema: false },
    { fuera_de_tema: true, motivo: 'x' },
    { ...good(), fuera_de_tema: true },
    {},
    good({ mood: 'Elegante' }),
    good({ pair_id: 99 }),
    good({ color_palette: [] }),
    good({ concepts: ['una sola'] }),
  ]
  const accepted = docs.filter((doc) => {
    const verdict = whole.validate(doc).valid
    const errors = check(doc).errors
    assert.equal(!errors.some((e) => e.startsWith('schema:')), verdict, JSON.stringify(doc))
    return verdict
  })
  assert.equal(accepted.length, 2, 'solo el brandbook bueno y el fuera de tema exacto')
})

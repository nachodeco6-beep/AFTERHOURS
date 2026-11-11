import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_TYPE_STYLE } from '../src/lib/typography.ts'
import {
  contentOf,
  duplicateBoard,
  makeRecord,
  readBoards,
  readRecord,
  removeBoard,
  renameBoard,
  signature,
  STORAGE_KEY,
  upsert,
  writeBoards,
  type BoardContent,
  type KeyValue,
} from '../src/lib/saved.ts'
import { photo, L, P } from './helpers.ts'

const content = (over: Partial<BoardContent> = {}): BoardContent => ({
  title: 'Riviera',
  template: 'collage',
  format: 'vertical',
  include: { palette: true, type: true, keywords: false, notes: true },
  notes: 'Notas a mano',
  pairOffset: 2,
  fonts: { display: 6, text: 1 },
  typeStyle: { weight: 700, leading: 1.6, tracking: 0.05, uppercase: true },
  palette: null,
  concept: ['lujo', 'surf'],
  photos: [
    { photo: photo('a', L), tag: 'lujo' },
    { photo: photo('b', P), tag: 'surf' },
    { photo: photo('c', L), tag: 'lujo' },
  ],
  paletteOrigin: 'fotos',
  aiPalette: null,
  ai: null,
  divergenceDismissal: null,
  extras: {},
  ...over,
})

class Memory implements KeyValue {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

test('save → reload → open gives back the same board', () => {
  const store = new Memory()
  const record = makeRecord(content(), 'id1', 1000)
  assert.equal(writeBoards(store, upsert([], record)), 'ok')
  const [back] = readBoards(store)
  assert.deepEqual(back, record)
  assert.equal(signature(contentOf(back)), signature(content()), 'no unsaved changes right after opening')
})

test('the signature changes with any edit, not with the save time', () => {
  const base = signature(content())
  assert.notEqual(signature(content({ title: 'Otro' })), base)
  assert.notEqual(signature(content({ typeStyle: { ...DEFAULT_TYPE_STYLE } })), base)
  assert.notEqual(signature(content({ photos: [...content().photos].reverse() })), base)
  assert.equal(signature(contentOf(makeRecord(content(), 'x', 1))), signature(contentOf(makeRecord(content(), 'y', 2))))
})

test('older records are migrated: missing fields get their defaults', () => {
  const old = { id: 'old', title: 'Antiguo', template: 'grilla', photos: [{ photo: photo('a'), tag: 'mar' }], pairOffset: 1 }
  const r = readRecord(old)!
  assert.equal(r.version, 3)
  assert.equal(r.format, 'horizontal')
  assert.deepEqual(r.include, { palette: true, type: true, keywords: true, notes: false })
  assert.equal(r.fonts, null)
  assert.deepEqual(r.typeStyle, DEFAULT_TYPE_STYLE)
  assert.deepEqual(r.concept, [])
  assert.equal(r.template, 'grilla')
})

test('broken data never breaks the list', () => {
  const store = new Memory()
  store.setItem(STORAGE_KEY, '{not json')
  assert.deepEqual(readBoards(store), [])
  store.setItem(STORAGE_KEY, JSON.stringify({ a: 1 }))
  assert.deepEqual(readBoards(store), [])
  const good = makeRecord(content(), 'ok', 5)
  const noPhotos = { ...good, id: 'np', photos: [] }
  const badPhoto = { ...good, id: 'bp', photos: [{ photo: { id: 'x' }, tag: 't' }] }
  store.setItem(STORAGE_KEY, JSON.stringify([null, 'x', noPhotos, badPhoto, good]))
  assert.deepEqual(readBoards(store).map((r) => r.id), ['ok'])
  assert.deepEqual(readBoards(null), [])
})

test('unknown values fall back instead of leaking in', () => {
  const r = readRecord({ ...makeRecord(content(), 'z', 1), template: 'mosaico', format: 'cuadrado', fonts: { display: 'x' } })!
  assert.equal(r.template, 'editorial')
  assert.equal(r.format, 'horizontal')
  assert.equal(r.fonts, null)
})

test('the photos keep their order and their credits', () => {
  const r = readRecord(JSON.parse(JSON.stringify(makeRecord(content(), 'c', 1))))!
  assert.deepEqual(r.photos.map((p) => p.photo.id), ['unsplash:a', 'unsplash:b', 'unsplash:c'])
  assert.equal(r.photos[1].photo.author.name, 'author-b')
  assert.match(r.photos[1].photo.author.profileUrl, /unsplash\.com/)
})

test('most recent first; save again replaces in place', () => {
  let list = upsert([], makeRecord(content({ title: 'A' }), 'a', 1))
  list = upsert(list, makeRecord(content({ title: 'B' }), 'b', 2))
  list = upsert(list, makeRecord(content({ title: 'A2' }), 'a', 3))
  assert.deepEqual(list.map((r) => r.title), ['A2', 'B'])
  const store = new Memory()
  writeBoards(store, [...list].reverse())
  assert.deepEqual(readBoards(store).map((r) => r.id), ['a', 'b'])
})

test('duplicate, rename and remove', () => {
  let list = [makeRecord(content(), 'a', 1)]
  list = duplicateBoard(list, 'a', 'b', 9)
  assert.deepEqual(list.map((r) => [r.id, r.title]), [['b', 'Riviera (copia)'], ['a', 'Riviera']])
  assert.deepEqual(list[0].photos, list[1].photos)
  list = renameBoard(list, 'b', '  Costa  ')
  assert.equal(list[0].title, 'Costa')
  assert.equal(renameBoard(list, 'b', '   ')[0].title, 'Costa', 'an empty name is ignored')
  list = removeBoard(list, 'a')
  assert.deepEqual(list.map((r) => r.id), ['b'])
})

test('a full or blocked storage is reported, not thrown', () => {
  const full: KeyValue = {
    getItem: () => null,
    setItem: () => {
      throw Object.assign(new Error('full'), { name: 'QuotaExceededError' })
    },
  }
  const blocked: KeyValue = {
    getItem: () => null,
    setItem: () => {
      throw new Error('SecurityError')
    },
  }
  const list = [makeRecord(content(), 'a', 1)]
  assert.equal(writeBoards(full, list), 'full')
  assert.equal(writeBoards(blocked, list), 'unavailable')
  assert.equal(writeBoards(null, list), 'unavailable')
})

// ─── v3: campos de la IA y campos desconocidos (N9, D22, D23) ────────────────

const brandbook = {
  mood: 'urbano' as const,
  pair_id: 7,
  palette_id: 'after-hours',
  concepts: ['frase uno', 'frase dos'],
  search_queries: ['night street'],
  applications: ['web'],
  rationale: 'porque sí',
}

const aiEdit = {
  colors: [
    { hex: '#090909', locked: false, role: 'fondo' as const, photoId: null },
    { hex: '#F1F0E8', locked: false, role: 'texto' as const, photoId: null },
    { hex: '#C7FF3D', locked: false, role: 'acento' as const, photoId: null },
  ],
  basis: 'unsplash:a|unsplash:b',
}

test('a v2 record opens the same: an edited palette is «manual», none is «fotos»', () => {
  const v2 = { ...makeRecord(content(), 'v2', 1), version: 2 } as Record<string, unknown>
  delete v2.paletteOrigin
  delete v2.aiPalette
  delete v2.ai
  delete v2.divergenceDismissal
  delete v2.extras
  const sinPaleta = readRecord(v2)!
  assert.equal(sinPaleta.paletteOrigin, 'fotos')
  assert.equal(sinPaleta.aiPalette, null)
  assert.equal(sinPaleta.ai, null)
  assert.equal(sinPaleta.divergenceDismissal, null)
  assert.deepEqual(sinPaleta.extras, {})
  const conPaleta = readRecord({ ...v2, palette: aiEdit })!
  assert.equal(conPaleta.paletteOrigin, 'manual')
})

test('a v1 record opens as «fotos»', () => {
  const v1 = { version: 1, id: 'v1', title: 'Viejo', template: 'collage', photos: [{ photo: photo('a', L), tag: 'mar' }] }
  const r = readRecord(v1)!
  assert.equal(r.paletteOrigin, 'fotos')
  assert.equal(r.ai, null)
})

test('a v3 round trip keeps every AI field', () => {
  const store = new Memory()
  const c = content({
    palette: aiEdit,
    paletteOrigin: 'ia',
    aiPalette: aiEdit,
    ai: brandbook,
    divergenceDismissal: { d: 52.5, photoIds: ['unsplash:a', 'unsplash:b'] },
  })
  writeBoards(store, [makeRecord(c, 'ia1', 7)])
  const [back] = readBoards(store)
  assert.equal(back.paletteOrigin, 'ia')
  assert.deepEqual(back.aiPalette, aiEdit)
  assert.deepEqual(back.ai, brandbook)
  assert.deepEqual(back.divergenceDismissal, { d: 52.5, photoIds: ['unsplash:a', 'unsplash:b'] })
  assert.equal(signature(contentOf(back)), signature(c), 'reabrir no marca cambios sin guardar')
})

test('a corrupt ai or aiPalette is dropped as a field and the board opens anyway', () => {
  const good = makeRecord(content({ ai: brandbook, aiPalette: aiEdit }), 'x', 1)
  const badAi = readRecord({ ...good, ai: { mood: 'urbano', pair_id: 'siete' } })!
  assert.equal(badAi.ai, null)
  assert.equal(readRecord({ ...good, ai: { ...brandbook, concepts: [] } })!.ai, null)
  assert.equal(readRecord({ ...good, ai: { ...brandbook, mood: 'festivo' } })!.ai, null)
  const badPalette = readRecord({ ...good, aiPalette: { colors: [{ hex: 'nope' }], basis: 'x' } })!
  assert.equal(badPalette.aiPalette, null)
  assert.equal(badPalette.title, 'Riviera', 'el tablero se abre igual')
  assert.equal(readRecord({ ...good, divergenceDismissal: { d: 'mucho', photoIds: ['a'] } })!.divergenceDismissal, null)
  assert.equal(readRecord({ ...good, divergenceDismissal: { d: 50, photoIds: [7] } })!.divergenceDismissal, null)
})

test('an «ia» origin without an active palette falls back to «fotos»', () => {
  const r = readRecord({ ...makeRecord(content({ paletteOrigin: 'ia', aiPalette: aiEdit, ai: brandbook }), 'x', 1), palette: null })!
  assert.equal(r.paletteOrigin, 'fotos')
  assert.deepEqual(r.aiPalette, aiEdit, 'la paleta de la IA guardada queda')
})

test('the signature changes with the palette origin and with the brandbook', () => {
  const base = signature(content({ palette: aiEdit, paletteOrigin: 'manual' }))
  assert.notEqual(signature(content({ palette: aiEdit, paletteOrigin: 'ia' })), base)
  assert.notEqual(signature(content({ palette: aiEdit, paletteOrigin: 'manual', ai: brandbook })), base)
})

test('fields this version does not know survive a save, flat in storage (N9)', () => {
  const store = new Memory()
  // lo que guardaría una versión futura: un campo que esta versión no conoce
  const futureRaw = { ...JSON.parse(JSON.stringify(makeRecord(content(), 'fut', 3))), logo_v5: { simbolo: 'rayo' }, version: 4 }
  delete futureRaw.extras
  store.setItem(STORAGE_KEY, JSON.stringify([futureRaw]))
  const [opened] = readBoards(store)
  assert.deepEqual(opened.extras, { logo_v5: { simbolo: 'rayo' } })
  // esta versión lo guarda de nuevo: el campo vuelve plano, donde la versión nueva lo busca
  const again = new Memory()
  writeBoards(again, [opened])
  const raw = JSON.parse(again.getItem(STORAGE_KEY)!)[0]
  assert.deepEqual(raw.logo_v5, { simbolo: 'rayo' })
  assert.ok(!('extras' in raw), 'extras no queda anidado en el storage')
  assert.equal(raw.version, 3, 'los campos conocidos son los de esta versión')
})

test('a known field never loses against an extras collision', () => {
  const store = new Memory()
  writeBoards(store, [makeRecord(content({ extras: { title: 'intruso', libre: 1 } }), 'x', 1)])
  const raw = JSON.parse(store.getItem(STORAGE_KEY)!)[0]
  assert.equal(raw.title, 'Riviera')
  assert.equal(raw.libre, 1)
})

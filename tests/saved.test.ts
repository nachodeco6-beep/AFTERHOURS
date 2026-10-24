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
  concept: ['lujo', 'surf'],
  photos: [
    { photo: photo('a', L), tag: 'lujo' },
    { photo: photo('b', P), tag: 'surf' },
    { photo: photo('c', L), tag: 'lujo' },
  ],
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
  assert.equal(r.version, 1)
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

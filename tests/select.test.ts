import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeSelection, orientationOf, type Entry } from '../src/lib/select.ts'
import { L, P, S, photo } from './helpers.ts'

const e = (tag: string, ...args: Parameters<typeof photo>): Entry => ({ tag, photo: photo(...args) })

test('orientation classification', () => {
  assert.equal(orientationOf(photo('l', L)), 'landscape')
  assert.equal(orientationOf(photo('p', P)), 'portrait')
  assert.equal(orientationOf(photo('s', S)), 'square')
})

test('never removes or replaces the visitor picks, and fills up to 9', () => {
  const picks = [e('surf', 'a', L), e('surf', 'b', P)]
  const pool = Array.from({ length: 20 }, (_, i) => e(i % 2 ? 'surf' : 'noche', `p${i}`, i % 3 ? L : P))
  const added = completeSelection(picks, pool, ['surf', 'noche'])
  assert.equal(picks.length + added.length, 9)
  assert.ok(added.every((a) => !picks.some((p) => p.photo.id === a.photo.id)), 'no picks re-added')
  assert.equal(new Set(added.map((a) => a.photo.id)).size, added.length, 'no duplicates')
})

test('returns nothing when the selection already reaches the target', () => {
  const picks = Array.from({ length: 9 }, (_, i) => e('surf', `a${i}`))
  assert.deepEqual(completeSelection(picks, [e('surf', 'x')], ['surf']), [])
})

test('every tag with candidates ends up represented', () => {
  const picks = [e('surf', 'a'), e('surf', 'b'), e('surf', 'c')]
  const pool = [
    ...Array.from({ length: 10 }, (_, i) => e('surf', `s${i}`)),
    e('arena', 'ar1'),
    e('flash', 'fl1'),
    e('flash', 'fl2'),
  ]
  const added = completeSelection(picks, pool, ['surf', 'arena', 'flash', 'sin-fotos'])
  const tags = new Set([...picks, ...added].map((x) => x.tag))
  assert.ok(tags.has('arena') && tags.has('flash'))
})

test('no photographer appears more than twice in the final selection', () => {
  const picks = [e('surf', 'a', { author: 'Ana' }), e('surf', 'b', { author: 'Ana' })]
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => e('surf', `ana${i}`, { author: 'Ana' })),
    ...Array.from({ length: 6 }, (_, i) => e('surf', `bo${i}`, { author: 'Bo' })),
    ...Array.from({ length: 6 }, (_, i) => e('surf', `x${i}`)),
  ]
  const added = completeSelection(picks, pool, ['surf'])
  const final = [...picks, ...added]
  const count = (name: string) => final.filter((x) => x.photo.author.name === name).length
  assert.equal(count('Ana'), 2, 'no more Ana: already at 2')
  assert.ok(count('Bo') <= 2)
  assert.equal(final.length, 9)
})

test('prefers colours close to the picks', () => {
  const picks = [e('surf', 'red1', { color: '#c0392b' }), e('surf', 'red2', { color: '#d35400' })]
  const pool = [e('surf', 'blue', { color: '#2e86de' }), e('surf', 'orange', { color: '#e67e22' })]
  const [first] = completeSelection(picks, pool, ['surf'], 3)
  assert.equal(first.photo.id, 'unsplash:orange')
})

test('mixes orientations instead of piling up one kind', () => {
  const picks = [e('surf', 'p1', P), e('surf', 'p2', P), e('surf', 'p3', P)]
  // more portraits than landscapes in the pool, and portraits are listed first (more relevant)
  const pool = [...Array.from({ length: 8 }, (_, i) => e('surf', `pp${i}`, P)), ...Array.from({ length: 4 }, (_, i) => e('surf', `ll${i}`, L))]
  const added = completeSelection(picks, pool, ['surf'])
  const land = added.filter((a) => orientationOf(a.photo) === 'landscape').length
  assert.ok(land >= 3, `expected several landscapes, got ${land}`)
})

test('stops when the pool runs out', () => {
  const added = completeSelection([e('surf', 'a')], [e('surf', 'b'), e('surf', 'c')], ['surf'])
  assert.equal(added.length, 2)
})

test('works with no picks at all', () => {
  const pool = Array.from({ length: 12 }, (_, i) => e(i < 6 ? 'a' : 'b', `n${i}`, i % 2 ? L : P))
  const added = completeSelection([], pool, ['a', 'b'])
  assert.equal(added.length, 9)
  assert.ok(new Set(added.map((x) => x.tag)).size === 2)
})

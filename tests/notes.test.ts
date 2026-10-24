import assert from 'node:assert/strict'
import { test } from 'node:test'
import { writeNotes } from '../src/lib/notes.ts'

test('notes describe the board from its own data', () => {
  const text = writeNotes({
    tags: ['surf', 'California 90s'],
    palette: ['#1A1A1A', '#F2E8D5', '#C8553D', '#E2A04B', '#2F4858'],
    ratios: [0.67, 0.75, 0.8, 1.5],
    pair: { display: 'Pacifico', text: 'Quicksand', category: 'Verano' },
  })
  assert.match(text, /^Concepto: surf, California 90s\./)
  assert.match(text, /contraste alto/)
  assert.match(text, /3 verticales, 1 horizontal|1 horizontal, 3 verticales/)
  assert.match(text, /Predomina el formato vertical/)
  assert.match(text, /Pacifico para titulares y Quicksand para texto \(verano\)/)
})

test('notes skip what is missing', () => {
  assert.equal(writeNotes({ tags: [], palette: [], ratios: [], pair: null }), '')
  assert.doesNotMatch(writeNotes({ tags: ['a'], palette: [], ratios: [1], pair: null }), /Color|Tipografía/)
})

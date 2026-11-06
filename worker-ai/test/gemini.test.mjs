// Tests for the conversion to Gemini's responseSchema. Run with «npm test».
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { toGeminiSchema } from '../src/gemini.ts'

const SCHEMA = JSON.parse(readFileSync(new URL('../../shared/ai/brandbook.schema.json', import.meta.url), 'utf8'))

test('every key Gemini rejects is dropped, at any depth', () => {
  const unsupported = ['$schema', '$id', 'title', 'additionalProperties', 'unevaluatedProperties', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', 'const']
  for (const key of unsupported) {
    const converted = toGeminiSchema({
      type: 'object',
      [key]: 'x',
      properties: { a: { type: 'array', [key]: 'x', items: { type: 'string', [key]: 'x' } } },
    })
    assert.deepEqual(
      converted,
      { type: 'object', properties: { a: { type: 'array', items: { type: 'string' } } } },
      key,
    )
  }
})

test('a property named like a dropped key stays', () => {
  const converted = toGeminiSchema({ properties: { title: { type: 'string', title: 'x' }, default: { type: 'number' } } })
  assert.deepEqual(converted, { properties: { title: { type: 'string' }, default: { type: 'number' } } })
})

test('the real schema keeps its rules and loses only what Gemini rejects', () => {
  const converted = toGeminiSchema(SCHEMA)
  assert.deepEqual(Object.keys(converted), ['anyOf'])
  const [book, offTopic] = converted.anyOf
  const [schemaBook] = SCHEMA.anyOf
  assert.deepEqual(Object.keys(book).sort(), ['properties', 'required', 'type'])
  assert.deepEqual(book.required, schemaBook.required)
  assert.deepEqual(book.properties.palette_id.enum, schemaBook.properties.palette_id.enum)
  assert.equal(book.properties.palette_id.enum.length, 61)
  assert.equal(book.properties.pair_id.maximum, 62)
  assert.equal(book.properties.applications.items.pattern, schemaBook.properties.applications.items.pattern)
  // Gemini answers 400 to `const` and to `enum: [true]` (measured on 06/11): the validator checks the value.
  assert.deepEqual(offTopic, { type: 'object', required: ['fuera_de_tema'], properties: { fuera_de_tema: { type: 'boolean' } } })
})

test('anyOf branches are converted too, and a property named anyOf stays', () => {
  const converted = toGeminiSchema({ anyOf: [{ title: 'x', additionalProperties: false, properties: { a: { const: 1 } } }], properties: { anyOf: { title: 'y' } } })
  assert.deepEqual(converted, { anyOf: [{ properties: { a: {} } }], properties: { anyOf: {} } })
})

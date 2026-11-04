// Tests for the conversion to Gemini's responseSchema. Run with «npm test».
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { toGeminiSchema } from '../src/gemini.ts'

const SCHEMA = JSON.parse(readFileSync(new URL('../../shared/ai/brandbook.schema.json', import.meta.url), 'utf8'))

test('every key Gemini rejects is dropped, at any depth', () => {
  const unsupported = ['$schema', '$id', 'title', 'additionalProperties', 'unevaluatedProperties', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly']
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
  assert.deepEqual(Object.keys(converted).sort(), ['properties', 'required', 'type'])
  assert.deepEqual(converted.required, SCHEMA.required)
  assert.deepEqual(converted.properties.palette_id.enum, SCHEMA.properties.palette_id.enum)
  assert.equal(converted.properties.palette_id.enum.length, 61)
  assert.equal(converted.properties.pair_id.maximum, 62)
  assert.equal(converted.properties.applications.items.pattern, SCHEMA.properties.applications.items.pattern)
})

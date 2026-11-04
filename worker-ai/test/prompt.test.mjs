// Tests for the prompt render, against the real template and catalog. Run with «npm test».
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { MOODS } from '../../src/data/moods.ts'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import { formatPairs, formatPalettes, renderSystemPrompt } from '../src/prompt.ts'

const TEMPLATE = readFileSync(new URL('../../shared/ai/brandbook_system_prompt_v4.md', import.meta.url), 'utf8')

test('the catalog has the expected size', () => {
  assert.equal(TYPE_PAIRS.length, 62)
  assert.equal(PALETTES.length, 61)
  assert.equal(MOODS.length, 7)
})

test('pairs use the exact line format, one per line', () => {
  const lines = formatPairs(TYPE_PAIRS).split('\n')
  assert.equal(lines.length, 62)
  assert.equal(lines[0], '1 — Playfair Display + Montserrat — Lujo y moda — lujo, moda, sensual, elegante')
  assert.equal(lines[4], '5 — Permanent Marker + Questrial — Urbano — urbano, juvenil, pop, callejero')
})

test('palettes use the exact line format, one per line', () => {
  const lines = formatPalettes(PALETTES).split('\n')
  assert.equal(lines.length, 61)
  assert.equal(lines[0], 'after-hours — After hours (urbano) — #090909 #F1F0E8 #C7FF3D #2A2A28 #8F8E87')
  assert.equal(lines[2], 'revista-suiza — Revista suiza (editorial) — #F2F0EB #111111 #E3001B #9C9A94 #D2CCBE')
})

test('the render puts the catalog in the template and leaves no placeholders', () => {
  const prompt = renderSystemPrompt(TEMPLATE, TYPE_PAIRS, PALETTES)
  assert.ok(!prompt.includes('{{'))
  assert.ok(prompt.includes(formatPairs(TYPE_PAIRS)))
  assert.ok(prompt.includes(formatPalettes(PALETTES)))
  assert.ok(prompt.startsWith('# Brandbook System Prompt'))
})

test('a template without a placeholder is an error', () => {
  assert.throws(() => renderSystemPrompt('solo {{CATALOGO_PALETAS}}', TYPE_PAIRS, PALETTES), /CATALOGO_PARES/)
  assert.throws(() => renderSystemPrompt('solo {{CATALOGO_PARES}}', TYPE_PAIRS, PALETTES), /CATALOGO_PALETAS/)
})

test('an unknown placeholder is an error', () => {
  assert.throws(
    () => renderSystemPrompt('{{CATALOGO_PARES}}\n{{CATALOGO_PALETAS}}\n{{OTRO}}', TYPE_PAIRS, PALETTES),
    /Quedaron placeholders sin reemplazar:\n\{\{OTRO\}\}/,
  )
})

test('CRLF line endings in the template do not change the prompt', () => {
  const lf = TEMPLATE.replace(/\r\n/g, '\n')
  const crlf = lf.replace(/\n/g, '\r\n')
  assert.ok(crlf.includes('\r\n'))
  assert.equal(renderSystemPrompt(crlf, TYPE_PAIRS, PALETTES), renderSystemPrompt(lf, TYPE_PAIRS, PALETTES))
})

test('a dollar sign in the catalog stays literal', () => {
  const pair = { ...TYPE_PAIRS[0], category: "$& $' $`" }
  const prompt = renderSystemPrompt('{{CATALOGO_PARES}}|{{CATALOGO_PALETAS}}', [pair], [])
  assert.ok(prompt.includes("$& $' $`"))
})

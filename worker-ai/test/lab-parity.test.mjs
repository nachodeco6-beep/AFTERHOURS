// Compares the Worker's prompt and validator with the Python lab (afterhours-ai/), which lives
// outside this repo, in the parent folder. Without the lab these tests are reported as skipped.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import { toGeminiSchema } from '../src/gemini.ts'
import { renderSystemPrompt } from '../src/prompt.ts'
import { validateBrandbook } from '../src/validate.ts'

const WEB = fileURLToPath(new URL('../../', import.meta.url))
const WORKSPACE = resolve(WEB, '../..')
const PYTHON = join(WORKSPACE, '.venv/Scripts/python.exe')
const DUMP = join(WORKSPACE, 'afterhours-ai/scripts/parity_dump.py')
const FIXTURES = join(WORKSPACE, 'afterhours-ai/tests/fixtures')
const skip = existsSync(PYTHON) && existsSync(DUMP) ? false : 'el laboratorio Python no está en esta compu'

const TEMPLATE = readFileSync(join(WEB, 'shared/ai/brandbook_system_prompt_v4.md'), 'utf8')
const SCHEMA = JSON.parse(readFileSync(join(WEB, 'shared/ai/brandbook.schema.json'), 'utf8'))
const CATALOG = { pairs: TYPE_PAIRS, palettes: PALETTES }

function runLab(cases) {
  const run = spawnSync(PYTHON, [DUMP], { input: JSON.stringify({ cases }), encoding: 'utf8', maxBuffer: 2 ** 24 })
  assert.equal(run.status, 0, `parity_dump.py falló: ${run.stderr}`)
  return JSON.parse(run.stdout)
}

const base = JSON.parse(skip ? '{}' : readFileSync(join(FIXTURES, 'ok.json'), 'utf8'))
const INLINE = {
  'query con tilde': { ...base, search_queries: ['café brutalista', 'urban wall'] },
  'query en español': { ...base, search_queries: ['luz de la calle', 'urban wall'] },
  'query sin letras': { ...base, search_queries: ['1234 !!', 'urban wall'] },
  'query inglesa con palabras ambiguas': { ...base, search_queries: ['no son of a wall', 'urban wall'] },
  'frase con espacios': { ...base, concepts: ['   ', 'Ruido de calle'] },
  'query con espacios': { ...base, search_queries: ['neon alley', '   '] },
  'rationale con espacios': { ...base, rationale: '   ' },
  'mood distinto al de la paleta': { ...base, mood: 'retro' },
  'varios errores a la vez': { ...base, mood: 'lujo', rationale: ' ', search_queries: ['café', 'en la calle'] },
  'otro par y paleta válidos': { ...base, pair_id: 62, palette_id: 'after-hours', mood: 'urbano' },
  'no es un objeto': ['a'],
}

test('the Worker and Python render the same prompt', { skip }, () => {
  const { prompt } = runLab([])
  const mine = renderSystemPrompt(TEMPLATE, TYPE_PAIRS, PALETTES)
  assert.ok(prompt.length > 10000, `prompt de Python sospechosamente corto: ${prompt.length}`)
  assert.equal(mine, prompt)
})

test('the Worker and Python send Gemini the same responseSchema', { skip }, () => {
  const { gemini_schema: lab } = runLab([])
  assert.equal(lab.properties.palette_id.enum.length, 61, 'schema de Python sospechoso')
  assert.deepEqual(toGeminiSchema(SCHEMA), lab)
})

test('the Worker and Python agree on every fixture and edge case', { skip }, () => {
  const files = readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort()
  assert.deepEqual(files, [
    'bad_mood.json',
    'bad_mood_palette.json',
    'bad_pair_id.json',
    'bad_palette.json',
    'extra_colors.json',
    'missing_palette.json',
    'ok.json',
  ])
  const cases = [
    ...files.map((f) => [f, JSON.parse(readFileSync(join(FIXTURES, f), 'utf8'))]),
    ...Object.entries(INLINE),
  ]
  const { verdicts } = runLab(cases.map(([, doc]) => doc))
  assert.equal(verdicts.length, cases.length)

  const summary = cases.map(([name, doc], i) => {
    const mine = validateBrandbook(doc, CATALOG, SCHEMA)
    const lab = verdicts[i]
    assert.equal(mine.valid, lab.valid, `${name}: Worker ${JSON.stringify(mine.errors)} / Python ${JSON.stringify(lab.errors)}`)
    // Schema messages come from different libraries; everything else must match word for word.
    const words = (errors) => errors.filter((e) => !e.startsWith('schema:')).sort()
    assert.deepEqual(words(mine.errors), words(lab.errors), name)
    assert.equal(mine.errors.some((e) => e.startsWith('schema:')), lab.errors.some((e) => e.startsWith('schema:')), name)
    return [name, mine.valid]
  })

  // Guards against both validators accepting (or rejecting) everything.
  const validNames = summary.filter(([, valid]) => valid).map(([name]) => name).sort()
  assert.deepEqual(validNames, ['ok.json', 'otro par y paleta válidos', 'query inglesa con palabras ambiguas'])
})

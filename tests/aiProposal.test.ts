import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Brandbook, GenerateBrandbookResponse } from '../shared/types.ts'
import {
  applyProposal,
  conceptProblem,
  nextPaletteOrigin,
  reduceAiRequest,
  restoreAiPalette,
  suggestedQueries,
  type AiRequestState,
  type PaletteState,
} from '../src/lib/aiProposal.ts'
import { basisOf, type PaletteEdit } from '../src/lib/colorLab.ts'
import { PALETTES } from '../src/data/palettes.ts'

const brandbook: Brandbook = {
  mood: 'urbano',
  pair_id: 7,
  palette_id: 'after-hours',
  concepts: ['frase uno', 'frase dos'],
  search_queries: ['night street', 'neon sign'],
  applications: ['web'],
  rationale: 'porque sí',
}

const photoIds = ['unsplash:a', 'unsplash:b', 'unsplash:c']

// ─── applyProposal (D15) ────────────────────────────────────────────────────

test('apply() touches only what D15 allows: a loaded board keeps everything else', () => {
  // a board with every user decision loaded (what apply() must never touch)
  const board = {
    title: 'Mi marca',
    template: 'collage',
    format: 'a4',
    include: { palette: true, type: true, keywords: false, notes: true },
    notes: 'notas mías',
    pairOffset: 4,
    fonts: { display: 2, text: 3 },
    typeStyle: { weight: 700, leading: 1.6, tracking: 0.05, uppercase: true },
    paletteEdit: null,
    savedId: 'b1',
    buildId: 7,
  }
  const patch = applyProposal(brandbook, photoIds)
  assert.ok(patch)
  const merged = { ...board, ...patch }
  for (const field of ['title', 'template', 'format', 'include', 'notes', 'pairOffset', 'typeStyle', 'savedId', 'buildId'] as const) {
    assert.deepEqual(merged[field], board[field], `apply() no debe tocar ${field}`)
  }
  assert.deepEqual(Object.keys(patch).sort(), ['ai', 'aiPalette', 'divergenceDismissal', 'fonts', 'paletteEdit', 'paletteOrigin'])
})

test('apply() brings the pair, the catalogue palette with roles, origin «ia» and the brandbook', () => {
  const patch = applyProposal(brandbook, photoIds)
  assert.ok(patch)
  assert.deepEqual(patch.fonts, { display: 7, text: 7 })
  assert.equal(patch.paletteOrigin, 'ia')
  assert.equal(patch.ai, brandbook)
  assert.equal(patch.divergenceDismissal, null)
  assert.equal(patch.paletteEdit.basis, basisOf(photoIds))
  const catalogue = PALETTES.find((p) => p.id === 'after-hours')!
  assert.deepEqual(
    patch.paletteEdit.colors.map((c) => c.hex.toUpperCase()),
    catalogue.colors.map((c) => c.toUpperCase()),
  )
  assert.ok(patch.paletteEdit.colors.some((c) => c.role === 'fondo'))
  assert.ok(patch.paletteEdit.colors.every((c) => !c.locked && c.photoId === null))
})

test('aiPalette is a copy: editing the active palette never rewrites it', () => {
  const patch = applyProposal(brandbook, photoIds)
  assert.ok(patch)
  assert.deepEqual(patch.aiPalette, patch.paletteEdit)
  patch.paletteEdit.colors[0].hex = '#123456'
  assert.notEqual(patch.aiPalette.colors[0].hex, '#123456')
})

test('a palette_id outside the catalogue applies nothing', () => {
  assert.equal(applyProposal({ ...brandbook, palette_id: 'no-existe' }, photoIds), null)
})

// ─── suggestedQueries (N1) ──────────────────────────────────────────────────

test('with user tags, the AI queries come back as suggestions minus the ones already there', () => {
  assert.deepEqual(suggestedQueries(brandbook, ['vinos', 'Night Street']), ['neon sign'])
  assert.deepEqual(suggestedQueries(brandbook, []), ['night street', 'neon sign'])
  assert.deepEqual(suggestedQueries(null, ['vinos']), [])
})

// ─── nextPaletteOrigin (D22, N5) ────────────────────────────────────────────

const aiBoard = (): PaletteState => {
  const patch = applyProposal(brandbook, photoIds)!
  return { paletteOrigin: patch.paletteOrigin, paletteEdit: patch.paletteEdit, aiPalette: patch.aiPalette }
}
const NOW_BASIS = basisOf(['unsplash:x', 'unsplash:y'])

test('touching a colour over an AI palette turns it manual and moves basis to the photos of now (N5)', () => {
  const board = aiBoard()
  const edited: PaletteEdit = { colors: board.paletteEdit!.colors.map((c) => ({ ...c })), basis: board.paletteEdit!.basis }
  edited.colors[0] = { ...edited.colors[0], hex: '#101010' }
  const next = nextPaletteOrigin(board, { paletteEdit: edited }, NOW_BASIS)
  assert.equal(next.paletteOrigin, 'manual')
  assert.equal(next.paletteEdit?.basis, NOW_BASIS)
  assert.equal(next.paletteEdit?.colors[0].hex, '#101010')
})

test('paletteEdit: null is «fotos» and the AI palette is not dropped', () => {
  const board = aiBoard()
  const next = nextPaletteOrigin(board, { paletteEdit: null }, NOW_BASIS)
  assert.equal(next.paletteOrigin, 'fotos')
  assert.ok(!('aiPalette' in next), 'el patch no toca aiPalette: se conserva la del tablero')
})

test('an edit from «fotos» or «manual» is manual, with its own basis kept', () => {
  const edit: PaletteEdit = { colors: [], basis: 'propio' }
  const fromFotos = nextPaletteOrigin({ paletteOrigin: 'fotos', paletteEdit: null, aiPalette: null }, { paletteEdit: edit }, NOW_BASIS)
  assert.equal(fromFotos.paletteOrigin, 'manual')
  assert.equal(fromFotos.paletteEdit?.basis, 'propio')
  const fromManual = nextPaletteOrigin({ paletteOrigin: 'manual', paletteEdit: edit, aiPalette: null }, { paletteEdit: edit }, NOW_BASIS)
  assert.equal(fromManual.paletteOrigin, 'manual')
})

test('a patch that states its origin (applying, restoring) passes untouched', () => {
  const board = aiBoard()
  const patch = { paletteEdit: null, paletteOrigin: 'ia' as const }
  assert.equal(nextPaletteOrigin(board, patch, NOW_BASIS), patch)
  const noPalette: Partial<PaletteState> & { title: string } = { title: 'otro' }
  assert.equal(nextPaletteOrigin(board, noPalette, NOW_BASIS), noPalette)
})

test('restoreAiPalette goes back to «ia» with fresh copies on the photos of now', () => {
  const board = aiBoard()
  const restored = restoreAiPalette(board.aiPalette!, NOW_BASIS)
  assert.equal(restored.paletteOrigin, 'ia')
  assert.equal(restored.paletteEdit.basis, NOW_BASIS)
  assert.deepEqual(
    restored.paletteEdit.colors.map((c) => c.hex),
    board.aiPalette!.colors.map((c) => c.hex),
  )
  restored.paletteEdit.colors[0].hex = '#000001'
  assert.notEqual(board.aiPalette!.colors[0].hex, '#000001')
})

// ─── reduceAiRequest ────────────────────────────────────────────────────────

const proposal: GenerateBrandbookResponse = {
  brandbook,
  model: 'test-model',
  latency_ms: 10,
  tokens_in: 1,
  tokens_out: 2,
  tokens_thoughts: 1,
  remaining: 2,
  resetAt: null,
}
const loading: AiRequestState = { status: 'loading' }

test('pedir → loading → ready with a brandbook, or fuera-de-tema without one (N8)', () => {
  assert.deepEqual(reduceAiRequest({ status: 'idle' }, { type: 'pedir' }), loading)
  assert.deepEqual(reduceAiRequest(loading, { type: 'respuesta', response: proposal }), { status: 'ready', proposal })
  const off = { fuera_de_tema: true as const, model: 'm', latency_ms: 1, tokens_in: 1, tokens_out: 1, tokens_thoughts: 0, remaining: 3, resetAt: null }
  assert.deepEqual(reduceAiRequest(loading, { type: 'respuesta', response: off }), { status: 'fuera-de-tema' })
})

test('quota_exceeded and global_limit are sin-intentos with their reason; the rest is error', () => {
  assert.deepEqual(reduceAiRequest(loading, { type: 'falla', code: 'quota_exceeded', resetAt: '2026-11-11T09:00:00Z' }), {
    status: 'sin-intentos',
    reason: 'propios',
    resetAt: '2026-11-11T09:00:00Z',
  })
  assert.deepEqual(reduceAiRequest(loading, { type: 'falla', code: 'global_limit', resetAt: null }), { status: 'sin-intentos', reason: 'global', resetAt: null })
  for (const code of ['ai_unavailable', 'ai_invalid_output', 'captcha_failed', 'network', 'timeout', 'not_configured', 'bad_response'] as const) {
    assert.deepEqual(reduceAiRequest(loading, { type: 'falla', code, resetAt: null }), { status: 'error', code })
  }
})

test('a late answer outside loading changes nothing, and cerrar always goes back to idle', () => {
  const ready: AiRequestState = { status: 'ready', proposal }
  assert.equal(reduceAiRequest(ready, { type: 'respuesta', response: proposal }), ready)
  assert.equal(reduceAiRequest({ status: 'idle' }, { type: 'falla', code: 'network', resetAt: null }).status, 'idle')
  assert.deepEqual(reduceAiRequest(ready, { type: 'cerrar' }), { status: 'idle' })
})

// ─── conceptProblem ─────────────────────────────────────────────────────────

test('the concept needs 3 to 500 characters, trimmed, before any token is asked', () => {
  assert.equal(conceptProblem('  ab  '), 'corto')
  assert.equal(conceptProblem('bar'), null)
  assert.equal(conceptProblem('x'.repeat(500)), null)
  assert.equal(conceptProblem('x'.repeat(501)), 'largo')
})

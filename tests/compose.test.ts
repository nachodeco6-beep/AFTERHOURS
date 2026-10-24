import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose, composeMobile, cropOf, sequence, type BlockKind, type Layout, type Template } from '../src/lib/compose.ts'

const TEMPLATES: Template[] = ['editorial', 'collage', 'grilla']
const BLOCK_SETS: BlockKind[][] = [[], ['palette', 'type', 'keywords'], ['palette', 'type', 'keywords', 'notes'], ['type'], ['notes', 'palette']]
const L = 1.5
const P = 0.667
const S = 1

function pattern(n: number, seed: number): number[] {
  const kinds = [L, P, S, 1.78, 0.75, 1.33, 0.56]
  let s = seed
  return Array.from({ length: n }, () => kinds[(s = (s * 7 + 3) % 97) % kinds.length])
}
const PATTERNS: [string, (n: number) => number[]][] = [
  ['all landscape', (n) => Array(n).fill(L)],
  ['all portrait', (n) => Array(n).fill(P)],
  ['alternating', (n) => Array.from({ length: n }, (_, i) => (i % 2 ? P : L))],
  ['portrait lead', (n) => [P, ...Array(n - 1).fill(L)]],
  ['mixed A', (n) => pattern(n, 1)],
  ['mixed B', (n) => pattern(n, 5)],
]

function check(layout: Layout, ratios: number[], blocks: BlockKind[], label: string, leadMayTie = false) {
  const grid = Array.from({ length: layout.rows }, () => Array(12).fill(-1))
  layout.cells.forEach((c, i) => {
    for (let r = c.row - 1; r < c.row - 1 + c.h; r++)
      for (let k = c.col - 1; k < c.col - 1 + c.w; k++) {
        assert.equal(grid[r][k], -1, `${label}: overlap at ${r},${k}`)
        grid[r][k] = i
      }
  })
  assert.ok(grid.every((row) => row.every((v) => v >= 0)), `${label}: hole in the grid`)

  const photos = layout.cells.filter((c) => c.item.kind === 'photo')
  assert.deepEqual(photos.map((c) => (c.item as { index: number }).index).sort((a, b) => a - b), ratios.map((_, i) => i), `${label}: every photo once`)
  const kinds = layout.cells.filter((c) => c.item.kind !== 'photo').map((c) => c.item.kind)
  assert.deepEqual([...kinds].sort(), [...blocks].sort(), `${label}: every block once`)

  const lead = photos.find((c) => (c.item as { index: number }).index === 0)!
  const leadArea = lead.w * lead.h
  for (const c of photos)
    if (c !== lead) assert.ok(c.w * c.h < leadArea || (leadMayTie && c.w * c.h === leadArea), `${label}: photo ${(c.item as { index: number }).index} outranks the lead`)
  assert.equal(layout.cells.indexOf(lead), 0, `${label}: lead comes first`)

  for (const c of photos) {
    const crop = cropOf((c.item as { ratio: number }).ratio, c.w / c.h)
    assert.ok(crop <= 0.45, `${label}: photo ${(c.item as { index: number }).index} cropped ${(crop * 100).toFixed(0)}%`)
  }
}

test('every template, size, mix and block set fills the grid without holes', () => {
  for (const template of TEMPLATES)
    for (let n = 3; n <= 12; n++)
      for (const [name, make] of PATTERNS)
        for (const blocks of BLOCK_SETS) {
          const ratios = make(n)
          check(compose(ratios, blocks, template), ratios, blocks, `${template} n=${n} ${name} [${blocks}]`, template === 'grilla')
        }
})

test('the same input always gives the same layout', () => {
  const r = pattern(9, 3)
  assert.deepEqual(compose(r, ['palette', 'type'], 'editorial'), compose(r, ['palette', 'type'], 'editorial'))
})

test('orientation drives the cell shape', () => {
  const layout = compose([L, P, L, P, L, P], [], 'editorial')
  for (const c of layout.cells) {
    const ratio = c.w / c.h
    const photo = (c.item as { ratio: number }).ratio
    if (photo > 1.2) assert.ok(ratio >= 1, 'landscape gets a wide cell')
    if (photo < 0.8) assert.ok(ratio <= 1, 'portrait gets a tall cell')
  }
})

test('blocks are woven in, not piled at the end', () => {
  const items = sequence(Array(9).fill(L), ['palette', 'type', 'keywords', 'notes'])
  const pos = (k: string) => items.findIndex((i) => i.kind === k)
  assert.equal(items[0].kind, 'photo')
  assert.ok(pos('keywords') < pos('palette') && pos('palette') < pos('type') && pos('type') < pos('notes'))
  assert.ok(pos('notes') < items.length - 1)
})

test('mobile layouts keep order, hierarchy and never leave half rows', () => {
  for (const template of TEMPLATES)
    for (let n = 3; n <= 12; n++)
      for (const [name, make] of PATTERNS)
        for (const blocks of BLOCK_SETS) {
          const ratios = make(n)
          const m = composeMobile(ratios, blocks, template)
          const label = `${template} n=${n} ${name}`
          assert.equal(m.cells.length, n + blocks.length, label)
          assert.equal(m.cells[0].item.kind, 'photo', label)
          assert.equal((m.cells[0].item as { index: number }).index, 0, `${label}: lead first`)
          if (m.columns === 2) {
            assert.equal(m.cells[0].span, 2, `${label}: lead full width`)
            let used = 0
            for (const c of m.cells) used = c.span === 2 ? (assert.equal(used % 2, 0, `${label}: hole before a full row`), used + 2) : used + 1
            assert.equal(used % 2, 0, `${label}: last row incomplete`)
          }
          for (const c of m.cells)
            if (c.item.kind === 'photo') assert.ok(cropOf(c.item.ratio, c.ratio!) <= 0.45, `${label}: mobile crop`)
        }
})

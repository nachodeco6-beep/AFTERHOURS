import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compose, cropOf, sequence, type BlockKind, type Frame, type Layout, type Template } from '../src/lib/compose.ts'
import { canvasGeometry, FORMAT_ORDER, FORMATS, type Format } from '../src/lib/formats.ts'

const TEMPLATES: Template[] = ['editorial', 'collage', 'grilla']
const BLOCK_SETS: BlockKind[][] = [[], ['palette', 'type', 'keywords'], ['palette', 'type', 'keywords', 'notes'], ['type'], ['notes', 'palette']]
const L = 1.5
const P = 0.667
const S = 1
const EPS = 0.5

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

function frameOf(format: Format, template: Template, n: number, blocks: BlockKind[]): Frame {
  const geo = canvasGeometry(format, template, n, blocks.length === 0)
  return { width: geo.grid.width, height: geo.grid.height, gap: geo.gap }
}

const photoIndex = (c: Layout['cells'][number]) => (c.item as { index: number }).index

function check(layout: Layout, frame: Frame, ratios: number[], blocks: BlockKind[], label: string, leadMayTie = false) {
  const { width: W, height: H, gap: g } = frame
  const cells = layout.cells
  for (const c of cells) {
    assert.ok(c.w > 1 && c.h > 1, `${label}: empty cell`)
    assert.ok(c.x >= -EPS && c.y >= -EPS && c.x + c.w <= W + EPS && c.y + c.h <= H + EPS, `${label}: cell outside the frame`)
  }
  // grown by half a gutter on every side, the cells must tile the grown frame exactly:
  // no overlaps and an exact total area mean no holes either
  const grown = cells.map((c) => ({
    x0: c.x - g / 2,
    y0: c.y - g / 2,
    x1: c.x + c.w + g / 2,
    y1: c.y + c.h + g / 2,
  }))
  for (let i = 0; i < grown.length; i++)
    for (let j = i + 1; j < grown.length; j++) {
      const a = grown[i]
      const b = grown[j]
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      assert.ok(ox <= EPS || oy <= EPS, `${label}: cells ${i} and ${j} overlap`)
    }
  const area = grown.reduce((a, c) => a + (c.x1 - c.x0) * (c.y1 - c.y0), 0)
  assert.ok(Math.abs(area - (W + g) * (H + g)) < (W + H) * 2, `${label}: hole in the board (${area.toFixed(0)} vs ${((W + g) * (H + g)).toFixed(0)})`)

  const photos = cells.filter((c) => c.item.kind === 'photo')
  assert.deepEqual(
    photos.map(photoIndex).sort((a, b) => a - b),
    ratios.map((_, i) => i),
    `${label}: every photo once`,
  )
  const kinds = cells.filter((c) => c.item.kind !== 'photo').map((c) => c.item.kind)
  assert.deepEqual([...kinds].sort(), [...blocks].sort(), `${label}: every block once`)

  const lead = photos.find((c) => photoIndex(c) === 0)!
  const leadArea = lead.w * lead.h
  for (const c of photos) if (c !== lead) assert.ok(c.w * c.h < leadArea * (leadMayTie ? 1.03 : 1), `${label}: photo ${photoIndex(c)} outranks the lead`)
  assert.equal(cells.indexOf(lead), 0, `${label}: lead comes first`)

  for (const c of photos) {
    const crop = cropOf((c.item as { ratio: number }).ratio, c.w / c.h)
    assert.ok(crop <= 0.45, `${label}: photo ${photoIndex(c)} cropped ${(crop * 100).toFixed(0)}%`)
  }
}

test('every format, template, size, mix and block set fills the frame without holes', () => {
  for (const format of FORMAT_ORDER)
    for (const template of TEMPLATES)
      for (let n = 3; n <= 12; n++)
        for (const [name, make] of PATTERNS)
          for (const blocks of BLOCK_SETS) {
            const ratios = make(n)
            const frame = frameOf(format, template, n, blocks)
            check(compose(ratios, blocks, template, frame), frame, ratios, blocks, `${format} ${template} n=${n} ${name} [${blocks}]`, template === 'grilla')
          }
})

test('photos keep their proportions: the average crop stays small', () => {
  let total = 0
  let count = 0
  for (const format of FORMAT_ORDER)
    for (const template of TEMPLATES)
      for (const n of [3, 6, 9, 12])
        for (const [, make] of PATTERNS) {
          const ratios = make(n)
          const blocks: BlockKind[] = ['palette', 'type', 'keywords']
          for (const c of compose(ratios, blocks, template, frameOf(format, template, n, blocks)).cells)
            if (c.item.kind === 'photo') {
              total += cropOf(c.item.ratio, c.w / c.h)
              count++
            }
        }
  assert.ok(total / count < 0.12, `average crop ${((total / count) * 100).toFixed(1)}%`)
})

test('the canvas geometry adds up to the real format size', () => {
  for (const format of FORMAT_ORDER)
    for (const template of TEMPLATES)
      for (const bare of [true, false]) {
        const geo = canvasGeometry(format, template, 12, bare)
        assert.equal(geo.width, FORMATS[format].width)
        assert.ok(Math.abs(geo.pad * 2 + geo.header + geo.section * 2 + geo.grid.height + geo.footer - FORMATS[format].height) < 1e-6)
        assert.ok(geo.grid.height > geo.height * 0.45, `${format} ${template}: the photos get most of the canvas`)
      }
  // real export sizes, and the canvas scales to them exactly
  assert.deepEqual([FORMATS.horizontal.exportWidth, FORMATS.horizontal.exportHeight], [1920, 1080])
  assert.deepEqual([FORMATS.vertical.exportWidth, FORMATS.vertical.exportHeight], [1080, 1350])
  assert.deepEqual([FORMATS.a4.exportWidth, FORMATS.a4.exportHeight], [1240, 1754])
  for (const f of FORMAT_ORDER) {
    const { width, height, pixelRatio, exportWidth, exportHeight } = FORMATS[f]
    assert.ok(Math.abs(width * pixelRatio - exportWidth) < 1e-6)
    assert.ok(Math.abs(height * pixelRatio - exportHeight) < 1e-6)
  }
})

test('the same input always gives the same layout', () => {
  const r = pattern(9, 3)
  const frame = frameOf('horizontal', 'editorial', 9, ['palette', 'type'])
  assert.deepEqual(compose(r, ['palette', 'type'], 'editorial', frame), compose(r, ['palette', 'type'], 'editorial', frame))
})

test('orientation drives the cell shape', () => {
  for (const format of FORMAT_ORDER) {
    const ratios = [L, P, L, P, L, P]
    for (const c of compose(ratios, [], 'editorial', frameOf(format, 'editorial', 6, [])).cells) {
      const ratio = c.w / c.h
      const photo = (c.item as { ratio: number }).ratio
      if (photo > 1.2) assert.ok(ratio >= 1, `${format}: landscape gets a wide cell`)
      if (photo < 0.8) assert.ok(ratio <= 1, `${format}: portrait gets a tall cell`)
    }
  }
})

test('blocks are woven in, not piled at the end', () => {
  const items = sequence(Array(9).fill(L), ['palette', 'type', 'keywords', 'notes'])
  const pos = (k: string) => items.findIndex((i) => i.kind === k)
  assert.equal(items[0].kind, 'photo')
  assert.ok(pos('keywords') < pos('palette') && pos('palette') < pos('type') && pos('type') < pos('notes'))
  assert.ok(pos('notes') < items.length - 1)
})

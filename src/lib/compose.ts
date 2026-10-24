/**
 * Moodboard composition. Pure and deterministic.
 *
 * Desktop: a 12-column grid of square modules, built from horizontal bands.
 * Each band splits the 12 columns into a template-specific set of widths, and
 * each column holds one cell or two stacked ones. A dynamic-programming pass
 * picks the sequence of bands that best fits the items *in order*:
 *   - every photo lands in a cell close to its own proportions (moderate crop),
 *   - the first photo (the visitor's strongest pick) gets the biggest cell,
 *   - info blocks (palette, type, keywords, notes) get cells their content fits,
 *   - bands fill the full width, so there are never holes.
 * Mobile: one or two columns with the same order and hierarchy.
 */

export type Template = 'editorial' | 'collage' | 'grilla'
export type BlockKind = 'palette' | 'type' | 'keywords' | 'notes'

export type Item = { kind: 'photo'; index: number; ratio: number } | { kind: BlockKind }

export interface Cell {
  item: Item
  /** 1-based grid column and row; w/h in modules. */
  col: number
  row: number
  w: number
  h: number
}

export interface Layout {
  cells: Cell[]
  rows: number
}

export interface MobileCell {
  item: Item
  span: 1 | 2
  /** Width / height of the cell; null = the block's natural height. */
  ratio: number | null
}

export interface MobileLayout {
  columns: 1 | 2
  cells: MobileCell[]
}

// ─── Item order ─────────────────────────────────────────────────────────────

const BLOCK_ORDER: BlockKind[] = ['keywords', 'palette', 'type', 'notes']

/** Ideal position of each block: after which photo it goes. */
function idealAfter(n: number): Record<BlockKind, number> {
  return {
    keywords: 0, // right after the lead photo
    palette: Math.min(2, n - 1),
    type: Math.max(1, Math.floor(n * 0.55)),
    notes: Math.max(1, n - 2),
  }
}

/** Photos in the visitor's order, with the info blocks woven in at editorial positions. */
export function sequence(ratios: number[], blocks: BlockKind[], shift: Partial<Record<BlockKind, number>> = {}): Item[] {
  const n = ratios.length
  const ideal = idealAfter(n)
  const after = Object.fromEntries(
    BLOCK_ORDER.map((b) => [b, Math.max(0, Math.min(n - 1, ideal[b] + (shift[b] ?? 0)))]),
  ) as Record<BlockKind, number>
  const items: Item[] = []
  ratios.forEach((ratio, index) => {
    items.push({ kind: 'photo', index, ratio })
    for (const b of BLOCK_ORDER) if (blocks.includes(b) && after[b] === index) items.push({ kind: b })
  })
  return items
}

/** Block placements to try: the ideal one first, then nearby shifts (each shift costs a little). */
function placements(blocks: BlockKind[]): { shift: Partial<Record<BlockKind, number>>; cost: number }[] {
  const out: { shift: Partial<Record<BlockKind, number>>; cost: number }[] = [{ shift: {}, cost: 0 }]
  for (const b of blocks)
    for (const d of [-1, 1, -2, 2, 99]) out.push({ shift: { [b]: d }, cost: d === 99 ? 4 : Math.abs(d) * 1.5 })
  if (blocks.length > 1) {
    out.push({ shift: Object.fromEntries(blocks.map((b) => [b, 1])), cost: 3 })
    out.push({ shift: Object.fromEntries(blocks.map((b) => [b, -1])), cost: 3 })
    out.push({ shift: Object.fromEntries(blocks.map((b) => [b, 99])), cost: 6 })
  }
  return out
}

// ─── Bands ──────────────────────────────────────────────────────────────────

interface BandCell {
  dx: number // column offset inside the band
  dy: number // row offset inside the band
  w: number
  h: number
}

interface Band {
  key: string
  /** Height + column widths; consecutive bands with the same shape are discouraged. */
  shape: string
  h: number
  cells: BandCell[] // in reading order
}

interface TemplateSpec {
  widths: number[][]
  heights: number[]
  /** Columns may stack two cells. */
  split: boolean
  /** Bands of one or two columns may also use 2×2, «one over two» and «two over one» columns. */
  mosaic: boolean
  minPhotoArea: number
  /** The lead photo may tie in size with others (it still comes first). Only for the regular grid. */
  leadMayTie: boolean
}

const SPECS: Record<Template, TemplateSpec> = {
  // asymmetric columns, generous cells
  editorial: {
    widths: [[8, 4], [4, 8], [7, 5], [5, 7], [6, 6], [5, 4, 3], [3, 4, 5], [4, 4, 4], [9, 3], [3, 9], [12]],
    heights: [4, 5, 6, 8],
    split: true,
    mosaic: true,
    minPhotoArea: 9,
    leadMayTie: false,
  },
  // dense, many sizes, small cells allowed
  collage: {
    widths: [[6, 3, 3], [3, 6, 3], [3, 3, 6], [4, 5, 3], [5, 3, 4], [3, 3, 3, 3], [4, 4, 4], [6, 6], [8, 4], [4, 8], [7, 5], [5, 7], [12]],
    heights: [3, 4, 5, 6, 8],
    split: true,
    mosaic: true,
    minPhotoArea: 4,
    leadMayTie: false,
  },
  // calm and regular: few widths, at most two equal stacked cells
  grilla: {
    widths: [[4, 4, 4], [6, 6], [3, 3, 3, 3], [8, 4], [4, 8], [6, 3, 3], [3, 3, 6], [12]],
    heights: [4, 6, 8],
    split: true,
    mosaic: false,
    minPhotoArea: 9,
    leadMayTie: true,
  },
}

const bandCache = new Map<Template, Band[]>()

function bandsFor(template: Template): Band[] {
  const hit = bandCache.get(template)
  if (hit) return hit
  const spec = SPECS[template]
  const bands: Band[] = []
  for (const h of spec.heights) {
    for (const widths of spec.widths) {
      // how each column may be cut, in reading order inside the column
      const modes = widths.map((w) => {
        const m: ((dx: number) => BandCell[])[] = [(dx) => [{ dx, dy: 0, w, h }]]
        if (spec.split && h % 2 === 0) m.push((dx) => [{ dx, dy: 0, w, h: h / 2 }, { dx, dy: h / 2, w, h: h / 2 }])
        if (spec.mosaic && widths.length <= 2 && h % 2 === 0 && w % 2 === 0 && w >= 4) {
          const [hw, hh] = [w / 2, h / 2]
          m.push((dx) => [
            { dx, dy: 0, w: hw, h: hh },
            { dx: dx + hw, dy: 0, w: hw, h: hh },
            { dx, dy: hh, w: hw, h: hh },
            { dx: dx + hw, dy: hh, w: hw, h: hh },
          ])
          m.push((dx) => [{ dx, dy: 0, w, h: hh }, { dx, dy: hh, w: hw, h: hh }, { dx: dx + hw, dy: hh, w: hw, h: hh }])
          m.push((dx) => [{ dx, dy: 0, w: hw, h: hh }, { dx: dx + hw, dy: 0, w: hw, h: hh }, { dx, dy: hh, w, h: hh }])
        }
        return m
      })
      // every combination of modes across the columns
      const walk = (col: number, dx: number, acc: BandCell[], tag: string) => {
        if (col === widths.length) {
          bands.push({ key: `${h}:${widths.join('-')}:${tag}`, shape: `${h}:${widths.join('-')}`, h, cells: acc })
          return
        }
        modes[col].forEach((make, i) => walk(col + 1, dx + widths[col], [...acc, ...make(dx)], tag + i))
      }
      walk(0, 0, [], '')
    }
  }
  bandCache.set(template, bands)
  return bands
}

// ─── Costs ──────────────────────────────────────────────────────────────────

const MAX_CROP = 0.42
/** Any cost at or above this means a rule was bent (big crop, tiny cell, lead outranked). */
const HARD_PENALTY = 25

/** Fraction of the photo cut away when it fills a cell of the given ratio (object-fit: cover). */
export const cropOf = (photoRatio: number, cellRatio: number) => 1 - Math.min(photoRatio, cellRatio) / Math.max(photoRatio, cellRatio)

/** Shapes each block reads well in, and how small / big its cell may get (blocks never upstage photos). */
const BLOCK_FIT: Record<BlockKind, { ranges: [number, number][]; minArea: number; maxArea: number }> = {
  palette: { ranges: [[1.2, 4.5], [0.22, 0.6]], minArea: 6, maxArea: 36 },
  type: { ranges: [[0.7, 1.9]], minArea: 12, maxArea: 42 },
  keywords: { ranges: [[1, 5]], minArea: 6, maxArea: 24 },
  notes: { ranges: [[0.6, 2.4]], minArea: 9, maxArea: 32 },
}

function itemCost(item: Item, cell: BandCell, spec: TemplateSpec): number {
  const ratio = cell.w / cell.h
  const area = cell.w * cell.h
  if (item.kind === 'photo') {
    const crop = cropOf(item.ratio, ratio)
    return 10 * crop * crop + (crop > MAX_CROP ? 60 : 0) + (area < spec.minPhotoArea ? 25 : 0)
  }
  const fit = BLOCK_FIT[item.kind]
  const inside = fit.ranges.some(([lo, hi]) => ratio >= lo && ratio <= hi)
  const off = inside ? 0 : 6 + Math.min(...fit.ranges.map(([lo, hi]) => (ratio < lo ? lo / ratio : ratio / hi)))
  return off + (area < fit.minArea ? 25 : 0) + (area > fit.maxArea ? 4 + (area - fit.maxArea) / 6 : 0)
}

/**
 * What makes each template feel like itself, as a small cost per band:
 * editorial likes few, large cells; collage likes many cells and mosaics;
 * grilla likes equal widths.
 */
function bandTaste(band: Band, template: Template): number {
  const k = band.cells.length
  const widths = band.shape.split(':')[1].split('-').map(Number)
  if (template === 'editorial') return k >= 4 ? 2.5 : k === 3 ? 0.6 : 0
  if (template === 'collage') return k <= 2 ? 2 : k === 3 ? 0.8 : 0
  return widths.every((w) => w === widths[0]) ? 0 : 1.2
}

// ─── Desktop layout ─────────────────────────────────────────────────────────

/** Lays out the photos (by ratio, in order) and blocks on the 12-column grid. */
export function compose(ratios: number[], blocks: BlockKind[], template: Template): Layout {
  let best: { cost: number; layout: Layout } | null = null
  const seen = new Set<string>()
  for (const { shift, cost } of placements(blocks)) {
    const items = sequence(ratios, blocks, shift)
    const key = items.map((i) => i.kind).join()
    if (seen.has(key)) continue
    seen.add(key)
    const res = layoutItems(items, template)
    if (res && (!best || res.cost + cost < best.cost)) best = { cost: res.cost + cost, layout: res.layout }
    // the ideal block positions are good enough unless they forced a hard penalty
    if (best && best.cost < HARD_PENALTY) break
  }
  if (best) return best.layout
  // can't happen with the band sets below, but never leave the board empty
  const items = sequence(ratios, blocks)
  return { cells: items.map((item, i) => ({ item, col: 1, row: i * 6 + 1, w: 12, h: 6 })), rows: items.length * 6 }
}

function layoutItems(items: Item[], template: Template): { cost: number; layout: Layout } | null {
  const spec = SPECS[template]
  const bands = bandsFor(template)
  const n = items.length

  let best: { cost: number; plan: Band[] } | null = null

  // the first band holds the lead photo in its biggest cell (the first one in reading order)
  const firstBands = bands.filter((b) => {
    const area = b.cells[0].w * b.cells[0].h
    return b.cells.length <= n && b.cells.every((c, i) => i === 0 || c.w * c.h < area || (spec.leadMayTie && c.w * c.h === area))
  })

  // memo[lead area][pos][shape of the previous band] = best cost to place items[pos..];
  // shared by every first band with the same lead area
  const memo = new Map<string, { cost: number; plan: Band[] }>()

  for (const first of firstBands) {
    const heroArea = first.cells[0].w * first.cells[0].h
    let firstCost = bandTaste(first, template) + (template === 'editorial' ? -heroArea / 40 : 0) // editorial: a big lead
    first.cells.forEach((c, i) => (firstCost += itemCost(items[i], c, spec)))
    if (firstCost >= 60 || (best && firstCost >= best.cost)) continue

    const solve = (pos: number, last: Band): { cost: number; plan: Band[] } => {
      if (pos === n) return { cost: 0, plan: [] }
      const key = `${heroArea}|${pos}|${last.shape}`
      const hit = memo.get(key)
      if (hit) return hit
      let res = { cost: Infinity, plan: [] as Band[] }
      for (const band of bands) {
        const k = band.cells.length
        if (pos + k > n) continue
        let cost = (band.shape === last.shape ? 2 : 0) + bandTaste(band, template) // variety + template character
        if (k === 1 && band.cells[0].w === 12) cost += 3 // full-width rows only when they really fit
        for (let i = 0; i < k && cost < res.cost; i++) {
          const cell = band.cells[i]
          const item = items[pos + i]
          cost += itemCost(item, cell, spec)
          const area = cell.w * cell.h
          if (item.kind === 'photo' && (area > heroArea || (area === heroArea && !spec.leadMayTie))) cost += 100 // nothing outranks the lead photo
        }
        if (cost >= res.cost) continue
        const rest = solve(pos + k, band)
        if (cost + rest.cost < res.cost) res = { cost: cost + rest.cost, plan: [band, ...rest.plan] }
      }
      memo.set(key, res)
      return res
    }

    const rest = solve(first.cells.length, first)
    const total = firstCost + rest.cost
    if (!best || total < best.cost) best = { cost: total, plan: [first, ...rest.plan] }
  }

  if (!best || !Number.isFinite(best.cost)) return null

  const cells: Cell[] = []
  let row = 1
  let pos = 0
  for (const band of best.plan) {
    for (const c of band.cells) cells.push({ item: items[pos++], col: c.dx + 1, row: row + c.dy, w: c.w, h: c.h })
    row += band.h
  }
  return { cost: best.cost, layout: { cells, rows: row - 1 } }
}

// ─── Mobile layout ──────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Editorial: one column, every item full width. Collage and grilla: two
 * columns where landscapes and blocks take the full width and portraits or
 * squares pair up side by side, sharing a height so rows never leave holes.
 */
export function composeMobile(ratios: number[], blocks: BlockKind[], template: Template): MobileLayout {
  const items = sequence(ratios, blocks)
  if (template === 'editorial') {
    return {
      columns: 1,
      cells: items.map((item) => ({ item, span: 1, ratio: item.kind === 'photo' ? clamp(item.ratio, 0.8, 1.5) : null })),
    }
  }
  const cells: MobileCell[] = []
  let pending: Item | null = null
  items.forEach((item, i) => {
    if (item.kind !== 'photo') {
      cells.push({ item, span: 2, ratio: null })
      return
    }
    if (i === 0 || item.ratio > 1.15) {
      cells.push({ item, span: 2, ratio: clamp(item.ratio, i === 0 ? 0.9 : 1.2, 1.7) })
      return
    }
    if (pending && pending.kind === 'photo') {
      const shared = clamp((clamp(pending.ratio, 0.75, 1) + clamp(item.ratio, 0.75, 1)) / 2, 0.75, 1)
      cells.push({ item: pending, span: 1, ratio: shared }, { item, span: 1, ratio: shared })
      pending = null
    } else {
      pending = item
    }
  })
  if (pending && (pending as Item).kind === 'photo') {
    const p = pending as Extract<Item, { kind: 'photo' }>
    cells.push({ item: p, span: 2, ratio: clamp(p.ratio, 0.8, 1.5) })
  }
  return { columns: 2, cells }
}

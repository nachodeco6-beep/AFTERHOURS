/**
 * Moodboard composition inside a fixed frame. Pure and deterministic.
 *
 * The board has real pixel sizes (see formats.ts), so everything has to fit a
 * given width × height exactly. The frame is filled with horizontal bands; each
 * band spans the full width and holds columns of one item or a short stack of
 * items. Given the band's height, every column takes the width its contents'
 * proportions ask for, so a band has one *natural* height that fills the width
 * without distorting anything.
 *
 * A dynamic-programming pass picks the sequence of bands that best fits the
 * items *in order* and whose natural heights add up to the frame's height:
 *   - photos keep their proportions (any leftover is absorbed by the info
 *     blocks first and, only then, by an even, bounded crop),
 *   - the first photo (the visitor's strongest pick) gets the biggest cell,
 *   - info blocks (palette, type, keywords, notes) get shapes their content fits,
 *   - bands fill the full width and the full height: never a hole.
 */

export type Template = 'editorial' | 'collage' | 'grilla'
export type BlockKind = 'palette' | 'type' | 'keywords' | 'notes'

export type Item = { kind: 'photo'; index: number; ratio: number } | { kind: BlockKind }

export interface Frame {
  width: number
  height: number
  gap: number
}

export interface Cell {
  item: Item
  /** Position and size in px, relative to the frame. */
  x: number
  y: number
  w: number
  h: number
}

export interface Layout {
  cells: Cell[]
  width: number
  height: number
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
  const after = Object.fromEntries(BLOCK_ORDER.map((b) => [b, Math.max(0, Math.min(n - 1, ideal[b] + (shift[b] ?? 0)))])) as Record<BlockKind, number>
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
  for (const b of blocks) for (const d of [-1, 1, -2, 2, 99]) out.push({ shift: { [b]: d }, cost: d === 99 ? 4 : Math.abs(d) * 1.5 })
  if (blocks.length > 1) {
    out.push({ shift: Object.fromEntries(blocks.map((b) => [b, 1])), cost: 3 })
    out.push({
      shift: Object.fromEntries(blocks.map((b) => [b, -1])),
      cost: 3,
    })
  }
  return out
}

// ─── Templates and blocks ───────────────────────────────────────────────────

interface TemplateSpec {
  /** Most columns in one band. */
  maxCols: number
  /** Most items stacked in one column. */
  maxStack: number
  /** Most items in one band. */
  maxItems: number
  /** Photos shorter or narrower than this (px) are too small. */
  minPhoto: number
  /** The lead photo may tie in size with others (it still comes first). Only for the regular grid. */
  leadMayTie: boolean
}

const SPECS: Record<Template, TemplateSpec> = {
  // few, generous cells, clear hierarchy
  editorial: {
    maxCols: 4,
    maxStack: 2,
    maxItems: 6,
    minPhoto: 100,
    leadMayTie: false,
  },
  // dense: many cells, deep stacks
  collage: {
    maxCols: 5,
    maxStack: 3,
    maxItems: 7,
    minPhoto: 64,
    leadMayTie: false,
  },
  // calm rows: few stacks
  grilla: {
    maxCols: 6,
    maxStack: 2,
    maxItems: 7,
    minPhoto: 86,
    leadMayTie: true,
  },
}

/**
 * Shapes each block reads well in: the ratios (w / h) to try, the range it may
 * stretch to while absorbing leftover space, and its minimum readable size.
 */
const BLOCK_FIT: Record<BlockKind, { options: number[]; ranges: [number, number][]; minW: number; minH: number }> = {
  palette: {
    options: [3, 1.8, 0.42],
    ranges: [
      [1.2, 7],
      [0.2, 0.75],
    ],
    minW: 80,
    minH: 60,
  },
  type: { options: [1, 0.8, 1.3], ranges: [[0.62, 1.9]], minW: 190, minH: 200 },
  keywords: {
    options: [2.2, 1.5, 3.2],
    ranges: [[1, 5.5]],
    minW: 170,
    minH: 76,
  },
  notes: {
    options: [1.2, 0.85, 1.7],
    ranges: [[0.6, 2.6]],
    minW: 160,
    minH: 130,
  },
}

/** Blocks never upstage the lead photo. */
const BLOCK_MAX_SHARE = 0.8

const MAX_CROP = 0.45
/** Any cost at or above this means a rule was bent (big crop, tiny cell, lead outranked). */
const HARD_PENALTY = 25

/** Fraction of the photo cut away when it fills a cell of the given ratio (object-fit: cover). */
export const cropOf = (photoRatio: number, cellRatio: number) => 1 - Math.min(photoRatio, cellRatio) / Math.max(photoRatio, cellRatio)

const sizePenalty = (w: number, h: number, minW: number, minH: number) => (w < minW * 0.7 || h < minH * 0.7 ? 25 : w < minW || h < minH ? 6 : 0)

/** A cramped block costs more than a small photo: its text has to fit. A palette on its side needs height for five colours. */
function blockPenalty(kind: BlockKind, w: number, h: number): number {
  const fit = BLOCK_FIT[kind]
  const [minW, minH] = kind === 'palette' && w < h ? [90, 170] : [fit.minW, fit.minH]
  return w < minW * 0.7 || h < minH * 0.7 ? 25 : w < minW || h < minH ? 10 : 0
}

function rangeMiss(kind: BlockKind, ratio: number): number {
  const fit = BLOCK_FIT[kind]
  if (fit.ranges.some(([lo, hi]) => ratio >= lo && ratio <= hi)) return 0
  return 6 + Math.min(...fit.ranges.map(([lo, hi]) => (ratio < lo ? lo / ratio : ratio / hi)))
}

// ─── Bands ──────────────────────────────────────────────────────────────────

/** Shapes the first band may give the lead photo, relative to its own ratio. */
const LEAD_CROPS = [1, 1.3, 1 / 1.3, 1.6]

interface Column {
  /** Indexes into the item list, top to bottom. */
  items: number[]
  /** Ratio used for each item: the photo's own, or the block option picked. */
  ratios: number[]
  /** A single block: its width can flex to absorb leftover space. */
  flex: BlockKind | null
  /** Natural width = alpha · bandHeight + beta. */
  alpha: number
  beta: number
}

interface Band {
  start: number
  k: number
  cols: Column[]
  /** Natural height: the one that fills the width without crops. */
  h: number
  /** Template taste and block option preferences. */
  taste: number
  /** Size penalties at the natural height (an estimate; the final fit recomputes them). */
  size: number
  photos: number
  maxPhoto: number
  /** Biggest photo other than the first cell. */
  maxPhotoOthers: number
  maxBlock: number
  /** Area of the first cell (the lead, when this is the first band). */
  firstArea: number
  sig: string
}

function taste(template: Template, k: number, cols: Column[]): number {
  if (template === 'editorial') return k >= 4 ? 1.3 * (k - 2) : k === 3 ? 0.6 : 0
  if (template === 'collage') return k <= 2 ? 2 : k === 3 ? 0.8 : 0
  return cols.filter((c) => c.items.length > 1).length + (k === 1 ? 1 : 0)
}

export function bandsAt(start: number, items: Item[], template: Template, frame: Frame): Band[] {
  const spec = SPECS[template]
  const { width: W, gap: g } = frame
  const n = items.length
  const out: Band[] = []

  // every split of the next items into columns of 1..maxStack
  const shapes: number[][] = []
  const walk = (acc: number[], used: number) => {
    if (acc.length) shapes.push(acc)
    if (acc.length === spec.maxCols) return
    for (let m = 1; m <= spec.maxStack; m++) if (used + m <= spec.maxItems && start + used + m <= n) walk([...acc, m], used + m)
  }
  walk([], 0)

  for (const shape of shapes) {
    const k = shape.reduce((a, b) => a + b, 0)
    const idx = Array.from({ length: k }, (_, i) => start + i)
    const blockSlots = idx.filter((i) => items[i].kind !== 'photo')
    // block options: every shape for the first block, the preferred one for the rest
    const combos: number[][] = [[]]
    blockSlots.forEach((_, b) => {
      const opts = b < 1 ? [0, 1, 2] : [0]
      const next: number[][] = []
      for (const c of combos) for (const o of opts) next.push([...c, o])
      combos.splice(0, combos.length, ...next)
    })

    // the lead photo may also be cropped a little wider or taller, so it can stand out
    for (const lead of start === 0 ? LEAD_CROPS : [1])
      for (const combo of combos) {
        const ratioOf = (i: number) => {
          const it = items[i]
          if (it.kind !== 'photo') return BLOCK_FIT[it.kind].options[combo[blockSlots.indexOf(i)]]
          return i === 0 ? it.ratio * lead : it.ratio
        }
        let optionCost = combo.reduce((a, o) => a + o * 0.4, 0)
        let p = start
        const cols: Column[] = shape.map((m) => {
          const its = idx.slice(p - start, p - start + m)
          p += m
          const ratios = its.map(ratioOf)
          const alpha = 1 / ratios.reduce((a, r) => a + 1 / r, 0)
          const first = items[its[0]]
          return {
            items: its,
            ratios,
            flex: m === 1 && first.kind !== 'photo' ? first.kind : null,
            alpha,
            beta: -(m - 1) * g * alpha,
          }
        })
        const sumA = cols.reduce((a, c) => a + c.alpha, 0)
        const sumB = cols.reduce((a, c) => a + c.beta, 0)
        const h = (W - (cols.length - 1) * g - sumB) / sumA
        // a band taller than the frame can never fit
        if (!(h > 0) || h > frame.height * 1.2) continue

        const leadCrop = 1 - Math.min(lead, 1 / lead)
        let size = 10 * leadCrop * leadCrop
        let maxPhoto = 0
        let maxPhotoOthers = 0
        let maxBlock = 0
        let firstArea = 0
        for (const c of cols) {
          const w = c.alpha * h + c.beta
          c.items.forEach((i, j) => {
            const ch = w / c.ratios[j]
            const it = items[i]
            const area = w * ch
            if (i === start) firstArea = area
            if (it.kind === 'photo') {
              size += sizePenalty(w, ch, spec.minPhoto, spec.minPhoto)
              maxPhoto = Math.max(maxPhoto, area)
              if (i !== start) maxPhotoOthers = Math.max(maxPhotoOthers, area)
            } else {
              size += blockPenalty(it.kind, w, ch)
              maxBlock = Math.max(maxBlock, area)
              // a palette standing on its side only in a narrow column
              if (it.kind === 'palette' && c.ratios[j] < 1 && c.items.length > 1) optionCost += 2
            }
          })
        }
        // something unreadably small: not worth considering
        if (size >= 25) continue
        out.push({
          start,
          k,
          cols,
          h,
          taste: taste(template, k, cols) + optionCost,
          size,
          photos: idx.length - blockSlots.length,
          maxPhoto,
          maxPhotoOthers,
          maxBlock,
          firstArea,
          sig: shape.join(''),
        })
      }
  }
  return out
}

// ─── Final fit ──────────────────────────────────────────────────────────────

/** Height range in which a band's flexible block columns stay within their ratio ranges. */
function flexRange(band: Band, h: number, frame: Frame): [number, number] | null {
  const flex = band.cols.filter((c) => c.flex)
  if (!flex.length) return null
  const stiff = band.cols.filter((c) => !c.flex)
  const C = frame.width - (band.cols.length - 1) * frame.gap - stiff.reduce((a, c) => a + c.beta, 0)
  const sumA = stiff.reduce((a, c) => a + c.alpha, 0)
  const sumRho = flex.reduce((a, c) => a + c.ratios[0], 0)
  // each flexible block takes width ∝ its ratio: ratio(h) = rho · (C / h − sumA) / sumRho
  let lo = 0
  let hi = Infinity
  for (const c of flex) {
    const rho = c.ratios[0]
    // the range that contains the option picked
    const [rlo, rhi] = BLOCK_FIT[c.flex as BlockKind].ranges.find(([a, b]) => rho >= a && rho <= b) ?? [rho, rho]
    // rlo ≤ rho·(C/h − sumA)/sumRho ≤ rhi  ⇔  C/(rhi·sumRho/rho + sumA) ≤ h ≤ C/(rlo·sumRho/rho + sumA)
    lo = Math.max(lo, C / ((rhi * sumRho) / rho + sumA))
    hi = Math.min(hi, C / ((rlo * sumRho) / rho + sumA))
  }
  return lo <= h && h <= hi ? [lo, hi] : null
}

/** Turns a plan into exact cells that fill the frame, and scores the result. */
interface Realized {
  cells: Cell[]
  cost: number
  /** How many rules were bent: a big crop, a tiny photo, the lead outranked. */
  hard: number
}

/** `lead`: area of the lead photo when it sits outside these bands (side column). */
function realize(plan: Band[], planned: number[], items: Item[], frame: Frame, template: Template, lead = 0): Realized {
  const spec = SPECS[template]
  const { width: W, height: H, gap: g } = frame
  const target = H - (plan.length - 1) * g
  let heights = [...planned]
  const natural = heights.reduce((a, b) => a + b, 0)

  // 1. the flexible bands (single blocks) absorb as much of the leftover as their blocks allow
  let delta = target - natural
  const ranges = plan.map((b, i) => flexRange(b, heights[i], frame))
  const room = ranges.map((r, i) => (r ? (delta > 0 ? Math.min(r[1], heights[i] * 1.8) - heights[i] : r[0] - heights[i]) : 0))
  const totalRoom = room.reduce((a, b) => a + b, 0)
  if (totalRoom !== 0 && Math.sign(totalRoom) === Math.sign(delta)) {
    const share = Math.min(1, delta / totalRoom)
    heights = heights.map((h, i) => h + room[i] * share)
    delta = target - heights.reduce((a, b) => a + b, 0)
  }
  // 2. anything left: an even scale of every band (photos crop a little)
  if (Math.abs(delta) > 0.01) {
    const s = target / heights.reduce((a, b) => a + b, 0)
    heights = heights.map((h) => h * s)
  }

  const cells: Cell[] = []
  let cost = 0
  let hard = 0
  let y = 0
  let leadArea = lead
  const photoAreas: number[] = []
  const blockAreas: number[] = []

  plan.forEach((band, bi) => {
    const bh = heights[bi]
    const free = W - (band.cols.length - 1) * g
    let widths = band.cols.map((c) => (c.flex ? 0 : c.alpha * bh + c.beta))
    const flex = band.cols.filter((c) => c.flex)
    const rest = free - widths.reduce((a, b) => a + b, 0)
    const sumRho = flex.reduce((a, c) => a + c.ratios[0], 0)
    if (flex.length && rest > flex.length * 40) {
      widths = band.cols.map((c, i) => (c.flex ? (rest * c.ratios[0]) / sumRho : widths[i]))
    } else {
      // no room to flex: every column at its natural width, scaled to the band
      widths = band.cols.map((c) => c.alpha * bh + c.beta)
      const s = free / widths.reduce((a, b) => a + b, 0)
      widths = widths.map((w) => w * s)
    }

    let x = 0
    band.cols.forEach((col, ci) => {
      const w = widths[ci]
      const space = bh - (col.items.length - 1) * g
      const nat = col.ratios.map((r) => w / r)
      const s = space / nat.reduce((a, b) => a + b, 0)
      let cy = y
      col.items.forEach((i, j) => {
        const ch = nat[j] * s
        const item = items[i]
        cells.push({ item, x, y: cy, w, h: ch })
        const area = w * ch
        if (item.kind === 'photo') {
          const crop = cropOf(item.ratio, w / ch)
          const small = sizePenalty(w, ch, spec.minPhoto, spec.minPhoto)
          cost += 10 * crop * crop + (crop > MAX_CROP ? 60 : 0) + small
          if (crop > MAX_CROP || small >= HARD_PENALTY) hard++
          if (item.index === 0) leadArea = area
          else photoAreas.push(area)
        } else {
          // a cramped block is a cost, not a broken rule: its content scales with the cell
          cost += rangeMiss(item.kind, w / ch) + blockPenalty(item.kind, w, ch)
          blockAreas.push(area)
        }
        cy += ch + g
      })
      x += w + g
    })
    y += bh + g
  })

  // nothing outranks the lead photo; blocks stay clearly below it
  const tie = spec.leadMayTie ? 1.02 : 1 / 1.06
  if (photoAreas.some((a) => a > leadArea * tie)) {
    cost += 100
    hard++
  }
  for (const a of blockAreas) if (a > leadArea * BLOCK_MAX_SHARE) cost += 4 + (a / leadArea - BLOCK_MAX_SHARE) * 10
  return { cells, cost, hard }
}

// ─── Layout ─────────────────────────────────────────────────────────────────

/** Lays out the photos (by ratio, in order) and blocks so they fill the frame exactly. */
export function compose(ratios: number[], blocks: BlockKind[], template: Template, frame: Frame): Layout {
  let best: Realized | null = null
  const cache = new Map<string, Band[]>()
  // first with bands at their natural height; only if that bends a rule, with bands squeezed or stretched (cropping a little)
  for (const factors of [[1], STRETCH]) {
    const seen = new Set<string>()
    for (const { shift, cost } of placements(blocks).slice(0, factors.length > 1 ? 3 : 8)) {
      const items = sequence(ratios, blocks, shift)
      const key = items.map((i) => i.kind).join()
      if (seen.has(key)) continue
      seen.add(key)
      const res = layoutItems(items, template, frame, factors, cache)
      if (res && better(res, best, cost)) best = { ...res, cost: res.cost + cost }
      // the ideal block positions are good enough unless they forced a rule to bend
      if (best && !best.hard) break
    }
    if (best && !best.hard) break
  }
  if (best) return { cells: best.cells, width: frame.width, height: frame.height }
  // can't happen (a single band always exists), but never leave the board empty
  const items = sequence(ratios, blocks)
  const w = (frame.width - (items.length - 1) * frame.gap) / items.length
  return {
    cells: items.map((item, i) => ({
      item,
      x: i * (w + frame.gap),
      y: 0,
      w,
      h: frame.height,
    })),
    width: frame.width,
    height: frame.height,
  }
}

const better = (a: Realized, b: Realized | null, extra = 0) => !b || a.hard < b.hard || (a.hard === b.hard && a.cost + extra < b.cost)

/** Band heights the second pass may use, relative to the natural one: every photo in the band crops a little. */
const STRETCH = [1, 1.2, 1 / 1.2, 1.45, 1 / 1.45]

const stretchCost = (band: Band, f: number) => {
  const crop = 1 - Math.min(f, 1 / f)
  return band.photos * 10 * crop * crop
}

/** Editorial likes a big lead. */
const heroBonus = (template: Template, hero: number, frame: Frame) => (template === 'editorial' ? (-8 * hero) / (frame.width * frame.height) : 0)

/** Shapes the side column may give the lead photo (a very wide frame may need a deeper crop). */
const SIDE_CROPS = [1, 1.3, 1 / 1.3, 1.6, 1.75]

/** A lead in a full-height column beside the bands: natural in editorial and collage, less so in the regular grid. */
const SIDE_TASTE: Record<Template, number> = {
  editorial: 0,
  collage: 0.5,
  grilla: 1.5,
}

/**
 * Two families of layouts: bands across the whole frame (the lead opens the
 * first one), or the lead alone in a full-height column with bands beside it.
 */
function layoutItems(items: Item[], template: Template, frame: Frame, factors: number[], cache: Map<string, Band[]>): Realized | null {
  let best = solve(items, 0, frame, template, factors, cache, 0)
  const lead = items[0] as Extract<Item, { kind: 'photo' }>
  const { width: W, height: H, gap: g } = frame
  for (const v of SIDE_CROPS) {
    const lw = H * lead.ratio * v
    const rest = W - lw - g
    if (lw < W * 0.22 || rest < W * 0.3) continue
    const hero = lw * H
    const res = solve(items, 1, { width: rest, height: H, gap: g }, template, factors, cache, hero)
    if (!res) continue
    const crop = 1 - Math.min(v, 1 / v)
    const cost = res.cost + 10 * crop * crop + heroBonus(template, hero, frame) + SIDE_TASTE[template]
    const side: Realized = {
      cells: [{ item: lead, x: 0, y: 0, w: lw, h: H }, ...res.cells.map((c) => ({ ...c, x: c.x + lw + g }))],
      cost,
      hard: res.hard + (crop > MAX_CROP ? 1 : 0),
    }
    if (better(side, best)) best = side
  }
  return best
}

interface State {
  /** Estimated total, for choosing between paths of the same height. */
  cost: number
  /** Template taste alone: the final cost adds the crops realize() measures. */
  struct: number
  sum: number
  band: Band
  h: number
  /** Area of the lead photo on this path. */
  hero: number
  level: number
  prev: State | null
}

/** Rough cost of stretching the bands to the frame (realize() measures the real one). */
const misfit = (sum: number, goal: number) => {
  const crop = 1 - Math.min(sum, goal) / Math.max(sum, goal)
  return 60 * crop * crop
}

/**
 * Fills the frame with bands for items[from..]. With from = 0 the first band
 * opens with the lead photo; otherwise `lead` is the area of the lead photo,
 * already placed outside the frame.
 */
function solve(items: Item[], from: number, frame: Frame, template: Template, factors: number[], cache: Map<string, Band[]>, lead: number): Realized | null {
  const spec = SPECS[template]
  const n = items.length
  const { height: H, gap: g } = frame
  // bucketed total height (bands + gaps) so the DP can aim at the frame's height
  const goal = H + g
  const unit = goal / 70
  const limit = goal * 1.5

  // per start, bands of the same size and about the same height compete: keep the best two,
  // plus the one with the smallest photo (it may be the only one that respects the lead)
  const all: Band[][] = []
  for (let pos = from; pos < n; pos++) {
    // the bands at a position only depend on the frame width and the items that can follow it
    const key = `${Math.round(frame.width)}|${pos}|${items
      .slice(pos, pos + spec.maxItems)
      .map((i) => (i.kind === 'photo' ? i.index : i.kind))
      .join()}`
    const bands = cache.get(key) ?? bandsAt(pos, items, template, frame)
    cache.set(key, bands)
    const groups = new Map<string, Band[]>()
    for (const b of bands) {
      const k = `${b.k}|${Math.round(b.h / unit)}|${b.cols[0].items.length}`
      groups.set(k, [...(groups.get(k) ?? []), b])
    }
    const kept: Band[] = []
    for (const list of groups.values()) {
      list.sort((a, b) => a.taste + a.size - (b.taste + b.size))
      const smallest = list.reduce((m, b) => (b.maxPhoto < m.maxPhoto ? b : m), list[0])
      kept.push(...list.slice(0, 2))
      if (!kept.includes(smallest)) kept.push(smallest)
    }
    all[pos] = kept
  }

  const tie = spec.leadMayTie ? 1.02 : 1 / 1.06

  // DP state: (position, bucketed height so far, how close the biggest other photo is to the lead).
  // Paths that land on the same state compete; the hero of the winning path is kept with it.
  const dp: Map<number, State>[] = Array.from({ length: n + 1 }, () => new Map())
  const level = (ratio: number) => Math.max(0, Math.ceil(Math.log(ratio / tie) / Math.log(1.12)) + 8)
  const put = (pos: number, st: State) => {
    const key = Math.round(st.sum / unit) * 16 + st.level
    const cur = dp[pos].get(key)
    if (!cur || st.cost < cur.cost) dp[pos].set(key, st)
  }
  const extend = (st: State | null, b: Band, f: number, hero: number, t: number) => {
    const h = b.h * f
    const sum = (st?.sum ?? 0) + h + g
    if (sum > limit) return
    const others = st ? b.maxPhoto : b.maxPhotoOthers
    const ratio = (others * f) / hero
    if (ratio > tie) return // nothing outranks the lead photo
    const over = b.maxBlock * f > hero * BLOCK_MAX_SHARE ? 4 : 0
    put(b.start + b.k, {
      cost: (st?.cost ?? 0) + t + stretchCost(b, f) + b.size + over,
      struct: (st?.struct ?? 0) + t,
      sum,
      band: b,
      h,
      hero,
      level: others ? Math.max(st?.level ?? 0, level(ratio)) : (st?.level ?? 0),
      prev: st,
    })
  }

  if (from === 0) {
    // the first band holds the lead photo alone in its first column
    for (const b of all[0]) if (b.cols[0].items.length === 1) for (const f of factors) extend(null, b, f, b.firstArea * f, b.taste + heroBonus(template, b.firstArea * f, frame))
  } else {
    for (const b of all[from]) for (const f of factors) extend(null, b, f, lead, b.taste + (b.k === 1 && items[from].kind === 'photo' ? 2 : 0))
  }

  for (let pos = from + 1; pos < n; pos++) {
    for (const st of dp[pos].values()) {
      for (const b of all[pos]) {
        let t = b.taste
        if (b.k === 1 && items[pos].kind === 'photo') t += 2 // full-width rows only when they really fit
        if (template !== 'grilla' && b.sig === st.band.sig) t += 1.5 // variety
        for (const f of factors) extend(st, b, f, st.hero, t)
      }
    }
  }

  // the bands' heights only approximately add up: realize() fits them exactly and measures the crops
  let best: Realized | null = null
  const ends = [...dp[n].values()].sort((a, b) => a.cost + misfit(a.sum, goal) - (b.cost + misfit(b.sum, goal)))
  for (const [i, st] of ends.entries()) {
    // the best two dozen are usually enough; keep looking only while every candidate bends a rule
    if (i >= 24 && best && !best.hard) break
    if (best && !best.hard && st.struct >= best.cost) continue
    const plan: Band[] = []
    for (let s: State | null = st; s; s = s.prev) plan.unshift(s.band)
    // fit from the natural heights: the stretch only widened the search, an even fit crops least
    const res = realize(
      plan,
      plan.map((b) => b.h),
      items,
      frame,
      template,
      lead,
    )
    const total = { ...res, cost: st.struct + res.cost }
    if (better(total, best)) best = total
  }

  if (!best && from === 0) {
    // no band respects every rule: lay everything out in one band
    const one = all[0].find((b) => b.k === n)
    if (one) best = realize([one], [one.h], items, frame, template)
  }
  return best
}

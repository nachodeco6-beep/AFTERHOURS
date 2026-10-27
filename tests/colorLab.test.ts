import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deltaE, hexToRgb, labToRgb, rgbToHex, rgbToLab, type RGB } from '../src/lib/color.ts'
import {
  adjustText,
  assignRoles,
  basisOf,
  colorPool,
  contrastRatio,
  defaultRoles,
  formatRatio,
  fromAuto,
  MIN_DISTANCE,
  recalc,
  regenerate,
  roleIndex,
  setCount,
  setRole,
  sourceOf,
  toAse,
  toCss,
  toHexList,
  toTokens,
  wcag,
  type LabColor,
  type PoolColor,
} from '../src/lib/colorLab.ts'

const lab = (h: string) => rgbToLab(hexToRgb(h)!)
const minDistance = (hexes: string[]) => {
  let m = Infinity
  for (let i = 0; i < hexes.length; i++) for (let j = i + 1; j < hexes.length; j++) m = Math.min(m, deltaE(lab(hexes[i]), lab(hexes[j])))
  return m
}

// a pool of clearly different colours, as if read from 4 photos
const POOL: PoolColor[] = [
  '#101820', '#F2EDE4', '#C8102E', '#1F4E79', '#E0A800', '#2E7D32', '#6A1B9A', '#8D6E63', '#00838F', '#F06292', '#455A64', '#D84315',
].map((hex, i) => ({ hex, weight: (12 - i) / 78, photo: i % 4 }))
const IDS = ['p0', 'p1', 'p2', 'p3']
const c = (hex: string, locked = false): LabColor => ({ hex, locked, role: null, photoId: null })

test('contrast: black on white is 21:1, a colour on itself 1:1', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21)
  assert.equal(contrastRatio('#FFFFFF', '#000000'), 21)
  assert.equal(contrastRatio('#C7FF3D', '#C7FF3D'), 1)
  assert.equal(formatRatio(21), '21,0:1')
  assert.equal(formatRatio(4.4999), '4,4:1', 'never rounds a fail up to a pass')
  assert.deepEqual(wcag(4.5), { aa: true, aaa: false, aaLarge: true, aaaLarge: true })
  assert.deepEqual(wcag(3.2), { aa: false, aaa: false, aaLarge: true, aaaLarge: false })
  assert.equal(wcag(7.1).aaa, true)
})

test('default roles: extreme background, strongest text, most saturated accent', () => {
  const hexes = ['#8D6E63', '#101820', '#F2EDE4', '#C8102E', '#455A64']
  const roles = defaultRoles(hexes)
  assert.equal(roles[1], 'fondo', 'the darkest (gives the stronger text)')
  assert.equal(roles[2], 'texto', 'most contrast against it')
  assert.equal(roles[3], 'acento', 'most saturated')
  assert.equal(roles.filter((r) => r === 'secundario').length, 1)
  // a light set: the lightest is the background
  const light = defaultRoles(['#F7F3EA', '#EFE6D8', '#3B2F2F', '#D9A441'])
  assert.equal(light[0], 'fondo')
  assert.equal(light[2], 'texto')
  // three colours: no secundario
  assert.deepEqual(defaultRoles(['#000000', '#FFFFFF', '#FF0000']).sort(), ['acento', 'fondo', 'texto'])
})

test('regenerate respects the locks, only uses photo colours and never repeats', () => {
  const start = fromAuto(['#101820', '#F2EDE4', '#C8102E', '#1F4E79', '#E0A800'], POOL, IDS)
  const colors = start.colors.map((col, i) => (i === 0 || i === 2 ? { ...col, locked: true } : col))
  const poolHex = new Set(POOL.map((p) => p.hex))
  let current = colors
  for (let step = 1; step <= 6; step++) {
    const next = regenerate(current, POOL, IDS, step)
    assert.equal(next.length, 5)
    assert.equal(next[0].hex, '#101820', 'locked stays')
    assert.equal(next[2].hex, '#C8102E', 'locked stays')
    assert.ok(next.every((x) => poolHex.has(x.hex)), 'nothing invented')
    assert.ok(minDistance(next.map((x) => x.hex)) >= MIN_DISTANCE, `no near-duplicates (step ${step})`)
    assert.ok(next.some((x, i) => !x.locked && x.hex !== current[i].hex), 'something changed')
    assert.ok(next.every((x) => x.photoId && IDS.includes(x.photoId)), 'each colour knows its photo')
    current = next
  }
  assert.deepEqual(regenerate(colors, POOL, IDS, 3), regenerate(colors, POOL, IDS, 3), 'deterministic')
  assert.deepEqual(regenerate(colors, [], IDS, 1), colors, 'no pool: nothing changes')
})

test('a poor pool gives fewer changes rather than invented or repeated colours', () => {
  const tiny: PoolColor[] = [
    { hex: '#202020', weight: 0.5, photo: 0 },
    { hex: '#232323', weight: 0.3, photo: 0 },
    { hex: '#E0E0E0', weight: 0.2, photo: 1 },
  ]
  const next = regenerate([c('#202020', true), c('#E0E0E0'), c('#777777')], tiny, IDS, 1)
  assert.equal(next[0].hex, '#202020')
  assert.ok(next.every((x) => x.hex === '#777777' || tiny.some((p) => p.hex === x.hex)))
  assert.equal(new Set(next.map((x) => x.hex)).size, 3)
})

test('roles of locked colours stay; the others are worked out again', () => {
  const colors = [c('#F2EDE4', true), c('#101820'), c('#C8102E'), c('#455A64')]
  colors[0] = { ...colors[0], role: 'texto' }
  const out = assignRoles(colors)
  assert.equal(out[0].role, 'texto')
  assert.equal(out[1].role, 'fondo')
  assert.equal(out[2].role, 'acento')
  const moved = setRole(out, 3, 'acento')
  assert.equal(roleIndex(moved, 'acento'), 3, 'a role moves to its new colour')
  assert.equal(moved[2].role, out[3].role, 'and the other colour takes the old one (swap)')
  const swap = setRole(out, 1, 'acento') // the background becomes the accent…
  assert.equal(swap[2].role, 'fondo', '…and the old accent becomes the background: no role is lost')
  assert.equal(setRole(out, 1, null)[1].role, null)
})

test('3 to 8 colours, locks kept when there are fewer', () => {
  const five = fromAuto(['#101820', '#F2EDE4', '#C8102E', '#1F4E79', '#E0A800'], POOL, IDS).colors
  const eight = setCount(five, 8, POOL, IDS)
  assert.equal(eight.length, 8)
  assert.ok(minDistance(eight.map((x) => x.hex)) >= MIN_DISTANCE)
  assert.equal(setCount(five, 12, POOL, IDS).length, 8)
  const lockedLast = five.map((x, i) => (i === 4 ? { ...x, locked: true } : x))
  const three = setCount(lockedLast, 3, POOL, IDS)
  assert.equal(three.length, 3)
  assert.ok(three.some((x) => x.hex === '#E0A800'), 'the locked colour survives')
  assert.equal(setCount(five, 1, POOL, IDS).length, 3)
  // roles survive going down and back up; a hand-picked role stays put
  const custom = setRole(five, 4, 'acento')
  const roundTrip = setCount(setCount(custom, 3, POOL, IDS), 5, POOL, IDS)
  for (const r of ['fondo', 'texto', 'acento'] as const) assert.equal(roundTrip.filter((x) => x.role === r).length, 1, `${r} assigned`)
  const kept = setCount(custom, 6, POOL, IDS)
  assert.equal(kept[4].role, 'acento', 'growing keeps the chosen roles')
})

test('«Ajustar» reaches AA with the smallest change', () => {
  // brute force over the same path (towards white or black, keeping the hue): the best possible move
  const path = (text: string, dir: 1 | -1, t: number) => {
    const [L, a, b] = lab(text)
    const end = dir > 0 ? 100 : 0
    return rgbToHex(labToRgb([L + (end - L) * t, a * (1 - t), b * (1 - t)]))
  }
  for (const [text, bg] of [
    ['#777777', '#FFFFFF'],
    ['#556B2F', '#2B2B2B'],
    ['#C8102E', '#101820'],
    ['#8D6E63', '#F2EDE4'],
  ]) {
    const r = adjustText(text, bg)
    assert.ok(r.changed)
    assert.ok(r.ratio >= 4.5 && contrastRatio(r.hex, bg) >= 4.5, `${text} on ${bg}: ${r.ratio}`)
    let best = Infinity
    for (const dir of [1, -1] as const)
      for (let t = 0; t <= 1; t += 0.001) {
        const h = path(text, dir, t)
        if (contrastRatio(h, bg) >= 4.5) {
          best = Math.min(best, deltaE(lab(text), lab(h)))
          break
        }
      }
    assert.ok(deltaE(lab(text), lab(r.hex)) <= best + 0.5, `${text} on ${bg}: minimal change`)
  }
  assert.equal(adjustText('#000000', '#FFFFFF').changed, false, 'already passes: untouched')
})

test('the pool comes from the photos and knows where each colour comes from', () => {
  const solid = (hex: string, n = 300): RGB[] => Array.from({ length: n }, () => hexToRgb(hex)!)
  const pool = colorPool([solid('#C8102E'), solid('#1F4E79'), [...solid('#F2EDE4', 200), ...solid('#C8102E', 100)]], 6)
  assert.ok(pool.length >= 3)
  const red = sourceOf('#C8102E', pool)!
  assert.ok(red && (red.photo === 0 || red.photo === 2))
  assert.equal(sourceOf('#1F4E79', pool)!.photo, 1)
  assert.equal(sourceOf('#F2EDE4', pool)!.photo, 2)
  assert.equal(sourceOf('#00FF00', pool), null, 'a colour that isn\'t in the photos has no source')
  const total = pool.reduce((a, p) => a + p.weight, 0)
  assert.ok(Math.abs(total - 1) < 1e-9)
})

test('recalculate after the photos change keeps the locked colours', () => {
  const edit = fromAuto(['#101820', '#F2EDE4', '#C8102E'], POOL, IDS)
  edit.colors[1] = { ...edit.colors[1], locked: true }
  const other: PoolColor[] = [
    { hex: '#0B3C5D', weight: 0.4, photo: 0 },
    { hex: '#D9B310', weight: 0.35, photo: 1 },
    { hex: '#328CC1', weight: 0.25, photo: 1 },
  ]
  const next = recalc(edit, other, ['n0', 'n1'])
  assert.equal(next.colors[1].hex, '#F2EDE4')
  assert.equal(next.basis, basisOf(['n1', 'n0']))
  assert.ok(next.colors.filter((x) => !x.locked).every((x) => other.some((p) => p.hex === x.hex)))
})

test('exports: HEX list, CSS variables, tokens with roles and .ase', () => {
  const colors = assignRoles([c('#101820'), c('#F2EDE4'), c('#C8102E'), c('#1F4E79'), c('#E0A800')])
  assert.equal(toHexList(colors).split('\n').length, 5)
  const css = toCss(colors)
  assert.match(css, /--color-fondo: #101820;/)
  assert.match(css, /--color-texto: #F2EDE4;/)
  assert.match(css, /--color-acento: #/)
  const tokens = JSON.parse(toTokens(colors))
  assert.equal(tokens.color.fondo.$value, '#101820')
  assert.equal(tokens.color.fondo.$type, 'color')
  assert.equal(tokens.roles.texto, '{color.texto}')
  const ase = toAse(colors)
  assert.equal(String.fromCharCode(...ase.slice(0, 4)), 'ASEF')
  const view = new DataView(ase.buffer)
  assert.equal(view.getUint16(4), 1, 'version 1.0')
  assert.equal(view.getUint32(8), 5, 'five swatches')
  assert.equal(view.getUint16(12), 1, 'first block is a colour entry')
  // name «fondo» then «RGB » and 1 = 0x10/0x10? check red channel of #101820
  const nameLen = view.getUint16(18)
  assert.equal(nameLen, 'fondo'.length + 1)
  const model = 20 + nameLen * 2
  assert.equal(String.fromCharCode(...ase.slice(model, model + 4)), 'RGB ')
  assert.ok(Math.abs(view.getFloat32(model + 4) - 0x10 / 255) < 1e-6)
})

test('saved boards: old ones migrate to the automatic palette; edited palettes survive a reload', async () => {
  const { makeRecord, readRecord, readBoards, writeBoards, upsert, signature, contentOf } = await import('../src/lib/saved.ts')
  const { photo } = await import('./helpers.ts')
  const v1 = { version: 1, id: 'old', title: 'Viejo', template: 'collage', format: 'vertical', photos: [{ photo: photo('a'), tag: 'mar' }], typeStyle: { leading: 1.5 } }
  const migrated = readRecord(v1)!
  assert.equal(migrated.version, 2)
  assert.equal(migrated.palette, null, 'automatic palette')
  assert.equal(migrated.title, 'Viejo')
  assert.equal(migrated.format, 'vertical')
  assert.equal(migrated.typeStyle.leading, 1.5, 'nothing else lost')

  const edit = fromAuto(['#101820', '#F2EDE4', '#C8102E', '#1F4E79'], POOL, IDS)
  edit.colors[2] = { ...edit.colors[2], locked: true }
  const record = makeRecord({ ...contentOf(migrated), palette: edit }, 'new', 9)
  const mem = new Map<string, string>()
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
  writeBoards(store, upsert([], record))
  const back = readBoards(store)[0]
  assert.deepEqual(back.palette, edit)
  assert.notEqual(signature(contentOf(back)), signature(contentOf(migrated)), 'the palette counts as a change')

  // broken palettes fall back to the automatic one instead of breaking the board
  assert.equal(readRecord({ ...record, palette: { colors: [{ hex: 'nope' }], basis: 'x' } })!.palette, null)
  assert.equal(readRecord({ ...record, palette: { colors: edit.colors.slice(0, 2), basis: 'x' } })!.palette, null, 'fewer than 3')
  const dupRoles = { ...edit, colors: edit.colors.map((x) => ({ ...x, role: 'fondo' })) }
  assert.equal(readRecord({ ...record, palette: dupRoles })!.palette!.colors.filter((x) => x.role === 'fondo').length, 1, 'a role only once')
})

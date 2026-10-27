import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MOODS } from '../src/data/moods.ts'
import { HEAD_STYLES, PAIR_INFO } from '../src/data/pairInfo.ts'
import { TYPE_PAIRS } from '../src/data/typePairs.ts'
import { CATALOG, companions, filterPairs, linkTags, NO_FILTER, pairCss, pairName, randomPair, styleOf } from '../src/lib/pairing.ts'
import { rng } from '../src/lib/harmony.ts'
import { DEFAULT_TYPE_STYLE } from '../src/lib/typography.ts'

test('the catalogue: every pair, Nacho’s 12 first', () => {
  assert.equal(CATALOG.length, TYPE_PAIRS.length)
  assert.equal(CATALOG.length, 62)
  assert.ok(CATALOG.slice(0, 12).every((p) => p.nacho))
  assert.ok(CATALOG.slice(12).every((p) => !p.nacho))
})

test('every pair has a style and 2 or 3 climas; every clima is used', () => {
  for (const p of TYPE_PAIRS) {
    const info = PAIR_INFO[p.id]
    assert.ok(info, `pair ${p.id} has info`)
    assert.ok(HEAD_STYLES.includes(info.style))
    assert.ok(info.moods.length >= 2 && info.moods.length <= 3, `pair ${p.id}: ${info.moods.length} climas`)
    assert.equal(new Set(info.moods).size, info.moods.length)
  }
  for (const m of MOODS) assert.ok(TYPE_PAIRS.some((p) => PAIR_INFO[p.id].moods.includes(m)), `${m} is used`)
  for (const s of HEAD_STYLES) assert.ok(TYPE_PAIRS.some((p) => styleOf(p) === s), `${s} is used`)
})

test('the filters combine: style AND clima AND name', () => {
  assert.equal(filterPairs(CATALOG, NO_FILTER).length, 62)
  const serifLujo = filterPairs(CATALOG, { style: 'serif', mood: 'lujo', query: '' })
  assert.ok(serifLujo.length > 0)
  assert.ok(serifLujo.every((p) => styleOf(p) === 'serif' && PAIR_INFO[p.id].moods.includes('lujo')))
  assert.deepEqual(serifLujo, filterPairs(filterPairs(CATALOG, { ...NO_FILTER, style: 'serif' }), { ...NO_FILTER, mood: 'lujo' }))
  // the name matches either side, without caring about case or accents
  const mont = filterPairs(CATALOG, { ...NO_FILTER, query: 'MONTSERRAT' })
  assert.ok(mont.length >= 5 && mont.every((p) => p.display.family === 'Montserrat' || p.text.family === 'Montserrat'))
  const montDisplay = filterPairs(CATALOG, { style: 'display', mood: null, query: 'montserrat' })
  assert.deepEqual(
    montDisplay.map((p) => p.id),
    mont.filter((p) => styleOf(p) === 'display').map((p) => p.id),
  )
  assert.deepEqual(filterPairs(CATALOG, { style: 'mono', mood: 'lujo', query: '' }), [])
})

test('«Otro par» respects the filters and moves away from the current one', () => {
  const list = filterPairs(CATALOG, { ...NO_FILTER, mood: 'retro' })
  const rand = rng(4)
  for (let i = 0; i < 50; i++) {
    const p = randomPair(list, rand, list[0].id)!
    assert.ok(list.includes(p))
    assert.notEqual(p.id, list[0].id)
  }
  assert.equal(randomPair([], rand), null)
  assert.equal(randomPair([list[0]], rand, list[0].id), list[0], 'the only one there is')
})

test('fixing a headline: the catalogue’s pairs with that font come first', () => {
  const bodoni = TYPE_PAIRS.find((p) => p.id === 4)!.display // Bodoni Moda
  const list = companions(bodoni, 'display')
  const inCatalog = TYPE_PAIRS.filter((p) => p.display.family === 'Bodoni Moda').map((p) => p.text.family)
  const firsts = list.filter((c) => c.inCatalog).map((c) => c.font.family)
  assert.deepEqual(new Set(firsts), new Set(inCatalog))
  assert.deepEqual(
    list.slice(0, firsts.length).map((c) => c.font.family),
    firsts,
    'catalogue ones first',
  )
  // then other families, all text fonts that read well small
  for (const c of list.filter((x) => !x.inCatalog)) assert.ok(c.font.kind === 'sans' || c.font.kind === 'serif', `${c.font.family} reads well small`)
  // what's stored: the pair each font comes from, on its text side
  for (const c of list) assert.equal(TYPE_PAIRS.find((p) => p.id === c.from)!.text.family, c.font.family)
})

test('never proposes the same font as its own companion; works the other way round', () => {
  for (const p of TYPE_PAIRS) {
    for (const side of ['display', 'text'] as const) {
      const fixed = p[side]
      const list = companions(fixed, side)
      assert.ok(list.length > 0)
      assert.ok(list.every((c) => c.font.family !== fixed.family), `${fixed.family} (${side})`)
      assert.equal(new Set(list.map((c) => c.font.family)).size, list.length, 'no repeats')
    }
  }
  // fixing the text asks for headlines
  const inter = TYPE_PAIRS.find((p) => p.text.family === 'Inter')!.text
  const heads = companions(inter, 'text')
  assert.ok(heads.filter((c) => c.inCatalog).length >= 4)
  for (const c of heads) assert.equal(TYPE_PAIRS.find((p) => p.id === c.from)!.display.family, c.font.family)
})

test('copy: the name, the <link> and the CSS', () => {
  const p = TYPE_PAIRS.find((x) => x.id === 1)!
  assert.equal(pairName(p), 'Playfair Display + Montserrat')
  assert.match(linkTags(p), /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Playfair\+Display&family=Montserrat&display=swap" rel="stylesheet">/)
  // the site's own fonts are in the link too (whoever copies it doesn't have them)
  assert.match(linkTags(TYPE_PAIRS.find((x) => x.id === 23)!), /family=Big\+Shoulders\+Display.*family=Inter\+Tight/)
  const css = pairCss({ ...p, display: { ...p.display, weight: 700 } }, { ...DEFAULT_TYPE_STYLE, tracking: 0.02, uppercase: true })
  assert.match(css, /font-family: 'Playfair Display', Georgia/)
  assert.match(css, /font-weight: 700;/)
  assert.match(css, /letter-spacing: 0\.02em;/)
  assert.match(css, /text-transform: uppercase;/)
  assert.match(css, /line-height: 1\.4;/)
})

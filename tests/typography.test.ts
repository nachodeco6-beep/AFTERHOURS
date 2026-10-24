import assert from 'node:assert/strict'
import { test } from 'node:test'
import { TYPE_PAIRS } from '../src/data/typePairs.ts'
import { DEFAULT_TYPE_STYLE, effectivePair, fontCss, fontStack, fontUrl, googleFontsUrl, legibilityNotes, normalize, pairKey, rankPairs, scorePair, weightsOf } from '../src/lib/typography.ts'

const byId = (id: number) => TYPE_PAIRS.find((p) => p.id === id)!

test('the list has the 62 pairs, 12 of them Nacho picks', () => {
  assert.equal(TYPE_PAIRS.length, 62)
  assert.equal(TYPE_PAIRS.filter((p) => p.nacho).length, 12)
  assert.deepEqual(TYPE_PAIRS.map((p) => p.id), Array.from({ length: 62 }, (_, i) => i + 1))
})

test('normalize drops accents and case', () => {
  assert.equal(normalize('Romántico, ARTÉ  Déco!'), 'romantico arte deco')
})

test('lujo + moda picks Playfair Display + Montserrat (Nacho wins the tie)', () => {
  assert.equal(rankPairs(['Lujo', 'moda de autor'])[0].id, 1)
})

test('accents and plurals in the concept still match', () => {
  assert.ok(scorePair(byId(10), ['románticas', 'primavera']) >= 4)
  assert.equal(rankPairs(['ROMANTICO', 'Primavera'])[0].id, 10)
})

test('multi-word tags match as phrases', () => {
  assert.equal(rankPairs(['art déco', 'años 20', 'glamour'])[0].id, 37)
  assert.equal(rankPairs(['alta costura'])[0].id, 13)
})

test('urban streetwear concept goes to an urban pair', () => {
  const top = rankPairs(['Marca de ropa urbana', 'surf', 'California 90s', 'analógico', 'flash directo', 'arena y negro'])
  assert.equal(top[0].category, 'Urbano')
  assert.ok(top.some((p) => p.id === 40), 'surf pair is among the options')
})

test('no match falls back to the neutral editorial Nacho pick, then other Nacho picks', () => {
  const ranked = rankPairs(['zzzz', 'qwerty'])
  assert.equal(ranked[0].id, 3)
  assert.ok(ranked.length > 1 && ranked.every((p) => p.nacho))
})

test('Google Fonts URL asks for the special cuts', () => {
  assert.equal(googleFontsUrl(byId(2)), 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@1,400..900&family=Inter&display=swap')
  assert.match(googleFontsUrl(byId(6))!, /family=Fraunces:wght,SOFT@400\.\.900,0\.\.100/)
  assert.equal(googleFontsUrl(byId(7)), 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Open+Sans&display=swap')
  assert.match(googleFontsUrl(byId(8))!, /family=Archivo:wdth,wght@62\.\.125,400\.\.700/)
  assert.equal(googleFontsUrl(byId(1)), 'https://fonts.googleapis.com/css2?family=Playfair+Display&family=Montserrat&display=swap')
})

test('fonts already on the site are not requested again', () => {
  assert.equal(googleFontsUrl(byId(23)), null) // Big Shoulders Display + Inter Tight
  assert.equal(googleFontsUrl(byId(31)), null) // JetBrains Mono + Inter Tight
  assert.equal(googleFontsUrl(byId(29)), 'https://fonts.googleapis.com/css2?family=Sora&family=Inter&display=swap')
})

test('display weights: Fraunces black with SOFT 100, Cinzel 600, the rest 400', () => {
  assert.deepEqual(fontCss(byId(6).display), { fontFamily: fontStack(byId(6).display), fontWeight: 900, fontVariationSettings: "'SOFT' 100" })
  assert.equal(fontCss(byId(7).display).fontWeight, 600)
  const others = TYPE_PAIRS.filter((p) => p.id !== 6 && p.id !== 7)
  assert.ok(others.every((p) => fontCss(p.display).fontWeight === 400 && fontCss(p.text).fontWeight === 400))
})

test('Type Lab: weights come from what each font really has', () => {
  assert.deepEqual(weightsOf(byId(1).display), [400, 500, 600, 700, 800, 900]) // Playfair Display
  assert.deepEqual(weightsOf(byId(10).display), [400]) // Abril Fatface: one weight
  assert.deepEqual(weightsOf(byId(6).display), [400, 500, 600, 700, 800, 900], 'Fraunces: only inside its loaded range')
  assert.deepEqual(weightsOf(byId(23).display), [700, 900], 'Big Shoulders: what the site ships')
  for (const p of TYPE_PAIRS) {
    const ws = weightsOf(p.display)
    assert.ok(ws.length > 0, `${p.display.family} has weights`)
    if (p.display.weight) assert.ok(ws.includes(p.display.weight), `${p.display.family} ${p.display.weight}`)
  }
})

test('Type Lab: fonts picked by hand mix two pairs; the weight goes on the headline', () => {
  const auto = byId(1)
  assert.equal(effectivePair(auto, null, DEFAULT_TYPE_STYLE), auto)
  const mixed = effectivePair(auto, { display: 6, text: 9 }, DEFAULT_TYPE_STYLE)
  assert.equal(mixed.display.family, 'Fraunces')
  assert.equal(mixed.text.family, 'Montserrat')
  assert.equal(mixed.category, 'Retro')
  const heavy = effectivePair(auto, null, { ...DEFAULT_TYPE_STYLE, weight: 700 })
  assert.equal(heavy.display.weight, 700)
  assert.match(googleFontsUrl(heavy)!, /family=Playfair\+Display:wght@700/)
  assert.equal(effectivePair(byId(10), null, { ...DEFAULT_TYPE_STYLE, weight: 700 }).display.weight, undefined, 'a weight the font lacks is ignored')
  assert.notEqual(pairKey(heavy), pairKey(auto))
  assert.equal(effectivePair(auto, { display: 999, text: 999 }, DEFAULT_TYPE_STYLE), auto, 'unknown ids fall back')
})

test('Type Lab: one font at a time, none for the fonts the site ships', () => {
  assert.equal(fontUrl(byId(1).display), 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap')
  assert.equal(fontUrl(byId(23).display), null)
  assert.equal(fontUrl(byId(7).display), 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600&display=swap')
})

test('Type Lab: legibility warnings', () => {
  assert.deepEqual(legibilityNotes(byId(1), DEFAULT_TYPE_STYLE), [])
  const script = byId(12) // Mrs Saint Delafield
  assert.equal(legibilityNotes(script, { ...DEFAULT_TYPE_STYLE, uppercase: true }).length, 2)
  assert.equal(legibilityNotes(byId(1), { ...DEFAULT_TYPE_STYLE, tracking: -0.04, leading: 1.15 }).length, 2)
  assert.equal(legibilityNotes(byId(6), { ...DEFAULT_TYPE_STYLE, weight: 200 }).length, 1)
  assert.ok(legibilityNotes(byId(21), DEFAULT_TYPE_STYLE).some((n) => /monoespaciada/.test(n)))
})

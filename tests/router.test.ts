import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NAV } from '../src/data/nav.ts'
import { parseRoute, routeHref, TITLES } from '../src/lib/routes.ts'

test('the Library lives at #/library; the old #/archivo redirects there', () => {
  assert.deepEqual(parseRoute('#/library'), { route: 'library', replace: null })
  assert.deepEqual(parseRoute('#/library/'), { route: 'library', replace: null })
  assert.deepEqual(parseRoute('#/archivo'), { route: 'library', replace: '#/library' })
  assert.deepEqual(parseRoute('#/archivo/'), { route: 'library', replace: '#/library' })
  assert.equal(routeHref('library'), '#/library')
  assert.equal(TITLES.library, 'Library — AFTERHOURS')
  const item = NAV.find((n) => n.route === 'library')
  assert.deepEqual([item?.no, item?.label], ['04', 'Library'])
})

test('the other routes, anchors and unknown paths behave as before', () => {
  assert.deepEqual(parseRoute(''), { route: 'home', replace: null })
  assert.deepEqual(parseRoute('#/'), { route: 'home', replace: null })
  assert.deepEqual(parseRoute('#/studio'), { route: 'studio', replace: null })
  assert.deepEqual(parseRoute('#/type-lab'), { route: 'type-lab', replace: null })
  assert.deepEqual(parseRoute('#/color-lab'), { route: 'color-lab', replace: null })
  assert.equal(parseRoute('#moodboard'), null, 'an in-page anchor keeps the route')
  assert.deepEqual(parseRoute('#/no-existe'), { route: 'home', replace: '#/' })
})

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ROOMS } from '../src/planta/rooms.ts'
import { CLOSED, plantaReducer, ROOM_ROUTE, roomOfRoute, type PlantaState } from '../src/planta/state.ts'

test('each room leads to its route; the workshop is under construction', () => {
  assert.deepEqual(ROOM_ROUTE, {
    hall: '#/',
    studio: '#/studio',
    type: '#/type-lab',
    color: '#/color-lab',
    archivo: '#/archivo',
    taller: null,
  })
  assert.deepEqual(
    ROOMS.map((r) => [r.id, r.no, r.name]),
    [
      ['archivo', '04', 'Archivo'],
      ['hall', '00', 'Hall'],
      ['studio', '01', 'Studio'],
      ['type', '02', 'Type Lab'],
      ['color', '03', 'Color Lab'],
      ['taller', '05', 'Taller'],
    ],
  )
  assert.equal(ROOMS.find((r) => r.id === 'taller')!.obra, true)
  // who's inside each room
  const who = Object.fromEntries(ROOMS.map((r) => [r.id, r.who]))
  assert.match(who.hall, /Lola/)
  assert.match(who.studio, /Tomi y Pixel, el gato/)
  assert.match(who.type, /Vera/)
  assert.match(who.color, /Bruno/)
  assert.match(who.archivo, /Don Ernesto/)
  assert.match(who.taller, /el Tano/)
})

test('the plan opens on the room of the page you are on', () => {
  assert.equal(roomOfRoute(''), 'hall')
  assert.equal(roomOfRoute('#/'), 'hall')
  assert.equal(roomOfRoute('#/studio'), 'studio')
  assert.equal(roomOfRoute('#/type-lab'), 'type')
  assert.equal(roomOfRoute('#/color-lab/'), 'color')
  assert.equal(roomOfRoute('#/archivo'), 'archivo')
  assert.equal(roomOfRoute('#/otra-cosa'), 'studio')
})

test('Escape closes the plan and goes back to the route you came from', () => {
  let [s, fx] = plantaReducer(CLOSED, { type: 'open', from: '#/color-lab' })
  assert.deepEqual(s, { open: true, returnTo: '#/color-lab', focused: null })
  assert.deepEqual(fx, {})
  ;[s, fx] = plantaReducer(s, { type: 'escape' })
  assert.equal(s.open, false)
  assert.deepEqual(fx, { navigate: '#/color-lab' })
  // «Página» does the same
  ;[s, fx] = plantaReducer({ open: true, returnTo: '#/studio', focused: null }, { type: 'close' })
  assert.equal(s.open, false)
  assert.deepEqual(fx, { navigate: '#/studio' })
})

test('inside a room, Escape first flies back out to the whole plan', () => {
  const inRoom: PlantaState = { open: true, returnTo: '#/', focused: 'type' }
  const [s, fx] = plantaReducer(inRoom, { type: 'escape' })
  assert.deepEqual(s, { open: true, returnTo: '#/', focused: null })
  assert.deepEqual(fx, {}, 'no navigation yet')
})

test('entering a room goes to its route; the workshop can not be entered', () => {
  const open: PlantaState = { open: true, returnTo: '#/', focused: null }
  let [s, fx] = plantaReducer(open, { type: 'focus', room: 'archivo' })
  assert.equal(s.focused, 'archivo')
  ;[s, fx] = plantaReducer(s, { type: 'entered', room: 'archivo' })
  assert.equal(s.open, false)
  assert.deepEqual(fx, { navigate: '#/archivo' })
  ;[s, fx] = plantaReducer(open, { type: 'focus', room: 'taller' })
  assert.equal(s.focused, null)
  ;[s, fx] = plantaReducer(open, { type: 'entered', room: 'taller' })
  assert.deepEqual([s, fx], [open, {}])
})

// ─── the plan is not in the main chunk ──────────────────────────────────────

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Static imports only (`import x from`, `export … from`, side-effect `import '…'`); `import()` is a separate chunk. */
function staticImports(file: string): string[] {
  const src = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const out: string[] = []
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g)) {
    if (/^\s*(?:import|export)\s+type\s/.test(m[0].trim())) continue // types vanish at build time
    out.push(m[1])
  }
  return out
}

function resolveLocal(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = join(dirname(from), spec)
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) if (existsSync(c) && !c.endsWith('/')) return c
  return null
}

test('the 3D plan (three.js and the scene) is not in the main chunk', () => {
  const seen = new Set<string>()
  const packages = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file) || !/\.(ts|tsx)$/.test(file)) return
    seen.add(file)
    for (const spec of staticImports(file)) {
      const local = resolveLocal(file, spec)
      if (local) walk(local)
      else if (!spec.startsWith('.')) packages.add(spec.split('/')[0])
    }
  }
  walk(join(ROOT, 'src/main.tsx'))
  assert.ok(seen.size > 20, 'walked the app')
  assert.ok(!packages.has('three'), 'three is only loaded on demand')
  const planta = [...seen].filter((f) => f.includes('/src/planta/')).map((f) => f.split('/src/')[1])
  assert.deepEqual(planta, ['planta/state.ts'], 'only the tiny open/close state is in the main chunk')
  // and the shell loads the plan with a dynamic import
  assert.match(readFileSync(join(ROOT, 'src/App.tsx'), 'utf8'), /lazy\(\(\) => import\('\.\/planta\/StudioPlanta3D'\)/)
})

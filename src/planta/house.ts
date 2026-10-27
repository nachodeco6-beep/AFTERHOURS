/** The house: floors (with the selection edge), brick walls, iron windows with the night city, studs (ported from the prototype). */
import * as THREE from 'three'
import type { Materials } from './materials'
import { ROOMS, type RoomId } from './rooms'
import type { Textures } from './textures'
import { ACID, box, ctx, plane, std, X, Z } from './util'

export const WB = 2.3,
  WI = 1.05,
  WF = 0.3,
  T = 0.14,
  TI = 0.09

export interface RoomMeshes {
  floor: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  edge: THREE.Group
  center: THREE.Vector3
  anchor: THREE.Vector3
}

export function floors(TX: Textures): Record<RoomId, RoomMeshes> {
  const { root, pickables } = ctx()
  const def: Record<RoomId, THREE.Texture> = { library: TX.oakDark, hall: TX.tile, studio: TX.oak, type: TX.maple, color: TX.maple, taller: TX.concrete }
  const out = {} as Record<RoomId, RoomMeshes>
  for (const r of ROOMS) {
    const id = r.id
    const [px, py, pw, ph] = r.rect
    const w = pw / 100,
      d = ph / 100
    const mat = std(0xffffff, id === 'hall' ? 0.3 : id === 'taller' ? 0.85 : 0.36, 0, { map: def[id], emissive: ACID, emissiveIntensity: 0 })
    const m = box(w, 0.06, d, mat, X(px) + w / 2, -0.03, Z(py) + d / 2, root, id === 'hall' ? 1.6 : 2.4)
    m.userData.room = id
    if (!r.obra) pickables.push(m)
    // green edge for the chosen room
    const edge = new THREE.Group()
    edge.visible = false
    root.add(edge)
    const em = new THREE.MeshBasicMaterial({ color: ACID })
    const t = 0.045,
      y = 0.012
    box(w, 0.01, t, em, X(px) + w / 2, y, Z(py) + t / 2, edge)
    box(w, 0.01, t, em, X(px) + w / 2, y, Z(py) + d - t / 2, edge)
    box(t, 0.01, d, em, X(px) + t / 2, y, Z(py) + d / 2, edge)
    box(t, 0.01, d, em, X(px) + w - t / 2, y, Z(py) + d / 2, edge)
    const center = new THREE.Vector3(X(px + pw / 2), 0, Z(py + ph / 2))
    out[id] = { floor: m, edge, center, anchor: new THREE.Vector3(center.x, r.tagY, center.z) }
  }
  // the model's base
  box(10.9, 0.34, 7.7, std(0xe3ddd1, 0.8), 0, -0.23, 0)
  box(10.92, 0.025, 7.72, new THREE.MeshBasicMaterial({ color: ACID }), 0, -0.075, 0)
  box(10.95, 0.3, 7.75, std(0x1d1d1b, 0.7), 0, -0.25 - 0.17, 0)
  return out
}

type Win = [number, number, number, number]

function windowFrame(TX: Textures, MAT: Materials, axis: 'x' | 'z', a: number, b: number, y0: number, y1: number, c: number, t: number, outward: number) {
  const len = (b - a) / 100,
    mid = (a + b) / 200 - (axis === 'x' ? 5 : 3.4),
    hh = y1 - y0,
    ym = (y0 + y1) / 2
  const bar = (w: number, hgt: number, pos: number, y: number) => (axis === 'x' ? box(w, hgt, t + 0.02, MAT.steel, pos, y, c) : box(t + 0.02, hgt, w, MAT.steel, c, y, pos))
  const start = axis === 'x' ? X(a) : Z(a)
  for (let i = 0; i <= 4; i++) bar(i === 0 || i === 4 ? 0.05 : 0.025, hh, start + (len * i) / 4, ym)
  for (let j = 0; j <= 3; j++) bar(len, j === 0 || j === 3 ? 0.05 : 0.025, mid, y0 + (hh * j) / 3)
  // sky and city outside (doesn't block the moon)
  const sky = plane(len + 0.6, hh + 0.5, new THREE.MeshBasicMaterial({ map: TX.sky }))
  sky.userData.noShadow = true
  if (axis === 'x') sky.position.set(mid, ym, c + outward * (t / 2 + 0.35))
  else {
    sky.position.set(c + outward * (t / 2 + 0.35), ym, mid)
    sky.rotation.y = -Math.PI / 2
  }
  const glass = plane(
    len,
    hh,
    new THREE.MeshPhysicalMaterial({ color: 0xbfd4ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
  )
  glass.userData.noShadow = true
  if (axis === 'x') glass.position.set(mid, ym, c)
  else {
    glass.position.set(c, ym, mid)
    glass.rotation.y = Math.PI / 2
  }
  // sill
  if (axis === 'x') box(len + 0.06, 0.03, t + 0.08, MAT.concreteCap, mid, y0 - 0.015, c)
  else box(t + 0.08, 0.03, len + 0.06, MAT.concreteCap, c, y0 - 0.015, mid)
}

// wall along X (at y=py), with windows [[pxA, pxB, y0, y1]]
function wallAlongX(TX: Textures, MAT: Materials, px0: number, px1: number, py: number, h: number, t: number, mat: THREE.Material, wins: Win[] = [], outward = -1) {
  const zc = Z(py) + (outward * t) / 2
  let cur = px0
  const piece = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.5 || y1 - y0 < 0.01) return
    const w = (b - a) / 100
    box(w, y1 - y0, t, mat, X(a) + w / 2, y0 + (y1 - y0) / 2, zc, ctx().root, mat === MAT.brick ? 1.4 : 0)
  }
  for (const [a, b, y0, y1] of wins) {
    piece(cur, a, 0, h)
    piece(a, b, 0, y0)
    piece(a, b, y1, h)
    windowFrame(TX, MAT, 'x', a, b, y0, y1, zc, t, outward)
    cur = b
  }
  piece(cur, px1, 0, h)
}
function wallAlongZ(TX: Textures, MAT: Materials, px: number, py0: number, py1: number, h: number, t: number, mat: THREE.Material, wins: Win[] = [], outward = 1) {
  const xc = X(px) + (outward * t) / 2
  let cur = py0
  const piece = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.5 || y1 - y0 < 0.01) return
    const d = (b - a) / 100
    box(t, y1 - y0, d, mat, xc, y0 + (y1 - y0) / 2, Z(a) + d / 2, ctx().root, mat === MAT.brick ? 1.4 : 0)
  }
  for (const [a, b, y0, y1] of wins) {
    piece(cur, a, 0, h)
    piece((cur = a), b, 0, y0)
    piece(a, b, y1, h)
    windowFrame(TX, MAT, 'z', a, b, y0, y1, xc, t, outward)
    cur = b
  }
  piece(cur, py1, 0, h)
}
function studs(axis: 'x' | 'z', a: number, b: number, fixed: number, h: number) {
  const wood = std(0xc49a64, 0.75)
  const len = (b - a) / 100
  if (axis === 'x') {
    for (let p = a; p <= b; p += 40) box(0.05, h, 0.09, wood, X(p), h / 2, Z(fixed))
    box(len, 0.05, 0.09, wood, X(a) + len / 2, h - 0.025, Z(fixed))
    box(len, 0.05, 0.09, wood, X(a) + len / 2, 0.025, Z(fixed))
  } else {
    for (let p = a; p <= b; p += 40) box(0.09, h, 0.05, wood, X(fixed), h / 2, Z(p))
    box(0.09, 0.05, len, wood, X(fixed), h - 0.025, Z(a) + len / 2)
    box(0.09, 0.05, len, wood, X(fixed), 0.025, Z(a) + len / 2)
  }
}

export function walls(TX: Textures, MAT: Materials) {
  // back (brick, iron windows)
  wallAlongX(TX, MAT, -14, 1014, 0, WB, T, MAT.brick, [[318, 434, 0.75, 2.0], [628, 712, 0.75, 2.0], [880, 984, 0.75, 2.0]], -1)
  wallAlongZ(TX, MAT, 1000, 0, 460, WB, T, MAT.brick, [[116, 216, 0.75, 2.0]], 1)
  box(10.28, 0.06, T + 0.06, MAT.concreteCap, 0, WB + 0.03, Z(0) - T / 2)
  box(T + 0.06, 0.06, 4.6, MAT.concreteCap, X(1000) + T / 2, WB + 0.03, Z(230))
  studs('z', 460, 680, 1000 + 4, WB)
  // low front
  wallAlongZ(TX, MAT, 0, 0, 694, WF, T, MAT.plaster, [], -1)
  wallAlongX(TX, MAT, -14, 110, 680, WF, T, MAT.plaster, [], 1)
  wallAlongX(TX, MAT, 190, 720, 680, WF, T, MAT.plaster, [], 1)
  studs('x', 720, 1000, 684, WF + 0.1)
  // inner walls (white plaster, cut at half height)
  const iw = (axis: 'x' | 'z', a: number, b: number, f: number) =>
    axis === 'x' ? box((b - a) / 100, WI, TI, MAT.plaster, (X(a) + X(b)) / 2, WI / 2, Z(f)) : box(TI, WI, (b - a) / 100, MAT.plaster, X(f), WI / 2, (Z(a) + Z(b)) / 2)
  iw('z', 0, 150, 300)
  iw('z', 210, 480, 300)
  iw('z', 540, 680, 300)
  iw('x', 0, 200, 380)
  iw('x', 280, 300, 380)
  iw('z', 0, 70, 720)
  iw('z', 130, 320, 720)
  iw('z', 380, 560, 720)
  iw('z', 620, 680, 720)
  iw('x', 790, 1000, 230)
  studs('x', 720, 1000, 460, WI)
  // building-site curtain (plastic + tape)
  const sheet = plane(0.6, WI, std(0xdfe9f0, 0.3, 0, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }))
  sheet.position.set(X(720), WI / 2, Z(590))
  sheet.rotation.y = Math.PI / 2
  sheet.userData.noShadow = true
  const tape = plane(0.75, 0.07, std(0xffffff, 0.6, 0, { map: TX.hazard, side: THREE.DoubleSide }))
  tape.position.set(X(720) - 0.02, 0.62, Z(590))
  tape.rotation.set(0, Math.PI / 2, 0.25)
  // white skirting on the brick
  box(10.0, 0.08, 0.02, MAT.white, 0, 0.04, Z(0) + 0.01)
  box(0.02, 0.08, 4.6, MAT.white, X(1000) - 0.01, 0.04, Z(230))
}

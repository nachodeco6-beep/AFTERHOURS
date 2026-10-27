/**
 * Shared state and helpers of the 3D plan (ported from the planta3d.html
 * prototype). A fresh context is made on every open: same seed, same house,
 * and everything it creates can be disposed on close.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PlantaTheme } from './rooms'

export const ACID = 0xc7ff3d
export const BONE = 0xf1f0e8
export const INK = 0x141414

export interface Ctx {
  root: THREE.Group
  rand: () => number
  /** Every texture made, to dispose on close. */
  textures: THREE.Texture[]
  /** Floors that answer clicks. */
  pickables: THREE.Mesh[]
  /** Lights the intro switches on one by one. */
  lights: THREE.PointLight[]
  /** Per-frame animations (characters, record player, dust…). */
  anims: ((t: number) => void)[]
  reduced: boolean
  theme: PlantaTheme
}

let C: Ctx | null = null

export function newCtx(root: THREE.Group, reduced: boolean, theme: PlantaTheme): Ctx {
  let s = 11
  C = {
    root,
    rand: () => {
      s = (s * 16807) % 2147483647
      return (s - 1) / 2147483646
    },
    textures: [],
    pickables: [],
    lights: [],
    anims: [],
    reduced,
    theme,
  }
  return C
}

export const ctx = (): Ctx => {
  if (!C) throw new Error('planta: no context')
  return C
}

export const rand = () => ctx().rand()
export const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]

// ---------- coordinates: the sketch's 1000 × 680 plan, 100 px = 1 unit ----------
export const X = (px: number) => px / 100 - 5
export const Z = (py: number) => py / 100 - 3.4

export const std = (color: THREE.ColorRepresentation, roughness = 0.7, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
export const phys = (color: THREE.ColorRepresentation, extra: THREE.MeshPhysicalMaterialParameters = {}) => new THREE.MeshPhysicalMaterial({ color, ...extra })

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat = true): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d') as CanvasRenderingContext2D
  draw(g, w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  ctx().textures.push(t)
  return t
}

export function noise(g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, light = false) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,255,255,${rand() * a})` : `rgba(0,0,0,${rand() * a})`
    g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2)
  }
}

// box UVs in metres, so textures don't stretch
function boxUV(geo: THREE.BoxGeometry, w: number, h: number, d: number, s: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / s, (uv.getY(k) * dims[f][1]) / s)
    }
  uv.needsUpdate = true
  return geo
}

type Mat = THREE.Material | THREE.Material[]
const parentOf = (p?: THREE.Object3D) => p ?? ctx().root

export function box<M extends Mat>(w: number, h: number, d: number, mat: M, x: number, y: number, z: number, parent?: THREE.Object3D, uvScale = 0) {
  const geo = new THREE.BoxGeometry(w, h, d)
  if (uvScale) boxUV(geo, w, h, d, uvScale)
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  parentOf(parent).add(m)
  return m
}
export function rbox<M extends Mat>(w: number, h: number, d: number, mat: M, x: number, y: number, z: number, r = 0.04, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), mat)
  m.position.set(x, y, z)
  parentOf(parent).add(m)
  return m
}
export function cyl<M extends Mat>(rt: number, rb: number, h: number, mat: M, x: number, y: number, z: number, parent?: THREE.Object3D, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
  m.position.set(x, y, z)
  parentOf(parent).add(m)
  return m
}
export function sph<M extends Mat>(r: number, mat: M, x: number, y: number, z: number, parent?: THREE.Object3D, seg = 24) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat)
  m.position.set(x, y, z)
  parentOf(parent).add(m)
  return m
}
export function caps<M extends Mat>(r: number, len: number, mat: M, x: number, y: number, z: number, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
  m.position.set(x, y, z)
  parentOf(parent).add(m)
  return m
}
export function plane<M extends Mat>(w: number, h: number, mat: M, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  parentOf(parent).add(m)
  return m
}
export function grp(x = 0, y = 0, z = 0, parent?: THREE.Object3D, ry = 0) {
  const g = new THREE.Group()
  g.position.set(x, y, z)
  g.rotation.y = ry
  parentOf(parent).add(g)
  return g
}

/** The characters (AFTERHOURS originals, human proportions) and Pixel the cat. Ported from the prototype. */
import * as THREE from 'three'
import type { Materials } from './materials'
import type { Textures } from './textures'
import { ACID, box, caps, ctx, cyl, grp, phys, plane, rand, rbox, sph, std } from './util'

export type Who = 'lola' | 'tomi' | 'ernesto' | 'vera' | 'bruno' | 'tano'

const SKIN: Record<Who, number> = { lola: 0xe0b08c, tomi: 0xd9a77f, ernesto: 0xe6bfa3, vera: 0xefc8ae, bruno: 0x7a4a2e, tano: 0xc98f68 }

function seg(len: number, r1: number, r2: number, mat: THREE.Material, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 14), mat)
  m.position.y = -len / 2
  parent.add(m)
  sph(r1 * 1.02, mat, 0, 0, 0, parent, 12)
  return m
}
function shellH(r: number, mat: THREE.MeshStandardMaterial, parent: THREE.Object3D, { skip = 0, t0 = 0, tl = Math.PI / 2, y = 0, z = 0 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, Math.PI / 2 + skip / 2, Math.PI * 2 - skip, t0, tl), mat)
  m.material.side = THREE.DoubleSide
  m.position.set(0, y, z)
  parent.add(m)
  return m
}

interface Arm {
  sh: THREE.Group
  el: THREE.Group
  wr: THREE.Group
}

export function makeChar(TX: Textures, MAT: Materials, who: Who, parent: THREE.Object3D, x: number, z: number, ry = 0) {
  const sit = who === 'tomi' || who === 'ernesto'
  const S = { lola: 0.97, tomi: 1, ernesto: 0.95, vera: 0.95, bruno: 1.02, tano: 1.06 }[who]
  const g = grp(x, 0, z, parent, ry)
  const inner = grp(0, 0, 0, g)
  inner.scale.setScalar(S)
  const skin = phys(SKIN[who], { roughness: 0.62, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc9b0) })
  const C = {
    lola: { top: std(0xa9d42f, 0.7), sleeve: std(0xa9d42f, 0.7), pants: std(0x1b1b1a, 0.85), shoe: std(0xe9e6dd, 0.6), hair: std(0x121212, 0.5), iris: 0x2b1a10, lip: 0x9a5048 },
    tomi: { top: std(0x1a1a19, 0.95), sleeve: std(0x1a1a19, 0.95), pants: std(0x2b3546, 0.85), shoe: std(0xdedbd2, 0.6), hair: std(0x3e2614, 0.75), iris: 0x2f4a2a, lip: 0x8d4f42 },
    ernesto: { top: std(0xb19a72, 0.98), sleeve: std(0xb19a72, 0.98), pants: std(0x544636, 0.85), shoe: std(0x5a2622, 0.8), hair: std(0xd9d8d2, 0.85), iris: 0x46607a, lip: 0x9a6458 },
    vera: {
      top: std(0xffffff, 0.85, 0, { map: TX.stripes }),
      sleeve: std(0xffffff, 0.85, 0, { map: TX.stripes }),
      pants: std(0x222221, 0.85),
      shoe: std(0x161616, 0.45),
      hair: std(0xa8461f, 0.6),
      iris: 0x3c5e3a,
      lip: 0xb06058,
    },
    bruno: { top: std(0x4f4e49, 0.95), sleeve: std(0x4f4e49, 0.95), pants: std(0x30302d, 0.85), shoe: std(0xa9d42f, 0.6), hair: std(0x140d08, 0.95), iris: 0x1e120b, lip: 0x5c3426 },
    tano: { top: std(0x4a4945, 0.95), sleeve: std(0x4a4945, 0.95), pants: std(0x324058, 0.85), shoe: std(0x4a2f18, 0.7), hair: std(0x3a2414, 0.9), iris: 0x2e1d10, lip: 0x8a4a3c },
  }[who]
  for (const k of ['top', 'sleeve', 'pants'] as const) {
    const m = C[k]
    if (!m.bumpMap) {
      m.bumpMap = TX.fabric
      m.bumpScale = 1.2
      m.roughnessMap = TX.fabric
      m.needsUpdate = true
    }
  }
  C.hair.map = TX.hair
  C.hair.bumpMap = TX.hair
  C.hair.bumpScale = 2
  C.hair.roughness = 0.55
  C.hair.color.multiplyScalar(1.15)
  C.hair.needsUpdate = true
  skin.bumpMap = TX.skin
  skin.bumpScale = 0.4
  skin.roughness = 0.58
  skin.needsUpdate = true
  const hipY = sit ? (who === 'tomi' ? 0.56 : 0.5) : 0.9

  // legs with knees
  for (const s of [-1, 1]) {
    const hip = grp(s * 0.085, hipY, 0, inner)
    seg(0.42, 0.075, 0.055, C.pants, hip)
    const knee = grp(0, -0.42, 0, hip)
    seg(0.42, 0.055, 0.042, C.pants, knee)
    const foot = grp(0, -0.42, 0, knee)
    rbox(0.1, 0.075, 0.26, C.shoe, 0, -0.045, 0.06, 0.03, foot)
    if (sit) {
      hip.rotation.x = -Math.PI / 2
      knee.rotation.x = Math.PI / 2 - (who === 'tomi' ? 0.25 : 0)
      foot.rotation.x = who === 'tomi' ? 0.25 : 0
    }
  }
  sph(0.15, C.pants, 0, hipY, 0, inner, 18).scale.set(1.05, 0.55, 0.78)

  // torso (clothes) with a body shape
  const body = grp(0, hipY, 0, inner)
  const prof = [[0.0, 0], [0.15, 0.0], [0.158, 0.08], [0.142, 0.2], [0.155, 0.3], [0.175, 0.4], [0.19, 0.46], [0.15, 0.51], [0.07, 0.54], [0.0, 0.545]].map(([r, y]) => new THREE.Vector2(r, y))
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), C.top)
  torso.scale.z = 0.68
  body.add(torso)
  cyl(0.045, 0.05, 0.1, skin, 0, 0.58, 0, body, 14)
  if (who === 'ernesto') body.rotation.x = 0.14

  // arms with elbows and hands
  const arm = (s: number): Arm => {
    const sh = grp(s * 0.185, 0.48, 0, body)
    sh.rotation.z = s * 0.08
    seg(0.29, 0.05, 0.04, C.sleeve, sh)
    const el = grp(0, -0.29, 0, sh)
    seg(0.25, 0.04, who === 'tano' || who === 'bruno' ? 0.034 : 0.033, who === 'bruno' || who === 'tano' ? skin : C.sleeve, el)
    const wr = grp(0, -0.25, 0, el)
    rbox(0.05, 0.095, 0.03, skin, 0, -0.05, 0, 0.014, wr)
    const th = caps(0.011, 0.03, skin, s * -0.028, -0.035, 0.012, wr)
    th.rotation.z = s * 0.5
    if (who !== 'bruno' && who !== 'tano') cyl(0.036, 0.036, 0.03, C.sleeve, 0, -0.005, 0, wr, 12)
    return { sh, el, wr }
  }
  const L = arm(-1)
  const R = arm(1)

  // head
  const head = grp(0, 0.71, 0.01, body)
  const skull = sph(0.105, skin, 0, 0.02, -0.005, head, 32)
  skull.scale.set(0.9, 1.05, 1.0)
  const jaw = sph(0.085, skin, 0, -0.04, 0.018, head, 24)
  jaw.scale.set(0.9, 0.85, 0.95)
  for (const s of [-1, 1]) {
    const e = sph(0.026, skin, s * 0.094, 0.0, -0.005, head, 12)
    e.scale.set(0.45, 1, 0.8)
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.042, 10), skin)
  nose.position.set(0, -0.006, 0.103)
  nose.rotation.x = Math.PI / 2 + 0.25
  head.add(nose)
  sph(0.014, skin, 0, -0.022, 0.108, head, 10)
  const eyes = grp(0, 0.018, 0, head)
  for (const s of [-1, 1]) {
    sph(0.015, std(0xf2eee6, 0.25), s * 0.037, 0, 0.083, eyes, 12)
    const ir = sph(0.0095, std(C.iris, 0.15), s * 0.037, 0, 0.094, eyes, 10)
    ir.scale.z = 0.5
    const lid = sph(0.0165, skin, s * 0.037, 0.006, 0.081, eyes, 12)
    lid.scale.set(1.05, 0.55, 1.0)
    const br = box(0.036, 0.007, 0.012, C.hair, s * 0.038, 0.043, 0.094, head)
    br.rotation.z = s * -0.12
  }
  const lips = sph(0.02, std(C.lip, 0.45), 0, -0.058, 0.093, head, 12)
  lips.scale.set(1.35, 0.42, 0.55)

  // hair and accessories
  const H = C.hair
  if (who === 'tomi') {
    shellH(0.112, H, head, { tl: Math.PI * 0.48, y: 0.03, z: -0.01 }).scale.set(0.93, 1.05, 1.05)
    for (let i = 0; i < 14; i++) {
      const a = rand() * 6.3,
        r = rand() * 0.07
      const t = sph(0.03, H, Math.cos(a) * r, 0.12 + rand() * 0.02, Math.sin(a) * r, head, 10)
      t.scale.set(1, 0.6, 1.3)
      t.rotation.y = a
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.01, 8, 28, Math.PI), std(0x111111, 0.4))
    band.position.y = 0.03
    head.add(band)
    for (const s of [-1, 1]) {
      const cup = cyl(0.04, 0.04, 0.03, MAT.acidGlowSoft, s * 0.11, 0.0, 0, head, 18)
      cup.rotation.z = Math.PI / 2
    }
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.035, 10, 24), C.top)
    hood.position.set(0, 0.55, -0.06)
    hood.rotation.x = Math.PI / 2 + 0.5
    body.add(hood)
    const pr = plane(0.1, 0.05, std(0xffffff, 0.9, 0, { map: TX.hoodie }))
    body.add(pr)
    pr.position.set(0, 0.38, 0.122)
    rbox(0.18, 0.08, 0.02, C.top, 0, 0.16, 0.1, 0.01, body)
  } else if (who === 'lola') {
    shellH(0.118, H, head, { skip: 1.7, tl: Math.PI * 0.74, y: 0.02, z: -0.008 }).scale.set(0.98, 1.07, 1.02)
    shellH(0.112, H, head, { tl: Math.PI * 0.27, y: 0.03 }).scale.set(0.95, 1.05, 1.06)
    for (const s of [-1, 1]) sph(0.006, MAT.acidGlowSoft, s * 0.097, -0.03, 0, head, 8)
    const col = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 10, 24), std(0x151515, 0.8))
    col.position.set(0, 0.535, 0)
    col.rotation.x = Math.PI / 2
    body.add(col)
    box(0.006, 0.4, 0.004, std(0x2a2a28, 0.4, 0.6), 0, 0.3, 0.123, body)
  } else if (who === 'ernesto') {
    shellH(0.108, H, head, { skip: 3.3, t0: Math.PI * 0.33, tl: Math.PI * 0.3, y: 0.02 }).scale.set(0.95, 1.05, 1.02)
    shellH(0.09, H, head, { t0: Math.PI * 0.5, tl: Math.PI * 0.45, y: -0.03, z: 0.022 }).scale.set(0.95, 0.95, 1.0)
    const st = sph(0.022, H, 0, -0.04, 0.1, head, 12)
    st.scale.set(1.9, 0.55, 0.6)
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.003, 6, 20), MAT.black)
      ring.position.set(s * 0.037, 0.018, 0.1)
      head.add(ring)
    }
    box(0.016, 0.003, 0.003, MAT.black, 0, 0.022, 0.1, head)
    lips.visible = false
    const shirt = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 20), MAT.bone)
    shirt.position.set(0, 0.54, 0.01)
    shirt.rotation.x = Math.PI / 2
    body.add(shirt)
    for (let i = 0; i < 4; i++) sph(0.008, std(0x3a2a18, 0.4), 0.0, 0.42 - i * 0.09, 0.118 - i * 0.004, body, 8)
  } else if (who === 'vera') {
    for (let i = 0; i < 60; i++) {
      const yv = 1 - (i / 59) * 1.2
      const rr = Math.sqrt(Math.max(0, 1 - yv * yv))
      const th = i * 2.4
      const px = Math.cos(th) * rr,
        pz = Math.sin(th) * rr
      if (pz > 0.35 && yv < 0.6) continue
      sph(0.03, i % 3 ? H : std(0xc25a2c, 0.6), px * 0.108, yv * 0.11 + 0.03, pz * 0.108 - 0.005, head, 8)
    }
    sph(0.05, H, 0, 0.14, -0.05, head, 14)
    const pencil = cyl(0.005, 0.005, 0.15, MAT.acid, 0.01, 0.15, -0.05, head, 6)
    pencil.rotation.z = 1.0
    for (const s of [-1, 1]) {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0035, 6, 4), std(0x111111, 0.4))
      fr.rotation.z = Math.PI / 4
      fr.scale.set(1.3, 1, 1)
      fr.position.set(s * 0.037, 0.018, 0.1)
      head.add(fr)
    }
  } else if (who === 'bruno') {
    shellH(0.15, H, head, { skip: 2.2, tl: Math.PI * 0.62, y: 0.045, z: -0.02 })
    sph(0.12, H, 0, 0.07, -0.03, head, 18).scale.set(1.1, 0.9, 1.05)
    rbox(0.24, 0.42, 0.012, std(0xe6e2d8, 0.9), 0, 0.18, 0.112, 0.006, body)
    ;([[ACID, -0.05, 0.25], [0xe86a3a, 0.06, 0.12], [0x3f6fd1, -0.03, 0.06], [0x141414, 0.05, 0.3]] as const).forEach(([c, a, b]) => {
      const d = new THREE.Mesh(new THREE.CircleGeometry(0.018 + rand() * 0.012, 12), std(c, 0.4))
      d.position.set(a, b, 0.119)
      body.add(d)
    })
  } else if (who === 'tano') {
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.122, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), std(0xb4e632, 0.45))
    hat.position.y = 0.045
    head.add(hat)
    cyl(0.15, 0.15, 0.012, std(0xa4d42a, 0.5), 0, 0.048, 0.015, head, 28)
    shellH(0.092, H, head, { t0: Math.PI * 0.45, tl: Math.PI * 0.55, y: -0.035, z: 0.022 }).scale.set(1, 1.05, 1.05)
    lips.position.z = 0.1
    for (const s of [-1, 1]) {
      rbox(0.1, 0.36, 0.015, std(0xb4e632, 0.6), s * 0.075, 0.27, 0.105, 0.005, body).rotation.y = s * 0.15
      box(0.1, 0.02, 0.02, std(0xdedede, 0.2, 0.3), s * 0.075, 0.2, 0.112, body)
    }
  }

  // poses
  let page: THREE.Group | null = null
  let fan: THREE.Group | null = null
  if (who === 'tomi') {
    for (const A of [L, R]) {
      A.sh.rotation.x = -0.55
      A.el.rotation.x = -1.15
    }
    L.sh.rotation.z = -0.15
    R.sh.rotation.z = 0.15
  }
  if (who === 'ernesto') {
    for (const A of [L, R]) {
      A.sh.rotation.x = -0.35
      A.el.rotation.x = -1.35
    }
    L.sh.rotation.z = -0.25
    R.sh.rotation.z = 0.25
    const book = grp(0, 0.3, 0.3, body)
    book.rotation.x = -0.75
    rbox(0.26, 0.19, 0.016, std(0x161616, 0.6), 0, 0, -0.008, 0.004, book)
    for (const s of [-1, 1]) {
      const pg = box(0.125, 0.175, 0.01, MAT.bone, s * 0.064, 0, 0.004, book)
      pg.rotation.y = -s * 0.15
    }
    const flip = grp(0, 0, 0.011, book)
    box(0.12, 0.17, 0.003, std(0xffffff, 0.8), 0.061, 0, 0, flip)
    page = flip
  }
  if (who === 'lola') {
    R.sh.rotation.z = 1.25
    R.el.rotation.z = 1.2
  }
  if (who === 'vera') {
    R.sh.rotation.x = -0.75
    R.el.rotation.x = -0.55
    const pen = cyl(0.004, 0.004, 0.12, MAT.black, 0, -0.09, 0.02, R.wr, 6)
    pen.rotation.x = 0.8
    L.sh.rotation.x = -0.4
    L.el.rotation.x = -0.6
  }
  if (who === 'bruno') {
    R.sh.rotation.set(-0.6, 0, 0.35)
    R.el.rotation.x = -1.6
    fan = grp(0, -0.1, 0.01, R.wr)
    ;[0x141414, 0xe86a3a, 0xf1f0e8, 0x3f6fd1, ACID].forEach((c, i) => {
      const b = grp(0, 0, 0.004 * i, fan as THREE.Group)
      b.rotation.z = (i - 2) * 0.3 + Math.PI
      box(0.035, 0.17, 0.003, std(c, 0.5), 0, 0.09, 0, b)
    })
  }
  if (who === 'tano') {
    R.sh.rotation.x = -0.5
    R.el.rotation.x = -1.3
    const ham = grp(0, -0.09, 0, R.wr)
    ham.rotation.x = Math.PI / 2
    cyl(0.008, 0.008, 0.3, std(0xa5764a, 0.6), 0, -0.1, 0, ham, 8)
    box(0.035, 0.035, 0.11, std(0x3a3a38, 0.35, 0.7), 0, -0.24, 0, ham)
  }

  const seed = rand() * 10
  ctx().anims.push((t) => {
    const k = t + seed
    torso.scale.x = 1 + Math.sin(k * 1.7) * 0.012
    torso.scale.z = 0.68 + Math.sin(k * 1.7) * 0.01
    head.rotation.y = Math.sin(k * 0.35) * 0.18
    head.rotation.z = Math.sin(k * 0.5) * 0.03
    eyes.scale.y = k % 4.4 < 0.11 ? 0.15 : 1
    if (!sit) {
      inner.position.x = Math.sin(k * 0.4) * 0.012
      inner.rotation.z = Math.sin(k * 0.4) * 0.012
    }
    if (who === 'lola') R.el.rotation.z = 1.25 + Math.sin(k * 5.5) * 0.35
    if (who === 'tomi') {
      L.el.rotation.x = -1.15 - Math.max(0, Math.sin(k * 16)) * 0.08
      R.el.rotation.x = -1.15 - Math.max(0, Math.sin(k * 16 + 1.7)) * 0.08
      head.rotation.x = 0.12 + Math.sin(k * 6.4) * 0.05
      head.rotation.y = Math.sin(k * 0.25) * 0.08
    }
    if (who === 'ernesto' && page) {
      body.rotation.x = 0.14 + Math.sin(k * 1.1) * 0.025
      head.rotation.x = 0.2
      const c = (k % 7) / 7
      page.rotation.y = c < 0.6 ? 0 : c < 0.82 ? -((c - 0.6) / 0.22) * Math.PI : -Math.PI
      page.visible = c < 0.84
    }
    if (who === 'vera') {
      R.el.rotation.x = -0.55 + Math.sin(k * 3.6) * 0.07
      R.sh.rotation.z = 0.12 + Math.cos(k * 3.6) * 0.05
      head.rotation.x = 0.3
    }
    if (who === 'bruno' && fan) {
      fan.rotation.z = Math.sin(k * 2) * 0.35
      head.rotation.x = -0.05
    }
    if (who === 'tano') {
      const c = (k * 1.1) % 1
      R.sh.rotation.x = -0.5 - (c < 0.28 ? Math.sin((c / 0.28) * Math.PI) * 0.9 : 0)
      head.rotation.x = 0.25
    }
  })
  return g
}

export function makeCat(MAT: Materials, x: number, z: number) {
  const g = grp(x, 0, z, ctx().root, 0.6)
  const fur = std(0x161616, 0.7)
  const body = sph(0.2, fur, 0, 0.12, 0, g, 20)
  body.scale.set(1.25, 0.6, 0.85)
  sph(0.11, fur, -0.24, 0.12, 0.05, g, 18)
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 8), fur)
    ear.position.set(-0.26, 0.22, 0.05 + s * 0.06)
    ear.rotation.x = s * 0.3
    g.add(ear)
    box(0.004, 0.008, 0.04, new THREE.MeshBasicMaterial({ color: ACID }), -0.345, 0.13, 0.05 + s * 0.04, g)
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 8, 20), MAT.acid)
  collar.position.set(-0.17, 0.1, 0.04)
  collar.rotation.y = Math.PI / 2
  g.add(collar)
  const tail = grp(0.22, 0.08, 0, g)
  for (let i = 0; i < 6; i++) sph(0.035, fur, i * 0.05, 0.0, Math.sin(i * 0.5) * 0.06, tail, 10)
  ctx().anims.push((t) => {
    tail.rotation.y = Math.sin(t * 1.6) * 0.4
    body.scale.y = 0.6 + Math.sin(t * 1.3) * 0.02
  })
}

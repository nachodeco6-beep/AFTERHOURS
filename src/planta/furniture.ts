/** Furniture, lamps, LED strips, the neon sign and the graffiti (ported from the prototype, same order of random draws). */
import * as THREE from 'three'
import { makeCat, makeChar } from './characters'
import { TI, WB } from './house'
import type { Materials } from './materials'
import type { Textures } from './textures'
import { ACID, BONE, box, canvasTex, ctx, cyl, grp, pick, plane, rand, rbox, sph, std, X, Z } from './util'

function framed(tex: THREE.Texture, w: number, h: number, x: number, y: number, z: number, ry = 0, frame = 0x141414) {
  const g = grp(x, y, z, ctx().root, ry)
  g.rotation.z = (rand() - 0.5) * 0.07
  box(w + 0.05, h + 0.05, 0.03, std(frame, 0.5), 0, 0, 0, g)
  const p = plane(w, h, std(0xffffff, 0.75, 0, { map: tex }), g)
  p.position.z = 0.017
  return g
}

function bookshelf(w: number, h: number, d: number, x: number, z: number, ry: number, rows: number, colorFrame = 0x3a2a1e) {
  const g = grp(x, 0, z, ctx().root, ry)
  const fm = std(colorFrame, 0.6)
  box(w, h, 0.02, fm, 0, h / 2, -d / 2 + 0.01, g)
  box(0.03, h, d, fm, -w / 2, h / 2, 0, g)
  box(0.03, h, d, fm, w / 2, h / 2, 0, g)
  const rowH = (h - 0.06) / rows
  const books: [number, number, number, number][] = []
  for (let r = 0; r <= rows; r++) box(w, 0.03, d, fm, 0, 0.03 + r * rowH, 0, g)
  for (let r = 0; r < rows; r++) {
    let x0 = -w / 2 + 0.03
    while (x0 < w / 2 - 0.08) {
      const bw = 0.025 + rand() * 0.035,
        bh = rowH * (0.6 + rand() * 0.3)
      if (rand() < 0.07) {
        x0 += 0.08
        continue
      }
      books.push([x0 + bw / 2, 0.045 + r * rowH + bh / 2, bw, bh])
      x0 += bw + 0.004
    }
  }
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std(0xffffff, 0.7), books.length)
  const M = new THREE.Matrix4(),
    col = new THREE.Color()
  const pal = [0xf1f0e8, 0xc7ff3d, 0x141414, 0x8f8e87, 0xb5543a, 0xd8c9a8, 0x5e5d58, 0x2f4a3a, 0xe9e2d2, 0x3f5a7a]
  books.forEach(([bx, by, bw, bh], i) => {
    M.compose(new THREE.Vector3(bx, by, 0.01), new THREE.Quaternion(), new THREE.Vector3(bw, bh, d * 0.82))
    inst.setMatrixAt(i, M)
    inst.setColorAt(i, col.setHex(pick(pal)))
  })
  g.add(inst)
  return g
}

function plant(MAT: Materials, kind: 'monstera' | 'fiddle' | 'snake', x: number, z: number, s = 1, y = 0) {
  const g = grp(x, y, z)
  g.scale.setScalar(s)
  if (kind === 'monstera') {
    cyl(0.17, 0.13, 0.32, MAT.potWhite, 0, 0.16, 0, g)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.4,
        r = 0.15 + rand() * 0.15
      const stem = cyl(0.008, 0.008, 0.45, MAT.leaf[0], Math.cos(a) * r * 0.5, 0.5, Math.sin(a) * r * 0.5, g, 6)
      stem.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
      const leaf = sph(0.16, pick(MAT.leaf), Math.cos(a) * r, 0.62 + rand() * 0.25, Math.sin(a) * r, g, 14)
      leaf.scale.set(1, 0.18, 0.75)
      leaf.rotation.set(rand() * 0.6 - 0.3, a, rand() * 0.6 - 0.3)
    }
  } else if (kind === 'fiddle') {
    cyl(0.13, 0.11, 0.3, std(0x1d1d1b, 0.5), 0, 0.15, 0, g)
    cyl(0.015, 0.02, 1.2, std(0x5a3a20, 0.8), 0, 0.85, 0, g, 8)
    for (let i = 0; i < 14; i++) {
      const a = rand() * 6.3,
        y2 = 0.6 + (i / 14) * 0.8
      const leaf = sph(0.1, pick(MAT.leaf), Math.cos(a) * 0.12, y2, Math.sin(a) * 0.12, g, 12)
      leaf.scale.set(0.75, 1.1, 0.25)
      leaf.rotation.set(0.5, a, 0.3)
    }
  } else {
    cyl(0.1, 0.08, 0.2, MAT.acid, 0, 0.1, 0, g)
    for (let i = 0; i < 6; i++) {
      const leaf = sph(0.04, pick(MAT.leaf), (rand() - 0.5) * 0.08, 0.38, (rand() - 0.5) * 0.08, g, 10)
      leaf.scale.set(0.6, 5, 0.25)
      leaf.rotation.set(rand() * 0.3 - 0.15, rand() * 3, rand() * 0.3 - 0.15)
    }
  }
  return g
}

function lamp(MAT: Materials, kind: 'floor' | 'table' | 'arch' | 'work', x: number, z: number, y = 0, color: THREE.ColorRepresentation = 0xffd9a0, intensity = 2.2) {
  const g = grp(x, y, z)
  let top = 1.5
  if (kind === 'floor') {
    cyl(0.14, 0.15, 0.03, MAT.black, 0, 0.015, 0, g)
    cyl(0.012, 0.012, 1.45, MAT.black, 0, 0.74, 0, g, 8)
    cyl(0.14, 0.2, 0.26, MAT.lampShade, 0, 1.5, 0, g)
    top = 1.45
  } else if (kind === 'table') {
    cyl(0.07, 0.08, 0.02, MAT.black, 0, 0.01, 0, g)
    sph(0.07, MAT.acid, 0, 0.12, 0, g)
    cyl(0.008, 0.008, 0.2, MAT.black, 0, 0.22, 0, g, 6)
    cyl(0.09, 0.14, 0.17, MAT.lampShade, 0, 0.36, 0, g)
    top = 0.3
  } else if (kind === 'arch') {
    cyl(0.05, 0.06, 0.02, MAT.black, 0, 0.01, 0, g)
    const a1 = cyl(0.01, 0.01, 0.38, MAT.white, 0.06, 0.18, 0, g, 6)
    a1.rotation.z = -0.35
    const a2 = cyl(0.01, 0.01, 0.3, MAT.white, 0.2, 0.42, 0, g, 6)
    a2.rotation.z = 1.2
    const sh = cyl(0.02, 0.08, 0.12, MAT.white, 0.34, 0.4, 0, g)
    sh.rotation.z = 0.9
    sph(0.03, MAT.bulb, 0.37, 0.36, 0, g, 10)
    top = 0.36
  } else if (kind === 'work') {
    for (let i = 0; i < 3; i++) {
      const l = cyl(0.01, 0.01, 0.9, MAT.black, Math.cos(i * 2.1) * 0.12, 0.43, Math.sin(i * 2.1) * 0.12, g, 6)
      l.rotation.set(Math.sin(i * 2.1) * 0.25, 0, -Math.cos(i * 2.1) * 0.25)
    }
    rbox(0.28, 0.2, 0.08, MAT.black, 0, 0.95, 0, 0.02, g)
    const f = plane(0.24, 0.16, MAT.acidGlow, g)
    f.position.set(0, 0.95, 0.041)
    top = 0.95
  }
  const Lt = new THREE.PointLight(color, intensity, 4.5, 2)
  Lt.position.set(kind === 'arch' ? 0.37 : 0, top, kind === 'work' ? 0.2 : 0)
  g.add(Lt)
  ctx().lights.push(Lt)
  return g
}

function arcLamp(MAT: Materials, x: number, z: number, tx: number, tz: number) {
  const g = grp(x, 0, z)
  cyl(0.16, 0.17, 0.04, MAT.chrome, 0, 0.02, 0, g)
  const end = new THREE.Vector3(tx - x, 1.55, tz - z)
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.04, 0), new THREE.Vector3(end.x * 0.1, 2.3, end.z * 0.1), end)
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.014, 8), MAT.chrome)
  g.add(tube)
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x141414, 0.35, 0.3, { side: THREE.DoubleSide }))
  shade.position.copy(end).add(new THREE.Vector3(0, -0.02, 0))
  g.add(shade)
  sph(0.06, MAT.bulb, end.x, end.y - 0.06, end.z, g, 12)
  const Lt = new THREE.PointLight(0xffd9a8, 2.4, 5.5, 2)
  Lt.position.set(end.x, end.y - 0.15, end.z)
  g.add(Lt)
  ctx().lights.push(Lt)
}

function mug(x: number, y: number, z: number, color: THREE.ColorRepresentation = BONE) {
  const g = grp(x, y, z)
  cyl(0.04, 0.035, 0.09, std(color, 0.3), 0, 0.045, 0, g)
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.007, 8, 16, Math.PI), std(color, 0.3))
  hnd.position.set(0.04, 0.05, 0)
  hnd.rotation.z = -Math.PI / 2
  g.add(hnd)
  cyl(0.036, 0.036, 0.005, std(0x3a2414, 0.2), 0, 0.085, 0, g)
  const steam: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  for (let i = 0; i < 2; i++) {
    const s = sph(0.02, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }), (i - 0.5) * 0.02, 0.13, 0, g, 8)
    s.userData.noShadow = true
    steam.push(s)
  }
  ctx().anims.push((t) =>
    steam.forEach((s, i) => {
      const k = (t * 0.5 + i * 0.5) % 1
      s.position.y = 0.11 + k * 0.16
      s.material.opacity = 0.35 * Math.sin(k * Math.PI)
      s.scale.setScalar(0.6 + k)
    }),
  )
}

export function furniture(TX: Textures, MAT: Materials) {
  const { root, anims, lights, reduced } = ctx()
  const char = (who: Parameters<typeof makeChar>[2], parent: THREE.Object3D, x: number, z: number, ry = 0) => makeChar(TX, MAT, who, parent, x, z, ry)

  // ===== ARCHIVO =====
  bookshelf(2.72, 2.0, 0.36, X(150), Z(20), 0, 6)
  {
    // library ladder
    const g = grp(X(236), 0, Z(62))
    g.rotation.x = -0.22
    const w = std(0xb78955, 0.6)
    box(0.035, 1.9, 0.035, w, -0.17, 0.95, 0, g)
    box(0.035, 1.9, 0.035, w, 0.17, 0.95, 0, g)
    for (let i = 1; i < 7; i++) box(0.34, 0.025, 0.04, w, 0, i * 0.27, 0, g)
  }
  box(2.2, 0.012, 2.0, std(0xffffff, 0.95, 0, { map: TX.kilim }), X(150), 0.006, Z(250))
  {
    // green velvet armchair
    const g = grp(X(181), 0, Z(236), root, -0.35)
    rbox(0.9, 0.36, 0.72, MAT.velvet, 0, 0.2, 0.02, 0.07, g)
    rbox(0.66, 0.12, 0.56, MAT.velvet, 0, 0.42, 0.06, 0.05, g)
    rbox(0.9, 0.62, 0.18, MAT.velvet, 0, 0.5, -0.3, 0.08, g)
    rbox(0.14, 0.5, 0.72, MAT.velvet, -0.42, 0.33, 0.02, 0.06, g)
    rbox(0.14, 0.5, 0.72, MAT.velvet, 0.42, 0.33, 0.02, 0.06, g)
    for (const [a, b] of [[-0.38, 0.3], [0.38, 0.3], [-0.38, -0.3], [0.38, -0.3]]) cyl(0.025, 0.02, 0.06, MAT.walnut, a, 0.03, b, g, 8)
    rbox(0.18, 0.02, 0.6, std(0xf1f0e8, 0.9, 0, { map: TX.stripes }), -0.42, 0.59, 0.02, 0.01, g)
    char('ernesto', g, 0, 0.1)
  }
  {
    // side table, lamp and tea
    cyl(0.18, 0.18, 0.03, MAT.walnut, X(256), 0.52, Z(232))
    cyl(0.025, 0.025, 0.5, MAT.walnut, X(256), 0.26, Z(232), root, 8)
    cyl(0.12, 0.14, 0.02, MAT.walnut, X(256), 0.01, Z(232))
    lamp(MAT, 'table', X(262), Z(222), 0.535, 0xffb070, 1.6)
    mug(X(246), 0.535, Z(244), ACID)
  }
  {
    // archive boxes
    rbox(0.6, 0.3, 0.46, MAT.cardboard, X(52), 0.15, Z(320), 0.015)
    rbox(0.52, 0.26, 0.4, std(0xd1a872, 0.9), X(54), 0.43, Z(322), 0.015)
    const l1 = plane(0.18, 0.07, std(0xffffff, 0.8, 0, { map: TX.label('REFS 26') }))
    l1.position.set(X(52), 0.16, Z(320) + 0.232)
    const l2 = plane(0.18, 0.07, std(0xffffff, 0.8, 0, { map: TX.label('ZINES') }))
    l2.position.set(X(54), 0.44, Z(322) + 0.202)
  }
  plant(MAT, 'monstera', X(262), Z(346), 1.1)
  lamp(MAT, 'floor', X(40), Z(110), 0, 0x3d6bff, 2.2)
  // pictures on the x=300 wall (Archivo/Hall side)
  framed(TX.photo, 0.38, 0.48, X(300) - TI / 2 - 0.02, 0.62, Z(250), -Math.PI / 2)
  framed(TX.cover2, 0.32, 0.32, X(300) - TI / 2 - 0.02, 0.6, Z(310), -Math.PI / 2)
  framed(TX.fromVision, 0.4, 0.52, X(300) - TI / 2 - 0.02, 0.62, Z(430), -Math.PI / 2)

  // ===== HALL =====
  {
    const g = grp(X(90), 0, Z(405))
    rbox(1.24, 0.6, 0.32, MAT.lacquer, 0, 0.42, 0, 0.02, g)
    for (const a of [-0.58, 0.58]) box(0.03, 0.12, 0.28, MAT.black, a, 0.06, 0, g)
  }
  lamp(MAT, 'table', X(46), Z(400), 0.72)
  plant(MAT, 'snake', X(132), Z(404), 1, 0.72)
  {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 40), std(0xdfe5ea, 0.04, 1))
    m.position.set(X(90), 1.05 - 0.2, Z(380) + TI / 2 + 0.03)
    root.add(m)
    m.position.y = 0.8
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.02, 12, 48), MAT.led)
    ring.userData.noShadow = true
    ring.position.copy(m.position)
    root.add(ring)
  }
  {
    // coat stand
    const g = grp(X(262), 0, Z(440))
    cyl(0.16, 0.18, 0.03, MAT.black, 0, 0.015, 0, g)
    cyl(0.015, 0.015, 1.7, MAT.black, 0, 0.85, 0, g, 8)
    for (let i = 0; i < 4; i++) {
      const k = cyl(0.008, 0.008, 0.18, MAT.black, Math.cos(i * 1.57) * 0.07, 1.62, Math.sin(i * 1.57) * 0.07, g, 6)
      k.rotation.set(Math.sin(i * 1.57) * 0.8, 0, -Math.cos(i * 1.57) * 0.8)
    }
    const coat = rbox(0.3, 0.75, 0.14, MAT.acid, 0.12, 1.15, 0.05, 0.06, g)
    coat.rotation.z = 0.08
    const coat2 = rbox(0.28, 0.6, 0.13, std(0x2a2a28, 0.8), -0.1, 1.2, -0.06, 0.06, g)
    coat2.rotation.z = -0.1
  }
  {
    const g = grp(X(31), 0, Z(576))
    rbox(0.36, 0.08, 1.12, MAT.wood, 0, 0.4, 0, 0.02, g)
    for (const [a, b] of [[-0.14, -0.5], [0.14, -0.5], [-0.14, 0.5], [0.14, 0.5]]) box(0.04, 0.36, 0.04, MAT.black, a, 0.18, b, g)
    rbox(0.32, 0.07, 1.04, MAT.acid, 0, 0.47, 0, 0.03, g)
  }
  {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.014, 64), [std(0x141414, 0.95), std(0xffffff, 0.95, 0, { map: TX.ahRug }), std(0x141414, 0.95)])
    r.position.set(X(150), 0.007, Z(560))
    r.rotation.y = Math.PI / 4
    root.add(r)
  }
  box(0.76, 0.012, 0.28, std(0xffffff, 0.95, 0, { map: TX.doormat }), X(150), 0.006, Z(664))
  char('lola', root, X(150), Z(600), -0.5)
  plant(MAT, 'fiddle', X(268), Z(655), 1)

  // ===== STUDIO =====
  // Persian rug
  box(3.0, 0.014, 2.96, [std(0xa8462f, 0.95), std(0xa8462f, 0.95), std(0xffffff, 0.95, 0, { map: TX.persian }), std(0xa8462f, 0.95), std(0xa8462f, 0.95), std(0xa8462f, 0.95)], X(510), 0.007, Z(464))
  for (const zz of [Z(316) - 0.04, Z(612) + 0.04]) box(3.0, 0.004, 0.08, std(0xeadcc0, 1), X(510), 0.003, zz)
  // dark rug under the desk
  box(2.0, 0.01, 1.4, std(0x2a2a28, 0.95), X(530), 0.005, Z(170))
  {
    // desk
    const g = grp(X(530), 0, Z(186))
    rbox(2.0, 0.045, 0.72, MAT.white, 0, 0.74, 0, 0.012, g)
    for (const [a, b] of [[-0.95, -0.32], [-0.95, 0.32]]) box(0.04, 0.72, 0.04, MAT.black, a, 0.36, b, g)
    rbox(0.4, 0.71, 0.66, std(0xe3dfd5, 0.4), 0.76, 0.355, 0, 0.015, g)
    for (let i = 0; i < 3; i++) {
      box(0.36, 0.005, 0.005, std(0xb7b2a6, 0.5), 0.76, 0.24 + i * 0.22, 0.332, g)
      box(0.1, 0.012, 0.012, MAT.black, 0.76, 0.32 + i * 0.22, 0.34, g)
    }
    // laptop
    rbox(0.5, 0.018, 0.34, std(0x3a3a38, 0.35, 0.6), 0, 0.773, -0.04, 0.01, g)
    box(0.44, 0.003, 0.2, std(0x1e1e1d, 0.6), 0, 0.783, -0.07, g)
    const lid = grp(0, 0.782, 0.13, g)
    lid.rotation.x = -0.32
    rbox(0.5, 0.33, 0.014, std(0x3a3a38, 0.35, 0.6), 0, 0.165, 0, 0.01, lid)
    const logo = plane(0.3, 0.19, new THREE.MeshStandardMaterial({ map: TX.laptop, emissive: 0xffffff, emissiveMap: TX.laptop, emissiveIntensity: 1.1, roughness: 0.4 }), lid)
    logo.position.set(0, 0.17, 0.0085)
    const scr = plane(0.46, 0.3, std(0x0e0e0e, 0.2, 0, { emissive: ACID, emissiveIntensity: 0.25 }), lid)
    scr.position.set(0, 0.165, -0.0085)
    scr.rotation.y = Math.PI
    const glow = new THREE.PointLight(ACID, 1.2, 1.6, 2)
    glow.position.set(0, 0.95, -0.2)
    g.add(glow)
    lights.push(glow)
    anims.push((t) => {
      glow.intensity = 1.0 + Math.sin(t * 2.6) * 0.25
    })
    // papers, mug, green cube
    const pap = plane(0.22, 0.3, std(0xffffff, 0.8))
    pap.rotation.set(-Math.PI / 2, 0, 0.15)
    pap.position.set(X(530) - 0.62, 0.765, Z(186) - 0.05)
    mug(X(530) - 0.72, 0.763, Z(186) + 0.18)
    rbox(0.12, 0.12, 0.12, MAT.acid, X(530) + 0.48, 0.823, Z(186) - 0.1, 0.012)
    lamp(MAT, 'arch', X(530) + 0.72, Z(186) - 0.22, 0.763, ACID, 1.4)
    // office chair + Tomi
    const ch = grp(X(530), 0, Z(186) - 0.62)
    cyl(0.03, 0.03, 0.4, MAT.chrome, 0, 0.25, 0, ch, 10)
    for (let i = 0; i < 5; i++) {
      const leg = box(0.3, 0.025, 0.04, MAT.black, Math.cos(i * 1.256) * 0.14, 0.04, Math.sin(i * 1.256) * 0.14, ch)
      leg.rotation.y = -i * 1.256
    }
    rbox(0.5, 0.08, 0.48, std(0x1d1d1b, 0.6), 0, 0.48, 0, 0.04, ch)
    const back = rbox(0.48, 0.55, 0.07, std(0x1d1d1b, 0.6), 0, 0.82, -0.24, 0.05, ch)
    back.rotation.x = -0.1
    char('tomi', ch, 0, 0.02)
  }
  framed(TX.mood, 1.6, 0.69, X(532), 1.62, Z(0) + 0.03)
  plant(MAT, 'fiddle', X(406), Z(110), 1.05)
  bookshelf(1.78, 1.0, 0.36, X(696), Z(225), -Math.PI / 2, 3, 0x1d1d1b)
  {
    // sideboard with record player
    const g = grp(X(693), 0, Z(469), root, -Math.PI / 2)
    rbox(1.5, 0.5, 0.46, std(0x7a5233, 0.5), 0, 0.3, 0, 0.02, g)
    for (let i = -1; i <= 1; i++) box(0.46, 0.4, 0.005, std(0x6a4528, 0.5), i * 0.48, 0.3, 0.232, g)
    for (const a of [-0.68, 0.68]) cyl(0.02, 0.015, 0.05, MAT.black, a, 0.025, 0, g, 8)
    rbox(0.42, 0.06, 0.34, MAT.black, -0.3, 0.58, 0, 0.015, g)
    const rec = cyl(0.15, 0.15, 0.008, std(0x111111, 0.25), -0.32, 0.615, 0, g, 40)
    const lbl = cyl(0.045, 0.045, 0.01, MAT.acid, -0.32, 0.616, 0, g, 24)
    const arm = box(0.2, 0.01, 0.015, MAT.chrome, -0.16, 0.63, 0.1, g)
    arm.rotation.y = 0.5
    anims.push((t) => {
      rec.rotation.y = t * 3.5
      lbl.rotation.y = t * 3.5
    })
    for (const a of [0.2, 0.55]) {
      rbox(0.26, 0.36, 0.26, MAT.black, a, 0.73, 0, 0.02, g)
      const cone = cyl(0.07, 0.07, 0.01, std(0x5e5d58, 0.6), a, 0.75, 0.131, g)
      cone.rotation.x = Math.PI / 2
      const tw = cyl(0.03, 0.03, 0.01, std(0x3a3a38, 0.5), a, 0.62, 0.131, g)
      tw.rotation.x = Math.PI / 2
    }
  }
  framed(TX.cover1, 0.4, 0.4, X(720) - TI / 2 - 0.02, 0.86, Z(420), -Math.PI / 2, 0xf1f0e8)
  framed(TX.cover2, 0.4, 0.4, X(720) - TI / 2 - 0.02, 0.86, Z(520), -Math.PI / 2)
  {
    // cognac leather sofa
    const g = grp(X(478), 0, Z(352))
    rbox(2.16, 0.26, 0.86, MAT.leatherDark, 0, 0.2, 0, 0.05, g)
    rbox(1.0, 0.16, 0.66, MAT.leather, -0.5, 0.4, 0.08, 0.07, g)
    rbox(1.0, 0.16, 0.66, MAT.leather, 0.5, 0.4, 0.08, 0.07, g)
    const b1 = rbox(1.0, 0.5, 0.2, MAT.leather, -0.5, 0.62, -0.3, 0.09, g)
    b1.rotation.x = -0.12
    const b2 = rbox(1.0, 0.5, 0.2, MAT.leather, 0.5, 0.62, -0.3, 0.09, g)
    b2.rotation.x = -0.12
    rbox(0.16, 0.48, 0.86, MAT.leatherDark, -1.08, 0.36, 0, 0.07, g)
    rbox(0.16, 0.48, 0.86, MAT.leatherDark, 1.08, 0.36, 0, 0.07, g)
    for (const [a, b] of [[-1, 0.36], [1, 0.36], [-1, -0.36], [1, -0.36]]) cyl(0.025, 0.018, 0.08, MAT.walnut, a, 0.04, b, g, 8)
    const p1 = rbox(0.38, 0.34, 0.12, MAT.acid, -0.72, 0.62, -0.16, 0.06, g)
    p1.rotation.set(-0.2, 0.2, 0.08)
    const p2 = rbox(0.36, 0.32, 0.12, std(0xf1f0e8, 0.85), 0.74, 0.6, -0.16, 0.06, g)
    p2.rotation.set(-0.2, -0.25, -0.06)
    const blanket = rbox(0.5, 0.03, 0.6, std(0xffffff, 0.9, 0, { map: TX.stripes }), 0.25, 0.49, 0.1, 0.012, g)
    blanket.rotation.y = 0.1
  }
  {
    // coffee table
    const g = grp(X(491), 0, Z(471))
    rbox(1.1, 0.06, 0.62, MAT.wood, 0, 0.36, 0, 0.015, g)
    for (const [a, b] of [[-0.5, -0.26], [0.5, -0.26], [-0.5, 0.26], [0.5, 0.26]]) box(0.04, 0.33, 0.04, MAT.black, a, 0.165, b, g)
    rbox(0.36, 0.05, 0.26, std(0x141414, 0.5), -0.25, 0.415, 0, 0.008, g)
    rbox(0.32, 0.04, 0.22, MAT.acid, -0.25, 0.46, 0, 0.008, g)
    mug(X(491) + 0.22, 0.39, Z(471) + 0.05, 0x141414)
    plant(MAT, 'snake', X(491) + 0.42, Z(471) - 0.12, 0.6, 0.39)
  }
  arcLamp(MAT, X(372), Z(444), X(440), Z(440))
  makeCat(MAT, X(600), Z(580))
  plant(MAT, 'monstera', X(690), Z(650), 1.1)

  // ===== TYPE LAB =====
  box(2.2, 0.012, 1.2, std(0xffffff, 0.95, 0, { map: TX.gridRug }), X(860), 0.006, Z(152))
  {
    const g = grp(X(865), 0, Z(130))
    for (const [a, b] of [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]]) box(0.04, 0.86, 0.04, MAT.black, a, 0.43, b, g)
    box(1.4, 0.03, 0.03, MAT.black, 0, 0.3, 0.32, g)
    const board = grp(0, 0.92, 0, g)
    board.rotation.x = 0.26
    rbox(1.5, 0.03, 0.82, MAT.white, 0, 0, 0, 0.01, board)
    const p = plane(1.36, 0.72, std(0xffffff, 0.85, 0, { map: TX.draft }), board)
    p.rotation.x = -Math.PI / 2
    p.position.y = 0.017
    box(1.5, 0.02, 0.04, MAT.walnut, 0, 0.02, 0.41, board)
    char('vera', root, X(862), Z(76), -0.15)
    lamp(MAT, 'arch', X(935), Z(100), 1.0, 0xf4f6ff, 1.8)
  }
  framed(TX.typeCase, 1.2, 0.6, X(802), 1.55, Z(0) + 0.03, 0, 0x4a3220)
  framed(TX.specimen, 0.6, 0.78, X(1000) - 0.04, 1.6, Z(50), -Math.PI / 2, 0x141414)
  {
    const g = grp(X(760), 0, Z(196))
    cyl(0.18, 0.18, 0.05, MAT.acid, 0, 0.66, 0, g)
    for (let i = 0; i < 3; i++) {
      const l = cyl(0.012, 0.012, 0.66, MAT.black, Math.cos(i * 2.1) * 0.12, 0.33, Math.sin(i * 2.1) * 0.12, g, 6)
      l.rotation.set(Math.sin(i * 2.1) * 0.15, 0, -Math.cos(i * 2.1) * 0.15)
    }
  }
  plant(MAT, 'snake', X(974), Z(206), 1.1)

  // ===== COLOR LAB =====
  box(2.36, 0.012, 1.6, std(0xffffff, 0.95, 0, { map: TX.stripeRug }), X(862), 0.006, Z(348))
  {
    const g = grp(X(854), 0, Z(334))
    rbox(1.6, 0.04, 0.76, std(0xffffff, 0.3, 0, { map: TX.swatchTable }), 0, 0.74, 0, 0.008, g)
    for (const [a, b] of [[-0.74, -0.33], [0.74, -0.33], [-0.74, 0.33], [0.74, 0.33]]) box(0.035, 0.72, 0.035, MAT.black, a, 0.36, b, g)
    const card = plane(0.36, 0.16, std(0xffffff, 0.6))
    card.rotation.set(-Math.PI / 2, 0, -0.14)
    card.position.set(X(854) + 0.4, 0.765, Z(334) - 0.22)
    char('bruno', root, X(852), Z(282), -0.1)
  }
  {
    const g = grp(X(977), 0, Z(346), root, -Math.PI / 2) // shelf with jars
    rbox(1.96, 1.6, 0.38, std(0xe9e6dd, 0.6), 0, 0.8, -0.0, 0.01, g)
    const jars: [number, number][] = []
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) jars.push([-0.85 + i * 0.21, 0.16 + r * 0.38])
    // bonus: the jars take the board's palette
    const pal = ctx().theme.palette
    const cols: THREE.ColorRepresentation[] = pal && pal.length ? pal : [0xc7ff3d, 0xe86a3a, 0x3f6fd1, 0x141414, 0x8f8e87, 0xb5543a, 0x9ec5e8, 0xf1f0e8]
    for (let r = 1; r < 4; r++) box(1.92, 0.02, 0.34, std(0xd9d5ca, 0.6), 0, r * 0.38 + 0.02, 0.02, g)
    jars.forEach(([a, y]) => {
      const h = 0.12 + rand() * 0.08
      cyl(0.06, 0.06, h, std(pick(cols), 0.3), a, y + h / 2 - 0.08, 0.1, g, 16)
      cyl(0.062, 0.062, 0.025, MAT.bone, a, y + h - 0.07, 0.1, g, 16)
    })
  }
  framed(TX.chips, 1.6, 0.5, X(898), 0.72, Z(230) + TI / 2 + 0.02)
  lamp(MAT, 'floor', X(752), Z(262), 0, 0xf4f6ff, 1.6)
  {
    // paint tins
    for (const [a, b, c] of [[X(762), Z(440), ACID], [X(784), Z(446), 0xe86a3a], [X(774), Z(424), 0x3f6fd1]]) {
      cyl(0.08, 0.08, 0.16, MAT.metal, a, 0.08, b, root, 18)
      cyl(0.075, 0.075, 0.01, std(c, 0.2), a, 0.165, b, root, 18)
    }
  }

  // ===== TALLER =====
  box(1.4, 0.008, 0.9, std(0xd9d2c3, 0.95, 0, { transparent: true, opacity: 0.7 }), X(810), 0.005, Z(520))
  {
    const g = grp(X(871), 0, Z(622))
    rbox(1.5, 0.08, 0.5, std(0xb78955, 0.6), 0, 0.74, 0, 0.01, g)
    for (const [a, b] of [[-0.68, -0.2], [0.68, -0.2], [-0.68, 0.2], [0.68, 0.2]]) box(0.06, 0.7, 0.06, std(0x9a6f3f, 0.7), a, 0.35, b, g)
    box(1.4, 0.04, 0.4, std(0x9a6f3f, 0.7), 0, 0.2, 0, g)
    const saw = box(0.4, 0.005, 0.1, MAT.metal, -0.4, 0.79, 0.05, g)
    saw.rotation.y = 0.3
    rbox(0.26, 0.1, 0.16, MAT.acid, 0.45, 0.83, 0, 0.02, g)
    char('tano', root, X(872), Z(580), -0.2)
  }
  {
    // scaffold
    const g = grp(X(960), 0, Z(540))
    for (const [a, b] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) cyl(0.018, 0.018, 1.9, MAT.metal, a, 0.95, b, g, 8)
    for (const y of [0.9, 1.8]) rbox(0.7, 0.04, 0.66, std(0xb78955, 0.7), 0, y, 0, 0.005, g)
    const d1 = cyl(0.012, 0.012, 1.0, MAT.metal, 0, 0.45, 0.3, g, 6)
    d1.rotation.z = 0.9
  }
  {
    const g = grp(X(752), 0, Z(520))
    const w = std(0xb78955, 0.6)
    const l = grp(0, 0, 0, g)
    l.rotation.x = 0.22
    box(0.04, 1.6, 0.04, w, -0.2, 0.8, 0, l)
    box(0.04, 1.6, 0.04, w, 0.2, 0.8, 0, l)
    for (let i = 1; i < 6; i++) box(0.4, 0.025, 0.05, w, 0, i * 0.27, 0, l)
    const r = grp(0, 0, 0, g)
    r.rotation.x = -0.22
    box(0.04, 1.6, 0.04, w, -0.2, 0.8, 0, r)
    box(0.04, 1.6, 0.04, w, 0.2, 0.8, 0, r)
  }
  lamp(MAT, 'work', X(752), Z(640), 0, ACID, 3)
  for (const [a, b] of [[X(742), Z(600)], [X(982), Z(664)], [X(840), Z(668)]]) {
    cyl(0.012, 0.12, 0.38, MAT.acid, a, 0.19, b, root, 18)
    cyl(0.07, 0.085, 0.06, MAT.black, a, 0.2, b, root, 18)
    box(0.26, 0.025, 0.26, MAT.black, a, 0.012, b)
  }
  {
    const g = grp(X(890), 0, Z(668))
    box(1.2, 0.14, 0.03, std(0xffffff, 0.6, 0, { map: TX.hazard }), 0, 0.62, 0, g)
    box(0.05, 0.62, 0.05, MAT.black, -0.55, 0.31, 0, g)
    box(0.05, 0.62, 0.05, MAT.black, 0.55, 0.31, 0, g)
  }
  rbox(0.5, 0.36, 0.42, MAT.cardboard, X(963), 0.18, Z(497), 0.015)

  // ===== GREEN LIGHTS =====
  const led = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = box(w, h, d, MAT.led, x, y, z)
    m.userData.noShadow = true
    return m
  }
  led(10.0, 0.025, 0.025, 0, WB - 0.06, Z(0) + 0.02)
  led(0.025, 0.025, 4.6, X(1000) - 0.02, WB - 0.06, Z(230))
  led(2.66, 0.012, 0.012, X(150), 1.97, Z(20) + 0.17)
  const deskB = box(1.9, 0.012, 0.012, MAT.ledBlue, X(530), 0.715, Z(186) + 0.34)
  deskB.userData.noShadow = true
  led(1.66, 0.012, 0.012, X(532), 1.98, Z(0) + 0.05)
  const acidL = (x: number, y: number, z: number, i: number, d = 4) => {
    const Lt = new THREE.PointLight(ACID, i, d, 2)
    Lt.position.set(x, y, z)
    root.add(Lt)
    lights.push(Lt)
    return Lt
  }
  const blueL = (x: number, y: number, z: number, i: number, d = 4) => {
    const Lt = new THREE.PointLight(0x2f6bff, i, d, 2)
    Lt.position.set(x, y, z)
    root.add(Lt)
    lights.push(Lt)
    return Lt
  }
  blueL(X(150), 1.7, Z(80), 3.0, 4.5)
  acidL(X(150), 1.6, Z(560), 1.1, 3.6)
  const rugL = acidL(X(500), 1.9, Z(440), 1.4, 5)
  rugL.castShadow = true
  rugL.shadow.mapSize.set(512, 512)
  rugL.shadow.bias = -0.002
  blueL(X(640), 1.4, Z(600), 2.6, 4)
  acidL(X(900), 1.7, Z(380), 1.6, 3.6)
  blueL(X(860), 1.8, Z(120), 2.4, 3.5)
  blueL(X(870), 1.6, Z(560), 2.6, 3.5)
  const ledB = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = box(w, h, d, MAT.ledBlue, x, y, z)
    m.userData.noShadow = true
    return m
  }
  ledB(10.0, 0.02, 0.02, 0, 0.03, Z(0) + 0.02)
  ledB(0.02, 0.02, 4.6, X(1000) - 0.02, 0.03, Z(230))
  ledB(0.02, 0.02, 1.7, X(300) - 0.06, 0.03, Z(345))
  ledB(0.02, 0.02, 1.85, X(720) - 0.06, 0.03, Z(225))
  ledB(2.1, 0.015, 0.015, X(478), 0.03, Z(352) + 0.44)
  ledB(1.4, 0.012, 0.012, X(693) - 0.25, 0.06, Z(469))
  acidL(X(530), 1.9, Z(60), 1.0, 3.2)
  // neon sign
  const neonM = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: ACID, emissiveMap: TX.neon, emissiveIntensity: 3, transparent: true, alphaMap: TX.neon, depthWrite: false })
  const neon = plane(1.9, 0.48, neonM)
  neon.position.set(X(1000) - 0.04, 1.95, Z(346))
  neon.rotation.y = -Math.PI / 2
  neon.userData.noShadow = true
  anims.push((t) => {
    const f = t % 9 > 8.7 ? 0.35 : 1
    neonM.emissiveIntensity = 3 * f * (t < 1.6 && !reduced ? Math.max(0, Math.min(1, (t - 1.3) / 0.3)) : 1)
  })
  // graffiti
  const tagM = new THREE.MeshStandardMaterial({ map: TX.tag, transparent: true, roughness: 0.9, emissive: ACID, emissiveMap: TX.tag, emissiveIntensity: 0.25, depthWrite: false })
  const graf = plane(0.85, 0.64, tagM)
  graf.position.set(X(368), 0.42, Z(0) + 0.006)
  graf.userData.noShadow = true
  // glow on the ground under the house
  const glowTex = canvasTex(
    256,
    256,
    (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
      gr.addColorStop(0, 'rgba(199,255,61,0.22)')
      gr.addColorStop(0.5, 'rgba(47,107,255,0.08)')
      gr.addColorStop(1, 'rgba(199,255,61,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    },
    false,
  )
  const gl = plane(20, 15, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  gl.rotation.x = -Math.PI / 2
  gl.position.y = -0.6
  rbox(0.42, 0.28, 0.36, std(0xd1a872, 0.9), X(966), 0.5, Z(497), 0.015)
}

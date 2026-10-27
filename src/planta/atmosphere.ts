/** Corner shadows, soft shadows under things, industrial pipes, moonbeams and floating dust (ported from the prototype). */
import * as THREE from 'three'
import { box, canvasTex, ctx, cyl, plane, rand, std, X, Z } from './util'

export function atmosphere() {
  const { root, anims } = ctx()
  // contact shadow where the wall meets the floor
  const aoTex = canvasTex(
    8,
    64,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h)
      gr.addColorStop(0, 'rgba(255,255,255,1)')
      gr.addColorStop(0.35, 'rgba(255,255,255,0.35)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, w, h)
    },
    false,
  )
  aoTex.colorSpace = THREE.NoColorSpace
  const aoMat = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: aoTex, transparent: true, opacity: 0.6, depthWrite: false })
  const ao = (axis: 'x' | 'z', a: number, b: number, at: number, side: number, wd = 0.34) => {
    const len = (b - a) / 100
    const p = plane(len, wd, aoMat)
    p.rotation.x = -Math.PI / 2
    p.userData.noShadow = true
    p.renderOrder = 1
    if (axis === 'x') {
      p.position.set(X(a) + len / 2, 0.003, Z(at) + (side * wd) / 2)
      if (side < 0) p.rotation.z = Math.PI
    } else {
      p.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2
      p.position.set(X(at) + (side * wd) / 2, 0.003, Z(a) + len / 2)
    }
  }
  ao('x', 0, 1000, 0, 1, 0.5)
  ao('z', 0, 680, 1000, -1, 0.5)
  ao('z', 0, 680, 0, 1)
  ao('x', 0, 1000, 680, -1)
  for (const [a, b] of [[0, 150], [210, 480], [540, 680]]) {
    ao('z', a, b, 300 - 4, -1)
    ao('z', a, b, 300 + 4, 1)
  }
  for (const [a, b] of [[0, 200], [280, 300]]) {
    ao('x', a, b, 380 - 4, -1)
    ao('x', a, b, 380 + 4, 1)
  }
  for (const [a, b] of [[0, 70], [130, 320], [380, 560], [620, 680]]) {
    ao('z', a, b, 720 - 4, -1)
    ao('z', a, b, 720 + 4, 1)
  }
  ao('x', 790, 1000, 230 - 4, -1)
  ao('x', 790, 1000, 230 + 4, 1)
  ao('x', 720, 1000, 456, -1)
  ao('x', 720, 1000, 464, 1)

  // soft shadows under furniture and people
  const blobTex = canvasTex(
    64,
    64,
    (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,255,255,1)')
      gr.addColorStop(0.6, 'rgba(255,255,255,0.45)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, 64, 64)
    },
    false,
  )
  blobTex.colorSpace = THREE.NoColorSpace
  const blob = (x: number, z: number, w: number, d: number, o = 0.55) => {
    const p = plane(w, d, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, opacity: o, depthWrite: false }))
    p.rotation.x = -Math.PI / 2
    p.position.set(x, 0.016, z)
    p.userData.noShadow = true
    p.renderOrder = 2
  }
  blob(X(530), Z(186), 2.5, 1.2)
  blob(X(478), Z(352), 2.7, 1.3)
  blob(X(491), Z(471), 1.5, 1.0)
  blob(X(181), Z(236), 1.3, 1.1)
  blob(X(90), Z(405), 1.6, 0.6)
  blob(X(865), Z(130), 1.9, 1.1)
  blob(X(854), Z(334), 2.0, 1.1)
  blob(X(871), Z(622), 1.9, 0.8)
  blob(X(693), Z(469), 0.8, 1.9)
  blob(X(150), Z(28), 3.0, 0.7, 0.7)
  blob(X(696), Z(225), 0.7, 2.2, 0.6)
  blob(X(977), Z(346), 0.7, 2.3)
  for (const [x, z] of [[X(150), Z(600)], [X(862), Z(76)], [X(852), Z(282)], [X(872), Z(580)], [X(600), Z(580)]]) blob(x, z, 0.75, 0.6, 0.6)

  // industrial pipes over the brick
  const pipe = std(0x1e1e1d, 0.35, 0.8)
  const run = (len: number, x: number, y: number, z: number, rot: { x?: number; z?: number }) => {
    const c = cyl(0.042, 0.042, len, pipe, x, y, z, root, 14)
    c.rotation.z = rot.z || 0
    c.rotation.x = rot.x || 0
    return c
  }
  run(10.0, 0, 2.08, Z(0) + 0.1, { z: Math.PI / 2 })
  run(4.55, X(1000) - 0.1, 2.08, Z(230), { x: Math.PI / 2 })
  run(2.08, X(14), 1.04, Z(0) + 0.1, {})
  for (let i = 0; i < 7; i++) {
    box(0.06, 0.12, 0.1, pipe, X(40 + i * 150), 2.12, Z(0) + 0.06)
    cyl(0.052, 0.052, 0.05, pipe, X(115 + i * 150), 2.08, Z(0) + 0.1, root, 14).rotation.z = Math.PI / 2
  }
  for (let i = 0; i < 3; i++) box(0.1, 0.12, 0.06, pipe, X(1000) - 0.06, 2.12, Z(60 + i * 150))
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20), std(0xb4e632, 0.4))
  valve.position.set(X(14) + 0.02, 1.2, Z(0) + 0.18)
  root.add(valve)

  // moonbeams through the windows
  const dir = new THREE.Vector3(-3.2, -9, 5.5).normalize()
  const rayMat = new THREE.MeshBasicMaterial({ color: 0x6f8fff, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  const shaft = (pts: THREE.Vector3[]) => {
    const fl = pts.map((p) => p.clone().addScaledVector(dir, p.y / -dir.y))
    const v: number[] = []
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => v.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray())
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4
      quad(pts[i], pts[j], fl[j], fl[i])
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    const m = new THREE.Mesh(geo, rayMat)
    m.userData.noShadow = true
    m.renderOrder = 3
    root.add(m)
  }
  for (const [a, b] of [[318, 434], [628, 712], [880, 984]])
    shaft([new THREE.Vector3(X(a), 0.75, Z(0)), new THREE.Vector3(X(b), 0.75, Z(0)), new THREE.Vector3(X(b), 2.0, Z(0)), new THREE.Vector3(X(a), 2.0, Z(0))])
  shaft([new THREE.Vector3(X(1000), 0.75, Z(116)), new THREE.Vector3(X(1000), 0.75, Z(216)), new THREE.Vector3(X(1000), 2.0, Z(216)), new THREE.Vector3(X(1000), 2.0, Z(116))])

  // dust floating in the air
  const N = 420,
    pos = new Float32Array(N * 3),
    seeds = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rand() - 0.5) * 9.6
    pos[i * 3 + 1] = rand() * 2.2
    pos[i * 3 + 2] = (rand() - 0.5) * 6.4
    seeds[i] = rand() * 100
  }
  const dg = new THREE.BufferGeometry()
  dg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }))
  root.add(dust)
  const base = pos.slice()
  anims.push((t) => {
    for (let i = 0; i < N; i++) {
      const s = seeds[i]
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 0.12
      pos[i * 3 + 1] = (base[i * 3 + 1] + t * 0.02 * (0.5 + (s % 1))) % 2.2
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s) * 0.12
    }
    ;(dg.attributes.position as THREE.BufferAttribute).needsUpdate = true
  })
}

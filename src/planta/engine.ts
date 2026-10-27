/**
 * The 3D plan's engine: renderer, camera, controls, post-processing, picking,
 * camera flights and the render loop. Ported from the planta3d.html prototype;
 * adds quality levels, pausing while the tab is hidden and full disposal.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js'
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js'
import { atmosphere } from './atmosphere'
import { furniture } from './furniture'
import { floors, walls, type RoomMeshes } from './house'
import { finishIntro, introStep } from './intro'
import { makeMaterials } from './materials'
import { ROOMS, type PlantaTheme, type RoomId } from './rooms'
import { makeTextures } from './textures'
import { newCtx } from './util'

/** high: as the prototype · low: phones and modest machines (pixel ratio 1.5, 1024 shadows, no tilt-shift) · min: also no bloom. */
export type Quality = 'high' | 'low' | 'min'

export function pickQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const small = window.innerWidth < 768
  const cores = nav.hardwareConcurrency ?? 8
  const memory = nav.deviceMemory ?? 8
  if (cores <= 2 || memory <= 2) return 'min'
  if (coarse || small || cores <= 4 || memory <= 4) return 'low'
  return 'high'
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export interface PlantaOptions {
  /** The element the engine puts its own canvas in (and takes its size from). */
  stage: HTMLElement
  /** Closing while the house is still being built cancels it. */
  signal: AbortSignal
  reduced: boolean
  quality: Quality
  /** Read once, when the house is built (after fonts load). */
  theme: () => PlantaTheme
  initial: RoomId
  /** The sign buttons, positioned every frame over their rooms. */
  tags: () => Map<RoomId, HTMLElement>
  /** A click / tap on the canvas chose a room. */
  onPick: (id: RoomId) => void
  /** Double click on a room: enter it. */
  onEnterRequest: (id: RoomId) => void
  /** The camera finished flying into a room. */
  onArrived: (id: RoomId) => void
  onReady: () => void
  /** The GPU dropped the context (driver reset, too little memory): the shell shows the simple plan. */
  onLost: () => void
}

export interface PlantaController {
  select: (id: RoomId) => void
  /** Flies into a room (instant with reduced motion); calls onArrived when there. */
  focusRoom: (id: RoomId) => void
  unfocus: () => void
  dispose: () => void
}

const AZ = -Math.PI / 4
/** Up to this stage width (px) it's a phone: the model starts closer and the signs shrink to their number (planta.css). */
const NARROW = 640

export async function createPlanta(o: PlantaOptions): Promise<PlantaController> {
  const { stage, reduced, quality, signal } = o
  let disposed = false

  // canvas texts draw with the site's fonts: wait for them (a little) before building anything
  const theme0 = o.theme()
  const fonts = ['900 40px "Big Shoulders Display"', '40px "Instrument Serif"', '20px "JetBrains Mono"']
  if (theme0.type) fonts.push(`${theme0.type.displayWeight} 40px ${theme0.type.display}`, `400 40px ${theme0.type.text}`)
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2500))])
  } catch {
    // build with whatever is there
  }
  if (signal.aborted) throw new DOMException('closed', 'AbortError')

  // a canvas of its own: two engines must never share a WebGL context
  const canvas = document.createElement('canvas')
  canvas.className = 'gl'
  canvas.setAttribute('aria-label', 'Maqueta 3D del estudio AFTERHOURS. Usá los carteles para elegir una habitación.')
  stage.prepend(canvas)

  // the renderer first: if WebGL fails, nothing else is built
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (err) {
    canvas.remove()
    throw err
  }
  const ratio = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.5)
  renderer.setPixelRatio(ratio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  let lost = false
  const onContextLost = (e: Event) => {
    e.preventDefault()
    lost = true
    renderer.setAnimationLoop(null)
    o.onLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const scene = new THREE.Scene()
  const root = new THREE.Group()
  scene.add(root)
  const C = newCtx(root, reduced, o.theme())

  const pmrem = new THREE.PMREMGenerator(renderer)
  const roomEnv = new RoomEnvironment(renderer)
  const envRT = pmrem.fromScene(roomEnv, 0.04)
  scene.environment = envRT.texture
  scene.background = new THREE.Color(0x0a0a0a)

  const hemi = new THREE.HemisphereLight(0x9aa2b0, 0x1a1714, 0.62)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xa9bce6, 0.85)
  sun.position.set(3.2, 9, -5.5)
  sun.target.position.set(0, 0, 0)
  scene.add(sun, sun.target)
  sun.castShadow = true
  const shadowSize = quality === 'high' ? 2048 : 1024
  sun.shadow.mapSize.set(shadowSize, shadowSize)
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 25 })
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.025
  const fill = new THREE.DirectionalLight(0xc8ccd6, 0.35)
  fill.position.set(-6, 5, 6)
  scene.add(fill)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minZoom = 0.8
  controls.maxZoom = 3.2
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.2
  controls.minAzimuthAngle = AZ - 0.65
  controls.maxAzimuthAngle = AZ + 0.65
  /** The whole-plan view: the intro ends here and «Toda la planta» flies back here. The zoom depends on the stage width (resize). */
  const HOME = { target: new THREE.Vector3(0.2, 0.3, 0), zoom: 1 }
  const setCamDir = (polar = 0.98, az = AZ, dist = 30) => {
    camera.position.set(HOME.target.x + dist * Math.sin(polar) * Math.sin(az), HOME.target.y + dist * Math.cos(polar), HOME.target.z + dist * Math.sin(polar) * Math.cos(az))
    controls.target.copy(HOME.target)
    camera.lookAt(controls.target)
  }

  // ---------- the house ----------
  const TX = makeTextures()
  const MAT = makeMaterials(TX)
  const rooms: Record<RoomId, RoomMeshes> = floors(TX)
  walls(TX, MAT)
  furniture(TX, MAT)
  atmosphere()
  root.traverse((obj) => {
    const m = obj as THREE.Mesh
    if (!m.isMesh) return
    const mat = m.material as THREE.Material & { envMapIntensity?: number; isMeshBasicMaterial?: boolean }
    if (mat && !Array.isArray(mat) && 'envMapIntensity' in mat) mat.envMapIntensity = 0.5
    const basic = mat && !Array.isArray(mat) && mat.isMeshBasicMaterial
    m.castShadow = !(m.userData.noShadow || basic)
    m.receiveShadow = !basic
  })

  // how far the floors reach to each side of the home view, in world units: on a phone the plan spans the width
  root.updateMatrixWorld(true)
  const floorBox = new THREE.Box3()
  for (const r of ROOMS) floorBox.expandByObject(rooms[r.id].floor)
  let reach = 0
  for (const x of [floorBox.min.x, floorBox.max.x])
    for (const z of [floorBox.min.z, floorBox.max.z]) reach = Math.max(reach, Math.abs((x - HOME.target.x) * Math.cos(AZ) - (z - HOME.target.z) * Math.sin(AZ)))

  // ---------- post-processing (the model-photo look) ----------
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : quality === 'low' ? 2 : 0 })
  const composer = new EffectComposer(renderer, rt)
  composer.setPixelRatio(ratio)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = quality === 'min' ? null : new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.4, 0.92)
  if (bloom) composer.addPass(bloom)
  const tiltH = quality === 'high' ? new ShaderPass(HorizontalTiltShiftShader) : null
  const tiltV = quality === 'high' ? new ShaderPass(VerticalTiltShiftShader) : null
  if (tiltH && tiltV) {
    tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.52
    composer.addPass(tiltH)
    composer.addPass(tiltV)
  }
  const output = new OutputPass()
  composer.addPass(output)

  const resize = () => {
    const r = stage.getBoundingClientRect()
    const w = Math.max(1, r.width),
      h = Math.max(1, r.height),
      asp = w / h
    const halfH = Math.max(4.5, 7.0 / asp)
    Object.assign(camera, { left: -halfH * asp, right: halfH * asp, top: halfH, bottom: -halfH })
    const home = w <= NARROW ? Math.max(1, (halfH * asp) / reach) : 1
    // still on the whole plan (say, the phone turned): follow the new home zoom
    if (camera.zoom === HOME.zoom && !focused && !tween) camera.zoom = home
    HOME.zoom = home
    camera.updateProjectionMatrix()
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom?.setSize(w, h)
    if (tiltH && tiltV) {
      tiltH.uniforms.h.value = 1.6 / w
      tiltV.uniforms.v.value = 1.6 / h
    }
  }
  const ro = new ResizeObserver(resize)
  ro.observe(stage)

  // ---------- selection, hover and flights ----------
  let sel: RoomId = o.initial
  let hover: RoomId | null = null
  let focused: RoomId | null = null
  const paintFloors = () => {
    for (const r of ROOMS) {
      const m = rooms[r.id]
      m.edge.visible = r.id === sel
      m.floor.material.emissiveIntensity = r.id === sel ? 0.12 : r.id === hover ? 0.06 : 0
    }
  }
  let tween: { t0: number; from: THREE.Vector3; to: THREE.Vector3; z0: number; z1: number; arrive: RoomId | null } | null = null
  const flyTo = (target: THREE.Vector3, zoom: number, arrive: RoomId | null) => {
    if (reduced) {
      // no flight: the camera just changes
      controls.target.copy(target)
      camera.zoom = zoom
      camera.updateProjectionMatrix()
      if (arrive) requestAnimationFrame(() => !disposed && o.onArrived(arrive))
      return
    }
    tween = { t0: performance.now(), from: controls.target.clone(), to: target.clone(), z0: camera.zoom, z1: zoom, arrive }
  }

  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2()
  let down: { x: number; y: number } | null = null
  const roomAt = (ev: PointerEvent | MouseEvent): RoomId | null => {
    const r = canvas.getBoundingClientRect()
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(C.pickables, false)[0]
    return hit ? (hit.object.userData.room as RoomId) : null
  }
  const onDown = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY }
    canvas.classList.add('dragging')
  }
  const onUp = (e: PointerEvent) => {
    canvas.classList.remove('dragging')
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const id = roomAt(e)
      if (id) o.onPick(id)
    }
    down = null
  }
  const onDbl = (e: MouseEvent) => {
    const id = roomAt(e)
    if (id) o.onEnterRequest(id)
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || down) return
    const id = roomAt(e)
    if (id !== hover) {
      hover = id
      paintFloors()
      canvas.style.cursor = id ? 'pointer' : ''
    }
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('dblclick', onDbl)
  canvas.addEventListener('pointermove', onMove)

  // ---------- signs over the rooms ----------
  const tmp = new THREE.Vector3()
  const updateTags = () => {
    const r = canvas.getBoundingClientRect()
    const tags = o.tags()
    for (const room of ROOMS) {
      const el = tags.get(room.id)
      if (!el) continue
      tmp.copy(rooms[room.id].anchor).project(camera)
      el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * r.width}px, ${(-tmp.y * 0.5 + 0.5) * r.height}px) translate(-50%, -100%)`
    }
  }

  // ---------- start ----------
  resize()
  setCamDir()
  controls.update()
  paintFloors()
  let introOn = !reduced
  const rig = {
    camera,
    target: HOME.target,
    get zoom() {
      return HOME.zoom
    },
    az: AZ,
    lights: C.lights,
    MAT,
  }
  if (introOn) {
    controls.enabled = false
    introStep(rig, 0)
  }

  // time stands still while the tab is hidden (and with reduced motion)
  let start = performance.now()
  let hiddenAt = 0
  const tick = () => {
    if (lost) return
    const t = reduced ? 0 : (performance.now() - start) / 1000
    for (const a of C.anims) a(t)
    if (introOn && !introStep(rig, t)) {
      introOn = false
      controls.enabled = true
    }
    if (tween) {
      const k = Math.min(1, (performance.now() - tween.t0) / 900),
        e = 1 - Math.pow(1 - k, 3)
      controls.target.lerpVectors(tween.from, tween.to, e)
      camera.zoom = tween.z0 + (tween.z1 - tween.z0) * e
      camera.updateProjectionMatrix()
      if (k >= 1) {
        const arrive = tween.arrive
        tween = null
        if (arrive) o.onArrived(arrive)
      }
    }
    if (!introOn) controls.update()
    try {
      composer.render()
    } catch (err) {
      // a GPU that gives up mid-frame (lost context, shader limits): stop and fall back to the simple plan
      lost = true
      renderer.setAnimationLoop(null)
      console.warn('planta 3D:', err)
      o.onLost()
      return
    }
    updateTags()
  }
  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = performance.now()
      renderer.setAnimationLoop(null)
    } else if (!lost) {
      if (hiddenAt) start += performance.now() - hiddenAt
      hiddenAt = 0
      renderer.setAnimationLoop(tick)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  renderer.setAnimationLoop(tick)
  o.onReady()

  return {
    select(id) {
      sel = id
      paintFloors()
    },
    focusRoom(id) {
      focused = id
      const c = rooms[id].center
      flyTo(new THREE.Vector3(c.x, 0.6, c.z), id === 'studio' ? 1.7 : 2.3, id)
    },
    unfocus() {
      if (!focused) return
      focused = null
      flyTo(HOME.target, HOME.zoom, null)
    },
    dispose() {
      if (disposed) return
      disposed = true
      renderer.setAnimationLoop(null)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('dblclick', onDbl)
      canvas.removeEventListener('pointermove', onMove)
      controls.dispose()
      if (introOn) finishIntro(rig)
      // everything the house made: geometries, materials (and their maps), textures
      const mats = new Set<THREE.Material>()
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mat = m.material
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => mats.add(x))
        const light = obj as THREE.Light
        if (light.isLight && light.shadow) light.shadow.map?.dispose()
      })
      mats.forEach((m) => m.dispose())
      C.textures.forEach((t) => t.dispose())
      envRT.dispose()
      roomEnv.dispose()
      pmrem.dispose()
      bloom?.dispose()
      tiltH?.dispose()
      tiltV?.dispose()
      output.dispose()
      composer.dispose()
      rt.dispose()
      renderer.renderLists.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
}

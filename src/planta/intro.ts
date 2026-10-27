/** Entrance: the camera comes in and the studio lights up one light at a time (ported from the prototype). */
import type * as THREE from 'three'
import type { Materials } from './materials'

export const INTRO_DURATION = 3.4

export interface IntroRig {
  camera: THREE.OrthographicCamera
  target: THREE.Vector3
  /** Home zoom (closer on a phone). */
  zoom: number
  /** Home azimuth of the camera. */
  az: number
  lights: THREE.PointLight[]
  MAT: Materials
}

/** Advances the intro to time t (seconds); returns false once it's over (everything at full power). */
export function introStep(rig: IntroRig, t: number): boolean {
  const { camera, target, zoom, az: AZ, lights, MAT } = rig
  const k = Math.min(1, t / INTRO_DURATION)
  // lights switch on one by one, with a tube's flicker
  lights.forEach((L, i) => {
    if (L.userData.base === undefined) L.userData.base = L.intensity
    const s = 0.5 + i * 0.16
    const local = Math.min(1, Math.max(0, (t - s) / 0.35))
    const flick = local > 0 && local < 1 && Math.sin(t * 60 + i) > 0.2 ? 0.25 : 1
    L.intensity = L.userData.base * local * flick
  })
  const ledK = t < 0.9 ? 0 : t < 1.0 ? 1 : t < 1.08 ? 0 : t < 1.2 ? 1 : t < 1.26 ? 0.2 : 1
  MAT.led.emissiveIntensity = 2.0 * ledK
  MAT.ledBlue.emissiveIntensity = 5.5 * Math.min(1, Math.max(0, (t - 1.4) / 0.4))
  // camera: from far and from the side to the model view
  const e = 1 - Math.pow(1 - k, 3)
  const az = AZ - 0.55 * (1 - e),
    polar = 0.98 - 0.25 * (1 - e)
  camera.position.set(target.x + 30 * Math.sin(polar) * Math.sin(az), target.y + 30 * Math.cos(polar), target.z + 30 * Math.sin(polar) * Math.cos(az))
  camera.zoom = (0.62 + 0.38 * e) * zoom
  camera.updateProjectionMatrix()
  camera.lookAt(target)
  if (k >= 1) {
    finishIntro(rig)
    return false
  }
  return true
}

export function finishIntro({ lights, MAT }: Pick<IntroRig, 'lights' | 'MAT'>) {
  lights.forEach((L) => {
    if (L.userData.base !== undefined) L.intensity = L.userData.base
  })
  MAT.led.emissiveIntensity = 2.0
  MAT.ledBlue.emissiveIntensity = 5.5
}

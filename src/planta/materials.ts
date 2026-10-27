/** Materials of the house (ported from the prototype). */
import * as THREE from 'three'
import type { Textures } from './textures'
import { ACID, BONE, phys, std } from './util'

export type Materials = Record<
  | 'brick' | 'plaster' | 'concreteCap' | 'steel' | 'wood' | 'walnut' | 'black' | 'white' | 'bone' | 'acid' | 'cardboard' | 'metal' | 'chrome'
  | 'potWhite' | 'lampShade' | 'bulb' | 'acidGlow' | 'acidGlowSoft' | 'led' | 'ledBlue',
  THREE.MeshStandardMaterial
> &
  Record<'lacquer' | 'leather' | 'leatherDark' | 'velvet', THREE.MeshPhysicalMaterial> & { leaf: THREE.MeshStandardMaterial[] }

export function makeMaterials(TX: Textures): Materials {
  return {
    brick: std(0xb0aca6, 0.92, 0, { map: TX.brick, bumpMap: TX.brick, bumpScale: 1.2 }),
    plaster: std(0xa9a49b, 0.95),
    concreteCap: std(0x9a978f, 0.9, 0, { map: TX.concrete }),
    steel: std(0x1a1a19, 0.4, 0.7),
    wood: std(0xa8794c, 0.55),
    walnut: std(0x5e3d24, 0.5),
    black: std(0x1d1d1b, 0.45, 0.1),
    lacquer: phys(0x161615, { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    white: std(0xf1eee6, 0.35),
    bone: std(BONE, 0.6),
    acid: std(ACID, 0.55),
    leather: phys(0x8f4f25, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.2, sheenColor: new THREE.Color(0xffc89a) }),
    leatherDark: phys(0x7a4220, { roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.45 }),
    velvet: phys(0xa9d82f, { roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xe8ff9a) }),
    cardboard: std(0xc49a64, 0.9),
    metal: std(0x8f8e87, 0.35, 0.8),
    chrome: std(0xdddddd, 0.08, 1),
    leaf: [std(0x2f6b2c, 0.55), std(0x3f7f36, 0.5), std(0x4b8a3d, 0.5), std(0x376f30, 0.6)],
    potWhite: std(0xe9e4d8, 0.6),
    lampShade: std(0xe9e4d8, 0.6, 0, { emissive: 0xfff0d8, emissiveIntensity: 1.1 }),
    bulb: std(0xffffff, 0.3, 0, { emissive: 0xfff1d0, emissiveIntensity: 5 }),
    acidGlow: std(ACID, 0.4, 0, { emissive: ACID, emissiveIntensity: 3 }),
    acidGlowSoft: std(ACID, 0.4, 0, { emissive: ACID, emissiveIntensity: 1.4 }),
    led: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: ACID, emissiveIntensity: 2.0 }),
    ledBlue: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2f6bff, emissiveIntensity: 5.5 }),
  }
}

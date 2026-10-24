/** Small colour helpers shared by the selection, the palette and the notes. Pure, no DOM. */

export type RGB = [number, number, number]
export type Lab = [number, number, number]

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/** sRGB (0–255) → CIE Lab (D65). */
export function rgbToLab([r, g, b]: RGB): Lab {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const [fx, fy, fz] = [f(x), f(y), f(z)]
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/** CIE Lab (D65) → sRGB (0–255), clamped. */
export function labToRgb([L, a, b]: Lab): RGB {
  const fy = (L + 16) / 116
  const fx = fy + a / 500
  const fz = fy - b / 200
  const inv = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787)
  const [x, y, z] = [inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883]
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415
  const B = x * 0.0557 + y * -0.204 + z * 1.057
  const gamma = (c: number) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  return [gamma(R), gamma(G), gamma(B)].map((v) => Math.round(Math.max(0, Math.min(255, v)))) as RGB
}

/** CIE76 distance between two colours in Lab. ~2.3 is a just-noticeable difference; 100+ is opposite. */
export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function hexDistance(a: string, b: string): number | null {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  return ra && rb ? deltaE(rgbToLab(ra), rgbToLab(rb)) : null
}

/** Relative luminance (WCAG), 0–1. */
export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Positive = warm (reds/oranges/yellows), negative = cool (blues/greens), from Lab a/b. */
export function warmth(rgb: RGB): number {
  const [, a, b] = rgbToLab(rgb)
  return a * 0.5 + b * 0.5
}

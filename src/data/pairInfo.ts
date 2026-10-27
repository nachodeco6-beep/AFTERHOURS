import type { Mood } from './moods.ts'

/** How the headline of a pair looks, for the Type Lab's «Estilo del titular» filter. */
export type HeadStyle = 'serif' | 'sans' | 'display' | 'mono' | 'script'

export const HEAD_STYLES: HeadStyle[] = ['serif', 'sans', 'display', 'mono', 'script']

export const HEAD_STYLE_LABEL: Record<HeadStyle, string> = { serif: 'Serif', sans: 'Sans', display: 'Display', mono: 'Mono', script: 'Script' }

/**
 * Per pair (by id in TYPE_PAIRS): the style of its headline and 2 or 3 «climas».
 * Display = made for big sizes (slabs, condensed posters, decorative cuts).
 */
export const PAIR_INFO: Record<number, { style: HeadStyle; moods: Mood[] }> = {
  1: { style: 'serif', moods: ['lujo', 'editorial'] },
  2: { style: 'serif', moods: ['editorial', 'lujo'] },
  3: { style: 'serif', moods: ['editorial', 'calido'] },
  4: { style: 'serif', moods: ['lujo', 'editorial', 'retro'] },
  5: { style: 'script', moods: ['urbano', 'experimental'] },
  6: { style: 'serif', moods: ['retro', 'calido'] },
  7: { style: 'serif', moods: ['editorial', 'calido'] },
  8: { style: 'display', moods: ['urbano', 'retro'] },
  9: { style: 'display', moods: ['urbano', 'tecnico'] },
  10: { style: 'display', moods: ['retro', 'lujo'] },
  11: { style: 'serif', moods: ['editorial', 'lujo'] },
  12: { style: 'script', moods: ['lujo', 'calido'] },
  13: { style: 'serif', moods: ['lujo', 'editorial'] },
  14: { style: 'serif', moods: ['editorial', 'urbano'] },
  15: { style: 'serif', moods: ['editorial', 'retro'] },
  16: { style: 'serif', moods: ['lujo', 'editorial'] },
  17: { style: 'serif', moods: ['calido', 'lujo'] },
  18: { style: 'serif', moods: ['lujo', 'editorial'] },
  19: { style: 'serif', moods: ['lujo', 'calido'] },
  20: { style: 'serif', moods: ['editorial', 'calido'] },
  21: { style: 'sans', moods: ['urbano', 'tecnico', 'experimental'] },
  22: { style: 'display', moods: ['urbano', 'experimental'] },
  23: { style: 'display', moods: ['urbano', 'tecnico'] },
  24: { style: 'sans', moods: ['urbano', 'tecnico'] },
  25: { style: 'mono', moods: ['experimental', 'retro'] },
  26: { style: 'display', moods: ['urbano', 'experimental'] },
  27: { style: 'display', moods: ['retro', 'experimental'] },
  28: { style: 'display', moods: ['tecnico', 'experimental'] },
  29: { style: 'sans', moods: ['tecnico', 'editorial'] },
  30: { style: 'sans', moods: ['tecnico', 'urbano'] },
  31: { style: 'mono', moods: ['tecnico', 'editorial'] },
  32: { style: 'display', moods: ['tecnico', 'lujo'] },
  33: { style: 'display', moods: ['retro', 'calido'] },
  34: { style: 'display', moods: ['retro', 'urbano'] },
  35: { style: 'display', moods: ['retro', 'urbano'] },
  36: { style: 'display', moods: ['retro', 'calido'] },
  37: { style: 'display', moods: ['retro', 'lujo'] },
  38: { style: 'display', moods: ['retro', 'lujo'] },
  39: { style: 'script', moods: ['retro', 'calido'] },
  40: { style: 'script', moods: ['calido', 'retro'] },
  41: { style: 'serif', moods: ['retro', 'calido', 'lujo'] },
  42: { style: 'serif', moods: ['calido', 'editorial'] },
  43: { style: 'serif', moods: ['calido', 'retro'] },
  44: { style: 'serif', moods: ['calido', 'editorial'] },
  45: { style: 'script', moods: ['calido', 'retro'] },
  46: { style: 'script', moods: ['calido', 'experimental'] },
  47: { style: 'sans', moods: ['editorial', 'tecnico'] },
  48: { style: 'sans', moods: ['editorial', 'tecnico'] },
  49: { style: 'sans', moods: ['editorial', 'calido'] },
  50: { style: 'display', moods: ['urbano', 'tecnico'] },
  51: { style: 'sans', moods: ['tecnico', 'urbano'] },
  52: { style: 'display', moods: ['retro', 'urbano'] },
  53: { style: 'display', moods: ['editorial', 'experimental'] },
  54: { style: 'mono', moods: ['retro', 'experimental'] },
  55: { style: 'display', moods: ['experimental', 'retro'] },
  56: { style: 'display', moods: ['experimental', 'urbano'] },
  57: { style: 'display', moods: ['experimental', 'calido'] },
  58: { style: 'sans', moods: ['calido', 'experimental'] },
  59: { style: 'display', moods: ['calido', 'urbano'] },
  60: { style: 'script', moods: ['lujo', 'calido'] },
  61: { style: 'script', moods: ['urbano', 'experimental'] },
  62: { style: 'display', moods: ['experimental', 'editorial', 'tecnico'] },
}

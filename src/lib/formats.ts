/**
 * Board formats and the fixed geometry of the board canvas. Pure, no DOM.
 *
 * Every format has a real export size in px (1920 × 1080, 1080 × 1350, A4 at
 * 150 ppi). The canvas is laid out at that size divided by `pixelRatio`, so the
 * interface type (rem-based) stays legible on screen; exporting at
 * `pixelRatio` gives exactly the real size. The header, the photo area and the
 * credits footer always add up to the canvas' exact width and height.
 */
import type { Template } from './compose.ts'

export type Format = 'horizontal' | 'vertical' | 'a4'

export interface FormatSpec {
  id: Format
  label: string
  hint: string
  /** Real (export) size in px. */
  exportWidth: number
  exportHeight: number
  /** Export px per canvas px. */
  pixelRatio: number
  /** Canvas size in CSS px. */
  width: number
  height: number
}

/** `width`: canvas width in CSS px; the rest follows from the export size. */
const spec = (id: Format, label: string, hint: string, exportWidth: number, exportHeight: number, width: number): FormatSpec => ({
  id,
  label,
  hint,
  exportWidth,
  exportHeight,
  pixelRatio: exportWidth / width,
  width,
  height: (exportHeight * width) / exportWidth,
})

export const FORMATS: Record<Format, FormatSpec> = {
  horizontal: spec('horizontal', 'Horizontal 16:9', 'Presentación · 1920 × 1080', 1920, 1080, 1280),
  vertical: spec('vertical', 'Vertical 4:5', 'Post de Instagram · 1080 × 1350', 1080, 1350, 720),
  // A4 (210 × 297 mm) at 150 ppi
  a4: spec('a4', 'A4 vertical', 'Para imprimir · A4 a 150 ppp (1240 × 1754)', 1240, 1754, 720),
}

export const FORMAT_ORDER: Format[] = ['horizontal', 'vertical', 'a4']
export const DEFAULT_FORMAT: Format = 'horizontal'

/** Outer padding and gutter per template (canvas px): the same engine, different air. */
export const AIR: Record<Template, { pad: number; gap: number }> = {
  editorial: { pad: 40, gap: 14 },
  collage: { pad: 18, gap: 4 },
  grilla: { pad: 52, gap: 22 },
}

const CREDIT_LINE = 16

export interface CanvasGeometry {
  width: number
  height: number
  pad: number
  gap: number
  header: number
  /** Font size of the title. */
  title: number
  footer: number
  creditColumns: number
  /** Space between header / photos / footer. */
  section: number
  /** The area where compose() lays out photos and blocks. */
  grid: { x: number; y: number; width: number; height: number }
}

export function canvasGeometry(format: Format, template: Template, photos: number, bare: boolean): CanvasGeometry {
  const { width, height } = FORMATS[format]
  // the A4 canvas is narrower: a little less air
  const u = Math.min(width, height) / 720
  const pad = Math.round(AIR[template].pad * u)
  const gap = Math.round(AIR[template].gap * u)
  const title = bare ? 26 : format === 'horizontal' ? 48 : 56
  // label row + space + title + bottom padding and rule
  const header = 16 + 8 + Math.round(title * 0.95) + 14
  const creditColumns = format === 'horizontal' ? 6 : 4
  const rows = Math.max(1, Math.ceil(photos / creditColumns))
  // rule + padding + «Créditos» row + credit lines
  const footer = 1 + 10 + 18 + rows * CREDIT_LINE
  const section = bare ? 14 : 20
  const gridY = pad + header + section
  return {
    width,
    height,
    pad,
    gap,
    header,
    title,
    footer,
    creditColumns,
    section,
    grid: {
      x: pad,
      y: gridY,
      width: width - pad * 2,
      height: height - gridY - section - footer - pad,
    },
  }
}

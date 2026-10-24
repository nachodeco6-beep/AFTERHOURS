/**
 * Art-direction notes written from the board's own data (tags, palette,
 * orientations, type pair). Plain templates, nothing guessed. Pure.
 */
import { hexToRgb, luminance, warmth } from './color.ts'

export interface NotesInput {
  tags: string[]
  palette: string[]
  /** Width / height of each photo on the board. */
  ratios: number[]
  pair?: { display: string; text: string; category: string } | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function writeNotes({ tags, palette, ratios, pair }: NotesInput): string {
  const lines: string[] = []
  if (tags.length) lines.push(`Concepto: ${tags.join(', ')}.`)

  const rgbs = palette.map(hexToRgb).filter((c) => c !== null)
  if (rgbs.length) {
    const lum = rgbs.map(luminance)
    const avgWarmth = rgbs.reduce((s, c) => s + warmth(c), 0) / rgbs.length
    const temp = avgWarmth > 8 ? 'cálida' : avgWarmth < -4 ? 'fría' : 'neutra'
    const spread = Math.max(...lum) - Math.min(...lum)
    const contrast = spread > 0.5 ? 'contraste alto' : spread > 0.2 ? 'contraste medio' : 'contraste bajo'
    const avgLum = lum.reduce((a, b) => a + b, 0) / lum.length
    const tone = avgLum < 0.15 ? 'dominan los tonos oscuros' : avgLum > 0.5 ? 'dominan los tonos claros' : 'tonos medios'
    lines.push(`Color: paleta ${temp}, de ${contrast}; ${tone}.`)
  }

  if (ratios.length) {
    const land = ratios.filter((r) => r > 1.15).length
    const port = ratios.filter((r) => r < 0.87).length
    const sq = ratios.length - land - port
    const parts = [land && plural(land, 'horizontal', 'horizontales'), port && plural(port, 'vertical', 'verticales'), sq && plural(sq, 'cuadrada', 'cuadradas')].filter(Boolean)
    const lean =
      port > land ? ' Predomina el formato vertical: funciona en afiches y pantallas de celular.' : land > port ? ' Predomina el formato horizontal: funciona en banners y pantallas anchas.' : ''
    lines.push(`Encuadre: ${parts.join(', ')}.${lean}`)
  }

  if (pair) lines.push(`Tipografía: ${pair.display} para titulares y ${pair.text} para texto (${pair.category.toLowerCase()}).`)
  return lines.join('\n')
}

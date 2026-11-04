/**
 * Builds the system prompt from the template in shared/ai/ and the catalog in
 * src/data/. The line format must match afterhours-ai/scripts/render_prompt_v4.py;
 * test/lab-parity.test.mjs fails if the two renders differ.
 */
import type { InspirationPalette } from '../../src/data/palettes.ts'
import type { TypePair } from '../../src/data/typePairs.ts'

/** `id — display + text — category — tags` */
export function formatPairs(pairs: readonly TypePair[]): string {
  return pairs
    .map((p) => `${p.id} — ${p.display.family} + ${p.text.family} — ${p.category} — ${p.tags.join(', ')}`)
    .join('\n')
}

/** `id — name (mood) — #hex1 #hex2 ...` */
export function formatPalettes(palettes: readonly InspirationPalette[]): string {
  return palettes.map((p) => `${p.id} — ${p.name} (${p.mood}) — ${p.colors.join(' ')}`).join('\n')
}

export function renderSystemPrompt(
  template: string,
  pairs: readonly TypePair[],
  palettes: readonly InspirationPalette[],
): string {
  // A Windows checkout can give the template CRLF line endings; the prompt must not depend on that.
  const normalized = template.replace(/\r\n/g, '\n')
  for (const placeholder of ['{{CATALOGO_PARES}}', '{{CATALOGO_PALETAS}}']) {
    if (!normalized.includes(placeholder)) throw new Error(`La plantilla no tiene el placeholder ${placeholder}`)
  }
  // Replacer functions: a `$` in the catalog must stay literal.
  const prompt = normalized
    .replaceAll('{{CATALOGO_PARES}}', () => formatPairs(pairs))
    .replaceAll('{{CATALOGO_PALETAS}}', () => formatPalettes(palettes))

  const leftover = prompt.split('\n').filter((line) => line.includes('{{'))
  if (leftover.length) throw new Error(`Quedaron placeholders sin reemplazar:\n${leftover.join('\n')}`)
  return prompt
}

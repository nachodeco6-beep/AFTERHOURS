/** How many tags one search can use (1 tag = 1 request to Unsplash). */
export const MAX_TAGS = 6
/** Longest query the Worker accepts. */
export const MAX_TAG_LENGTH = 100

/** Comparison key: case-insensitive, spaces collapsed. Accents count as different letters. */
export const tagKey = (tag: string) => tag.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es')

export interface ParsedTags {
  /** Every tag in the text, deduplicated, in order. */
  all: string[]
  /** The first MAX_TAGS — the ones a search uses. */
  searchable: string[]
  /** True if some tag was longer than MAX_TAG_LENGTH and got cut. */
  truncated: boolean
}

/**
 * Cuts the idea into tags: one per comma (or line break), trimmed, without
 * empty or repeated pieces. The text stays the single source of truth; editing
 * a chip rewrites the text with joinTags().
 */
export function parseTags(text: string): ParsedTags {
  const seen = new Set<string>()
  const all: string[] = []
  let truncated = false
  for (const piece of text.split(/[,\n]/)) {
    let tag = piece.trim().replace(/\s+/g, ' ')
    if (!tag) continue
    if (tag.length > MAX_TAG_LENGTH) {
      tag = tag.slice(0, MAX_TAG_LENGTH).trim()
      truncated = true
    }
    const key = tagKey(tag)
    if (seen.has(key)) continue
    seen.add(key)
    all.push(tag)
  }
  return { all, searchable: all.slice(0, MAX_TAGS), truncated }
}

export const joinTags = (tags: string[]) => tags.filter((t) => t.trim()).join(', ')

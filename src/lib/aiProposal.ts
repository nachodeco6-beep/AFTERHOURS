/**
 * The AI proposal as board logic, pure and DOM-free: what applying changes
 * (and, above all, what it never touches, D15), how the palette's origin
 * moves between «ia», «manual» and «fotos» (D22), and the request's states.
 * Talking to the Worker is aiApi.ts; wiring into React is the provider.
 */
import type { Brandbook, GenerateBrandbookResponse, GenerateResponse } from '../../shared/types.ts'
import { PALETTES } from '../data/palettes.ts'
import type { AiFailureCode } from './aiApi.ts'
import { basisOf, defaultRoles, type LabColor, type PaletteEdit } from './colorLab.ts'
import { tagKey } from './tags.ts'
import type { PickedFonts } from './typography.ts'

/** Who put the active palette there. «fotos» is what paletteEdit: null used to mean. */
export type PaletteOrigin = 'fotos' | 'ia' | 'manual'

/** A dismissed divergence notice: D and the photos at that moment (D23), to know when to warn again. */
export interface DivergenceDismissal {
  d: number
  photoIds: string[]
}

// ─── Applying (D15, D19, D22) ───────────────────────────────────────────────

/** Everything apply() changes. Nothing else: no title, notes, template, format, include, typeStyle or photos. */
export interface ProposalPatch {
  fonts: PickedFonts
  paletteEdit: PaletteEdit
  paletteOrigin: 'ia'
  /** The AI palette as proposed, kept even when another palette is active (D22). */
  aiPalette: PaletteEdit
  /** The whole brandbook, saved with the project (N9). */
  ai: Brandbook
  /** A new proposal starts the divergence notice from scratch. */
  divergenceDismissal: null
}

const editOf = (colors: readonly string[], basis: string): PaletteEdit => {
  const hexes = colors.map((hex) => hex.toUpperCase())
  const roles = defaultRoles(hexes)
  return { colors: hexes.map((hex, i): LabColor => ({ hex, locked: false, role: roles[i], photoId: null })), basis }
}

/**
 * The board changes of applying a brandbook: the pair, the palette built from
 * the catalogue (with default roles and the current photos as basis), the AI
 * fields and the «ia» origin (D19/D22). Null if the palette isn't in this
 * build's catalogue (aiApi already refuses those, this one stays pure).
 */
export function applyProposal(brandbook: Brandbook, photoIds: string[]): ProposalPatch | null {
  const palette = PALETTES.find((p) => p.id === brandbook.palette_id)
  if (!palette) return null
  const basis = basisOf(photoIds)
  return {
    fonts: { display: brandbook.pair_id, text: brandbook.pair_id },
    paletteEdit: editOf(palette.colors, basis),
    paletteOrigin: 'ia',
    aiPalette: editOf(palette.colors, basis),
    ai: brandbook,
    divergenceDismissal: null,
  }
}

/**
 * The AI queries that aren't already searched, to offer as one-click
 * suggestions when the user brought their own tags (N1). Nothing is searched
 * (and no Unsplash spent) until one is picked.
 */
export function suggestedQueries(ai: Brandbook | null, currentTags: string[]): string[] {
  if (!ai) return []
  const have = new Set(currentTags.map(tagKey))
  return ai.search_queries.filter((q) => !have.has(tagKey(q)))
}

// ─── Palette origin (D22) ───────────────────────────────────────────────────

/** The part of the board the origin rules read. */
export interface PaletteState {
  paletteOrigin: PaletteOrigin
  paletteEdit: PaletteEdit | null
  aiPalette: PaletteEdit | null
}

/**
 * Follows the palette's origin on every board patch, so touching a colour in
 * the Color Lab moves «ia» to «manual» without editing ColorLab.tsx:
 * - a patch that states its origin (applying, restoring) passes untouched;
 * - paletteEdit: null is «fotos» (aiPalette stays, D22);
 * - a new edit over an AI palette is «manual», and its basis moves to the
 *   current photos so the «Cambiaste las fotos» notice doesn't fire right
 *   there (N5); any other new edit is simply «manual».
 */
export function nextPaletteOrigin<P extends Partial<PaletteState>>(board: PaletteState, patch: P, photosBasis: string): P & Partial<PaletteState> {
  if ('paletteOrigin' in patch || !('paletteEdit' in patch)) return patch
  const edit = patch.paletteEdit ?? null
  if (edit === null) return { ...patch, paletteOrigin: 'fotos' }
  if (board.paletteOrigin === 'ia') return { ...patch, paletteOrigin: 'manual', paletteEdit: { ...edit, basis: photosBasis } }
  return { ...patch, paletteOrigin: 'manual' }
}

/** Back to the AI palette (D22): fresh copies, based on the photos of now. */
export function restoreAiPalette(aiPalette: PaletteEdit, photosBasis: string): { paletteEdit: PaletteEdit; paletteOrigin: 'ia' } {
  return { paletteEdit: { colors: aiPalette.colors.map((c) => ({ ...c })), basis: photosBasis }, paletteOrigin: 'ia' }
}

// ─── The request's states ───────────────────────────────────────────────────

export type AiRequestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; proposal: GenerateBrandbookResponse }
  /** The request isn't a brand (D16): no attempt spent, Nacho's message in W3b. Its own state (N8). */
  | { status: 'fuera-de-tema' }
  /** No attempts left: the visitor's own, or the global cap («global», D8). */
  | { status: 'sin-intentos'; reason: 'propios' | 'global'; resetAt: string | null }
  /** Anything else. The board is never touched: classic mode keeps working (D8). */
  | { status: 'error'; code: AiFailureCode }

export type AiRequestEvent =
  | { type: 'pedir' }
  | { type: 'respuesta'; response: GenerateResponse }
  | { type: 'falla'; code: AiFailureCode; resetAt: string | null }
  /** Also after applying: the proposal was consumed. */
  | { type: 'cerrar' }

export function reduceAiRequest(state: AiRequestState, event: AiRequestEvent): AiRequestState {
  switch (event.type) {
    case 'pedir':
      return { status: 'loading' }
    case 'respuesta':
      if (state.status !== 'loading') return state
      return 'brandbook' in event.response ? { status: 'ready', proposal: event.response } : { status: 'fuera-de-tema' }
    case 'falla':
      if (state.status !== 'loading') return state
      if (event.code === 'quota_exceeded') return { status: 'sin-intentos', reason: 'propios', resetAt: event.resetAt }
      if (event.code === 'global_limit') return { status: 'sin-intentos', reason: 'global', resetAt: event.resetAt }
      return { status: 'error', code: event.code }
    case 'cerrar':
      return { status: 'idle' }
  }
}

// ─── The concept ────────────────────────────────────────────────────────────

export const CONCEPT_MIN = 3
export const CONCEPT_MAX = 500

/** Checked before asking Turnstile for a token: a bad length never leaves the page. */
export function conceptProblem(concept: string): 'corto' | 'largo' | null {
  const length = concept.trim().length
  if (length < CONCEPT_MIN) return 'corto'
  if (length > CONCEPT_MAX) return 'largo'
  return null
}

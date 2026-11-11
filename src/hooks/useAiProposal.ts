/**
 * The AI proposal for whoever draws the panel (Nacho, W3b): the request's
 * state, the attempts left, apply/discard, the suggested searches (N1) and
 * the divergence notice (D20). The request itself lives in StudioProvider, so
 * navigating doesn't lose a generation that was already charged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Brandbook } from '../../shared/types'
import type { AiRequestState } from '../lib/aiProposal'
import { restoreAiPalette as restorePatch } from '../lib/aiProposal'
import { basisOf } from '../lib/colorLab'
import { paletteDistance, shouldWarn } from '../lib/divergence'
import { useStudio } from './useStudio'

/** The notice waits this long after the last photo change (D20). */
export const DIVERGENCE_SETTLE_MS = 2_000

export interface AiProposalApi {
  /** False = the AI isn't configured: don't draw anything, the web is the classic one (D8). */
  available: boolean
  state: AiRequestState
  /** The brandbook waiting for «Aplicar», when state is ready. */
  proposal: Brandbook | null
  remaining: number | null
  resetAt: string | null
  propose: (concept: string) => Promise<void>
  apply: () => void
  discard: () => void
  suggestedTags: string[]
  addSuggestedTag: (tag: string) => boolean
  /** The divergence notice should show (D20; its design is W3b's). */
  photoPaletteDiverges: boolean
  /** D, for dev mode and for calibrating the threshold. Null = nothing to compare. */
  divergence: number | null
  /** «Usar paleta de tus fotos» (D19/D22): the AI palette stays saved. */
  applyPhotoPalette: () => void
  /** Back to the AI palette, rebased on the photos of now (D22). */
  restoreAiPalette: () => void
  /** Saves D and the photos of this moment with the project (D23). */
  dismissDivergence: () => void
}

/**
 * `photoPalette` comes from whoever already computes it (useBoardData), so the
 * photos aren't sampled twice; `getToken` comes from the Turnstile widget.
 */
export function useAiProposal(photoPalette: string[] | null, getToken: () => Promise<string>): AiProposalApi {
  const { ai, board, selection, updateBoard } = useStudio()

  const photoIds = useMemo(() => selection.map((s) => s.photo.id), [selection])
  const photosKey = photoIds.join('|')
  const aiHexes = useMemo(() => board?.aiPalette?.colors.map((c) => c.hex) ?? null, [board?.aiPalette])
  const photoKey = photoPalette?.join('|') ?? ''
  const aiKey = aiHexes?.join('|') ?? ''

  // D settles 2 s after the last photo change, with the photo palette already read
  const [divergence, setDivergence] = useState<number | null>(null)
  useEffect(() => {
    if (!aiHexes || !photoPalette?.length) {
      setDivergence(null)
      return
    }
    const timer = setTimeout(() => setDivergence(paletteDistance(aiHexes, photoPalette)), DIVERGENCE_SETTLE_MS)
    return () => clearTimeout(timer)
    // keyed by content: a new photo or palette restarts the wait
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey, photoKey, aiKey])

  const photoPaletteDiverges = shouldWarn({
    origin: board?.paletteOrigin ?? 'fotos',
    d: divergence,
    dismissal: board?.divergenceDismissal ?? null,
    photoIds,
  })

  const propose = useCallback((concept: string) => ai.propose(concept, getToken), [ai, getToken])

  const applyPhotoPalette = useCallback(() => updateBoard({ paletteEdit: null }), [updateBoard])

  const restoreAiPalette = useCallback(() => {
    const aiPalette = board?.aiPalette
    if (aiPalette) updateBoard(restorePatch(aiPalette, basisOf(photoIds)))
  }, [board?.aiPalette, photoIds, updateBoard])

  const dismissDivergence = useCallback(() => {
    if (divergence !== null) updateBoard({ divergenceDismissal: { d: divergence, photoIds } })
  }, [divergence, photoIds, updateBoard])

  return {
    available: ai.available,
    state: ai.state,
    proposal: ai.state.status === 'ready' ? ai.state.proposal.brandbook : null,
    remaining: ai.remaining,
    resetAt: ai.resetAt,
    propose,
    apply: ai.apply,
    discard: ai.discard,
    suggestedTags: ai.suggestedTags,
    addSuggestedTag: ai.addSuggestedTag,
    photoPaletteDiverges,
    divergence,
    applyPhotoPalette,
    restoreAiPalette,
    dismissDivergence,
  }
}

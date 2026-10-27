import type { CSSProperties } from 'react'
import { needsEdge } from '../../lib/colorLab'

/** Small helpers for the labs: tabs, keyboard and swatches. */

export const tabPanelProps = (id: string, tab: string) => ({ role: 'tabpanel', id: `${id}-panel-${tab}`, 'aria-labelledby': `${id}-tab-${tab}`, tabIndex: 0 }) as const

/** True when the key press belongs to a field or a control (so the space bar isn't ours). */
export const isTypingTarget = (t: EventTarget | null) =>
  t instanceof Element &&
  Boolean(t.closest('input, textarea, select, button, a, summary, [role="radio"], [role="tab"], [role="switch"], [role="slider"], [contenteditable=""], [contenteditable="true"]'))

/** A colour on the dark page: with a 1px edge, a shade lighter than the page, when it would melt into it. */
export const swatchStyle = (hex: string): CSSProperties => ({ backgroundColor: hex, ...(needsEdge(hex) ? { boxShadow: 'inset 0 0 0 1px var(--color-line)' } : {}) })

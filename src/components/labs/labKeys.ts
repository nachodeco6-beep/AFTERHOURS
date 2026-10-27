/** Small helpers for the labs' tabs and keyboard. */

export const tabPanelProps = (id: string, tab: string) => ({ role: 'tabpanel', id: `${id}-panel-${tab}`, 'aria-labelledby': `${id}-tab-${tab}`, tabIndex: 0 }) as const

/** True when the key press belongs to a field or a control (so the space bar isn't ours). */
export const isTypingTarget = (t: EventTarget | null) =>
  t instanceof Element &&
  Boolean(t.closest('input, textarea, select, button, a, summary, [role="radio"], [role="tab"], [role="switch"], [role="slider"], [contenteditable=""], [contenteditable="true"]'))

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

/**
 * Modal behaviour for overlays: traps Tab focus, closes on Escape, locks page
 * scroll and returns focus to whatever opened it.
 */
export function useDialog(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const node = ref.current
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPadding = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbar}px`

    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    requestAnimationFrame(() => first?.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
      // Hand focus back to the opener, unless something outside the dialog
      // already took it (e.g. a route change focused the new view's title).
      const current = document.activeElement
      if (!current || current === document.body || node?.contains(current)) opener?.focus({ preventScroll: true })
    }
  }, [open, ref])
}

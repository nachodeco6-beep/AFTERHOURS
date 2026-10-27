import { useEffect, useRef } from 'react'
import type { FontSpec } from '../../data/typePairs'
import { queueFont } from '../../lib/fonts'
import { fontCss } from '../../lib/typography'

/** A line of text in a font that loads only when the line comes into view. */
export function FontSample({ spec, text, className }: { spec: FontSpec; text: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      queueFont(spec)
      io.disconnect()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [spec])
  return (
    <span ref={ref} className={className} style={fontCss(spec)} aria-hidden="true">
      {text}
    </span>
  )
}

import { useEffect, useRef, useState } from 'react'

/** Copies text; `copied` names what was copied, for a second and a half. */
export function useCopy(say: (text: string) => void) {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async (key: string, text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      say(done)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 1600)
    } catch {
      say('No se pudo copiar: el navegador no dio permiso.')
    }
  }
  return { copied, copy }
}

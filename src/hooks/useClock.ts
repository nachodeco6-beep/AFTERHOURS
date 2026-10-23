import { useEffect, useState } from 'react'

/** The visitor's local time, ticking on the second boundary so every clock on the page agrees. */
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: number
    const tick = () => {
      const d = new Date()
      setNow(d)
      timer = window.setTimeout(tick, 1000 - d.getMilliseconds() + 5)
    }
    timer = window.setTimeout(tick, 1000 - new Date().getMilliseconds() + 5)
    return () => window.clearTimeout(timer)
  }, [])

  return now
}

export function timeZoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')
  } catch {
    return 'Hora local'
  }
}

export const pad = (n: number) => String(n).padStart(2, '0')

export function formatClock(d: Date, withSeconds = true) {
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function formatStamp(ts: number) {
  const d = new Date(ts)
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`
}

/** A short relative stamp for the journal list: "Just now", "12 min ago", "Yesterday 23:40"… */
export function formatRelative(ts: number, now = Date.now()) {
  const diff = Math.max(0, now - ts)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const d = new Date(ts)
  const today = new Date(now)
  const yesterday = new Date(now - 86400000)
  if (d.toDateString() === today.toDateString()) return `Today ${timeFmt.format(d)}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${timeFmt.format(d)}`
  return formatStamp(ts)
}

/** Where we are in the night, for the hero's status line. */
export function nightPhase(d: Date) {
  const h = d.getHours()
  if (h >= 22 || h < 1) return 'The night is young'
  if (h < 4) return 'Deep night'
  if (h < 6) return 'Almost dawn'
  if (h < 18) return 'Daylight — rest, we open at dusk'
  return 'Dusk — doors opening'
}

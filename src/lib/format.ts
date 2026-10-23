export const pad = (n: number) => String(n).padStart(2, '0')

export function formatClock(d: Date, withSeconds = true) {
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
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

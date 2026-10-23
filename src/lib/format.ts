export const pad = (n: number) => String(n).padStart(2, '0')

export function formatClock(d: Date, withSeconds = true) {
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  return withSeconds ? `${base}:${pad(d.getSeconds())}` : base
}

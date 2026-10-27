/** The 3D plan's icon (from the prototype). */
export function PlanIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" className={className}>
      <path d="M7 1l6 3.5v5L7 13 1 9.5v-5z" />
      <path d="M1 4.5L7 8l6-3.5M7 8v5" />
    </svg>
  )
}

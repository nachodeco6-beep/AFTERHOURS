/** Small equaliser glyph. Animates only while audio is really playing. */
export function EqBars({ active, className = '' }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`inline-flex h-3 items-end gap-[2px] ${className}`}>
      {[0.55, 1, 0.7, 0.85].map((h, i) => (
        <span
          key={i}
          className="w-[2px] origin-bottom bg-current"
          style={{
            height: `${h * 100}%`,
            animation: active ? `eq 0.${7 + i}s ${i * 0.13}s ease-in-out infinite alternate` : 'none',
            transform: active ? undefined : 'scaleY(0.25)',
          }}
        />
      ))}
    </span>
  )
}

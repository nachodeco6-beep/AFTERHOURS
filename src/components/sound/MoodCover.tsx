import type { CSSProperties, ReactNode } from 'react'
import type { Mood } from '../../data/moods'

const W = 600

function Frame({ mood, children }: { mood: Mood; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="block h-full w-full" role="img" aria-label={`Cover artwork for ${mood.title}`}>
      <rect width={W} height={W} fill={mood.tint} />
      {children}
      {/* shared sleeve furniture */}
      <g fontFamily="'JetBrains Mono', monospace" fontSize="11" letterSpacing="1.6" fill="#F1F0E8" opacity="0.75">
        <text x="28" y="42">AFTERHOURS / SR-{mood.index}</text>
        <text x={W - 28} y="42" textAnchor="end">
          {mood.meta.tempo.toUpperCase()} · {mood.meta.key.toUpperCase()}
        </text>
      </g>
      <line x1="28" y1={W - 96} x2={W - 28} y2={W - 96} stroke="#F1F0E8" strokeOpacity="0.18" />
      <text
        x="28"
        y={W - 24}
        fontFamily="'Big Shoulders Display', 'Arial Narrow', sans-serif"
        fontWeight="900"
        fontSize="62"
        fill={mood.accent}
      >
        {mood.index}
      </text>
      <text
        x={W - 28}
        y={W - 24}
        textAnchor="end"
        fontFamily="'Big Shoulders Display', 'Arial Narrow', sans-serif"
        fontWeight="900"
        fontSize="62"
        fill="#F1F0E8"
        style={{ textTransform: 'uppercase' }}
      >
        {mood.title.toUpperCase()}
      </text>
    </svg>
  )
}

function MidnightDrive({ mood }: { mood: Mood }) {
  const a = mood.accent
  const vx = 300
  const vy = 250
  return (
    <Frame mood={mood}>
      <defs>
        <radialGradient id="md-glow" cx="50%" cy="42%" r="50%">
          <stop offset="0" stopColor={a} stopOpacity="0.55" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="md-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect width={W} height={W} fill="url(#md-glow)" />
      <line x1="0" y1={vy} x2={W} y2={vy} stroke={a} strokeOpacity="0.6" />
      {/* road edges and lane fan */}
      {[-1.6, -0.9, -0.35, 0.35, 0.9, 1.6].map((k) => (
        <line key={k} x1={vx} y1={vy} x2={vx + k * 300} y2={W} stroke={a} strokeOpacity={Math.abs(k) > 1 ? 0.9 : 0.35} strokeWidth="1.5" />
      ))}
      <path d={`M${vx} ${vy} L${vx - 480} ${W} L${vx + 480} ${W} Z`} fill="url(#md-road)" />
      {/* centre dashes — run only while playing */}
      <line className="cover-anim cover-dash" x1={vx} y1={vy} x2={vx} y2={W} stroke="#F1F0E8" strokeWidth="4" strokeDasharray="22 26" />
      {/* lamps */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const t = Math.pow(i / 6, 1.4)
        const x = 50 + (vx - 50) * t
        const y = 120 + (vy - 120) * t
        const r = 13 * (1 - t) + 3
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r * 3} fill={a} opacity="0.12" />
            <circle cx={x} cy={y} r={r * 0.6} fill="#FFE2C4" />
            <circle cx={W - x} cy={y} r={r * 3} fill={a} opacity="0.12" />
            <circle cx={W - x} cy={y} r={r * 0.6} fill="#FFE2C4" />
          </g>
        )
      })}
    </Frame>
  )
}

function DeepFocus({ mood }: { mood: Mood }) {
  const a = mood.accent
  return (
    <Frame mood={mood}>
      {/* Swiss grid */}
      {Array.from({ length: 11 }, (_, i) => (
        <g key={i} stroke="#F1F0E8" strokeOpacity="0.07">
          <line x1={i * 60} y1="0" x2={i * 60} y2={W} />
          <line x1="0" y1={i * 60} x2={W} y2={i * 60} />
        </g>
      ))}
      {[200, 150, 100, 50].map((r, i) => (
        <circle key={r} className="cover-anim cover-breathe" style={{ animationDelay: `${i * -1.2}s` }} cx="300" cy="280" r={r} fill="none" stroke={a} strokeOpacity={0.15 + i * 0.12} />
      ))}
      <circle cx="300" cy="280" r="8" fill={a} />
      <g className="cover-anim cover-orbit" style={{ transformOrigin: '300px 280px' }}>
        <circle cx="500" cy="280" r="7" fill="#F1F0E8" />
        <line x1="300" y1="280" x2="500" y2="280" stroke="#F1F0E8" strokeOpacity="0.25" strokeDasharray="2 6" />
      </g>
    </Frame>
  )
}

function OceanAtNight({ mood }: { mood: Mood }) {
  const a = mood.accent
  const wave = (y: number, amp: number, len: number) => {
    let d = `M -${len} ${y}`
    for (let x = -len; x <= W + len * 2; x += len / 2) {
      d += ` Q ${x + len / 4} ${y - amp} ${x + len / 2} ${y} T ${x + len} ${y}`
      x += len / 2
    }
    return d
  }
  return (
    <Frame mood={mood}>
      <defs>
        <radialGradient id="on-moon" cx="70%" cy="22%" r="40%">
          <stop offset="0" stopColor={a} stopOpacity="0.35" />
          <stop offset="1" stopColor={a} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={W} fill="url(#on-moon)" />
      <circle cx="420" cy="132" r="34" fill="#EDF6F3" />
      {Array.from({ length: 16 }, (_, i) => {
        const y = 250 + i * i * 1.05 + i * 8
        const len = 120 + i * 14
        return (
          <path
            key={i}
            className="cover-anim cover-wave"
            style={{ '--len': `${len}px`, animationDuration: `${7 + (i % 5)}s`, animationDirection: i % 2 ? 'reverse' : 'normal' } as CSSProperties}
            d={wave(y, 4 + i * 0.9, len)}
            fill="none"
            stroke={i % 4 === 0 ? a : '#F1F0E8'}
            strokeOpacity={0.15 + (i / 16) * 0.55}
            strokeWidth={0.8 + i * 0.08}
          />
        )
      })}
      <rect x="410" y="250" width="20" height="230" fill="#EDF6F3" opacity="0.08" />
    </Frame>
  )
}

function NoSleepClub({ mood }: { mood: Mood }) {
  const a = mood.accent
  const cells = 8
  const size = 48
  const ox = 300 - (cells * size) / 2
  const oy = 80
  const pattern = [3, 7, 12, 18, 21, 26, 30, 33, 37, 42, 44, 49, 55, 58, 61]
  return (
    <Frame mood={mood}>
      {Array.from({ length: cells * cells }, (_, i) => {
        const x = ox + (i % cells) * size
        const y = oy + Math.floor(i / cells) * size
        const on = pattern.includes(i)
        return (
          <rect
            key={i}
            x={x + 3}
            y={y + 3}
            width={size - 6}
            height={size - 6}
            fill={on ? a : 'none'}
            stroke={on ? 'none' : '#F1F0E8'}
            strokeOpacity="0.12"
            className={on ? 'cover-anim cover-strobe' : undefined}
            style={on ? { animationDelay: `${(i % 4) * 0.121}s` } : undefined}
          />
        )
      })}
    </Frame>
  )
}

const COVERS = {
  'midnight-drive': MidnightDrive,
  'deep-focus': DeepFocus,
  'ocean-at-night': OceanAtNight,
  'no-sleep-club': NoSleepClub,
}

export function MoodCover({ mood, playing }: { mood: Mood; playing: boolean }) {
  const Cover = COVERS[mood.id]
  return (
    <div className={`cover h-full w-full ${playing ? 'is-playing' : ''}`}>
      <Cover mood={mood} />
    </div>
  )
}

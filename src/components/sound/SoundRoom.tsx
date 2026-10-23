import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Pause, Play, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react'
import type { CSSProperties } from 'react'
import { MOODS } from '../../data/moods'
import { usePlayer, type PlaybackStatus } from '../../hooks/useAudioPlayer'
import { useTrackDurations } from '../../hooks/useTrackDurations'
import { formatDuration } from '../../lib/format'
import { EqBars } from '../EqBars'
import { Reveal } from '../Reveal'
import { SectionHeader } from '../SectionHeader'
import { MoodCover } from './MoodCover'
import { Spectrum } from './Spectrum'
import { Waveform } from './Waveform'

const STATUS_LABEL: Record<PlaybackStatus, string> = {
  idle: 'Not playing',
  loading: 'Loading',
  playing: 'Playing',
  paused: 'Paused',
  ended: 'Finished',
  error: 'Unavailable',
}

function StatusDot({ status }: { status: PlaybackStatus }) {
  const color = status === 'playing' ? 'bg-acid' : status === 'error' ? 'bg-alarm' : status === 'loading' ? 'bg-bone' : 'bg-dim'
  return (
    <span className="relative flex size-2" aria-hidden="true">
      {status === 'playing' && <span className="absolute inset-0 animate-ping bg-acid opacity-60" />}
      {status === 'loading' && <span className="absolute inset-0 animate-pulse bg-bone" />}
      <span className={`relative size-2 ${color}`} />
    </span>
  )
}

export function SoundRoom() {
  const player = usePlayer()
  const durations = useTrackDurations(MOODS)
  const { mood, status } = player
  const busy = status === 'playing' || status === 'loading'
  const known = Object.values(durations).filter((d): d is number => Number.isFinite(d))
  const total = known.length === MOODS.length ? formatDuration(known.reduce((a, b) => a + b, 0)) : null
  const VolumeIcon = player.muted || player.volume === 0 ? VolumeX : player.volume < 0.5 ? Volume1 : Volume2
  const volumePct = player.muted ? 0 : player.volume * 100

  return (
    <section
      id="sound-room"
      aria-labelledby="sound-room-title"
      className="relative isolate overflow-hidden py-24 md:py-32"
      style={{ '--mood': mood.accent } as CSSProperties}
    >
      {/* ambient glow that follows the selected mood */}
      <AnimatePresence>
        <motion.div
          key={mood.id}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: `radial-gradient(60% 50% at 25% 55%, ${mood.accent}1f, transparent 70%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4 }}
        />
      </AnimatePresence>

      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="sound-room" no="01" label="Sound Room" meta={total ? `4 moods · ${total}` : '4 moods'} title="Sound room">
          Four rooms of sound, each scored for a different kind of night. Every track was composed and synthesised for
          AFTERHOURS — pick a mood and let it fill the space.
        </SectionHeader>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* cover */}
          <Reveal className="min-w-0 lg:col-span-6">
            <div className="relative aspect-square w-full overflow-hidden bg-char">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={mood.id}
                  className="absolute inset-0"
                  initial={{ clipPath: 'inset(0 0 0 100%)' }}
                  animate={{ clipPath: 'inset(0 0 0 0%)' }}
                  exit={{ opacity: 0.4 }}
                  transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
                >
                  <MoodCover mood={mood} playing={player.isPlaying} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-mute">
              <p className="label">
                SR-{mood.index} <span className="text-dim">/</span> {mood.meta.texture}
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="Tags">
                {mood.tags.map((t) => (
                  <li key={t} className="label-sm border border-line px-2 py-1">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* list + detail + player */}
          <div className="flex min-w-0 flex-col lg:col-span-6">
            <Reveal delay={100}>
              <ol className="border-t border-line" aria-label="Moods">
                {MOODS.map((m) => {
                  const selected = m.id === mood.id
                  const d = durations[m.id]
                  const playingThis = selected && player.isPlaying
                  return (
                    <li key={m.id} className="border-b border-line">
                      <button
                        type="button"
                        onClick={() => player.select(m.id)}
                        aria-pressed={selected}
                        aria-label={`${playingThis ? 'Pause' : 'Play'} ${m.title}`}
                        data-cursor={playingThis ? 'Pause' : 'Play'}
                        className="group grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-3 py-4 text-left sm:grid-cols-[3rem_1fr_auto] md:py-5"
                        style={{ '--accent': m.accent } as CSSProperties}
                      >
                        <span className={`label transition-colors ${selected ? 'text-[var(--accent)]' : 'text-dim group-hover:text-bone'}`}>{m.index}</span>
                        <span
                          className={`display block text-[clamp(2.1rem,5.2vw,4.25rem)] transition-[color,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-2 ${
                            selected ? 'text-bone' : 'text-dim group-hover:text-bone'
                          }`}
                        >
                          {m.title}
                        </span>
                        <span className="flex items-center gap-3 text-mute">
                          <span className="label hidden tabular-nums md:inline">
                            {m.meta.tempo} <span className="text-dim">·</span> {d === undefined ? '--:--' : formatDuration(d)}
                          </span>
                          <span
                            className={`grid size-10 place-items-center border transition-colors ${
                              selected ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-line group-hover:border-bone group-hover:text-bone'
                            }`}
                            aria-hidden="true"
                          >
                            {playingThis ? <EqBars active /> : <Play className="size-3.5" fill="currentColor" strokeWidth={0} />}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </Reveal>

            <Reveal delay={160} className="mt-8 md:mt-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mood.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="grid gap-4 md:grid-cols-[1fr_1.4fr] md:gap-8"
                >
                  <p className="editorial text-[1.75rem] leading-[1.05] text-bone">{mood.kicker}</p>
                  <p className="text-[0.9375rem] leading-relaxed text-mute">{mood.description}</p>
                </motion.div>
              </AnimatePresence>
            </Reveal>

            {/* player */}
            <Reveal delay={220} className="mt-10 border border-line bg-char/70 p-4 sm:p-6 lg:mt-auto">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3" role="status" aria-live="polite">
                  <StatusDot status={status} />
                  <p className="label min-w-0 truncate">
                    <span className={status === 'playing' ? 'text-acid' : status === 'error' ? 'text-alarm' : 'text-bone'}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-dim"> — </span>
                    <span className="text-mute">{mood.title}</span>
                  </p>
                </div>
                <Spectrum accent={mood.accent} />
              </div>

              <div className="mt-6">
                <Waveform
                  peaks={mood.waveform}
                  accent={mood.accent}
                  currentTime={player.currentTime}
                  duration={player.duration}
                  onSeek={player.seek}
                  label={`Seek within ${mood.title}`}
                />
                <div className="mt-2 flex justify-between font-mono text-xs tabular-nums text-mute">
                  <span>{formatDuration(player.currentTime)}</span>
                  <span>{formatDuration(player.duration)}</span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={player.previous}
                    aria-label="Previous mood"
                    className="grid size-11 place-items-center border border-line text-mute transition-colors hover:border-bone hover:text-bone active:scale-95"
                  >
                    <SkipBack className="size-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={player.toggle}
                    aria-label={busy ? `Pause ${mood.title}` : `Play ${mood.title}`}
                    data-cursor={busy ? 'Pause' : 'Play'}
                    className="btn-fill grid size-14 place-items-center bg-acid text-ink transition-transform [--fill-color:var(--color-bone)] active:scale-95"
                  >
                    {busy ? <Pause className="size-5" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />}
                  </button>
                  <button
                    type="button"
                    onClick={player.next}
                    aria-label="Next mood"
                    className="grid size-11 place-items-center border border-line text-mute transition-colors hover:border-bone hover:text-bone active:scale-95"
                  >
                    <SkipForward className="size-4" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={player.toggleMute}
                    aria-label={player.muted ? 'Unmute' : 'Mute'}
                    aria-pressed={player.muted}
                    className="grid size-11 place-items-center text-mute transition-colors hover:text-bone"
                  >
                    <VolumeIcon className="size-[1.125rem]" strokeWidth={1.5} />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={player.muted ? 0 : player.volume}
                    onChange={(e) => player.setVolume(Number(e.target.value))}
                    aria-label="Volume"
                    aria-valuetext={`${Math.round(volumePct)}%`}
                    className="range w-28 sm:w-36"
                    style={{ '--fill': `${volumePct}%` } as CSSProperties}
                  />
                  <span className="label w-9 text-right tabular-nums text-dim">{Math.round(volumePct)}</span>
                </div>
              </div>

              {player.error && (
                <p role="alert" className="mt-5 flex items-start gap-2 border-t border-line pt-4 text-sm text-mute">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alarm" strokeWidth={1.5} aria-hidden="true" />
                  {player.error}
                </p>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MOODS, type MoodId } from '../data/moods'
import { PlayerContext, type PlayerApi, type PlayerState } from '../hooks/useAudioPlayer'

const VOLUME_KEY = 'afterhours.volume'

function readStoredVolume() {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.8
  } catch {
    return 0.8
  }
}

const moodById = (id: MoodId) => MOODS.find((m) => m.id === id) ?? MOODS[0]

/** Tells the visitor exactly which file is missing and how to restore it. */
function loadErrorMessage(audio: HTMLAudioElement) {
  const src = audio.currentSrc || audio.src
  const file = src ? new URL(src, location.href).pathname : '/audio/…'
  const local = `public/${file.slice(import.meta.env.BASE_URL.length)}`
  return `Couldn’t load ${file}. Add an MP3 at ${local} or run “npm run audio” to regenerate the tracks.`
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const graph = useRef<{ ctx: AudioContext; gain: GainNode; analyser: AnalyserNode } | null>(null)
  const [state, setState] = useState<PlayerState>(() => ({
    moodId: MOODS[0].id,
    status: 'idle',
    currentTime: 0,
    duration: NaN,
    volume: readStoredVolume(),
    muted: false,
    error: null,
  }))
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  const patch = useCallback((p: Partial<PlayerState>) => setState((s) => ({ ...s, ...p })), [])

  // One <audio> element for the whole site.
  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = moodById(stateRef.current.moodId).src
    audioRef.current = audio

    // Progress updates at ~30fps — smooth for the scrubber, cheap for React.
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 33) {
        last = t
        patch({ currentTime: audio.currentTime })
      }
      raf = requestAnimationFrame(loop)
    }
    const stopLoop = () => cancelAnimationFrame(raf)

    const on: Record<string, () => void> = {
      loadedmetadata: () => patch({ duration: audio.duration }),
      durationchange: () => patch({ duration: audio.duration }),
      playing: () => {
        patch({ status: 'playing', error: null })
        stopLoop()
        raf = requestAnimationFrame(loop)
      },
      pause: () => {
        stopLoop()
        if (!audio.ended) patch({ status: 'paused', currentTime: audio.currentTime })
      },
      waiting: () => patch({ status: 'loading' }),
      ended: () => {
        stopLoop()
        patch({ status: 'ended', currentTime: audio.duration })
      },
      seeked: () => patch({ currentTime: audio.currentTime }),
      error: () => {
        stopLoop()
        patch({ status: 'error', duration: NaN, error: loadErrorMessage(audio) })
      },
    }
    for (const [evt, fn] of Object.entries(on)) audio.addEventListener(evt, fn)
    return () => {
      stopLoop()
      for (const [evt, fn] of Object.entries(on)) audio.removeEventListener(evt, fn)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [patch])

  /**
   * Route the element through Web Audio on first play (needs a user gesture).
   * Volume is applied with a GainNode because iOS ignores HTMLMediaElement.volume.
   */
  const ensureGraph = useCallback(() => {
    const audio = audioRef.current
    if (graph.current || !audio) return graph.current
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    try {
      const ctx = new Ctor()
      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.82
      source.connect(gain).connect(analyser).connect(ctx.destination)
      const s = stateRef.current
      gain.gain.value = s.muted ? 0 : s.volume
      audio.volume = 1
      graph.current = { ctx, gain, analyser }
    } catch {
      graph.current = null
    }
    return graph.current
  }, [])

  const applyVolume = useCallback((volume: number, muted: boolean) => {
    const v = muted ? 0 : volume
    const g = graph.current
    if (g) g.gain.gain.setTargetAtTime(v, g.ctx.currentTime, 0.02)
    else if (audioRef.current) audioRef.current.volume = v
  }, [])

  const play = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const g = ensureGraph()
    if (g && g.ctx.state === 'suspended') void g.ctx.resume()
    if (stateRef.current.status === 'error') audio.load()
    if (audio.ended) audio.currentTime = 0
    patch({ status: 'loading', error: null })
    audio.play().catch((err: unknown) => {
      // The browser refused or the file is unreachable — never pretend otherwise.
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        patch({ status: 'paused', error: 'Playback was blocked by the browser. Press play again to start.' })
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        // superseded by a newer load(); the next state event will report truthfully
      } else {
        const unsupported = audio.error === null && err instanceof DOMException && err.name === 'NotSupportedError' && audio.readyState > 0
        patch({ status: 'error', error: unsupported ? 'This track’s format isn’t supported by your browser.' : loadErrorMessage(audio) })
      }
    })
  }, [ensureGraph, patch])

  const pause = useCallback(() => audioRef.current?.pause(), [])

  const toggle = useCallback(() => {
    const s = stateRef.current.status
    if (s === 'playing' || s === 'loading') pause()
    else play()
  }, [pause, play])

  const select = useCallback(
    (id: MoodId, autoplay = true) => {
      const audio = audioRef.current
      if (!audio) return
      if (id === stateRef.current.moodId) {
        if (autoplay) toggle()
        return
      }
      audio.pause()
      audio.src = moodById(id).src
      audio.load()
      patch({ moodId: id, currentTime: 0, duration: NaN, status: 'idle', error: null })
      if (autoplay) play()
    },
    [patch, play, toggle],
  )

  const step = useCallback(
    (dir: 1 | -1) => {
      const i = MOODS.findIndex((m) => m.id === stateRef.current.moodId)
      const next = MOODS[(i + dir + MOODS.length) % MOODS.length]
      const wasPlaying = stateRef.current.status === 'playing' || stateRef.current.status === 'loading'
      select(next.id, wasPlaying)
    },
    [select],
  )

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current
      if (!audio || !Number.isFinite(audio.duration)) return
      audio.currentTime = Math.max(0, Math.min(audio.duration, seconds))
      patch({ currentTime: audio.currentTime, ...(stateRef.current.status === 'ended' ? { status: 'paused' as const } : {}) })
    },
    [patch],
  )

  const setVolume = useCallback(
    (v: number) => {
      const volume = Math.max(0, Math.min(1, v))
      const muted = volume === 0
      applyVolume(volume, muted)
      patch({ volume, muted })
      try {
        if (volume > 0) localStorage.setItem(VOLUME_KEY, String(volume))
      } catch {
        // storage unavailable — volume still works for this session
      }
    },
    [applyVolume, patch],
  )

  const toggleMute = useCallback(() => {
    const { volume, muted } = stateRef.current
    const nextVolume = muted && volume === 0 ? 0.6 : volume
    applyVolume(nextVolume, !muted)
    patch({ muted: !muted, volume: nextVolume })
  }, [applyVolume, patch])

  const next = useCallback(() => step(1), [step])
  const previous = useCallback(() => step(-1), [step])
  const getAnalyser = useCallback(() => graph.current?.analyser ?? null, [])

  const api = useMemo<PlayerApi>(
    () => ({
      ...state,
      mood: moodById(state.moodId),
      isPlaying: state.status === 'playing',
      select,
      toggle,
      play,
      pause,
      seek,
      setVolume,
      toggleMute,
      next,
      previous,
      getAnalyser,
    }),
    [state, select, toggle, play, pause, seek, setVolume, toggleMute, next, previous, getAnalyser],
  )

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>
}


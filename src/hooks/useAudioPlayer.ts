import { createContext, useContext } from 'react'
import type { Mood, MoodId } from '../data/moods'

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

export interface PlayerState {
  moodId: MoodId
  status: PlaybackStatus
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  error: string | null
}

export interface PlayerApi extends PlayerState {
  mood: Mood
  isPlaying: boolean
  select: (id: MoodId, autoplay?: boolean) => void
  toggle: () => void
  play: () => void
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (v: number) => void
  toggleMute: () => void
  next: () => void
  previous: () => void
  /** Frequency analyser for the visualiser; null until the first user-initiated play. */
  getAnalyser: () => AnalyserNode | null
}

export const PlayerContext = createContext<PlayerApi | null>(null)

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>')
  return ctx
}

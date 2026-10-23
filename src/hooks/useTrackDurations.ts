import { useEffect, useState } from 'react'
import type { Mood, MoodId } from '../data/moods'

/** Reads each track's real duration from its metadata. NaN = not (yet) known. */
export function useTrackDurations(moods: Mood[]) {
  const [durations, setDurations] = useState<Partial<Record<MoodId, number>>>({})

  useEffect(() => {
    const probes = moods.map((m) => {
      const a = new Audio()
      a.preload = 'metadata'
      const done = (d: number) => setDurations((cur) => ({ ...cur, [m.id]: d }))
      a.addEventListener('loadedmetadata', () => done(a.duration), { once: true })
      a.addEventListener('error', () => done(NaN), { once: true })
      a.src = m.src
      return a
    })
    return () =>
      probes.forEach((a) => {
        a.removeAttribute('src')
        a.load()
      })
  }, [moods])

  return durations
}

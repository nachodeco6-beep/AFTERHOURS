import { useState } from 'react'

/** Work table of the labs (see WorkSurface): grid paper, neutral grey or black. */
export type Surface = 'paper' | 'gray' | 'black'

const KEY = 'afterhours.surface'

function read(): Surface {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'gray' || v === 'black' ? v : 'paper'
  } catch {
    return 'paper'
  }
}

/** The chosen surface, remembered in this browser (when it lets us). */
export function useSurface(): [Surface, (s: Surface) => void] {
  const [surface, setSurface] = useState<Surface>(read)
  const set = (s: Surface) => {
    setSurface(s)
    try {
      localStorage.setItem(KEY, s)
    } catch {
      // not remembered: still works for this visit
    }
  }
  return [surface, set]
}

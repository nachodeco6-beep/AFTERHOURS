import { useEffect, useState } from 'react'

/**
 * Minimal hash router: `#/` is the home page, `#/studio` the Studio, plus the
 * labs and the archive (`#/type-lab`, `#/color-lab`, `#/archivo`).
 * Hashes that don't start with `#/` are plain in-page anchors and leave the
 * current route alone; unknown routes fall back to home.
 */
export type RouteId = 'home' | 'studio' | 'type-lab' | 'color-lab' | 'archivo'

const PATHS: Record<string, RouteId> = { '/': 'home', '/studio': 'studio', '/type-lab': 'type-lab', '/color-lab': 'color-lab', '/archivo': 'archivo' }

export const TITLES: Record<RouteId, string> = {
  home: 'AFTERHOURS — From vision to visual',
  studio: 'Studio — AFTERHOURS',
  'type-lab': 'Type Lab — AFTERHOURS',
  'color-lab': 'Color Lab — AFTERHOURS',
  archivo: 'Mis tableros — AFTERHOURS',
}

export const routeHref = (route: RouteId) => (route === 'home' ? '#/' : `#/${route}`)

function parse(hash: string): RouteId | 'unknown' | null {
  if (!hash || hash === '#') return 'home'
  if (!hash.startsWith('#/')) return null
  const path = hash.slice(1).replace(/\/+$/, '') || '/'
  return PATHS[path] ?? 'unknown'
}

function resolve(hash: string, current: RouteId): RouteId {
  const parsed = parse(hash)
  if (parsed === null) return current
  if (parsed === 'unknown') {
    history.replaceState(null, '', routeHref('home'))
    return 'home'
  }
  return parsed
}

export function useRoute() {
  const [route, setRoute] = useState<RouteId>(() => resolve(location.hash, 'home'))

  useEffect(() => {
    const onChange = () => setRoute((current) => resolve(location.hash, current))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route
}

/** Scroll without the page-wide smooth behaviour (route changes should land instantly). */
export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'instant' })
}

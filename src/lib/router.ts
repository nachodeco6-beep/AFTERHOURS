/**
 * Minimal hash router: `#/` is the home page, `#/studio` the Studio, plus the
 * labs and the Library (`#/type-lab`, `#/color-lab`, `#/library`). Routes that
 * moved (`#/archivo` → `#/library`) are redirected, so old links still work.
 * Hashes that don't start with `#/` are plain in-page anchors and leave the
 * current route alone; unknown routes fall back to home.
 */
import { useEffect, useState } from 'react'
import { parseRoute, type RouteId } from './routes'

export { parseRoute, routeHref, TITLES, type RouteId } from './routes'

function resolve(hash: string, current: RouteId): RouteId {
  const parsed = parseRoute(hash)
  if (parsed === null) return current
  if (parsed.replace) history.replaceState(null, '', parsed.replace)
  return parsed.route
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

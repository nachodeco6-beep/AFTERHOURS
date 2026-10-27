/**
 * The routes of the app and how a hash maps to one. Pure (no DOM), so it can be tested.
 */
export type RouteId = 'home' | 'studio' | 'type-lab' | 'color-lab' | 'library'

const PATHS: Record<string, RouteId> = { '/': 'home', '/studio': 'studio', '/type-lab': 'type-lab', '/color-lab': 'color-lab', '/library': 'library' }

/** Old paths and where they live now. */
const MOVED: Record<string, RouteId> = { '/archivo': 'library' }

export const TITLES: Record<RouteId, string> = {
  home: 'AFTERHOURS — From vision to visual',
  studio: 'Studio — AFTERHOURS',
  'type-lab': 'Type Lab — AFTERHOURS',
  'color-lab': 'Color Lab — AFTERHOURS',
  library: 'Library — AFTERHOURS',
}

export const routeHref = (route: RouteId) => (route === 'home' ? '#/' : `#/${route}`)

/**
 * Where a hash leads: the route, and the address to put instead when it's an
 * old path (redirect) or an unknown one (home). null = an in-page anchor.
 */
export function parseRoute(hash: string): { route: RouteId; replace: string | null } | null {
  if (!hash || hash === '#') return { route: 'home', replace: null }
  if (!hash.startsWith('#/')) return null
  const path = hash.slice(1).replace(/\/+$/, '') || '/'
  const route = PATHS[path]
  if (route) return { route, replace: null }
  const moved = MOVED[path]
  if (moved) return { route: moved, replace: routeHref(moved) }
  return { route: 'home', replace: routeHref('home') }
}

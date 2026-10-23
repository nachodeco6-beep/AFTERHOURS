import type { RouteId } from '../lib/router'

export interface NavItem {
  route: RouteId
  no: string
  label: string
  blurb: string
}

/** Only views that exist. Stage 3 adds «Archive». */
export const NAV: NavItem[] = [
  { route: 'home', no: '00', label: 'Inicio', blurb: 'From vision to visual' },
  { route: 'studio', no: '01', label: 'Studio', blurb: 'Escribí una idea y buscá fotografías reales' },
]

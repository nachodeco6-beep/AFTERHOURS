import type { RouteId } from '../lib/router'

export interface NavItem {
  route: RouteId
  no: string
  label: string
  blurb: string
}

/** Only views that exist. Numbers match the rooms of the 3D plan. */
export const NAV: NavItem[] = [
  { route: 'home', no: '00', label: 'Inicio', blurb: 'From vision to visual' },
  { route: 'studio', no: '01', label: 'Studio', blurb: 'Escribí una idea y buscá fotografías reales' },
  { route: 'type-lab', no: '02', label: 'Type Lab', blurb: 'Las tipografías de tu tablero' },
  { route: 'color-lab', no: '03', label: 'Color Lab', blurb: 'La paleta de tu tablero' },
  { route: 'archivo', no: '04', label: 'Archivo', blurb: 'Tus tableros guardados' },
]

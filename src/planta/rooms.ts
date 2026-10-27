/** The rooms of the 3D plan (names, texts, where they sit). Pure: no three.js. */
import type { RoomId } from './state.ts'

export { ROOM_ROUTE, roomOfRoute, type RoomId } from './state.ts'
export type { PlantaAction, PlantaState } from './state.ts'

export interface Room {
  id: RoomId
  /** [x, y, width, height] on the sketch's 1000 × 680 plan. */
  rect: [number, number, number, number]
  no: string
  name: string
  desc: string
  who: string
  /** Height of the sign above the floor (3D units). */
  tagY: number
  /** Under construction: shown, not enterable. */
  obra?: boolean
}

/** In the prototype's order (it decides how signs stack). */
export const ROOMS: Room[] = [
  { id: 'archivo', rect: [0, 0, 300, 380], no: '04', name: 'Archivo', desc: 'Tus tableros guardados', who: 'Adentro: Don Ernesto, el archivista', tagY: 2.45 },
  { id: 'hall', rect: [0, 380, 300, 300], no: '00', name: 'Hall', desc: 'La portada', who: 'Adentro: Lola, que te recibe', tagY: 2.2 },
  { id: 'studio', rect: [300, 0, 420, 680], no: '01', name: 'Studio', desc: 'Idea, referencias y moodboard', who: 'Adentro: Tomi y Pixel, el gato', tagY: 2.55 },
  { id: 'type', rect: [720, 0, 280, 230], no: '02', name: 'Type Lab', desc: 'Tipografías que conectan', who: 'Adentro: Vera, que dibuja letras', tagY: 2.5 },
  { id: 'color', rect: [720, 230, 280, 230], no: '03', name: 'Color Lab', desc: 'Paletas que funcionan', who: 'Adentro: Bruno, que prueba colores', tagY: 2.3 },
  { id: 'taller', rect: [720, 460, 280, 220], no: '05', name: 'Taller', desc: 'En obra', who: 'Adentro: el Tano, que arma el taller', tagY: 2.4, obra: true },
]

export const roomById = (id: RoomId) => ROOMS.find((r) => r.id === id) as Room

/** What the current board lends the house (bonus): type pair, palette, photo colours. */
export interface PlantaTheme {
  /** Headline and text fonts of the board's pair, as CSS font shorthands' family + weight. */
  type: { display: string; displayWeight: number; text: string } | null
  palette: string[] | null
  photoColors: string[]
}

export const NO_THEME: PlantaTheme = { type: null, palette: null, photoColors: [] }

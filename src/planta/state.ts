/**
 * Opening and closing the 3D plan, and where each room leads. Tiny and pure:
 * it's all the app shell carries of the plan (the rest loads on demand).
 */
export type RoomId = 'library' | 'hall' | 'studio' | 'type' | 'color' | 'taller'

/** Where each room leads in the app; null = under construction. */
export const ROOM_ROUTE: Record<RoomId, string | null> = {
  hall: '#/',
  studio: '#/studio',
  type: '#/type-lab',
  color: '#/color-lab',
  library: '#/library',
  taller: null,
}

/** Routes that moved: the old one still leads to the same room. */
const MOVED: Record<string, string> = { '#/archivo': '#/library' }

/** The room of a route (to start the plan on the room you're in). */
export function roomOfRoute(hash: string): RoomId {
  const trimmed = (hash || '#/').replace(/\/+$/, '')
  const clean = MOVED[trimmed] ?? (trimmed === '' || trimmed === '#' ? '#/' : trimmed)
  const hit = (Object.entries(ROOM_ROUTE) as [RoomId, string | null][]).find(([, route]) => route && (route === clean || (route !== '#/' && clean.startsWith(route))))
  return hit ? hit[0] : clean === '#/' ? 'hall' : 'studio'
}

// ─── Open / close ───────────────────────────────────────────────────────────

export interface PlantaState {
  open: boolean
  /** The route to come back to when closing. */
  returnTo: string
  /** A room the camera flew into (Escape first flies back out). */
  focused: RoomId | null
}

export type PlantaAction =
  | { type: 'open'; from: string }
  | { type: 'focus'; room: RoomId }
  | { type: 'unfocus' }
  | { type: 'escape' }
  | { type: 'close' }
  /** The flight into a room ended: go there. */
  | { type: 'entered'; room: RoomId }

export const CLOSED: PlantaState = { open: false, returnTo: '#/', focused: null }

/** Effects the shell must carry out after a transition. */
export interface PlantaEffect {
  navigate?: string
}

export function plantaReducer(state: PlantaState, action: PlantaAction): [PlantaState, PlantaEffect] {
  switch (action.type) {
    case 'open':
      return [{ open: true, returnTo: action.from || '#/', focused: null }, {}]
    case 'focus':
      return ROOM_ROUTE[action.room] === null ? [state, {}] : [{ ...state, focused: action.room }, {}]
    case 'unfocus':
      return [{ ...state, focused: null }, {}]
    case 'escape':
      // first out of the room, then out of the plan, back where you were
      if (state.focused) return [{ ...state, focused: null }, {}]
      return [CLOSED, { navigate: state.returnTo }]
    case 'close':
      return [CLOSED, { navigate: state.returnTo }]
    case 'entered': {
      const route = ROOM_ROUTE[action.room]
      return route ? [CLOSED, { navigate: route }] : [state, {}]
    }
  }
}

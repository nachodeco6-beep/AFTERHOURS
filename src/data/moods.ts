/** «Climas»: the moods the labs filter by, shared by the type pairs and the inspiration palettes. */
export type Mood = 'editorial' | 'urbano' | 'lujo' | 'retro' | 'tecnico' | 'calido' | 'experimental'

export const MOODS: Mood[] = ['editorial', 'urbano', 'lujo', 'retro', 'tecnico', 'calido', 'experimental']

export const MOOD_LABEL: Record<Mood, string> = {
  editorial: 'Editorial',
  urbano: 'Urbano',
  lujo: 'Lujo',
  retro: 'Retro',
  tecnico: 'Técnico',
  calido: 'Cálido',
  experimental: 'Experimental',
}

export const isMood = (v: unknown): v is Mood => MOODS.includes(v as Mood)

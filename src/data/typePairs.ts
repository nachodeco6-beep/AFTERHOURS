import type { CSSProperties } from 'react'

/** One font of a pair, as Google Fonts serves it. */
export interface FontSpec {
  family: string
  /** Generic fallback while the font loads. */
  kind: 'serif' | 'sans' | 'mono' | 'script'
  /** Weight to load and show; 400 when omitted. */
  weight?: number
  /** Google Fonts css2 `family=` value when the default (regular 400, or `weight`) isn't enough. */
  query?: string
  /** How the font must be set to show the requested cut (italic, SOFT axis, expanded width). */
  style?: Pick<CSSProperties, 'fontStyle' | 'fontStretch' | 'fontVariationSettings'>
}

export interface TypePair {
  id: number
  display: FontSpec
  text: FontSpec
  category: string
  tags: string[]
  /** Nacho's own picks: they win ties. */
  nacho: boolean
}

/** Headline + text pairs, all from Google Fonts. Order matters: earlier pairs win remaining ties. */
export const TYPE_PAIRS: TypePair[] = [
  { id: 1, display: { family: 'Playfair Display', kind: 'serif' }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Lujo y moda', tags: ['lujo', 'moda', 'sensual', 'elegante'], nacho: true },
  { id: 2, display: { family: 'Bodoni Moda', kind: 'serif', query: 'Bodoni+Moda:ital,wght@1,400..900', style: { fontStyle: 'italic' } }, text: { family: 'Inter', kind: 'sans' }, category: 'Editorial', tags: ['editorial', 'elegante', 'moderno', 'masculino'], nacho: true },
  { id: 3, display: { family: 'Cormorant Garamond', kind: 'serif' }, text: { family: 'Lato', kind: 'sans' }, category: 'Editorial', tags: ['clásico', 'arquitectura', 'sereno', 'atemporal'], nacho: true },
  { id: 4, display: { family: 'Bodoni Moda', kind: 'serif' }, text: { family: 'Open Sans', kind: 'sans' }, category: 'Lujo y moda', tags: ['lujo', 'moda', 'clásico', 'revista'], nacho: true },
  { id: 5, display: { family: 'Permanent Marker', kind: 'script' }, text: { family: 'Questrial', kind: 'sans' }, category: 'Urbano', tags: ['urbano', 'juvenil', 'pop', 'callejero'], nacho: true },
  { id: 6, display: { family: 'Fraunces', kind: 'serif', weight: 900, query: 'Fraunces:wght,SOFT@400..900,0..100', style: { fontVariationSettings: "'SOFT' 100" } }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Retro', tags: ['retro', '70s', 'cálido', 'floral'], nacho: true },
  { id: 7, display: { family: 'Cinzel', kind: 'serif', weight: 600 }, text: { family: 'Open Sans', kind: 'sans' }, category: 'Natural', tags: ['natural', 'clásico', 'orgánico', 'sobrio'], nacho: true },
  { id: 8, display: { family: 'Alfa Slab One', kind: 'serif' }, text: { family: 'Archivo', kind: 'sans', query: 'Archivo:wdth,wght@62..125,400..700', style: { fontStretch: '125%' } }, category: 'Deporte', tags: ['deporte', 'college', 'americano', 'potente'], nacho: true },
  { id: 9, display: { family: 'Bebas Neue', kind: 'sans' }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Urbano', tags: ['urbano', 'street', 'techno', 'gráfico'], nacho: true },
  { id: 10, display: { family: 'Abril Fatface', kind: 'serif' }, text: { family: 'Josefin Sans', kind: 'sans' }, category: 'Romántico', tags: ['romántico', 'primavera', 'femenino', 'delicado'], nacho: true },
  { id: 11, display: { family: 'Gloock', kind: 'serif' }, text: { family: 'Outfit', kind: 'sans' }, category: 'Editorial', tags: ['británico', 'institucional', 'clásico', 'editorial'], nacho: true },
  { id: 12, display: { family: 'Mrs Saint Delafield', kind: 'script' }, text: { family: 'Outfit', kind: 'sans' }, category: 'Verano', tags: ['fresco', 'verano', 'frutal', 'femenino'], nacho: true },
  { id: 13, display: { family: 'Bodoni Moda', kind: 'serif' }, text: { family: 'Jost', kind: 'sans' }, category: 'Lujo y moda', tags: ['alta costura', 'minimal', 'moda'], nacho: false },
  { id: 14, display: { family: 'DM Serif Display', kind: 'serif' }, text: { family: 'Inter', kind: 'sans' }, category: 'Editorial', tags: ['editorial', 'revista', 'moderno'], nacho: false },
  { id: 15, display: { family: 'Libre Caslon Display', kind: 'serif' }, text: { family: 'Libre Franklin', kind: 'sans' }, category: 'Editorial', tags: ['periodismo', 'clásico', 'editorial'], nacho: false },
  { id: 16, display: { family: 'Italiana', kind: 'serif' }, text: { family: 'Raleway', kind: 'sans' }, category: 'Lujo y moda', tags: ['lujo', 'perfume', 'delicado'], nacho: false },
  { id: 17, display: { family: 'Marcellus', kind: 'serif' }, text: { family: 'Nunito Sans', kind: 'sans' }, category: 'Natural', tags: ['spa', 'sereno', 'bienestar'], nacho: false },
  { id: 18, display: { family: 'Prata', kind: 'serif' }, text: { family: 'Lato', kind: 'sans' }, category: 'Lujo y moda', tags: ['joyería', 'elegante', 'clásico'], nacho: false },
  { id: 19, display: { family: 'Gilda Display', kind: 'serif' }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Romántico', tags: ['boda', 'romántico', 'lujo'], nacho: false },
  { id: 20, display: { family: 'Newsreader', kind: 'serif' }, text: { family: 'Inter', kind: 'sans' }, category: 'Editorial', tags: ['literario', 'periodismo', 'sobrio'], nacho: false },
  { id: 21, display: { family: 'Archivo Black', kind: 'sans' }, text: { family: 'IBM Plex Mono', kind: 'mono' }, category: 'Urbano', tags: ['brutalista', 'techno', 'crudo'], nacho: false },
  { id: 22, display: { family: 'Anton', kind: 'sans' }, text: { family: 'Space Mono', kind: 'mono' }, category: 'Urbano', tags: ['póster', 'protesta', 'urbano'], nacho: false },
  { id: 23, display: { family: 'Big Shoulders Display', kind: 'sans' }, text: { family: 'Inter Tight', kind: 'sans' }, category: 'Oscuro y cine', tags: ['industrial', 'nocturno', 'techno'], nacho: false },
  { id: 24, display: { family: 'Oswald', kind: 'sans' }, text: { family: 'Roboto', kind: 'sans' }, category: 'Deporte', tags: ['deporte', 'urbano', 'gráfico'], nacho: false },
  { id: 25, display: { family: 'Rubik Mono One', kind: 'mono' }, text: { family: 'Rubik', kind: 'sans' }, category: 'Pop', tags: ['pop', 'gamer', 'juvenil'], nacho: false },
  { id: 26, display: { family: 'Bungee', kind: 'sans' }, text: { family: 'Work Sans', kind: 'sans' }, category: 'Urbano', tags: ['señalética', 'street', 'urbano'], nacho: false },
  { id: 27, display: { family: 'Monoton', kind: 'sans' }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Retro', tags: ['neón', 'disco', 'noche'], nacho: false },
  { id: 28, display: { family: 'Orbitron', kind: 'sans' }, text: { family: 'Exo 2', kind: 'sans' }, category: 'Tech', tags: ['futurista', 'sci-fi', 'gamer'], nacho: false },
  { id: 29, display: { family: 'Sora', kind: 'sans' }, text: { family: 'Inter', kind: 'sans' }, category: 'Tech', tags: ['startup', 'tecnología', 'limpio'], nacho: false },
  { id: 30, display: { family: 'Chakra Petch', kind: 'sans' }, text: { family: 'Barlow', kind: 'sans' }, category: 'Tech', tags: ['cyber', 'tech', 'industrial'], nacho: false },
  { id: 31, display: { family: 'JetBrains Mono', kind: 'mono' }, text: { family: 'Inter Tight', kind: 'sans' }, category: 'Tech', tags: ['código', 'digital', 'minimal'], nacho: false },
  { id: 32, display: { family: 'Michroma', kind: 'sans' }, text: { family: 'Manrope', kind: 'sans' }, category: 'Tech', tags: ['automotor', 'futurista', 'premium'], nacho: false },
  { id: 33, display: { family: 'Shrikhand', kind: 'serif' }, text: { family: 'Karla', kind: 'sans' }, category: 'Retro', tags: ['retro', '70s', 'divertido'], nacho: false },
  { id: 34, display: { family: 'Righteous', kind: 'sans' }, text: { family: 'Poppins', kind: 'sans' }, category: 'Retro', tags: ['80s', 'retro', 'pop'], nacho: false },
  { id: 35, display: { family: 'Bowlby One SC', kind: 'sans' }, text: { family: 'Rubik', kind: 'sans' }, category: 'Deporte', tags: ['deporte retro', '70s', 'potente'], nacho: false },
  { id: 36, display: { family: 'Rye', kind: 'serif' }, text: { family: 'Lora', kind: 'serif' }, category: 'Retro', tags: ['western', 'vintage', 'rústico'], nacho: false },
  { id: 37, display: { family: 'Limelight', kind: 'serif' }, text: { family: 'Raleway', kind: 'sans' }, category: 'Retro', tags: ['art déco', 'años 20', 'glamour'], nacho: false },
  { id: 38, display: { family: 'Poiret One', kind: 'sans' }, text: { family: 'Lato', kind: 'sans' }, category: 'Retro', tags: ['art déco', 'delicado', 'años 20'], nacho: false },
  { id: 39, display: { family: 'Lobster', kind: 'script' }, text: { family: 'Open Sans', kind: 'sans' }, category: 'Retro', tags: ['diner', 'americano', 'retro'], nacho: false },
  { id: 40, display: { family: 'Pacifico', kind: 'script' }, text: { family: 'Quicksand', kind: 'sans' }, category: 'Verano', tags: ['surf', 'playa', 'relajado'], nacho: false },
  { id: 41, display: { family: 'Yeseva One', kind: 'serif' }, text: { family: 'Josefin Sans', kind: 'sans' }, category: 'Romántico', tags: ['vintage', 'boutique', 'femenino'], nacho: false },
  { id: 42, display: { family: 'Lora', kind: 'serif' }, text: { family: 'Source Sans 3', kind: 'sans' }, category: 'Natural', tags: ['cálido', 'literario', 'natural'], nacho: false },
  { id: 43, display: { family: 'Young Serif', kind: 'serif' }, text: { family: 'Nunito', kind: 'sans' }, category: 'Natural', tags: ['orgánico', 'café', 'artesanal'], nacho: false },
  { id: 44, display: { family: 'Gelasio', kind: 'serif' }, text: { family: 'Mulish', kind: 'sans' }, category: 'Natural', tags: ['cálido', 'suave', 'editorial'], nacho: false },
  { id: 45, display: { family: 'Amatic SC', kind: 'script' }, text: { family: 'Josefin Sans', kind: 'sans' }, category: 'Natural', tags: ['artesanal', 'feria', 'rústico'], nacho: false },
  { id: 46, display: { family: 'Caveat', kind: 'script' }, text: { family: 'Nunito', kind: 'sans' }, category: 'Pop', tags: ['manuscrito', 'cercano', 'cuaderno'], nacho: false },
  { id: 47, display: { family: 'Schibsted Grotesk', kind: 'sans' }, text: { family: 'Inter', kind: 'sans' }, category: 'Minimal', tags: ['suizo', 'minimal', 'corporativo'], nacho: false },
  { id: 48, display: { family: 'Hanken Grotesk', kind: 'sans' }, text: { family: 'Spectral', kind: 'serif' }, category: 'Minimal', tags: ['minimal', 'sobrio', 'arquitectura'], nacho: false },
  { id: 49, display: { family: 'Outfit', kind: 'sans' }, text: { family: 'Merriweather', kind: 'serif' }, category: 'Minimal', tags: ['moderno', 'legible', 'amable'], nacho: false },
  { id: 50, display: { family: 'Teko', kind: 'sans' }, text: { family: 'Barlow', kind: 'sans' }, category: 'Deporte', tags: ['deporte', 'fitness', 'energía'], nacho: false },
  { id: 51, display: { family: 'Saira Condensed', kind: 'sans' }, text: { family: 'Saira', kind: 'sans' }, category: 'Deporte', tags: ['racing', 'motor', 'velocidad'], nacho: false },
  { id: 52, display: { family: 'Graduate', kind: 'sans' }, text: { family: 'Roboto Condensed', kind: 'sans' }, category: 'Deporte', tags: ['college', 'universitario', 'americano'], nacho: false },
  { id: 53, display: { family: 'Unica One', kind: 'sans' }, text: { family: 'Crimson Text', kind: 'serif' }, category: 'Oscuro y cine', tags: ['cine', 'misterio', 'noir'], nacho: false },
  { id: 54, display: { family: 'Special Elite', kind: 'script' }, text: { family: 'Courier Prime', kind: 'mono' }, category: 'Oscuro y cine', tags: ['máquina de escribir', 'policial', 'archivo'], nacho: false },
  { id: 55, display: { family: 'UnifrakturMaguntia', kind: 'sans' }, text: { family: 'EB Garamond', kind: 'serif' }, category: 'Oscuro y cine', tags: ['gótico', 'metal', 'oscuro'], nacho: false },
  { id: 56, display: { family: 'Pirata One', kind: 'sans' }, text: { family: 'Libre Baskerville', kind: 'serif' }, category: 'Oscuro y cine', tags: ['tatuaje', 'rock', 'gótico'], nacho: false },
  { id: 57, display: { family: 'Bagel Fat One', kind: 'sans' }, text: { family: 'DM Sans', kind: 'sans' }, category: 'Pop', tags: ['pop', 'dulce', 'juvenil'], nacho: false },
  { id: 58, display: { family: 'Fredoka', kind: 'sans' }, text: { family: 'Nunito', kind: 'sans' }, category: 'Pop', tags: ['amigable', 'infantil', 'redondo'], nacho: false },
  { id: 59, display: { family: 'Lilita One', kind: 'sans' }, text: { family: 'Open Sans', kind: 'sans' }, category: 'Verano', tags: ['playa', 'divertido', 'verano'], nacho: false },
  { id: 60, display: { family: 'Great Vibes', kind: 'script' }, text: { family: 'Cormorant Garamond', kind: 'serif' }, category: 'Romántico', tags: ['boda', 'invitación', 'romántico'], nacho: false },
  { id: 61, display: { family: 'Sedgwick Ave Display', kind: 'script' }, text: { family: 'Roboto Mono', kind: 'mono' }, category: 'Urbano', tags: ['graffiti', 'hip hop', 'street'], nacho: false },
  { id: 62, display: { family: 'Syncopate', kind: 'sans' }, text: { family: 'Montserrat', kind: 'sans' }, category: 'Minimal', tags: ['arquitectura', 'moderno', 'galería'], nacho: false },
]

/** Neutral editorial pick (Nacho) when the concept matches nothing: Cormorant Garamond + Lato. */
export const DEFAULT_PAIR_ID = 3

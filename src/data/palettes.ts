import type { Mood } from './moods.ts'

export interface InspirationPalette {
  id: string
  name: string
  mood: Mood
  /** Five colours, in the order they read best (often background first). */
  colors: [string, string, string, string, string]
  /** Comes from AFTERHOURS's own identity. */
  brand?: boolean
}

/** Palettes made by hand for the Color Lab's «Inspiración». The brand's come first. */
export const PALETTES: InspirationPalette[] = [
  // ── de la marca
  { id: 'after-hours', name: 'After hours', mood: 'urbano', colors: ['#090909', '#F1F0E8', '#C7FF3D', '#2A2A28', '#8F8E87'], brand: true },
  { id: 'acido-y-alarma', name: 'Ácido y alarma', mood: 'experimental', colors: ['#0B0D12', '#1F3A63', '#C7FF3D', '#FF5A3C', '#F1F0E8'], brand: true },

  // ── editorial
  { id: 'revista-suiza', name: 'Revista suiza', mood: 'editorial', colors: ['#F2F0EB', '#111111', '#E3001B', '#9C9A94', '#D2CCBE'] },
  { id: 'papel-y-tinta', name: 'Papel y tinta', mood: 'editorial', colors: ['#F4EFE6', '#1B1B1B', '#6B6255', '#B8AE9C', '#2F3E4E'] },
  { id: 'diario-de-domingo', name: 'Diario de domingo', mood: 'editorial', colors: ['#ECE7DC', '#222222', '#8B1E1E', '#5C5C5C', '#C3B8A4'] },
  { id: 'galeria-blanca', name: 'Galería blanca', mood: 'editorial', colors: ['#FBFBF8', '#1E1E1E', '#B5B1A8', '#D8D2C4', '#3F6F8F'] },
  { id: 'tipografia-de-museo', name: 'Tipografía de museo', mood: 'editorial', colors: ['#EDE8DF', '#0F2A44', '#C4572C', '#8A9BA8', '#2E2E2E'] },
  { id: 'archivo-gris', name: 'Archivo gris', mood: 'editorial', colors: ['#E6E4DF', '#9A9893', '#4D4C49', '#1A1A19', '#C8402C'] },
  { id: 'bauhaus', name: 'Bauhaus', mood: 'editorial', colors: ['#F0E9DA', '#1A1A1A', '#D62828', '#F2B705', '#1F4E9C'] },
  { id: 'catalogo-de-arquitectura', name: 'Catálogo de arquitectura', mood: 'editorial', colors: ['#E9E6E1', '#2B2B2B', '#7D8C8A', '#C2B49A', '#A44A3F'] },

  // ── urbano
  { id: 'neon-y-asfalto', name: 'Neón y asfalto', mood: 'urbano', colors: ['#121417', '#2E333B', '#FF2E88', '#00E5FF', '#E8E8E8'] },
  { id: 'techno-de-madrugada', name: 'Techno de madrugada', mood: 'urbano', colors: ['#07070A', '#26263A', '#6C2BD9', '#00F0B5', '#D9D9E3'] },
  { id: 'hormigon', name: 'Hormigón', mood: 'urbano', colors: ['#C4C1BA', '#8C8A85', '#5B5A56', '#2C2C2B', '#F26B1D'] },
  { id: 'subte', name: 'Subte', mood: 'urbano', colors: ['#1D1D1B', '#F5C400', '#E4E2DC', '#6A6A66', '#0067B1'] },
  { id: 'grafiti', name: 'Grafiti', mood: 'urbano', colors: ['#141414', '#FF4F00', '#2DE1C2', '#FFE14D', '#F2F2F2'] },
  { id: 'skate-park', name: 'Skate park', mood: 'urbano', colors: ['#D9D6CF', '#3A3A3A', '#E63946', '#457B9D', '#1D3557'] },
  { id: 'colectivo', name: 'Colectivo de barrio', mood: 'urbano', colors: ['#F2EDE4', '#1E3A5F', '#E94F37', '#F6BD60', '#2B2B2B'] },
  { id: 'fabrica', name: 'Fábrica', mood: 'urbano', colors: ['#2E2C29', '#6E6A62', '#C9C2B6', '#B33F1A', '#F3EFE7'] },

  // ── lujo
  { id: 'champagne', name: 'Champagne', mood: 'lujo', colors: ['#F5EFE4', '#DCC7A1', '#B8956A', '#3A2F25', '#121212'] },
  { id: 'terciopelo', name: 'Terciopelo', mood: 'lujo', colors: ['#1A0F14', '#4A1428', '#8C2F39', '#D4A373', '#F2E8DC'] },
  { id: 'marmol', name: 'Mármol', mood: 'lujo', colors: ['#F4F3EF', '#D2CFC8', '#8E8B84', '#2B2A28', '#B89B5E'] },
  { id: 'joyeria', name: 'Joyería', mood: 'lujo', colors: ['#0E1A2B', '#1F4E5F', '#C9A227', '#E8E1D3', '#6B1E3A'] },
  { id: 'perfume', name: 'Perfume', mood: 'lujo', colors: ['#E2CDD6', '#C08DA0', '#6E3B52', '#2A1B22', '#F7F2EE'] },
  { id: 'noche-de-gala', name: 'Noche de gala', mood: 'lujo', colors: ['#0A0A0A', '#2E261C', '#D4AF37', '#F0E6D2', '#7A6A53'] },
  { id: 'hotel-del-lago', name: 'Hotel del lago', mood: 'lujo', colors: ['#C9D6D0', '#8FA8A0', '#2F4A47', '#C2A878', '#F5F2EA'] },
  { id: 'cuero-y-bronce', name: 'Cuero y bronce', mood: 'lujo', colors: ['#2B1D14', '#6F4A2F', '#B07D4F', '#E9DCC9', '#1C3A3A'] },

  // ── retro
  { id: 'surf-90s', name: 'Surf 90s', mood: 'retro', colors: ['#00A6A6', '#F4D35E', '#EE6352', '#0D3B66', '#FAF0CA'] },
  { id: 'disco-70s', name: 'Disco 70s', mood: 'retro', colors: ['#3D1E6D', '#E94E77', '#F7A541', '#F3E9D2', '#1B998B'] },
  { id: 'kodachrome', name: 'Kodachrome', mood: 'retro', colors: ['#C1440E', '#F2C14E', '#2B4162', '#E8DCC4', '#6C8EAD'] },
  { id: 'pastel-lavado', name: 'Pastel lavado', mood: 'retro', colors: ['#F3D1C8', '#CFE3D8', '#D7D0EA', '#F6E7B4', '#5B5560'] },
  { id: 'fotonovela', name: 'Fotonovela', mood: 'retro', colors: ['#E7C8A0', '#C0392B', '#2C3E50', '#F5EBDD', '#8E6C4A'] },
  { id: 'diner', name: 'Diner americano', mood: 'retro', colors: ['#D7263D', '#F4F1E1', '#1B998B', '#2E294E', '#F49D37'] },
  { id: 'formica', name: 'Fórmica', mood: 'retro', colors: ['#E8D9B5', '#D96C3B', '#4F8A8B', '#2D2D2A', '#F2B544'] },
  { id: 'videoclub', name: 'Videoclub', mood: 'retro', colors: ['#1B1035', '#FF3CAC', '#2B86C5', '#FFD23F', '#EDEDF2'] },
  { id: 'anos-20', name: 'Años 20', mood: 'retro', colors: ['#0F1B1E', '#C8A85A', '#E9E0CC', '#3E5A57', '#8C3B2E'] },

  // ── técnico
  { id: 'plano-azul', name: 'Plano azul', mood: 'tecnico', colors: ['#0B2545', '#1E4F8A', '#8DA9C4', '#EEF4ED', '#F2A541'] },
  { id: 'terminal', name: 'Terminal', mood: 'tecnico', colors: ['#0C0F0A', '#2A3B23', '#39FF14', '#A3B18A', '#E9F5DB'] },
  { id: 'laboratorio', name: 'Laboratorio', mood: 'tecnico', colors: ['#F4F7F7', '#CFD8DC', '#263238', '#00ACC1', '#FF6F61'] },
  { id: 'circuito', name: 'Circuito', mood: 'tecnico', colors: ['#0A1F14', '#135E46', '#4CAF50', '#C0CA33', '#E8EDE4'] },
  { id: 'interfaz-oscura', name: 'Interfaz oscura', mood: 'tecnico', colors: ['#0D1117', '#262C36', '#8B949E', '#58A6FF', '#F0F6FC'] },
  { id: 'satelite', name: 'Satélite', mood: 'tecnico', colors: ['#1C1F26', '#3D5A80', '#98C1D9', '#E0FBFC', '#EE6C4D'] },
  { id: 'fibra-optica', name: 'Fibra óptica', mood: 'tecnico', colors: ['#050A30', '#233DFF', '#7EC8E3', '#D9F6FF', '#FF5C8A'] },
  { id: 'monocromo-tecnico', name: 'Monocromo técnico', mood: 'tecnico', colors: ['#111111', '#444444', '#888888', '#CCCCCC', '#FF3B00'] },

  // ── cálido
  { id: 'pliego-kraft', name: 'Pliego kraft', mood: 'calido', colors: ['#C8A97E', '#3B2F23', '#F3EBDD', '#7A5C3E', '#1F1A15'] },
  { id: 'desierto', name: 'Desierto', mood: 'calido', colors: ['#E9C46A', '#F4A261', '#E76F51', '#264653', '#F6EBD9'] },
  { id: 'terracota', name: 'Terracota', mood: 'calido', colors: ['#B5543C', '#D98C5F', '#F2D0A9', '#4A3428', '#8A9A5B'] },
  { id: 'mate-y-bizcochos', name: 'Mate y bizcochos', mood: 'calido', colors: ['#5C6B2E', '#A3B565', '#E8D8B0', '#8B5A2B', '#2E241B'] },
  { id: 'siesta', name: 'Siesta', mood: 'calido', colors: ['#F2E3C6', '#E0A458', '#C2683A', '#6E4C3A', '#A7C4A0'] },
  { id: 'feria-de-san-telmo', name: 'Feria de San Telmo', mood: 'calido', colors: ['#7B2D26', '#D9A441', '#F0E2C3', '#2F4858', '#B5714F'] },
  { id: 'cafe-con-leche', name: 'Café con leche', mood: 'calido', colors: ['#3B2618', '#7B5137', '#C69C72', '#EADBC8', '#141414'] },
  { id: 'otono-en-palermo', name: 'Otoño en Palermo', mood: 'calido', colors: ['#8C3F1F', '#D07A2D', '#E9B949', '#5D6B3A', '#F3E7D3'] },
  { id: 'atardecer', name: 'Atardecer', mood: 'calido', colors: ['#2D1E2F', '#6B2D5C', '#F26A4F', '#F7B267', '#FCE9D7'] },
  { id: 'ladrillo-y-musgo', name: 'Ladrillo y musgo', mood: 'calido', colors: ['#9E3D22', '#D4836A', '#5F6F3A', '#E7DCC8', '#2B2A26'] },

  // ── experimental
  { id: 'acido', name: 'Ácido', mood: 'experimental', colors: ['#E4FF1A', '#FF1F8E', '#1A1AFF', '#0B0B0B', '#F2F2F2'] },
  { id: 'holograma', name: 'Holograma', mood: 'experimental', colors: ['#CDB4DB', '#FFC8DD', '#BDE0FE', '#7FB7FF', '#2B2D42'] },
  { id: 'glitch', name: 'Glitch', mood: 'experimental', colors: ['#0F0F0F', '#FF0055', '#00FFC6', '#F5F5F5', '#7A00FF'] },
  { id: 'rave', name: 'Rave', mood: 'experimental', colors: ['#1A0033', '#FF00E5', '#00FFF0', '#FFF500', '#F2F2F2'] },
  { id: 'brutalismo', name: 'Brutalismo', mood: 'experimental', colors: ['#CFCAC0', '#1C1C1C', '#FF3B1F', '#7A7670', '#F7F4EE'] },
  { id: 'ciencia-ficcion', name: 'Ciencia ficción', mood: 'experimental', colors: ['#0A0F1F', '#3A0CA3', '#F72585', '#4CC9F0', '#E0E1DD'] },
  { id: 'mutante', name: 'Mutante', mood: 'experimental', colors: ['#2F3E1E', '#9EF01A', '#F15BB5', '#FEE440', '#00BBF9'] },
  { id: 'collage-punk', name: 'Collage punk', mood: 'experimental', colors: ['#F2F2EE', '#111111', '#FF2E63', '#FFD400', '#08D9D6'] },
]

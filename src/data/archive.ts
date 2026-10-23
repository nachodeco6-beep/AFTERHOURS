import type { ArtStyle } from '../lib/art'

export const CATEGORIES = ['Digital', 'Photographic', 'Landscape', 'Architecture', 'Editorial'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Work {
  id: string
  no: string
  title: string
  category: Category
  year: string
  medium: string
  description: string
  /** width / height */
  ratio: number
  style: ArtStyle
  seed: number
}

export const WORKS: Work[] = [
  {
    id: 'sodium-lines',
    no: '001',
    title: 'Sodium Lines',
    category: 'Photographic',
    year: '2026',
    medium: 'Long-exposure study',
    description:
      'Forty seconds of traffic compressed into a single frame. What remains is the route, not the cars: light as a record of where people needed to be at 1:40 a.m.',
    ratio: 4 / 5,
    style: 'trails',
    seed: 4,
  },
  {
    id: 'tower-0312',
    no: '002',
    title: 'Tower, 03:12',
    category: 'Architecture',
    year: '2025',
    medium: 'Generative elevation',
    description:
      'An office tower after the cleaners have gone. Four windows still lit, one red aviation lamp keeping time for a sky that is not listening.',
    ratio: 3 / 4,
    style: 'tower',
    seed: 312,
  },
  {
    id: 'ridge-study',
    no: '003',
    title: 'Ridge Study No. 4',
    category: 'Landscape',
    year: '2026',
    medium: 'Layered terrain',
    description:
      'Seven ridgelines receding under a low moon. Each layer is drawn from the same noise field, offset in time, so the range reads like a slow exhale.',
    ratio: 16 / 10,
    style: 'ridges',
    seed: 44,
  },
  {
    id: 'isobar',
    no: '004',
    title: 'Isobar',
    category: 'Digital',
    year: '2026',
    medium: 'Contour field',
    description:
      'A pressure map of a weather system that never existed. Lines of equal value tighten around two quiet eyes, one of them lit.',
    ratio: 1,
    style: 'topo',
    seed: 9,
  },
  {
    id: 'facade-unlit',
    no: '005',
    title: 'Façade, Unlit',
    category: 'Architecture',
    year: '2025',
    medium: 'Brutalist grid',
    description:
      'Two hundred concrete bays and the handful of people still awake behind them. A census taken by lamplight.',
    ratio: 4 / 5,
    style: 'facade',
    seed: 205,
  },
  {
    id: 'low-tide',
    no: '006',
    title: 'Low Tide Signal',
    category: 'Landscape',
    year: '2024',
    medium: 'Horizon study',
    description:
      'The sea at night is mostly the sound of it. Here it is reduced to lines and a single broken reflection walking toward the viewer.',
    ratio: 3 / 2,
    style: 'sea',
    seed: 61,
  },
  {
    id: 'rue-nine',
    no: '007',
    title: 'Bokeh, Rue 9',
    category: 'Photographic',
    year: '2026',
    medium: 'Defocused city',
    description:
      'A street photographed with the focus thrown away. Every lamp, sign and taillight becomes the same soft coin of light.',
    ratio: 1,
    style: 'bokeh',
    seed: 9,
  },
  {
    id: 'issue-00',
    no: '008',
    title: 'Issue 00 / Insomnia',
    category: 'Editorial',
    year: '2026',
    medium: 'Cover composition',
    description:
      'Proposed cover for a magazine that only publishes between midnight and six. Typography cropped by the edge of the page, as it should be.',
    ratio: 3 / 4,
    style: 'type',
    seed: 0,
  },
  {
    id: 'signal-loss',
    no: '009',
    title: 'Signal Loss',
    category: 'Digital',
    year: '2025',
    medium: 'Scanline corruption',
    description:
      'A broadcast that lost its carrier at 4:00 a.m. and kept transmitting anyway. Bands of colour slipping out of register.',
    ratio: 16 / 10,
    style: 'glitch',
    seed: 400,
  },
  {
    id: 'level-minus-two',
    no: '010',
    title: 'Level −2',
    category: 'Architecture',
    year: '2024',
    medium: 'Perspective study',
    description:
      'An underground car park, fluorescent tubes running to a vanishing point. The most honest light in the city.',
    ratio: 4 / 5,
    style: 'garage',
    seed: 2,
  },
  {
    id: 'streetlamp-haze',
    no: '011',
    title: 'Streetlamp, Fog',
    category: 'Photographic',
    year: '2025',
    medium: 'Atmospheric study',
    description:
      'A single lamp in sea fog. The halo is wider than the light itself, which is how most things look after 2 a.m.',
    ratio: 3 / 4,
    style: 'haze',
    seed: 17,
  },
  {
    id: 'index-of-nights',
    no: '012',
    title: 'Index of Nights',
    category: 'Editorial',
    year: '2026',
    medium: 'Lunar table',
    description:
      'Thirty nights catalogued by the shape of the moon. One of them is marked; nobody remembers why.',
    ratio: 1,
    style: 'phases',
    seed: 30,
  },
]

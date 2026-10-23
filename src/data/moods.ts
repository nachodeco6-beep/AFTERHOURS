import waveforms from './waveforms.json'

export type MoodId = 'midnight-drive' | 'deep-focus' | 'ocean-at-night' | 'no-sleep-club'

export interface Mood {
  id: MoodId
  index: string
  title: string
  kicker: string
  description: string
  meta: { tempo: string; key: string; texture: string }
  tags: string[]
  /** Accent colour that drives the cover, the room's glow and the waveform. */
  accent: string
  /** Deep tint used behind the cover. */
  tint: string
  src: string
  waveform: number[]
}

const audio = (id: MoodId) => `${import.meta.env.BASE_URL}audio/${id}.mp3`

export const MOODS: Mood[] = [
  {
    id: 'midnight-drive',
    index: '01',
    title: 'Midnight Drive',
    kicker: 'Sodium light, empty lanes',
    description:
      'Arpeggiated bass rolling under detuned pads, a gated snare bouncing off concrete. For the long road home when the city has stopped asking anything of you.',
    meta: { tempo: '96 BPM', key: 'A minor', texture: 'Synth · Pulse' },
    tags: ['Motion', 'Neon', 'Night roads'],
    accent: '#FF7A2F',
    tint: '#170b05',
    src: audio('midnight-drive'),
    waveform: waveforms['midnight-drive'],
  },
  {
    id: 'deep-focus',
    index: '02',
    title: 'Deep Focus',
    kicker: 'One lamp, one task',
    description:
      'Slow ninth chords that never resolve, a warm floor of noise and bells placed far apart. Built to disappear the moment you start working.',
    meta: { tempo: 'Free · 66', key: 'D major', texture: 'Pads · Bells' },
    tags: ['Ambient', 'Work', 'Stillness'],
    accent: '#B9D3E3',
    tint: '#0a0e11',
    src: audio('deep-focus'),
    waveform: waveforms['deep-focus'],
  },
  {
    id: 'ocean-at-night',
    index: '03',
    title: 'Ocean at Night',
    kicker: 'Black water, slow breath',
    description:
      'Swells of surf that arrive on their own schedule, a low drone you feel more than hear, and chimes drifting in from somewhere further down the shore.',
    meta: { tempo: 'Tidal', key: 'E minor', texture: 'Surf · Drone' },
    tags: ['Field', 'Drift', 'Sleep adjacent'],
    accent: '#3FD6C8',
    tint: '#031110',
    src: audio('ocean-at-night'),
    waveform: waveforms['ocean-at-night'],
  },
  {
    id: 'no-sleep-club',
    index: '04',
    title: 'No Sleep Club',
    kicker: 'Four on the floor, lights low',
    description:
      'A kick that does not stop, a bass that rolls between it, and chord stabs opening like a door into a room that is already too warm. 124 and climbing.',
    meta: { tempo: '124 BPM', key: 'F minor', texture: 'House · Stabs' },
    tags: ['Club', 'Pressure', 'Until six'],
    accent: '#C7FF3D',
    tint: '#0b0e03',
    src: audio('no-sleep-club'),
    waveform: waveforms['no-sleep-club'],
  },
]

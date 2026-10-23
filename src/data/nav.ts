export const NAV = [
  { id: 'sound-room', no: '01', label: 'Sound Room', short: 'Sound', blurb: 'Four moods for four kinds of night' },
  { id: 'the-void', no: '02', label: 'The Void', short: 'Journal', blurb: 'A private page for what keeps you up' },
  { id: 'archive', no: '03', label: 'Night Archive', short: 'Archive', blurb: 'Twelve works made after dark' },
] as const

export type SectionId = (typeof NAV)[number]['id']

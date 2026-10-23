export const NAV = [
  { id: 'the-void', no: '02', label: 'The Void', short: 'Journal', blurb: 'A private page for what keeps you up' },
  { id: 'archive', no: '03', label: 'Night Archive', short: 'Archive', blurb: 'Twelve works made after dark' },
] as const

export type SectionId = (typeof NAV)[number]['id']

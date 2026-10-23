export const NAV = [
  { id: 'archive', no: '03', label: 'Night Archive', short: 'Archive', blurb: 'Twelve works made after dark' },
] as const

export type SectionId = (typeof NAV)[number]['id']

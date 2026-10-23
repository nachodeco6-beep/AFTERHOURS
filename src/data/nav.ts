export interface NavItem {
  id: string
  no: string
  label: string
  blurb: string
}

// Every section of the old site is gone; the router (next commit) brings the new views.
export const NAV: NavItem[] = []

export type SectionId = string

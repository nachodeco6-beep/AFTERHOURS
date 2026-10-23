/**
 * Asymmetric editorial grid inherited from the old Night Archive.
 * Not used yet: stage 2 builds the moodboard templates on top of it.
 *
 * PLACEMENT cycles through positions on a 12-column grid (md and up);
 * MOBILE alternates full-bleed and inset widths on a single column.
 * Apply both to the item at index i: PLACEMENT[i % len], MOBILE[i % len],
 * plus `md:w-auto md:ml-0` so the mobile widths don't leak into the grid.
 * The container was `flex flex-col gap-14 md:grid md:grid-cols-12 md:items-start md:gap-x-8 md:gap-y-20`.
 */
export const PLACEMENT = [
  'md:col-start-1 md:col-span-5',
  'md:col-start-7 md:col-span-4 md:mt-40',
  'md:col-start-2 md:col-span-6 md:mt-10',
  'md:col-start-9 md:col-span-4 md:mt-48',
  'md:col-start-1 md:col-span-4 md:mt-10',
  'md:col-start-6 md:col-span-7 md:mt-32',
]

export const MOBILE = ['w-full', 'ml-auto w-[84%]', 'w-[90%]', 'ml-auto w-full']

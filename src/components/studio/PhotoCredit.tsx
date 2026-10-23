import type { Photo } from '../../../shared/types'
import { UNSPLASH_URL } from '../../lib/unsplash'

/** «Foto: <autor> en Unsplash», with both links as Unsplash's guidelines ask. */
export function PhotoCredit({ photo, className = '' }: { photo: Photo; className?: string }) {
  return (
    <p className={className}>
      Foto:{' '}
      <a href={photo.author.profileUrl} target="_blank" rel="noopener noreferrer" className="text-bone underline-offset-2 hover:text-acid hover:underline">
        {photo.author.name}
      </a>{' '}
      en{' '}
      <a href={UNSPLASH_URL} target="_blank" rel="noopener noreferrer" className="text-bone underline-offset-2 hover:text-acid hover:underline">
        Unsplash
      </a>
    </p>
  )
}

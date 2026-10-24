import { ImageOff } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import type { Photo } from '../../../shared/types'

interface PhotoFrameProps {
  photo: Photo
  /** Positioning + surface classes for the frame. Defaults to `relative`. */
  className?: string
  /** Load right away instead of waiting until the photo is near the viewport. */
  eager?: boolean
  fit?: 'cover' | 'contain'
  /** `sizes` attribute for the responsive image. */
  sizes?: string
  /** Grid thumbnails pick between small and regular; the viewer always uses regular. */
  size?: 'grid' | 'large'
}

/**
 * A remote photo with deferred loading. Until it arrives the frame shows the
 * photo's dominant colour and «Revelando…»; if it fails it shows a quiet plate,
 * so a broken image never breaks the layout. URLs are used exactly as Unsplash
 * sends them (hotlinking, ixid intact).
 */
export function PhotoFrame({ photo, className = 'relative', eager = false, fit = 'cover', sizes, size = 'grid' }: PhotoFrameProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const srcSet = size === 'grid' ? `${photo.urls.small} 400w, ${photo.urls.regular} 1080w` : undefined

  return (
    // the dominant colour is only a placeholder: once the photo is in, it must not frame it (fit="contain")
    <div className={`overflow-hidden ${className}`} style={{ backgroundColor: loaded ? undefined : (photo.color ?? undefined) } as CSSProperties}>
      {!loaded && !failed && (
        <div aria-hidden="true" className="absolute inset-0 flex items-end bg-ink/55 p-3">
          <span className="label-sm text-bone/70">Revelando…</span>
          <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-transparent via-white/[0.04] to-transparent" />
        </div>
      )}
      {failed ? (
        <div className="absolute inset-0 flex flex-col justify-between bg-char p-4" role="img" aria-label={`${photo.alt} (no se pudo cargar)`}>
          <ImageOff className="size-4 text-dim" strokeWidth={1.5} aria-hidden="true" />
          <span className="label-sm text-dim">No se pudo cargar esta foto</span>
        </div>
      ) : (
        <img
          src={size === 'grid' ? photo.urls.small : photo.urls.regular}
          srcSet={srcSet}
          sizes={srcSet ? sizes : undefined}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          draggable={false}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

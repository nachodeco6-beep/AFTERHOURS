import type { Photo } from '../../shared/types'
import type { RGB } from './color'
import { colorPool, poolFromReported, type PoolColor, type Role } from './colorLab'
import { paletteFromPixels, paletteFromReported } from './palette'

export interface PaletteResult {
  colors: string[]
  /** 'pixels' = read from the photos; 'unsplash' = Unsplash's dominant colours (fallback). */
  source: 'pixels' | 'unsplash'
  /** Colours present in the photos, with the photo each comes from (the Color Lab's raw material). */
  pool: PoolColor[]
  /** Roles, when the palette was edited in the Color Lab. */
  roles?: (Role | null)[]
}

const SAMPLE = 48
const cache = new Map<string, Promise<RGB[]>>()

/** Reads a small version of the photo into a canvas. Needs CORS, which Unsplash's CDN allows. */
function sample(url: string): Promise<RGB[]> {
  const hit = cache.get(url)
  if (hit) return hit
  const job = new Promise<RGB[]>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const scale = SAMPLE / Math.max(img.naturalWidth, img.naturalHeight)
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('no canvas')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data // throws if the canvas is tainted
        const pixels: RGB[] = []
        for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) pixels.push([data[i], data[i + 1], data[i + 2]])
        resolve(pixels)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = () => reject(new Error('image failed'))
    img.src = url
  })
  job.catch(() => cache.delete(url))
  cache.set(url, job)
  return job
}

/** 5 colours from the board's photos; falls back to Unsplash's colours if any photo can't be read. */
export async function extractPalette(photos: Photo[]): Promise<PaletteResult> {
  try {
    const samples = await Promise.all(photos.map((p) => sample(p.urls.small)))
    const colors = paletteFromPixels(samples)
    if (colors.length) return { colors, source: 'pixels', pool: colorPool(samples) }
  } catch {
    // fall through to the reported colours
  }
  return { colors: paletteFromReported(photos.map((p) => p.color)), source: 'unsplash', pool: poolFromReported(photos.map((p) => p.color)) }
}

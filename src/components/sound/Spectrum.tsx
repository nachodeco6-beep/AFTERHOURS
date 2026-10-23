import { useEffect, useRef } from 'react'
import { usePlayer } from '../../hooks/useAudioPlayer'

const BARS = 28

/** Live frequency bars from the Web Audio analyser. Flat and still whenever nothing is playing. */
export function Spectrum({ accent }: { accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { isPlaying, getAnalyser } = usePlayer()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const analyser = isPlaying ? getAnalyser() : null
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    const gap = 2
    const bw = (w - gap * (BARS - 1)) / BARS
    let raf = 0

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      if (analyser && data) analyser.getByteFrequencyData(data)
      for (let i = 0; i < BARS; i++) {
        let v = 0
        if (data) {
          // log-ish bin mapping so the bars aren't dominated by the bass
          const idx = Math.floor(Math.pow(i / BARS, 1.6) * data.length * 0.7)
          v = data[idx] / 255
        }
        const bh = Math.max(1, v * h)
        ctx.fillStyle = data ? accent : 'rgba(241,240,232,0.25)'
        ctx.fillRect(i * (bw + gap), h - bh, bw, bh)
      }
      if (analyser) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, getAnalyser, accent])

  return <canvas ref={ref} aria-hidden="true" className="block h-8 w-28 sm:w-36" />
}

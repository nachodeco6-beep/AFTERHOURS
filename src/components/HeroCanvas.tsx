import { useEffect, useRef } from 'react'

const LINES = 28

/**
 * A slowly shifting nocturnal landscape: ridgelines receding to a horizon,
 * lit by a light that drifts across the scene and leans toward the pointer.
 * Pauses offscreen / in background tabs; renders one still frame for reduced motion.
 */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let raf = 0
    let running = false
    let visible = true
    const pointer = { x: 0.62, y: 0.3, tx: 0.62, ty: 0.3 }
    const start = performance.now() - 40000 // begin mid-drift, not at a symmetric pose

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!running) draw(performance.now())
    }

    const ridge = (xn: number, i: number, t: number) => {
      const centre = 0.5 + 0.18 * Math.sin(t * 0.031 + i * 0.05)
      const env = 0.22 + Math.exp(-((xn - centre) ** 2) / 0.05)
      const v =
        Math.sin(xn * 6.3 + i * 0.83 + t * 0.19) * 0.5 +
        Math.sin(xn * 13.7 - i * 1.31 + t * 0.11) * 0.3 +
        Math.sin(xn * 31.1 + i * 2.17 - t * 0.37) * 0.12 +
        Math.sin(xn * 3.1 + i * 0.4 - t * 0.05) * 0.4
      return (0.5 + 0.5 * (v / 1.32)) * env
    }

    function draw(now: number) {
      const t = (now - start) / 1000
      pointer.x += (pointer.tx - pointer.x) * 0.03
      pointer.y += (pointer.ty - pointer.y) * 0.03

      // sky
      const horizon = h * 0.5
      const sky = ctx!.createLinearGradient(0, 0, 0, h)
      sky.addColorStop(0, '#090909')
      sky.addColorStop(0.5, '#0f100d')
      sky.addColorStop(1, '#090909')
      ctx!.fillStyle = sky
      ctx!.fillRect(0, 0, w, h)

      // drifting light: a slow Lissajous path nudged by the pointer
      const lx = w * (0.5 + 0.26 * Math.sin(t * 0.045) + (pointer.x - 0.5) * 0.18)
      const ly = h * (0.3 + 0.06 * Math.sin(t * 0.07 + 1.3) + (pointer.y - 0.5) * 0.08)
      const big = Math.max(w, h)
      let g = ctx!.createRadialGradient(lx, ly, 0, lx, ly, big * 0.55)
      g.addColorStop(0, 'rgba(241,240,232,0.16)')
      g.addColorStop(0.2, 'rgba(199,255,61,0.05)')
      g.addColorStop(1, 'rgba(9,9,9,0)')
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, w, h)
      g = ctx!.createRadialGradient(lx, ly, 0, lx, ly, big * 0.035)
      g.addColorStop(0, 'rgba(250,250,240,0.95)')
      g.addColorStop(0.35, 'rgba(241,240,232,0.35)')
      g.addColorStop(1, 'rgba(241,240,232,0)')
      ctx!.fillStyle = g
      ctx!.fillRect(lx - big * 0.04, ly - big * 0.04, big * 0.08, big * 0.08)

      // ridgelines, back to front; each fills to occlude the ones behind
      const step = Math.max(4, w / 260)
      for (let i = 0; i < LINES; i++) {
        const depth = i / (LINES - 1)
        const base = horizon + (h - horizon) * Math.pow(depth, 1.7) + h * 0.02
        const amp = h * (0.03 + depth * 0.2)
        ctx!.beginPath()
        ctx!.moveTo(-10, h + 10)
        for (let x = -10; x <= w + 10; x += step) {
          const y = base - ridge(x / w, i, t) * amp
          ctx!.lineTo(x, y)
        }
        ctx!.lineTo(w + 10, h + 10)
        ctx!.closePath()
        ctx!.fillStyle = '#090909'
        ctx!.fill()
        // stroke brightness falls off with depth and distance from the light
        const lit = ctx!.createLinearGradient(lx - w * 0.6, 0, lx + w * 0.6, 0)
        const a = 0.08 + depth * 0.32
        lit.addColorStop(0, `rgba(241,240,232,${a * 0.25})`)
        lit.addColorStop(0.5, i === LINES - 6 ? `rgba(199,255,61,${Math.min(1, a * 1.8)})` : `rgba(241,240,232,${a})`)
        lit.addColorStop(1, `rgba(241,240,232,${a * 0.25})`)
        ctx!.strokeStyle = lit
        ctx!.lineWidth = 0.6 + depth * 0.9
        ctx!.stroke()
      }

      // horizon hairline
      ctx!.fillStyle = 'rgba(241,240,232,0.08)'
      ctx!.fillRect(0, horizon + h * 0.02, w, 1)
    }

    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    const startLoop = () => {
      if (running || reduce || !visible || document.hidden) return
      running = true
      raf = requestAnimationFrame(loop)
    }
    const stopLoop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const onPointer = (e: PointerEvent) => {
      pointer.tx = e.clientX / window.innerWidth
      pointer.ty = e.clientY / window.innerHeight
    }
    const onVisibility = () => (document.hidden ? stopLoop() : startLoop())
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) startLoop()
      else stopLoop()
    })

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    io.observe(canvas)
    resize()
    startLoop()
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopLoop()
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />
}

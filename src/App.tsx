import { MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Cursor } from './components/Cursor'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Intro } from './components/Intro'
import { StudioProvider } from './components/StudioProvider'
import { scrollToTop, TITLES, useRoute } from './lib/router'
import { HomeView } from './views/HomeView'
import { StudioView } from './views/StudioView'

export default function App() {
  const route = useRoute()
  const [ready, setReady] = useState(false)
  const onIntroDone = useCallback(() => setReady(true), [])
  const lastRoute = useRef(route)

  // On navigation: new title, back to the top, focus on the view's heading.
  // (Compares with the previous route rather than a "first run" flag, so
  // StrictMode's double effects don't steal focus on load.)
  useEffect(() => {
    document.title = TITLES[route]
    if (lastRoute.current === route) return
    lastRoute.current = route
    scrollToTop()
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[data-route-title]')?.focus({ preventScroll: true }),
    )
    return () => cancelAnimationFrame(frame)
  }, [route])

  const skipToContent = (e: MouseEvent<HTMLAnchorElement>) => {
    // keep the route hash in the URL; just move focus
    e.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <MotionConfig reducedMotion="user">
      <StudioProvider>
        <a
          href="#main"
          onClick={skipToContent}
          className="label fixed top-3 left-3 z-[95] -translate-y-20 bg-acid px-3 py-2 text-ink transition-transform focus:translate-y-0"
        >
          Saltar al contenido
        </a>
        <Intro onDone={onIntroDone} />
        <Header route={route} />
        <main id="main" tabIndex={-1} className="outline-none">
          <motion.div key={route} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            {route === 'studio' ? <StudioView /> : <HomeView ready={ready} />}
          </motion.div>
        </main>
        <Footer />
        <Cursor />
        <div className="grain" aria-hidden="true" />
      </StudioProvider>
    </MotionConfig>
  )
}

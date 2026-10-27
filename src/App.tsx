import { MotionConfig, motion } from 'framer-motion'
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { Cursor } from './components/Cursor'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Intro } from './components/Intro'
import { PlantaUnavailable, PlantaLoading } from './components/PlantaShell'
import { StudioProvider } from './components/StudioProvider'
import { scrollToTop, TITLES, useRoute, type RouteId } from './lib/router'
import { CLOSED, plantaReducer, roomOfRoute, type PlantaAction, type PlantaState } from './planta/state'
import { HomeView } from './views/HomeView'
import { ColorLabView, LibraryView, TypeLabView } from './views/RoomViews'
import { StudioView } from './views/StudioView'

// the 3D plan (three.js and the whole scene) loads only when someone opens it
const StudioPlanta3D = lazy(() => import('./planta/StudioPlanta3D').catch(() => ({ default: PlantaUnavailable })))

const normalizeHash = (h: string) => (!h || h === '#' || h === '#/' ? '#/' : h.replace(/\/+$/, ''))

function View({ route, ready }: { route: RouteId; ready: boolean }) {
  switch (route) {
    case 'studio':
      return <StudioView />
    case 'type-lab':
      return <TypeLabView />
    case 'color-lab':
      return <ColorLabView />
    case 'library':
      return <LibraryView />
    default:
      return <HomeView ready={ready} />
  }
}

export default function App() {
  const route = useRoute()
  const [ready, setReady] = useState(false)
  const onIntroDone = useCallback(() => setReady(true), [])
  const lastRoute = useRef(route)

  // «Página | Planta»: the plan opens over everything and closes back to where you were
  const [planta, setPlanta] = useState<PlantaState>(CLOSED)
  const plantaRef = useRef(planta)
  useLayoutEffect(() => {
    plantaRef.current = planta
  }, [planta])
  const dispatchPlanta = useCallback((action: PlantaAction) => {
    const [next, effect] = plantaReducer(plantaRef.current, action)
    plantaRef.current = next
    setPlanta(next)
    if (effect.navigate && normalizeHash(location.hash) !== normalizeHash(effect.navigate)) location.hash = effect.navigate
  }, [])
  const openPlanta = useCallback(() => dispatchPlanta({ type: 'open', from: normalizeHash(location.hash) }), [dispatchPlanta])
  // the route changed some other way (back button…): the plan steps aside
  const [seenRoute, setSeenRoute] = useState(route)
  if (seenRoute !== route) {
    setSeenRoute(route)
    if (planta.open) setPlanta(CLOSED)
  }

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
        <Header route={route} plantaOpen={planta.open} onPlanta={openPlanta} />
        <main id="main" tabIndex={-1} className="outline-none">
          <motion.div key={route} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
            <View route={route} ready={ready} />
          </motion.div>
        </main>
        {planta.open && (
          <Suspense fallback={<PlantaLoading />}>
            <StudioPlanta3D state={planta} dispatch={dispatchPlanta} initialRoom={roomOfRoute(planta.returnTo)} />
          </Suspense>
        )}
        <Footer />
        <Cursor />
        <div className="grain" aria-hidden="true" />
      </StudioProvider>
    </MotionConfig>
  )
}

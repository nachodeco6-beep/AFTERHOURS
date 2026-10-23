import { useCallback, useState } from 'react'
import { Cursor } from './components/Cursor'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { Intro } from './components/Intro'
import { Marquee } from './components/Marquee'

export default function App() {
  const [ready, setReady] = useState(false)
  const onIntroDone = useCallback(() => setReady(true), [])

  return (
    <>
      <a
        href="#main"
        className="label fixed top-3 left-3 z-[95] -translate-y-20 bg-acid px-3 py-2 text-ink transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <Intro onDone={onIntroDone} />
      <Header />
      <main id="main">
        <Hero ready={ready} />
        <Marquee words={['Night owls', 'Designers', 'Musicians', 'Insomniacs', 'Night shift', 'Dreamers']} />
        <Marquee words={['Archive', 'After dark', 'Long exposure', 'Empty towers', 'Black water']} duration={60} outline />
      </main>
      <Footer />
      <Cursor />
      <div className="grain" aria-hidden="true" />
    </>
  )
}

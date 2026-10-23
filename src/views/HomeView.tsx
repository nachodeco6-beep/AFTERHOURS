import { Hero } from '../components/Hero'
import { Marquee } from '../components/Marquee'

export function HomeView({ ready }: { ready: boolean }) {
  return (
    <>
      <Hero ready={ready} />
      <Marquee words={['Night owls', 'Designers', 'Musicians', 'Insomniacs', 'Night shift', 'Dreamers']} />
    </>
  )
}

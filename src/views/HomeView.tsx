import { Hero } from '../components/Hero'
import { HowItWorks } from '../components/HowItWorks'
import { Marquee } from '../components/Marquee'

export function HomeView({ ready }: { ready: boolean }) {
  return (
    <>
      <Hero ready={ready} />
      <Marquee words={['Moodboards', 'Dirección de arte', 'Paleta', 'Tipografía', 'Referencias', 'Fotografía real']} />
      <HowItWorks />
      <Marquee words={['From vision to visual', 'De la idea a la imagen']} duration={45} outline />
    </>
  )
}

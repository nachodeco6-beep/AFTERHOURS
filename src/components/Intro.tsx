import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

const SEEN_KEY = 'afterhours.intro-seen'
const WORD = 'AFTERHOURS'

function alreadySeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

/** Opening title card. Plays once per session, skipped entirely for reduced motion. */
export function Intro({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(() => !reduce && !alreadySeen())

  useEffect(() => {
    if (!show) {
      onDone()
      return
    }
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // fine — the intro will just play again next visit
    }
    const t = window.setTimeout(() => setShow(false), 1900)
    return () => window.clearTimeout(t)
  }, [show, onDone])

  return (
    <AnimatePresence onExitComplete={onDone}>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[90] flex flex-col justify-between bg-ink p-5 md:p-8"
          initial={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)' }}
          transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
          aria-hidden="true"
        >
          <div className="flex justify-between text-mute">
            <span className="label">Estudio creativo digital</span>
            <span className="label">N° 00</span>
          </div>
          <div className="overflow-hidden">
            <div className="display flex text-[clamp(3.5rem,17vw,16rem)] text-bone">
              {WORD.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 + i * 0.045, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block"
                >
                  {ch}
                </motion.span>
              ))}
            </div>
          </div>
          <div>
            <motion.div
              className="h-px origin-left bg-acid"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.6, ease: [0.65, 0, 0.35, 1] }}
            />
            <div className="mt-3 flex justify-between text-mute">
              <span className="label">Idea · Referencias · Moodboard</span>
              <span className="label">From vision to visual</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

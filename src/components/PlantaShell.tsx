import { useRef } from 'react'
import { useDialog } from '../hooks/useDialog'

/** While the 3D plan's code arrives. */
export function PlantaLoading() {
  return (
    <div className="label fixed inset-0 z-[90] grid place-items-center bg-ink text-mute" role="status">
      Armando el estudio…
    </div>
  )
}

/** The plan's code couldn't be loaded (offline, blocked): say so and let people go back. */
export function PlantaUnavailable({ dispatch }: { dispatch: (a: { type: 'close' }) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, true, () => dispatch({ type: 'close' }))
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="La planta" className="fixed inset-0 z-[90] grid place-items-center bg-ink p-6 text-center">
      <div>
        <p className="label text-mute">No se pudo cargar la planta. Revisá la conexión y probá de nuevo.</p>
        <button type="button" onClick={() => dispatch({ type: 'close' })} data-autofocus className="label mt-6 h-10 border border-line px-4 text-bone hover:border-bone">
          Volver a la página
        </button>
      </div>
    </div>
  )
}

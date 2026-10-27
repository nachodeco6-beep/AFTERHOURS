import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useBoardData } from '../hooks/useBoardData'
import { PlanIcon } from '../components/PlanIcon'
import { useDialog } from '../hooks/useDialog'
import { useStudio } from '../hooks/useStudio'
import { fontStack } from '../lib/typography'
import { createPlanta, pickQuality, webglAvailable, type PlantaController } from './engine'
import './planta.css'
import { NO_THEME, ROOM_ROUTE, ROOMS, roomById, type PlantaAction, type PlantaState, type PlantaTheme, type RoomId } from './rooms'

interface Props {
  state: PlantaState
  dispatch: (action: PlantaAction) => void
  /** The room of the page you came from. */
  initialRoom: RoomId
}

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * AFTERHOURS as a night-time loft model: each room is a part of the app.
 * Opens over everything; Escape or «Página» closes it. Loaded on demand.
 */
export default function StudioPlanta3D({ state, dispatch, initialRoom }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLElement>(null)
  const tags = useRef(new Map<RoomId, HTMLElement>())
  const ctrl = useRef<PlantaController | null>(null)
  const [sel, setSel] = useState<RoomId>(initialRoom === 'taller' ? 'studio' : initialRoom)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'nowebgl'>(() => (webglAvailable() ? 'loading' : 'nowebgl'))
  const [reduced] = useState(REDUCED)

  // what the current board lends the house (bonus)
  const { board, selection } = useStudio()
  const photos = useMemo(() => selection.map((s) => s.photo), [selection])
  const data = useBoardData(board, photos)
  const theme = useRef<PlantaTheme>(NO_THEME)
  useLayoutEffect(() => {
    theme.current = {
      type: board?.include.type ? { display: fontStack(data.pair.display), displayWeight: data.pair.display.weight ?? 400, text: fontStack(data.pair.text) } : null,
      palette: board && data.palette ? data.palette.colors : null,
      photoColors: photos.map((p) => p.color).filter((c): c is string => Boolean(c)),
    }
  })

  // the latest callbacks for the engine (it lives across renders)
  type Handler = (id: RoomId) => void
  const noop: Handler = () => {}
  const handlers = useRef<{ pick: Handler; enter: Handler; arrived: Handler }>({ pick: noop, enter: noop, arrived: noop })
  useLayoutEffect(() => {
    handlers.current = {
      pick: (id) => select(id),
      enter: (id) => enter(id),
      arrived: (id) => dispatch({ type: 'entered', room: id }),
    }
  })

  useEffect(() => {
    if (status !== 'loading' || !stage.current) return
    let live = true
    const abort = new AbortController()
    let made: PlantaController | null = null
    createPlanta({
      stage: stage.current,
      signal: abort.signal,
      reduced,
      quality: pickQuality(),
      theme: () => theme.current,
      initial: sel,
      tags: () => tags.current,
      onPick: (id) => handlers.current.pick(id),
      onEnterRequest: (id) => handlers.current.enter(id),
      onArrived: (id) => handlers.current.arrived(id),
      onReady: () => live && setStatus('ready'),
      onLost: () => {
        if (!live) return
        // the GPU gave up: release everything now and show the simple plan
        made?.dispose()
        ctrl.current = null
        setStatus('failed')
      },
    })
      .then((c) => {
        made = c
        if (live) ctrl.current = c
        else c.dispose()
      })
      .catch((err: unknown) => {
        if (!live) return
        console.warn('planta 3D:', err)
        setStatus('failed')
      })
    return () => {
      live = false
      abort.abort()
      made?.dispose()
      ctrl.current = null
    }
    // built once per open; selection changes go through the controller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const select = (id: RoomId) => {
    if (roomById(id).obra) return
    setSel(id)
    ctrl.current?.select(id)
  }
  const enter = (id: RoomId = sel) => {
    if (!ROOM_ROUTE[id]) return
    select(id)
    dispatch({ type: 'focus', room: id })
    // without the 3D view there's no flight: go straight there
    if (ctrl.current) ctrl.current.focusRoom(id)
    else dispatch({ type: 'entered', room: id })
  }
  const escape = () => {
    if (state.focused) ctrl.current?.unfocus()
    dispatch({ type: 'escape' })
  }
  useDialog(ref, true, escape)

  const room = roomById(sel)
  const goTo = (e: MouseEvent, id: RoomId) => {
    e.preventDefault()
    select(id)
    dispatch({ type: 'entered', room: id })
  }
  const plain = status === 'nowebgl' || status === 'failed'

  return (
    <div ref={ref} className="planta" role="dialog" aria-modal="true" aria-label="La planta de AFTERHOURS">
      <header className="top">
        <div className="logo">
          Afterhours
          <i aria-hidden="true" />
        </div>
        <div className="planta-views" role="group" aria-label="Cómo ver AFTERHOURS">
          <button type="button" aria-pressed="false" onClick={() => dispatch({ type: 'close' })}>
            Página
          </button>
          <button type="button" aria-pressed="true" data-autofocus>
            <PlanIcon />
            Planta
          </button>
        </div>
      </header>

      <main className="stage" ref={stage}>
        <div className="vignette" aria-hidden="true" />
        <div className="pl-grain" aria-hidden="true" />
        <div className="eyebrow">
          <span>
            <b>N° 00</b> / El estudio · after hours
          </span>
        </div>
        {!plain && <p className="hint">Arrastrá para girar · rueda o pellizco para acercar · tocá una habitación</p>}

        {!plain && (
          <nav className="tags" aria-label="Habitaciones">
            {ROOMS.map((r) => (
              <button
                key={r.id}
                ref={(el) => {
                  if (el) tags.current.set(r.id, el)
                  else tags.current.delete(r.id)
                }}
                type="button"
                className={`tag${r.obra ? ' obra' : ''}${r.id === sel ? ' on' : ''}`}
                disabled={r.obra}
                aria-pressed={r.obra ? undefined : r.id === sel}
                aria-label={r.obra ? `${r.name}: en obra` : `${r.name}: ${r.desc}`}
                title={r.obra ? 'En obra' : undefined}
                onClick={() => select(r.id)}
                onDoubleClick={() => enter(r.id)}
                style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }}
              >
                <small>{r.no}</small>
                <span>{r.obra ? 'Taller · en obra' : r.name}</span>
              </button>
            ))}
          </nav>
        )}

        {/* the same rooms as plain links, for keyboards and screen readers */}
        {!plain && (
          <nav className="rooms-list" aria-label="Lista de habitaciones">
            <ul>
              {ROOMS.map((r) => (
                <li key={r.id}>
                  {ROOM_ROUTE[r.id] ? (
                    <a href={ROOM_ROUTE[r.id] as string} onClick={(e) => goTo(e, r.id)}>
                      <small>{r.no}</small> {r.name} — {r.desc}
                      {r.id === sel ? ' · elegida' : ''}
                    </a>
                  ) : (
                    <span className="off" aria-disabled="true">
                      <small>{r.no}</small> {r.name} — en obra, todavía no se puede entrar
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        )}

        {state.focused && !plain && (
          <button type="button" className="back" onClick={escape}>
            ← Toda la planta
          </button>
        )}

        {status === 'loading' && <div className="status">Armando el estudio…</div>}

        {plain && (
          <section className="plan-simple" aria-label="Plano de AFTERHOURS">
            <p className="plain-note">
              {status === 'nowebgl' ? 'Este navegador no puede mostrar la maqueta 3D: acá está el plano.' : 'No se pudo armar la maqueta 3D: acá está el plano.'}
            </p>
            <ul className="board">
              {ROOMS.map((r) => {
                const [x, y, w, h] = r.rect
                const style = { left: `${x / 10}%`, top: `${(y / 680) * 100}%`, width: `${w / 10}%`, height: `${(h / 680) * 100}%` }
                return (
                  <li key={r.id}>
                    {ROOM_ROUTE[r.id] ? (
                      <a
                        className={`room${r.id === sel ? ' on' : ''}`}
                        style={style}
                        href={ROOM_ROUTE[r.id] as string}
                        onClick={(e) => goTo(e, r.id)}
                        onFocus={() => setSel(r.id)}
                        onMouseEnter={() => setSel(r.id)}
                      >
                        <small>{r.no}</small>
                        <b>{r.name}</b>
                        <span className="sr-only">{r.desc}</span>
                      </a>
                    ) : (
                      <span className="room obra" style={style} aria-disabled="true">
                        <small>{r.no}</small>
                        <b>{r.name}</b>
                        <span>En obra</span>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </main>

      <footer className="bar">
        <div className="sel" aria-live="polite">
          <span className="no">{room.no}</span>
          <h2>{room.name}</h2>
          <p>{room.desc}</p>
          <span className="who">{room.who}</span>
        </div>
        <button type="button" className="go" onClick={() => enter()} disabled={!ROOM_ROUTE[sel] || state.focused !== null}>
          {state.focused ? `Entrando a ${roomById(state.focused).name}…` : 'Entrar'} <span aria-hidden="true">→</span>
        </button>
      </footer>
    </div>
  )
}

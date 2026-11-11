/**
 * Invisible Turnstile widget, no dependencies: loads the official script once
 * (render=explicit), renders the widget in the container Nacho places next to
 * the generate button (N3) and hands out tokens. A token is single use and
 * lives 300 s, so every request asks for a fresh one, retries included:
 * getToken() does reset + execute each time.
 */

interface TurnstileRenderParams {
  sitekey: string
  callback: (token: string) => void
  'error-callback': () => boolean
  /** Challenge only when execute() is called (how the invisible flow works). */
  execution: 'execute'
}

interface TurnstileApi {
  render(container: HTMLElement, params: TurnstileRenderParams): string | undefined
  execute(widgetId: string): void
  reset(widgetId: string): void
  remove(widgetId: string): void
}

export const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Why a token couldn't be had: the script didn't load, or the challenge failed. */
export class TurnstileError extends Error {
  readonly reason: 'script' | 'challenge'
  constructor(reason: 'script' | 'challenge') {
    super(reason === 'script' ? 'No se pudo cargar Turnstile.' : 'El desafío de Turnstile falló.')
    this.reason = reason
  }
}

const turnstileOf = () => (globalThis as { turnstile?: TurnstileApi }).turnstile

let scriptPromise: Promise<TurnstileApi> | null = null

/** The script tag goes in once; everyone else waits on the same promise. */
function loadScript(doc: Document): Promise<TurnstileApi> {
  const loaded = turnstileOf()
  if (loaded) return Promise.resolve(loaded)
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = doc.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    script.onload = () => {
      const api = turnstileOf()
      if (api) resolve(api)
      else reject(new TurnstileError('script'))
    }
    script.onerror = () => {
      scriptPromise = null
      reject(new TurnstileError('script'))
    }
    doc.head.appendChild(script)
  })
  return scriptPromise
}

export interface TokenSource {
  /** One fresh token per call. Rejects with TurnstileError. */
  getToken: () => Promise<string>
  /** Removes the widget (on unmount). */
  destroy: () => void
}

/**
 * The widget in `container`, lazy: nothing loads until the first getToken().
 * Calls are serialised; the widget is rendered once and reset per token.
 */
export function createTokenSource(container: HTMLElement, siteKey: string): TokenSource {
  let widgetId: string | null = null
  let pending: { resolve: (token: string) => void; reject: (err: Error) => void } | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const challenge = (api: TurnstileApi) =>
    new Promise<string>((resolve, reject) => {
      pending = { resolve, reject }
      if (widgetId === null) {
        widgetId =
          api.render(container, {
            sitekey: siteKey,
            execution: 'execute',
            callback: (token) => {
              pending?.resolve(token)
              pending = null
            },
            'error-callback': () => {
              pending?.reject(new TurnstileError('challenge'))
              pending = null
              return true // handled: no console noise
            },
          }) ?? null
        if (widgetId === null) {
          pending = null
          reject(new TurnstileError('script'))
          return
        }
      } else {
        api.reset(widgetId)
      }
      api.execute(widgetId)
    })

  return {
    getToken: () => {
      const next = queue.then(() => loadScript(container.ownerDocument).then(challenge))
      // one challenge at a time; a failure doesn't jam the queue
      queue = next.catch(() => undefined)
      return next
    },
    destroy: () => {
      pending?.reject(new TurnstileError('challenge'))
      pending = null
      if (widgetId !== null) {
        turnstileOf()?.remove(widgetId)
        widgetId = null
      }
    },
  }
}

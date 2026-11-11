interface ImportMetaEnv {
  /** Base URL of the search Worker (worker/). Empty or missing = demo mode. */
  readonly VITE_SEARCH_API_URL?: string
  /** Base URL of the AI Worker (worker-ai/). Empty or missing = AI off, classic mode. */
  readonly VITE_AI_API_URL?: string
  /** Turnstile site key (public). Empty or missing = AI off, classic mode. */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

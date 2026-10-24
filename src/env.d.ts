interface ImportMetaEnv {
  /** Base URL of the search Worker (worker/). Empty or missing = demo mode. */
  readonly VITE_SEARCH_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

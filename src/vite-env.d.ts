/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "memory" in the single-file demo build, which runs inside a frame at a fixed URL. */
  readonly VITE_ROUTER?: string
  /** "true" in the demo build: shows the demo accounts on the login screen. */
  readonly VITE_DEMO?: string
}

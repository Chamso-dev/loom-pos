/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the deployed product-identification backend (api/identify). */
  readonly VITE_IDENTIFY_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

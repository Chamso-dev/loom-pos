/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Web-bundle version baked into this build (CI run number). */
  readonly VITE_BUNDLE_VERSION?: string
  /** Override URL for the OTA update manifest (latest.json). */
  readonly VITE_UPDATE_MANIFEST_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

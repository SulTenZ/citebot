/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  // tambah env vars lain yang diperlukan
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
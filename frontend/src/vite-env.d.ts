/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_DEMO_SHOWCASE?: string;
  readonly VITE_ENABLE_MESSAGING?: string;
  readonly VITE_ENABLE_PREVIEW?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

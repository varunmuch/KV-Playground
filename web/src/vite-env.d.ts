/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the live lab server when it is not on the same host, e.g. https://lab-api.example.com */
  readonly VITE_LAB_API?: string;
}

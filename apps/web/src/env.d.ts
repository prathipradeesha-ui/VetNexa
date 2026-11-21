/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, default "/api" (same origin through the Vite proxy or Nginx). */
  readonly VITE_API_URL?: string;
  /**
   * Google Maps JavaScript API key (browser key restricted to your domain). Without it, maps
   * fall back to Google's keyless embed of one place at a time.
   */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Google Maps map ID for advanced markers; Google's DEMO_MAP_ID is used if empty. */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

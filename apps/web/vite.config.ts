/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to the Express server so the browser sees one origin
    // and the HttpOnly session cookie works without cross-site settings.
    proxy: {
      '/api': { target: 'http://localhost:4100', changeOrigin: false },
      '/uploads': { target: 'http://localhost:4100', changeOrigin: false },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

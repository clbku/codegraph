import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// During `vite dev`, proxy /api to the local UI server so frontend dev can
// hot-reload while talking to a real CodeGraph backend (run `codegraph ui`
// in another terminal). Build output goes into ../dist/ui so the bundled
// CLI picks it up at runtime.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../dist/ui-static'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:7777',
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Local dev points /api at the Firebase Functions emulator.
      // Set VITE_API_BASE in .env to hit deployed functions instead.
      '/api': {
        target: process.env.VITE_FUNCTIONS_ORIGIN || 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/krishisathi-sfhs/us-central1/api'),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy, rarely-changing SDKs out of the entry chunk so a
        // first load on a 2G connection stays small.
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/@zxing')) return 'scanner';
          return undefined;
        },
      },
    },
  },
});

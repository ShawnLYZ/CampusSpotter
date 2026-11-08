/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const alias = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@engine': alias('./shared/engine'),
      '@bundle': alias('./shared/bundle'),
      '@parsers': alias('./shared/parsers'),
      '@plans': alias('./shared/plans'),
      '@fixtures': alias('./shared/fixtures'),
    },
  },
  server: { port: 5173, strictPort: true },
  // The forecast engine and the 3D scene are large, and pages are not code-split yet.
  build: { chunkSizeWarningLimit: 2500 },
  test: {
    include: ['shared/**/*.test.ts', 'src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});

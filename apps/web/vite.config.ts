/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Dépendances stables dans des fichiers séparés : mieux mis en cache entre deux déploiements.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react-router'],
          vendor: [
            '@tanstack/react-query',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'sonner',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Même origine en dev qu'en prod : le cookie de refresh reste first-party.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_API_URL: 'http://localhost:3000/api/v1' },
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/types/**'],
      thresholds: { lines: 70 },
    },
  },
});

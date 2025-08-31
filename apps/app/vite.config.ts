import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext', // Enable top-level await support
    sourcemap: true,
    outDir: 'dist',
  },
  esbuild: {
    target: 'esnext', // Enable top-level await in esbuild
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext', // Enable top-level await in dependency optimization
    },
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000',
      '/weather-api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/weather-api/, ''),
      },
      '/airsafe-api': {
        target: 'http://localhost:5000',
        rewrite: (path) => path.replace(/^\/airsafe-api/, ''),
      },
      '/known-risks': {
        target: 'http://localhost:5001',
        rewrite: (path) => path.replace(/^\/known-risks/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})

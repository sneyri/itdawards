import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = `http://127.0.0.1:${process.env.API_PORT ?? '5000'}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': backend,
      '/assets': backend,
      '/admin': backend,
      '/account': backend,
      '/control': backend,
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = process.env.API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? '5000'}`

const blockWrites = {
  name: 'block-local-writes',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method ?? '') && (req.url ?? '').startsWith('/api')) {
        res.statusCode = 403
        res.end('Local demo: write requests are blocked')
        return
      }
      next()
    })
  },
}

export default defineConfig({
  plugins: [react(), blockWrites],
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true, secure: true },
      '/assets': { target: backend, changeOrigin: true, secure: true },
      '/admin': { target: backend, changeOrigin: true, secure: true },
      '/account': { target: backend, changeOrigin: true, secure: true },
      '/control': { target: backend, changeOrigin: true, secure: true },
    },
  },
})

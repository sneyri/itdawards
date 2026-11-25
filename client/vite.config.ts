import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = process.env.API_URL ?? `http://127.0.0.1:${process.env.API_PORT ?? '5000'}`

const blockWrites = {
  name: 'block-local-writes',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const source = id.replaceAll('\\', '/')
          if (/\/src\/(?:components\/(?:CatalogueStatus|CategoryRow|Reveal)\.tsx|lib\/(?:format|imageSource)\.ts)$/.test(source)) {
            return 'page-shared'
          }
          if (!id.includes('node_modules')) return
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react'
        },
      },
    },
  },
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

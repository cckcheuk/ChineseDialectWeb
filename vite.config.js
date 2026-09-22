import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true, // allow Tailscale Funnel / any host (dev only)
    proxy: {
      // Plain HTTP (REST: /api/health, /api/asr/transcribe, /api/chat)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket streaming (/api/asr/stream) needs a separate proxy entry to forward reliably
      '/api/asr/stream': {
        target: 'ws://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

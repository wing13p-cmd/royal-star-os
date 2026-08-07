import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const devHost = process.env.RSOS_FRONTEND_HOST || '127.0.0.1';
const devPort = Number(process.env.RSOS_FRONTEND_PORT || process.env.VITE_PORT || 4173);
const apiProxyTarget = process.env.RSOS_DEV_API_PROXY_TARGET || `http://127.0.0.1:${process.env.PORT || 3001}`;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
  },
  server: {
    host: devHost,
    port: Number.isInteger(devPort) && devPort > 0 ? devPort : 4173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

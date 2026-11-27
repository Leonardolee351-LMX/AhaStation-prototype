import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const port = Number(process.env.PORT) || 5177

export default defineConfig({
  plugins: [react()],
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
})

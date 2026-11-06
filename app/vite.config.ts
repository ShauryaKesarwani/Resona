import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // host and allowedHosts let phones on the LAN or a cloudflared tunnel open the dev server
  server: { host: true, allowedHosts: true },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from /junkyard-camp/
export default defineConfig({
  base: '/junkyard-camp/',
  plugins: [react(), tailwindcss()],
})

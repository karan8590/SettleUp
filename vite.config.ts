import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      target: 'vercel'
    })
  ]
})

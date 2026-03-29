import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-index-to-404',
      closeBundle() {
        const dist = resolve(__dirname, 'dist')
        const src  = resolve(dist, 'index.html')
        const dst  = resolve(dist, '404.html')
        if (fs.existsSync(src)) fs.copyFileSync(src, dst)
      },
    },
  ],
  base: '/project-tracker/',
})

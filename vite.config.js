import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

// __dirname is not available in ESM — derive it from import.meta.url
const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-index-to-404',
      closeBundle() {
        const src = resolve(__dirname, 'dist/index.html')
        const dst = resolve(__dirname, 'dist/404.html')
        if (fs.existsSync(src)) fs.copyFileSync(src, dst)
      },
    },
  ],
  base: '/project-tracker/',
})

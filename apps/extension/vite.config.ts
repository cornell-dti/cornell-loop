import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import webExtension from 'vite-plugin-web-extension'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svgr(),
    webExtension({ manifest: './manifest.json' }),
  ],
  build: {
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      '@app/ui': path.resolve(__dirname, '../../shared/ui/src'),
      '@app/convex': path.resolve(__dirname, '../dashboard/convex'),
    },
    dedupe: ['react', 'react-dom'],
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svgr(),
  ],
  envDir: '../../',
  resolve: {
    alias: {
      '@app/ui': path.resolve(__dirname, '../../shared/ui/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
})

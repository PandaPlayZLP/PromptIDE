import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

// https://vitejs.dev/config/
const isGhPages = process.env.GITHUB_PAGES === '1'

export default defineConfig({
  base: isGhPages ? '/PromptIDE/' : './',
  plugins: [
    react()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    cors: true
  },
  define: {
    __IS_ELECTRON__: JSON.stringify(!isGhPages)
  }
})


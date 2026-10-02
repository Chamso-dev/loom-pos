import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'path'

/**
 * Builds the real LoomPOS interface as one self-contained HTML file with an
 * in-browser API and sample Algerian shop data: npm run build:demo.
 */
export default defineConfig({
  root: path.resolve(__dirname, 'demo'),
  publicDir: false,
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: {
    'import.meta.env.VITE_ROUTER': JSON.stringify('memory'),
    'import.meta.env.VITE_DEMO': JSON.stringify('true'),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5_000,
  },
})

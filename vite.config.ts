import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('zxing')) return 'vendor-scanner';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('pdf-parse')) return 'vendor-pdf';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('dexie')) return 'vendor-dexie';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom') || id.includes('zustand')) return 'vendor-framework';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})

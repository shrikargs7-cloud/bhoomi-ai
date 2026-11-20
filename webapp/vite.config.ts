import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) return 'vendor-leaflet';
            if (id.includes('@xyflow')) return 'vendor-xyflow';
            if (id.includes('recharts')) return 'vendor-recharts';
            if (id.includes('/d3-') || id.includes('victory-vendor')) return 'vendor-d3';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
})

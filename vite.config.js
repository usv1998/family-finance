import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Set this to your GitHub repo name e.g. "/family-finance/"
// If you name your repo something else, change it here
const BASE_PATH = "/family-finance/";

export default defineConfig({
  base: process.env.NODE_ENV === "production" ? BASE_PATH : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Family Finance Tracker',
        short_name: 'FinTracker',
        description: 'Selva & Akshaya — Microsoft + Nvidia income tracker',
        theme_color: '#0B1120',
        background_color: '#0B1120',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/family-finance/',
        scope: '/family-finance/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { recharts: ["recharts"] }
      }
    }
  },
  server: {
    host: true,
    port: 5173
  }
})

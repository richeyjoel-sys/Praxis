import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

// The build stamp: git commit + date, shown on the Home screen so anyone can
// tell at a glance whether a deployed site is serving the latest push.
const stamp = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim() + ' · ' + new Date().toISOString().slice(0, 10)
  } catch {
    return 'dev'
  }
})()

// Praxis — Vite build.
// The service worker is network-first for the app shell and its data
// (see the prototype's sw.js): stale builds during review rounds were a real
// defect class, so the cache is an offline fallback only, never the source.
export default defineConfig({
  define: { __BUILD__: JSON.stringify(stamp) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Praxis',
        short_name: 'Praxis',
        description: 'Volunteer coverage and delegate movement planner',
        start_url: '/',
        display: 'standalone',
        background_color: '#fbfbfa',
        theme_color: '#1f5fbf',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Network first for everything we serve; cache is the offline fallback.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'praxis-shell', networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ request }) => ['script', 'style', 'worker'].includes(request.destination),
            handler: 'NetworkFirst',
            options: { cacheName: 'praxis-assets', networkTimeoutSeconds: 4 },
          },
          {
            // OpenStreetMap tiles pulled for the "Pull the real map" flow.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/react')) return 'react'
          return undefined
        },
      },
    },
  },
})

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/PRTracker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'],
        // Adds the share-target POST handler to the generated service worker.
        importScripts: ['share-target-sw.js'],
      },
      manifest: {
        name: 'PRTracker',
        short_name: 'PRTracker',
        description: 'Exercise-based PR and working weight tracker. All data stays on your device.',
        display: 'standalone',
        background_color: '#0f1216',
        theme_color: '#0f1216',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Lets the installed app receive a workout from another app's share sheet,
        // as an image (OCR'd on arrival) or as plain text.
        share_target: {
          action: 'share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'image', accept: ['image/*'] }],
          },
        },
      },
    }),
  ],
})

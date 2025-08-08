import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'manual', // No auto-update para reducir background activity
      workbox: {
        // Configuración más conservadora para el service worker
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        // Reducir actividad en background
        skipWaiting: false,
        clientsClaim: false
      },
      manifest: {
        short_name: 'Vales',
        name: 'Gestión de Vales',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
        start_url: '.',
        display: 'standalone',
        theme_color: '#2563eb',
        background_color: '#ffffff'
      }
    })
  ]
});

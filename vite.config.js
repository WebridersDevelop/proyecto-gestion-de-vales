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
        // Optimización específica para Firebase tiempo real
        runtimeCaching: [
          {
            // Firebase Auth - Cache más agresivo (no cambia frecuentemente)
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 horas
              }
            }
          },
          {
            // Firestore - Network First PERO con timeout corto para tiempo real
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 3, // REDUCIDO de 10 a 3 segundos
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // Solo 5 minutos de cache
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              // Plugin personalizado para invalidar cache en writes
              plugins: [{
                cacheWillUpdate: async ({ request, response }) => {
                  // No cachear writes/mutations
                  if (request.method !== 'GET') return null;
                  return response;
                }
              }]
            }
          }
        ],
        // Configuración ultra-conservadora para reducir background activity
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        // Reducir precaching solo a archivos críticos
        globPatterns: ['**/*.{js,css,html,png,jpg,gif,svg,woff2}'],
        // Ignorar archivos grandes que no son críticos
        globIgnores: ['**/node_modules/**/*', '**/src/**/*']
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

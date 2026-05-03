import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 6001,
      host: true,
      hmr: {
        // Allow HMR connections from external IPs
        host: process.env.VITE_HMR_HOST || 'localhost',
        clientPort: 6001,
      },
      proxy: {
        '/api': {
          target: process.env.VITE_API_TARGET || 'http://backend:7000',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('[Proxy Error] /api:', err);
            });
            proxy.on('proxyReq', (_proxyReq, req, _res) => {
              console.log('[Proxy Request] Sending to Target:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('[Proxy Response] Received from Target:', proxyRes.statusCode, req.url);
            });
          }
        },
        '/uploads': {
          target: process.env.VITE_API_TARGET || 'http://backend:7000',
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'SafeGuardPro SST',
          short_name: 'SafeGuardPro',
          description: 'Sistema de Gestão de SST e Inspeções',
          theme_color: '#10B981',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
          navigateFallback: '/index.html',
        },
        devOptions: {
          enabled: false
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

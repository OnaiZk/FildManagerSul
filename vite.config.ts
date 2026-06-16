import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      hmr: {
        overlay: false,      // Disable error overlay that can cause reloads
        timeout: 60000,      // Increase WebSocket timeout
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['assets/logo_icon.png'],
        workbox: {
          maximumFileSizeToCacheInBytes: 5000000, // Increase limit to 5MB
          skipWaiting: false,
          clientsClaim: false,
        },
        manifest: {
          name: 'Eletromidia Field Manager - Sul',
          short_name: 'Field Manager Sul',
          description: 'Sistema de Gestão de Operações em Campo - Filial Sul',
          theme_color: '#FA3A00',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'assets/logo_icon.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'assets/logo_icon.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        devOptions: {
          enabled: false
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-ui': ['lucide-react', 'recharts'],
            'vendor-utils': ['xlsx', 'exceljs']
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});

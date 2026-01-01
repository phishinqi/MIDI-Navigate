import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'root-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/frontend/index.html' });
            res.end();
            return;
          }
          next();
        });
      }
    }
  ],

  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend/src"),
    },
  },

  server: {
    host: '127.0.0.1',
    port: 5173,
    open: '/frontend/index.html',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: [
        '**/backend/**',
        '**/.venv/**',
        '**/venv/**',
        '**/__pycache__/**',
        '**/.git/**'
      ]
    }
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
    chunkSizeWarningLimit: 3000,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        ws: resolve(__dirname, 'ws/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pixi.js') || id.includes('@pixi')) {
              return 'pixi-vendor';
            }
            if (id.includes('p5')) {
              return 'p5-vendor';
            }
            return 'vendor';
          }
        },
      },
    },
  },
})

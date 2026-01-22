import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // 1. 插件配置
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

  // 2. 路径别名配置
  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend/src"),
    },
  },

  // 3. 开发服务器配置
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

  // 4. 构建配置
  build: {
    outDir: resolve(__dirname, 'dist'),
    // 再次调大警告阈值，因为 vendor 包将会很大，这是为了换取稳定性
    chunkSizeWarningLimit: 3000,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        ws: resolve(__dirname, 'ws/index.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // [安全策略]
            // 只拆分完全独立、不依赖 React 上下文的巨型库

            // 1. PixiJS (2D引擎 - 很大且独立)
            if (id.includes('pixi.js') || id.includes('@pixi')) {
              return 'pixi-vendor';
            }

            // 2. P5.js (创意编程库 - 很大且独立)
            if (id.includes('p5')) {
              return 'p5-vendor';
            }

            // [关键修复]
            // Three.js, React, Tone.js, i18next 等全部合并到 vendor
            // 这样可以确保 react-three-fiber 能正确找到 React 的 useLayoutEffect
            return 'vendor';
          }
        },
      },
    },
  },
})

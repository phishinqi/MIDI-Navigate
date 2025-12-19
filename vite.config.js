import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // 1. 插件配置
  plugins: [
    react(),
    // 自定义插件：处理根路径重定向
    {
      name: 'root-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // 如果访问的是根路径 '/'，重定向到 frontend/index.html
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
    // 强制使用 IPv4 (127.0.0.1)，解决 localhost 解析慢的问题
    host: '127.0.0.1',
    port: 5173,

    // 启动时自动打开的路径
    open: '/frontend/index.html',

    // API 代理配置
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      }
    },

    // 文件监听设置 (解决加载慢的核心配置)
    watch: {
      // 忽略后端目录和虚拟环境，防止 Vite 扫描过多文件导致卡顿
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'frontend/index.html'),
        ws: resolve(__dirname, 'ws/index.html'), // 确保这里的文件名和你实际的一致
      },
    },
  },
})
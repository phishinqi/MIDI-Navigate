// vite.config.js (位于项目根目录)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  // 1. ！！！移除 `root: 'frontend'` ！！！
  // 这将让 Vite 从项目根目录提供服务，从而能访问到所有文件夹。

  plugins: [react()],

  resolve: {
    alias: {
      // 路径从项目根目录 __dirname 开始解析，这是正确的
      "@": resolve(__dirname, "frontend/src"),
    },
  },

  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  },

  build: {
    // 构建输出目录，相对于项目根目录
    outDir: resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        // 2. 明确定义每一个入口 HTML 文件的路径
        main: resolve(__dirname, 'frontend/index.html'),
        ws: resolve(__dirname, 'ws/ws.html'),
      },
    },
  },
})

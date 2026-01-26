import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import obfuscator from 'rollup-plugin-obfuscator';

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
    },
    {
      ...obfuscator({
        include: [
          '**/chordAnalyzer.ts',
          '**/chordNameFinder.ts',
          '**/lib/theory.ts'
        ],
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 1,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 1,
          debugProtection: true,
          debugProtectionInterval: 4000,
          disableConsoleOutput: true,
          identifierNamesGenerator: 'hexadecimal',
          log: false,
          numbersToExpressions: true,
          renameGlobals: false,
          selfDefending: true,
          simplify: true,
          splitStrings: true,
          splitStringsChunkLength: 5,
          stringArray: true,
          stringArrayCallsTransform: true,
          stringArrayEncoding: ['rc4'],
          stringArrayIndexShift: true,
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 5,
          stringArrayWrappersChainedCalls: true,
          stringArrayWrappersParametersMaxCount: 5,
          stringArrayThreshold: 1,
          transformObjectKeys: true,
          unicodeEscapeSequence: false
        }
      }),
      apply: 'build'
    }
  ],

  // 2. 路径别名配置
  resolve: {
    alias: {
      "@": resolve(__dirname, "frontend/src"),
    },
  },

  // 3. 服务器配置
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

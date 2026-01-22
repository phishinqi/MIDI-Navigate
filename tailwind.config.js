// tailwind.config.js (位于项目根目录)

/** @type {import('tailwindcss').Config} */
export default {
  // --- 核心修正：更新扫描路径 ---
  // 因为此文件现在在根目录，所以路径需要包含 'frontend'
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
    "./ws/ws.html", // 同时扫描独立页面
  ],

  // 您的 theme 和 plugins 部分保持不变
  theme: {
    extend: {
      colors: {
        'midi-black': '#0a0a0a',
        'midi-dark': '#121212',
        'midi-gray': '#2a2a2a',
        'midi-accent': '#e0e0e0',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

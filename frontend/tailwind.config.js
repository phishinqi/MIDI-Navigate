/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 自定义深色模式调色板，用于 Zen Mode
        'midi-black': '#0a0a0a',
        'midi-dark': '#121212',
        'midi-gray': '#2a2a2a',
        'midi-accent': '#e0e0e0', // 高对比度文字
      },
      fontFamily: {
        // 推荐使用等宽字体增强 "代码艺术" 的感觉
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}

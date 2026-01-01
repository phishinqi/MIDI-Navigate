// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
    "./ws/ws.html", 
  ],

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

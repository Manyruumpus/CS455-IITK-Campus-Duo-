/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        craft: {
          bg: '#121316',
          surface: '#181a1f',
          surfaceHover: '#20232a',
          card: '#15171b',
          border: 'rgba(237, 238, 240, 0.08)',
          borderMedium: 'rgba(237, 238, 240, 0.16)',
          borderCraft: 'rgba(217, 119, 54, 0.28)',
          ink: '#edeef0',
          muted: '#8a8f98',
          subtle: '#5c6068',
        },
        ember: {
          50: '#fdf6f0',
          100: '#faebd9',
          200: '#f4d5b2',
          300: '#ecb882',
          400: '#e06b3a',
          500: '#d97736',
          600: '#b85d26',
          700: '#944720',
          800: '#773a1e',
          900: '#62311b',
        },
        brass: {
          400: '#e2c058',
          500: '#d4af37',
          600: '#ab8b26',
        },
        status: {
          available: '#10b981',
          'available-bg': 'rgba(16, 185, 129, 0.12)',
          reserved: '#f59e0b',
          'reserved-bg': 'rgba(245, 158, 11, 0.12)',
          occupied: '#ef4444',
          'occupied-bg': 'rgba(239, 68, 68, 0.12)',
          locked: '#64748b',
          'locked-bg': 'rgba(100, 116, 139, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'craft-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
        'craft-md': '0 4px 14px 0 rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(237, 238, 240, 0.06)',
        'craft-glow': '0 0 35px -5px rgba(217, 119, 54, 0.22)',
      },
    },
  },
  plugins: [],
};

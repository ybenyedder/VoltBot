/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#7c5cff',
          50:  '#f3efff',
          100: '#e6dcff',
          200: '#cdb9ff',
          300: '#b496ff',
          400: '#9b78ff',
          500: '#7c5cff',
          600: '#6347e6',
          700: '#4d36b8',
          800: '#3a288a',
          900: '#261b5c',
          950: '#170f3a',
        },
        neutral: {
          50:  '#f6f6f7',
          100: '#e6e6e8',
          200: '#c9c9ce',
          300: '#a1a1a9',
          400: '#74747d',
          500: '#52525b',
          600: '#3a3a40',
          700: '#27272b',
          800: '#1a1a1d',
          850: '#141416',
          900: '#0f0f11',
          950: '#0a0a0c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightish: '-0.015em',
      },
      boxShadow: {
        soft: '0 2px 6px -1px rgba(0,0,0,0.25), 0 8px 24px -8px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(124,92,255,0.35), 0 8px 32px -4px rgba(124,92,255,0.45)',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 220ms ease-out both',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}

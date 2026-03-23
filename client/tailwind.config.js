/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        risk: {
          low:      '#22c55e',
          medium:   '#f59e0b',
          high:     '#ef4444',
          critical: '#a855f7',
        },
        surface: {
          DEFAULT: '#0f172a',
          card:    '#1e293b',
          border:  '#334155',
        },
      },
    },
  },
  plugins: [],
}


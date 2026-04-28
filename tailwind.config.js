/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          900: '#0A0A0B',
          800: '#121214',
          700: '#1A1A1D',
          600: '#252529',
        },
        accent: {
          primary: '#6366F1',
          secondary: '#10B981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        primary: {
          DEFAULT: '#10b981',
          foreground: '#ffffff',
          dark: '#059669',
          light: '#34d399',
        },
        accent: {
          500: '#6366f1',
          600: '#4f46e5',
        },
        carbon: {
          950: '#070709',
          900: '#0b0c10',
          850: '#111218',
          800: '#181922',
          750: '#20222e',
          700: '#2a2c3c',
        }
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'Oswald', 'system-ui', 'sans-serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['Merriweather', 'Lora', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#b8d0ff',
          300: '#8eb3ff',
          400: '#5f8fff',
          500: '#3b6fed',
          600: '#2954c8',
          700: '#1f3fa0',
          800: '#1a3380',
          900: '#172b66',
          950: '#0f1c45',
        },
        accent: {
          400: '#7c83fd',
          500: '#5b63f5',
          600: '#4347c9',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 10px rgba(23, 43, 102, 0.08)',
        panel: '0 8px 30px rgba(23, 43, 102, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideIn: { '0%': { opacity: 0, transform: 'translateX(16px)' }, '100%': { opacity: 1, transform: 'translateX(0)' } },
        pulseSoft: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.55 } },
      },
    },
  },
  plugins: [],
};

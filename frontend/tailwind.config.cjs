/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        ink: '#14121B',
        mist: '#F6F3EF',
        teal: {
          900: '#0B3C3B',
          700: '#0E6F6B',
          500: '#11A39A',
          300: '#7ED9CF'
        },
        coral: {
          700: '#D1654B',
          500: '#E07A5F',
          300: '#F2B6A2'
        },
        lilac: {
          500: '#7E6AE6',
          300: '#C4B8FF'
        }
      },
      boxShadow: {
        card: '0 18px 50px -32px rgba(15, 23, 42, 0.55)',
        lift: '0 16px 30px -18px rgba(15, 23, 42, 0.45)'
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem'
      }
    }
  },
  plugins: []
};

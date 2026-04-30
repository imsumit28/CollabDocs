/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        apple: {
          blue:     '#007AFF',
          'blue-dark': '#0055D4',
          'blue-light': '#4DA3FF',
          indigo:   '#5856D6',
          purple:   '#AF52DE',
          pink:     '#FF2D55',
          red:      '#FF3B30',
          orange:   '#FF9500',
          yellow:   '#FFCC00',
          green:    '#34C759',
          teal:     '#5AC8FA',
          gray: {
            50:  '#F5F5F7',
            100: '#E8E8ED',
            200: '#D1D1D6',
            300: '#AEAEB2',
            400: '#8E8E93',
            500: '#636366',
            600: '#48484A',
            700: '#3A3A3C',
            800: '#2C2C2E',
            900: '#1C1C1E',
          },
        },
      },
      boxShadow: {
        'apple-sm':  '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'apple':     '0 2px 8px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
        'apple-md':  '0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
        'apple-lg':  '0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
        'apple-xl':  '0 20px 60px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.10)',
      },
      backdropBlur: {
        'apple': '20px',
      },
      borderRadius: {
        'apple':    '10px',
        'apple-lg': '14px',
        'apple-xl': '18px',
        'apple-2xl':'22px',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'scale-in':   'scaleIn 0.2s ease-out',
        'shimmer':    'shimmer 1.6s infinite linear',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                      to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' },     to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
      },
    },
  },
  plugins: [],
};

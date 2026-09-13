/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1B2430',
          soft: '#5B6675',
          faint: '#8B95A3',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          soft: '#F5F6F8',
          raised: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E4E7EC',
        },
        accent: {
          DEFAULT: '#2E6F6E',
          dark: '#1F5251',
          soft: '#E4F0EF',
        },
        success: '#2E7D5B',
        warning: '#B7791F',
        danger: '#C0392B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        control: '9px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27, 36, 48, 0.04), 0 8px 24px -12px rgba(27, 36, 48, 0.12)',
      },
    },
  },
  plugins: [],
};

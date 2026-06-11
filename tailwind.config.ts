import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Tema é controlado pela classe .dark no <html> (ThemeContext), não pela
  // preferência do SO. Sem isto, utilitários dark:* seguiam o SO e brigavam
  // com o tema do app (ex.: texto dark:text-yellow ilegível no tema claro).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'rgb(var(--color-app) / <alpha-value>)',
        paper: {
          DEFAULT: 'rgb(var(--color-paper) / <alpha-value>)',
          deep: 'rgb(var(--color-paper-deep) / <alpha-value>)',
          white: 'rgb(var(--color-paper-white) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
          2: 'rgb(var(--color-ink-2) / <alpha-value>)',
          3: 'rgb(var(--color-ink-3) / <alpha-value>)',
          4: 'rgb(var(--color-ink-4) / <alpha-value>)',
        },
        line: 'rgb(var(--color-line) / <alpha-value>)',
        'line-strong': 'rgb(var(--color-line-strong))',
        hairline: 'rgb(var(--color-hairline))',
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          2: 'rgb(var(--color-surface-2) / <alpha-value>)',
          3: 'rgb(var(--color-surface-3) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
          muted: 'rgb(var(--color-card-muted) / <alpha-value>)',
        },
        inverse: {
          DEFAULT: 'rgb(var(--color-inverse-bg) / <alpha-value>)',
          text: 'rgb(var(--color-inverse-text) / <alpha-value>)',
        },
        yellow: '#FFCB05',
        green: {
          DEFAULT: '#00A651',
          deep: '#007A3E',
        },
        red: '#E63946',
        blue: '#1D3557',
        gold: '#C9A856',
        sky: '#6FB4FF',
      },
      fontFamily: {
        display: ['Anton', 'Bebas Neue', 'Impact', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        full: '999px',
      },
      boxShadow: {
        btn: '4px 4px 0 rgb(var(--color-shadow-strong))',
        'btn-hover': '5px 5px 0 rgb(var(--color-shadow-strong))',
        'btn-active': '2px 2px 0 rgb(var(--color-shadow-strong))',
        card: '4px 4px 0 rgb(var(--color-shadow-strong))',
        'card-yellow': '8px 8px 0 #FFCB05',
        'card-live': '0 0 0 3px #E63946, 6px 6px 0 rgb(var(--color-shadow-strong))',
        device: '0 40px 80px rgb(var(--color-shadow-soft) / 0.28), 0 0 0 1px rgb(var(--color-hairline) / 0.9)',
      },
      letterSpacing: {
        eyebrow: '0.14em',
        display: '0.005em',
        mono: '-0.02em',
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'pulse-live': 'pulse-live 1.4s ease-in-out infinite',
        appear: 'appear 0.5s ease both',
        'news-progress': 'news-progress 9s linear forwards',
      },
      keyframes: {
        'news-progress': {
          from: { width: '0%' },
          to: { width: '100%' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(1.2)' },
        },
        appear: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'pitch-turf':
          'repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,.06) 24px, rgba(0,0,0,.06) 25px)',
        'paper-grain':
          'radial-gradient(ellipse at 20% 50%, rgba(120,72,0,.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(80,60,0,.05) 0%, transparent 40%), radial-gradient(ellipse at 50% 80%, rgba(100,80,20,.03) 0%, transparent 60%)',
        stripe:
          'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(0,0,0,.06) 4px, rgba(0,0,0,.06) 8px)',
      },
    },
  },
  plugins: [],
} satisfies Config

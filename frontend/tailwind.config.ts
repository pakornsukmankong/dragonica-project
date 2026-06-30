import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--default-font-family)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        paper: {
          50: 'var(--paper-50)',
          100: 'var(--paper-100)',
          200: 'var(--paper-200)',
        },
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
          950: 'var(--gray-950)',
        },
        blue: {
          300: 'var(--blue-300)',
          400: 'var(--blue-400)',
          500: 'var(--blue-500)',
        },
        gold: {
          soft: 'var(--gold-soft)',
          DEFAULT: 'var(--gold)',
          strong: 'var(--gold-strong)',
          dim: 'var(--gold-dim)',
        },
        rarity: {
          common: 'var(--rarity-common)',
          uncommon: 'var(--rarity-uncommon)',
          rare: 'var(--rarity-rare)',
          epic: 'var(--rarity-epic)',
          legendary: 'var(--rarity-legendary)',
        },
        success: {
          soft: 'var(--success-soft)',
          DEFAULT: 'var(--success)',
          strong: 'var(--success-strong)',
        },
        danger: {
          soft: 'var(--danger-soft)',
          DEFAULT: 'var(--danger)',
          strong: 'var(--danger-strong)',
        },
        warning: {
          soft: 'var(--warning-soft)',
          DEFAULT: 'var(--warning)',
          strong: 'var(--warning-strong)',
        },
      },
      backgroundColor: {
        root: 'var(--root)',
        background: 'var(--background)',
        surface: 'var(--surface)',
        cream: 'var(--cream)',
        raised: 'var(--raised)',
      },
      textColor: {
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        'dark-gray': 'var(--dark-gray)',
      },
      borderColor: {
        border: 'var(--border)',
        'border-dark': 'var(--border-dark)',
      },
      borderRadius: {
        base: '6px',
        sm: '4px',
        xs: '2px',
        full: '9999px',
      },
      fontSize: {
        xs: ['14px', { lineHeight: '20px' }],
        sm: ['16px', { lineHeight: '24px' }],
        base: ['18px', { lineHeight: '28px' }],
        lg: ['24px', { lineHeight: '32px' }],
        xl: ['30px', { lineHeight: '38px' }],
        '2xl': ['40px', { lineHeight: '48px' }],
        '3xl': ['48px', { lineHeight: '52px' }],
        '4xl': ['64px', { lineHeight: '68px' }],
      },
      boxShadow: {
        subtle: '0 1px 0 0 rgba(0, 0, 0, 0.4)',
        sm: '0 2px 6px rgba(0, 0, 0, 0.4)',
        card: '0 1px 0 0 rgba(255, 255, 255, 0.03), 0 8px 24px -12px rgba(0, 0, 0, 0.6)',
        button: 'inset 0 1px rgba(255, 255, 255, 0.18), inset 0 -1px rgba(0, 0, 0, 0.25)',
        gold: '0 0 0 1px rgba(224, 165, 60, 0.4), 0 0 20px -6px rgba(224, 165, 60, 0.5)',
      },
      screens: {
        laptop: '900px',
        wide: '1140px',
        desktop: '1471px',
      },
      maxWidth: {
        container: '1080px',
        'container-wide': '1321px',
      },
    },
  },
  plugins: [],
};

export default config;

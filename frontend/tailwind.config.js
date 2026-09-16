/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#141414',
        'ink-soft': '#262626',
        canvas: '#ffffff',
        'canvas-soft': '#f3f3f3',
        field: '#f0f0f0',
        'hairline-soft': '#f0f0f0',
        hairline: '#e0e0e0',
        muted: '#707070',
        faint: '#adadad',
        accent: '#0066ff',
        // Semantic risk colors (subtle)
        'risk-high': '#b30000',
        'risk-medium': '#c2410c',
        'risk-low': '#15803d',
        'risk-high-bg': '#fff1f0',
        'risk-medium-bg': '#fff7ed',
        'risk-low-bg': '#f0fdf4',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      fontSize: {
        display: ['80px', { lineHeight: '1', fontWeight: '700' }],
        'heading-1': ['56px', { lineHeight: '1', fontWeight: '700' }],
        'heading-2': ['44px', { lineHeight: '1.13', fontWeight: '700' }],
        'heading-3': ['32px', { lineHeight: '1.13', fontWeight: '700' }],
        'heading-4': ['24px', { lineHeight: '1.25', fontWeight: '700' }],
        title: ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['20px', { lineHeight: '1.38', fontWeight: '300' }],
        body: ['16px', { lineHeight: '1.38', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.43', fontWeight: '400' }],
        label: ['12px', { lineHeight: '1.33', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '1.33', fontWeight: '400' }],
      },
      borderRadius: {
        none: '0px',
        sm: '16px',
        md: '24px',
        full: '9999px',
        DEFAULT: '8px',
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '80px',
        'section-lg': '120px',
      },
      boxShadow: {
        none: 'none',
        // Only used for the active segment control pill
        segment: '0 1px 3px 0 rgba(0,0,0,0.08)',
      },
      animation: {
        marquee: 'marquee 40s linear infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

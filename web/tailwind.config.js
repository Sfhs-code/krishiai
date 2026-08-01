/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--card-foreground)' },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          soft: 'var(--primary-soft)',
        },
        secondary: { DEFAULT: 'var(--secondary)', foreground: 'var(--secondary-foreground)' },
        muted: { DEFAULT: 'var(--muted)', foreground: 'var(--muted-foreground)' },
        accent: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-foreground)' },
        destructive: { DEFAULT: 'var(--destructive)', foreground: 'var(--destructive-foreground)' },
        warning: { DEFAULT: 'var(--warning)', foreground: 'var(--warning-foreground)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.5rem)',
        sm: 'calc(var(--radius) - 0.85rem)',
        xl: 'calc(var(--radius) + 0.375rem)',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        float: 'var(--shadow-float)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.65' },
          '70%,100%': { transform: 'scale(1.7)', opacity: '0' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'slide-up': { from: { transform: 'translateY(100%)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        'bar-grow': { from: { transform: 'scaleY(0)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        shimmer: 'shimmer 1.6s infinite',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1B2E4B',
        gold: { DEFAULT: '#C4A044', light: '#E8C96A' },
        surface: '#F8F7F4',
        muted: '#6B7280',
        success: '#2E7D5E',
        border: '#E5E2DC',
        text: '#1A1A2E',
      },
      fontFamily: {
        display: ['Georgia', 'Gloock', 'serif'],
        sans: ['Inter', 'DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

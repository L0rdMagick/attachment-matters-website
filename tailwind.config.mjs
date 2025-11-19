// tailwind.config.mjs
/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'brand-cream': '#FAF7F2',       // A soft, warm, premium off-white for backgrounds
        'brand-charcoal': '#333333',    // A dark, rich gray for main text, softer than black
        'brand-terracotta': '#C66E4E',  // Your warm, autumnal accent for buttons and highlights
        'brand-deep-teal': '#1D5A5A',   // A professional, calming secondary accent
        'brand-stone': '#EAE5DC',       // A subtle color for borders and background sections
        'brand-highlight': '#FDE68A',   // A warm yellow for highlighting text, like the inspiration
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
// tailwind.config.mjs
/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'brand-linen': '#F7F2E9',       // A warmer, richer off-white for main backgrounds
        'brand-ink': '#2C2A2A',         // A very dark brown/black for main text
        'brand-terracotta': '#BF5B33',  // A deeper, richer, more earthy orange
        'brand-moss': '#4A5741',        // A deep, calming, and professional olive/moss green
        'brand-sandstone': '#EAE1D2',   // A warmer, darker shade for background sections
      },
      fontFamily: {
        // Expressive serif for headings
        serif: ['Playfair Display', ...defaultTheme.fontFamily.serif],
        // Clean, warm sans-serif for body text
        sans: ['Source Sans 3', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
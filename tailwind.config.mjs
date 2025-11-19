// tailwind.config.mjs
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'brand-deep-purple': '#483248', // A bold, deep purple
        'brand-rust': '#a84e32',       // An earthy, autumnal rust
        'brand-teal': '#32a8a4',       // A calming turquoise/teal
        'brand-blush': '#f4d3d3',      // A subtle, soft pink/blush
        'brand-sand': '#f4f1ea',       // A warm, inviting off-white for backgrounds
        'brand-gray': '#4a4a4a',       // A soft gray for text
      },
      fontFamily: {
        'sans': ['Georgia', 'serif'], // A classic, trustworthy serif for headings
        'body': ['"Helvetica Neue"', 'sans-serif'], // A clean, readable font for body text
      }
    },
  },
  plugins: [],
}
// tailwind.config.mjs
/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'brand-deep-purple': '#483248', // For headlines and strong text
        'brand-rust': '#a84e32',       // For buttons and calls-to-action
        'brand-teal': '#32a8a4',       // A secondary accent color
        'brand-blush': '#f4d3d3',      // For subtle backgrounds or accents
        'brand-sand': '#f9f6f1',       // The primary warm background color
        'brand-gray': '#3d3d3d',       // A softer, more readable body text color
      },
      fontFamily: {
        // We set 'Lato' as the default sans-serif font
        sans: ['Lato', ...defaultTheme.fontFamily.sans],
        // We keep Georgia for a classic, trustworthy heading option if needed
        serif: ['Georgia', ...defaultTheme.fontFamily.serif],
      },
    },
  },
  plugins: [],
}
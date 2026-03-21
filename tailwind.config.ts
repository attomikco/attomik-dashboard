import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#ffffff',
        cream: '#f2f2f2',
        accent: '#00ff97',
        'accent-light': '#e6fff5',
        muted: '#666666',
        border: '#e0e0e0',
        success: '#00cc78',
      },
      fontFamily: {
        barlow: ['Barlow', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config

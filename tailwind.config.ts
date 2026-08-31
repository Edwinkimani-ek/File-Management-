import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f5f7fa',
          100: '#e9edf3',
          200: '#cfd8e3',
          300: '#a9b8cc',
          400: '#7c90ad',
          500: '#5b7191',
          600: '#475a77',
          700: '#3a4a61',
          800: '#2f3b4d',
          900: '#1f2733',
        },
        brand: {
          50: '#eef6f2',
          100: '#d6ebe1',
          200: '#aed7c4',
          300: '#7fbca2',
          400: '#519d80',
          500: '#337f65',
          600: '#256551',
          700: '#1e5142',
          800: '#194134',
          900: '#123027',
        },
      },
    },
  },
  plugins: [],
};

export default config;

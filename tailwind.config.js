/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: '#0B5FFF',
        pine: '#0F766E',
      },
      boxShadow: {
        admin: '0 16px 42px rgba(2, 6, 23, 0.45)',
      },
    },
  },
  plugins: [],
};

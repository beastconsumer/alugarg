/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './admin.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B1F3B',
          off: '#F7F5F2',
          text: '#111827',
          cta: '#2F5BFF',
          slate: '#64748B',
          premium: '#C8A24A',
          danger: '#DC2626',
          success: '#16A34A',
          surface: '#F2F4F7',
        },
      },
      boxShadow: {
        admin: '0 16px 42px rgba(11, 31, 59, 0.22)',
      },
    },
  },
  plugins: [],
};

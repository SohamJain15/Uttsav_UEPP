/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        pageBg: '#F8FAFC',
        cardBg: '#FFFFFF',
        textMain: '#0F172A',
        textSecondary: '#64748B',
        borderMain: '#E5E7EB',
        statusGreen: '#16A34A',
        statusYellow: '#F59E0B',
        statusRed: '#DC2626',
        statusOrange: '#EA580C'
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'sans-serif']
      },
      boxShadow: {
        card: '0 4px 14px rgba(15, 23, 42, 0.06)'
      }
    }
  },
  plugins: []
};

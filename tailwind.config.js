/** @type {import('tailwindcss').Config} */
export default {
  content: ['./magasin3d.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Segoe UI', 'system-ui', 'sans-serif'] },
      colors: {
        acier: {
          950: '#0b0e12', 900: '#11151b', 850: '#161b22', 800: '#1c222b', 700: '#262e39',
          600: '#34404e', 500: '#4a5868', 400: '#6b7a8c', 300: '#94a3b4', 200: '#c4cdd8', 100: '#e4e9ef',
        },
        securite: { DEFAULT: '#f5b301', sombre: '#c48f00' },
      },
    },
  },
  plugins: [],
};

// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {}, // Cambio importante: usar el plugin específico de v4
    autoprefixer: {},
  },
};
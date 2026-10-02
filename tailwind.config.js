/** @type {import('tailwindcss').Config} */
export default {
  // 'media' => suit automatiquement la préférence sombre/clair du système (KDE).
  darkMode: "media",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accents alignés avec la palette Breeze de KDE.
        breeze: {
          DEFAULT: "#3daee9",
          dark: "#1d99f3",
        },
      },
    },
  },
  plugins: [],
};

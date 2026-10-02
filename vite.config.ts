import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri attend un serveur de dev à port fixe et ne doit pas voir Vite nettoyer l'écran.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Ne pas surveiller le dossier Rust.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    minify: "esbuild",
    sourcemap: false,
  },
});

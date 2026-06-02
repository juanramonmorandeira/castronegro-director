// vite.config.js
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte()],
  build: {
    // La aplicacion actual empaqueta dependencias pesadas del proyecto completo.
    // Subimos el umbral para que Vite no emita ruido en cada build mientras el
    // foco esta en estabilizar el nucleo de dominio.
    chunkSizeWarningLimit: 1200
  },
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, "./src/lib")
    }
  }
});

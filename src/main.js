// src/main.js
// ───────────────────────────────────────────────────────────
// Punto de entrada de la aplicación (Vite + Svelte 5).
// - Importa estilos globales (app.css).
// - Monta el componente raíz App.svelte dentro del #app de index.html.
// ───────────────────────────────────────────────────────────

import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

// Monta la aplicación en el contenedor principal.
// Nota: asegúrate de que en public/index.html exista <div id="app"></div>.
const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
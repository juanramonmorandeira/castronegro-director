<!-- src/App.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // App.svelte
  // Este componente raíz actúa como “router” ligero.
  // - Controla qué vista se muestra (landing / configurador / sesión).
  // - Mantiene en memoria el ID de la sesión actual (si la hay).
  // - Monta la capa de fondo (BackgroundLayer) por debajo.
  // ─────────────────────────────────────────────────────────────

  import BackgroundLayer from './components/landing/BackgroundLayer.svelte';
  import Landing from "./components/Landing.svelte";

  // Estado de navegación actual:
  let view = "landing";          // Valores posibles: "landing" | "configure" | "session"
  let currentSessionId = null;   // ID de la sesión activa (Firestore doc.id)

  /**
   * goConfigure(sessionId)
   * ─────────────────────────────────────────────────────────────
   * Callback que se ejecuta al pulsar “Create new game” en Landing.
   * Guarda el ID de la sesión recién creada y cambia la vista a “configure”.
   */
  function goConfigure(sessionId) {
    currentSessionId = sessionId;
    view = "configure";
  }

  /**
   * goSession(sessionId)
   * ─────────────────────────────────────────────────────────────
   * Callback que se ejecuta al pulsar “View current game”.
   * Guarda el ID de la sesión y cambia la vista a “session”.
   */
  function goSession(sessionId) {
    currentSessionId = sessionId;
    view = "session";
  }
</script>

<!-- ─────────────────────────────────────────────────────────────
     CAPA DE FONDO FIJA (imagen + niebla)
     No captura eventos (pointer-events: none en el propio componente).
     Siempre está visible detrás de todas las vistas.
     ───────────────────────────────────────────────────────────── -->
<BackgroundLayer
  backgroundUrl="/images/background-village.png"
  fogUrl="/images/fog-texture.png"
/>

<!-- ─────────────────────────────────────────────────────────────
     CONTENIDO PRINCIPAL SEGÚN LA VISTA ACTUAL
     Solo se muestra una sección a la vez.
     ───────────────────────────────────────────────────────────── -->
{#if view === "landing"}
  <Landing onCreate={goConfigure} onViewCurrent={goSession}/>
{:else if view === "configure"}
  <!-- Placeholder del configurador de partida -->
  <div class="page">
    <div class="card">
      <h2>Configuración de partida</h2>
      <p>ID de sesión: {currentSessionId}</p>
      <!-- Aquí se montará ConfigureBasics.svelte en el siguiente paso -->
    </div>
  </div>

{:else if view === "session"}
  <!-- Placeholder de la vista de sesión activa -->
  <div class="page">
    <div class="card">
      <h2>Sesión en curso</h2>
      <p>ID de sesión: {currentSessionId}</p>
      <!-- Aquí se montará la interfaz de partida -->
    </div>
  </div>
{/if}

<style>
    /* ─────────────────────────────────────────────────────────────
     Estilos básicos locales para App.svelte
     Estos no son globales; solo afectan al árbol de este componente.
     Lo global está en src/app.css
     ───────────────────────────────────────────────────────────── */

  /* Asegura que el contenido principal se superpone al fondo */
  :global(.page) {
    position: relative;
    z-index: 1;
  }
/* Estilo simple de tarjeta para placeholders */
  .card {
    margin: 2rem auto;
    padding: 1rem 1.5rem;
    width: min(90%, 700px);
    border-radius: 12px;
    background-color: rgba(0, 0, 0, 0.4);
    color: #fff;
    backdrop-filter: blur(5px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }

  h2 {
    margin-top: 0;
  }
</style>

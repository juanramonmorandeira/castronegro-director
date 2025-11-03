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
  import Login from './components/Login.svelte';
  import Registration from './components/Registration.svelte';
  import { t } from './lib/i18n.js';

  let view = "login"; // login, landing, configure, session
  let currentSessionId = null;
  let currentRole = null;

  function goConfigure(sessionId) {
    currentSessionId = sessionId;
    view = "configure";
  }

  function goSession(sessionId) {
    currentSessionId = sessionId;
    view = "session";
  }
  function handleLoginSuccess(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    currentRole = detail?.role ?? null;
    currentSessionId = null;

    if (currentRole === 'storyteller') {
      view = 'landing';
    } else {
      view = 'session';
    }
  }

  function handleLoginForgot(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    console.info('Password reset requested for', detail?.email);
  }

  function goLogin() {
    view = 'login';
  }

  function goRegistration() {
    view = 'registration';
  }

  function handleRegistered(event) {
    const detail = event?.detail ?? event;
    console.info('User registered (inactive until verification):', detail);
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
{#if view === "login"}
  <Login
    onLoginSuccess={handleLoginSuccess}
    onLoginForgot={handleLoginForgot}
    on:navigate-registration={goRegistration}
  />
{:else if view === 'registration'}
  <Registration
    on:registered={handleRegistered}
    on:navigate-login={goLogin}
  />
{:else if view === "configure"}
  <!-- Placeholder del configurador de partida -->
  <div class="page">
    <div class="card">
      <h2>{$t('app.placeholders.configure_title')}</h2>
      <p>{$t('app.placeholders.session_id', { id: currentSessionId ?? '—' })}</p>
      <!-- Aquí se montará ConfigureBasics.svelte en el siguiente paso -->
    </div>
  </div>

{:else if view === "session"}
  <!-- Placeholder de la vista de sesión activa -->
  <div class="page">
    <div class="card">
      <h2>{$t('app.placeholders.session_title')}</h2>
      <p>{$t('app.placeholders.session_id', { id: currentSessionId ?? '—' })}</p>
      <!-- Aquí se montará la interfaz de partida -->
    </div>
  </div>
{:else if view === "landing"}
  <Landing onCreate={goConfigure} onViewCurrent={goSession} />
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

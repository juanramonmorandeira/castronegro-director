<!-- src/App.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // App.svelte
  // Este componente raíz actúa como “router” ligero.
  // - Controla qué vista se muestra (landing / configurador / sesión).
  // - Mantiene en memoria el ID de la sesión actual (si la hay).
  // - Monta la capa de fondo (BackgroundLayer) por debajo.
  // ─────────────────────────────────────────────────────────────

  import { onMount } from 'svelte';
  import BackgroundLayer from './components/common/BackgroundLayer.svelte';
  import Storyteller from "./pages/Storyteller.svelte";
  import Login from './pages/Login.svelte';
  import Registration from './pages/Registration.svelte';
  import PlayerSelection from './pages/PlayerSelection.svelte';
  import Profile from './pages/Profile.svelte';
  import VerifyEmail from './pages/VerifyEmail.svelte';
  import Configure from './pages/Configure.svelte';
  import { t } from './lib/i18n.js';
  import { fetchCurrentUserProfile, signOutUser } from './lib/auth.js';
  import { auth } from './lib/firebase.js';
  import { onAuthStateChanged } from 'firebase/auth';

  let view = "login"; // login, registration, verify-email, landing, player-selection, configure, session, profile
  let currentSessionId = null;
  let currentRole = null;
  let currentUser = null;
  let previousView = null;

  if (typeof window !== 'undefined') {
    const initialPath = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'verifyEmail' || initialPath === '/verify') {
      view = 'verify-email';
    } else if (initialPath === '/registration') {
      view = 'registration';
    } else if (initialPath === '/login') {
      view = 'login';
    }
  }

  function goConfigure(sessionId) {
    currentSessionId = sessionId;
    view = "configure";
  }

  function goSession(sessionId) {
    currentSessionId = sessionId;
    view = "session";
  }
  async function handleLoginSuccess(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    currentRole = detail?.role ?? null;
    currentSessionId = null;
    try {
      currentUser = await fetchCurrentUserProfile();
    } catch (error) {
      console.error('Unable to load user profile', error);
      currentUser = null;
    }

    if (currentRole === 'storyteller') {
      view = 'landing';
    } else {
      view = 'player-selection';
    }
  }

  function handleLoginForgot(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    console.info('Password reset requested for', detail?.email);
  }

  function goLogin() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/login';
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url);
    }
    view = 'login';
  }

  function goRegistration() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/registration';
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url);
    }
    view = 'registration';
  }

  function handleRegistered(event) {
    const detail = event?.detail ?? event;
    console.info('User registered (inactive until verification):', detail);
  }

  function handlePlayerConnect(event) {
    const detail = event?.detail ?? event;
    if (detail?.sessionId) {
      goSession(detail.sessionId);
    }
  }

  function handlePlayerScan() {
    console.info('Scan QR requested (not implemented yet)');
  }

  function openProfile() {
    if (!currentUser) return;
    if (view !== 'profile') {
      previousView = view;
    }
    view = 'profile';
  }

  async function handleLogout() {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Error during logout', error);
    } finally {
      currentUser = null;
      currentRole = null;
      currentSessionId = null;
      previousView = null;
      goLogin();
    }
  }

  function handleProfileClose() {
    view = previousView ?? (currentRole === 'storyteller' ? 'landing' : 'player-selection');
    previousView = null;
  }

  function handleProfileUpdated(event) {
    const detail = event?.detail ?? event;
    if (detail?.user) {
      currentUser = detail.user;
    }
  }

  async function handleProfileEmailChange() {
    await handleLogout();
  }

  async function handleAccountDeleted() {
    try {
      await signOutUser();
    } catch (error) {
      console.warn('Error signing out after account deletion', error);
    } finally {
      currentUser = null;
      currentRole = null;
      currentSessionId = null;
      previousView = null;
      goLogin();
    }
  }

  onMount(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          currentUser = await fetchCurrentUserProfile();
        } catch (error) {
          console.error('Unable to fetch profile on auth change', error);
          currentUser = null;
        }
      } else {
        currentUser = null;
        currentRole = null;
        currentSessionId = null;
        previousView = null;
        if (view !== 'login' && view !== 'registration') {
          view = 'login';
        }
      }
    });
    return () => unsubscribe();
  });
</script>

<!-- ─────────────────────────────────────────────────────────────
     CAPA DE FONDO FIJA (imagen + niebla)
     No captura eventos (pointer-events: none en el propio componente).
     Siempre está visible detrás de todas las vistas.
     ───────────────────────────────────────────────────────────── -->
<BackgroundLayer
  backgroundUrl="/backgrounds/background-village.png"
  fogUrl="/backgrounds/fog-texture.png"
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
{:else if view === 'verify-email'}
  <VerifyEmail on:navigate-login={goLogin} />
{:else if view === 'player-selection'}
  <PlayerSelection
    user={currentUser}
    on:connect={handlePlayerConnect}
    on:scan-qr={handlePlayerScan}
    on:profile={openProfile}
    on:logout={handleLogout}
  />
{:else if view === "configure"}
  <Configure
    sessionId={currentSessionId}
    user={currentUser}
    on:back={() => {
      view = 'landing';
    }}
    on:profile={openProfile}
    on:logout={handleLogout}
  />
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
  <Storyteller
    user={currentUser}
    onCreate={goConfigure}
    onViewCurrent={goSession}
    on:profile={openProfile}
    on:logout={handleLogout}
  />
{:else if view === 'profile'}
  <Profile
    user={currentUser}
    on:updated={handleProfileUpdated}
    on:close={handleProfileClose}
    on:email-change={handleProfileEmailChange}
    on:logout={handleLogout}
    on:profile={openProfile}
    on:deleted={handleAccountDeleted}
  />
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

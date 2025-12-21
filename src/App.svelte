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
  import { get } from 'svelte/store';
  import BackgroundLayer from './components/common/BackgroundLayer.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Login from './pages/Login.svelte';
  import Registration from './pages/Registration.svelte';
  import Choose from './pages/Choose.svelte';
  import Profile from './pages/Profile.svelte';
  import Configure from './pages/Configure.svelte';
  import Waiting from './pages/Waiting.svelte';
  import Session from './pages/Session.svelte';
  import ToastHost from './components/ui/ToastHost.svelte';
  import { t } from './lib/i18n.js';
  import { fetchCurrentUserProfile, signOutUser, confirmEmailVerification } from './lib/auth.js';
  import { auth } from './lib/firebase.js';
  import { onAuthStateChanged } from 'firebase/auth';
  import { APP_VIEWS, resolveInitialView } from './lib/navigation.js';

  let view = APP_VIEWS.LOGIN;
  let currentSessionId = null;
  let currentSessionTokens = [];
  let currentSessionSelection = null;
  let currentSessionPlayers = [];
  let currentActorRoles = [];
  let currentRole = null;
  let currentUser = null;
  let previousView = null;
  let verificationNotice = null;
  let pendingVerificationCode = null;
  let shouldProcessVerification = false;
  const SESSION_INDICATOR_STATES = new Set(['shared', 'waiting', 'in_progress', 'paused']);
  const SESSION_INDICATOR_EXCLUDED_VIEWS = new Set([
    APP_VIEWS.LOGIN,
    APP_VIEWS.REGISTRATION,
    APP_VIEWS.LANDING,
    APP_VIEWS.PLAYER_SELECTION
  ]);
  let sessionIndicator = null;
  let sessionIndicatorStatus = null;
  let sessionIndicatorEnabled = false;

  if (typeof window !== 'undefined') {
    const initial = resolveInitialView(
      window.location.pathname,
      new URLSearchParams(window.location.search)
    );
    view = initial.view;
    pendingVerificationCode = initial.pendingVerificationCode;
    shouldProcessVerification = initial.shouldProcessVerification;
  }

  function goConfigure(sessionId) {
    currentSessionId = sessionId;
    currentSessionTokens = [];
    currentSessionSelection = null;
    currentSessionPlayers = [];
    view = APP_VIEWS.CONFIGURE;
  }

  function goSession(sessionId, payload = {}) {
    currentSessionId = sessionId;
    currentSessionTokens = payload.tokens ?? currentSessionTokens;
    currentSessionSelection = payload.selection ?? currentSessionSelection;
    currentSessionPlayers = payload.players ?? currentSessionPlayers;
    currentActorRoles = payload.actorRoles ?? currentActorRoles ?? [];
    view = APP_VIEWS.SESSION;
  }
  async function handleLoginSuccess(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    currentRole = detail?.role ?? null;
    currentSessionId = null;

    view = currentRole === 'storyteller' ? APP_VIEWS.LANDING : APP_VIEWS.PLAYER_SELECTION;

    try {
      currentUser = await fetchCurrentUserProfile();
    } catch (error) {
      console.error('Unable to load user profile', error);
      currentUser = null;
    }
  }

  function handleLoginForgot(payload) {
    const detail = payload && payload.detail !== undefined ? payload.detail : payload;
    console.info('Password reset requested for', detail?.email);
  }

  function clearVerificationParams() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    ['mode', 'oobCode', 'apiKey', 'lang', 'continueUrl'].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState({}, '', url);
  }

  async function processEmailVerification(code) {
    const translate = get(t);
    if (!code) {
      verificationNotice = {
        variant: 'error',
        message: translate('verify.invalid_message'),
        title: translate('verify.invalid_title')
      };
      clearVerificationParams();
      return;
    }
    try {
      const result = await confirmEmailVerification(code);
      const emailLabel = result?.email ?? translate('verify.unknown_email');
      verificationNotice = {
        variant: result?.activated ? 'success' : 'info',
        message: translate('verify.success_message', { email: emailLabel }),
        title: translate('verify.success_title')
      };
    } catch (error) {
      console.error('Unable to confirm email verification', error);
      const reason =
        error?.code === 'auth/invalid-action-code'
          ? translate('verify.error_invalid_code')
          : error?.code === 'auth/expired-action-code'
            ? translate('verify.error_expired_code')
            : translate('verify.error_generic_reason');
      verificationNotice = {
        variant: 'error',
        message: translate('verify.error_message', { reason }),
        title: translate('verify.error_title')
      };
    } finally {
      clearVerificationParams();
    }
  }

  function handleNoticeConsumed() {
    verificationNotice = null;
  }

  function goLogin() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/login';
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url);
    }
    view = APP_VIEWS.LOGIN;
  }

  function goRegistration() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.pathname = '/registration';
      url.search = '';
      url.hash = '';
      window.history.replaceState({}, '', url);
    }
    view = APP_VIEWS.REGISTRATION;
  }

  function handleRegistered(event) {
    const detail = event?.detail ?? event;
    console.info('User registered (inactive until verification):', detail);
  }

  function handlePlayerConnect(event) {
    const detail = event?.detail ?? event;
    if (detail?.sessionId) {
      currentSessionId = detail.sessionId;
      const explicitTarget = detail?.target;
      const inferredTarget = currentRole === 'player' ? APP_VIEWS.WAITING : APP_VIEWS.SESSION;
      const nextView = explicitTarget || inferredTarget;
      view = nextView;
    }
  }

  function handlePlayerScan() {
    console.info('Scan QR requested (not implemented yet)');
  }

  function openProfile() {
    if (!currentUser) return;
    if (view !== APP_VIEWS.PROFILE) {
      previousView = view;
    }
    view = APP_VIEWS.PROFILE;
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
      sessionIndicator = null;
      sessionIndicatorStatus = null;
      sessionIndicatorEnabled = false;
      goLogin();
    }
  }

  function handleProfileClose() {
    view = previousView ?? (currentRole === 'storyteller' ? APP_VIEWS.LANDING : APP_VIEWS.PLAYER_SELECTION);
    previousView = null;
  }

  function handleLeaveWaiting() {
    currentSessionId = null;
    view = APP_VIEWS.PLAYER_SELECTION;
    handleSessionStats({ detail: { reset: true } });
  }

  function handleProfileUpdated(event) {
    const detail = event?.detail ?? event;
    if (detail?.user) {
      currentUser = detail.user;
    }
  }

  function handleSessionStats(event) {
    const detail = event?.detail ?? event;
    if (!detail) return;
    if (detail.reset) {
      sessionIndicator = null;
      sessionIndicatorStatus = null;
      sessionIndicatorEnabled = false;
      return;
    }
    sessionIndicator = {
      expected: Number(detail.expected) || 0,
      connected: Number(detail.connected) || 0,
      ready: Number(detail.ready) || 0
    };
    if (detail.status) {
      sessionIndicatorStatus = detail.status;
    }
    sessionIndicatorEnabled = sessionIndicatorStatus
      ? SESSION_INDICATOR_STATES.has(sessionIndicatorStatus)
      : false;
  }

  $: allowIndicatorForView = !SESSION_INDICATOR_EXCLUDED_VIEWS.has(view);
  $: showSessionIndicator = allowIndicatorForView && sessionIndicatorEnabled && !!sessionIndicator;

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
    if (shouldProcessVerification) {
      processEmailVerification(pendingVerificationCode);
    }
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
        if (view !== APP_VIEWS.LOGIN && view !== APP_VIEWS.REGISTRATION) {
          view = APP_VIEWS.LOGIN;
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
{#if view === APP_VIEWS.LOGIN}
  <Login
    on:loginSuccess={handleLoginSuccess}
    on:loginForgot={handleLoginForgot}
    on:navigate-registration={goRegistration}
    verificationNotice={verificationNotice}
    on:notice-consumed={handleNoticeConsumed}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{:else if view === APP_VIEWS.REGISTRATION}
  <Registration
    on:registered={handleRegistered}
    on:navigate-login={goLogin}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{:else if view === APP_VIEWS.PLAYER_SELECTION}
  <Choose
    user={currentUser}
    on:connect={handlePlayerConnect}
    on:scan-qr={handlePlayerScan}
    on:profile={openProfile}
    on:logout={handleLogout}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{:else if view === APP_VIEWS.CONFIGURE}
  <Configure
    sessionId={currentSessionId}
    user={currentUser}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:back={() => {
      view = APP_VIEWS.LANDING;
    }}
    on:start={(event) => {
      const detail = event?.detail ?? {};
      const targetId = detail.sessionId ?? currentSessionId;
      if (targetId) goSession(targetId, detail);
    }}
    on:profile={openProfile}
    on:logout={handleLogout}
    on:session-stats={handleSessionStats}
  />
{:else if view === APP_VIEWS.WAITING}
  <Waiting
    sessionId={currentSessionId}
    user={currentUser}
    on:profile={openProfile}
    on:logout={handleLogout}
    on:leave={handleLeaveWaiting}
    on:session-stats={handleSessionStats}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{:else if view === APP_VIEWS.SESSION}
  <Session
    sessionId={currentSessionId}
    selection={currentSessionSelection}
    tokens={currentSessionTokens}
    players={currentSessionPlayers}
    actorRoles={currentActorRoles}
    user={currentUser}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:logout={handleLogout}
    on:profile={openProfile}
    on:configure={() => goConfigure(currentSessionId)}
  />
{:else if view === APP_VIEWS.LANDING}
  <Dashboard
    user={currentUser}
    onCreate={goConfigure}
    onViewCurrent={goSession}
    on:profile={openProfile}
    on:logout={handleLogout}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{:else if view === APP_VIEWS.PROFILE}
  <Profile
    user={currentUser}
    on:updated={handleProfileUpdated}
    on:close={handleProfileClose}
    on:email-change={handleProfileEmailChange}
    on:logout={handleLogout}
    on:profile={openProfile}
    on:deleted={handleAccountDeleted}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
  />
{/if}

<ToastHost />

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
</style>

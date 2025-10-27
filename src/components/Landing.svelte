<script>
  import { onMount } from 'svelte';
  import Topbar from './Topbar.svelte';
  import CurrentSessionCard from './landing/CurrentSessionCard.svelte';
  import HistoryCard from './landing/HistoryCard.svelte';
  import { getCurrentSession, listSessionHistory, createSessionDraft } from '../lib/db.js';
  import Footbar from './Footbar.svelte';

  // Constants
  const HISTORY_LIMIT = 20;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Props
  export let onCreate = () => {};

  // State
  let now = new Date();
  let current = null;
  let historyItems = [];
  let loadingCurrent = true;
  let loadingHistory = true;
  let errorHistory = null;
  let timer;

  // Helpers
  const pad = (value) => String(value).padStart(2, "0");
  const fmt = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  const normalizeHistoryDoc = (doc) => {
    const winners = Array.isArray(doc.winners)
      ? doc.winners
      : doc.winners
      ? [doc.winners]
      : [];

    return {
      id: doc.id,
      title: doc.title ?? '—',
      numPlayers: Number(doc.numPlayers ?? 0),
      winners,
      date: doc.date?.toMillis ? doc.date.toMillis() : doc.date,
      status: (doc.status ?? 'waiting').toLowerCase(),
    };
  };

  // Data loading
  async function loadCurrentSession() {
    loadingCurrent = true;
    try {
      current = await getCurrentSession();
    } catch (error) {
      console.error('Error loading current session', error);
      current = null;
    } finally {
      loadingCurrent = false;
    }
  }

  async function loadHistory() {
    loadingHistory = true;
    errorHistory = null;
    try {
      const docs = await listSessionHistory(HISTORY_LIMIT);
      historyItems = (docs ?? []).map(normalizeHistoryDoc);
    } catch (error) {
      console.error('Error loading history', error);
      errorHistory = error?.message ?? 'Failed to load history';
    } finally {
      loadingHistory = false;
    }
  }

  async function refreshAll() {
    await Promise.all([loadCurrentSession(), loadHistory()]);
  }

  async function createAndGo() {
    try {
      const id = await createSessionDraft({
        title: 'Untitled session',
        language: 'en',
      });
      await refreshAll();
      onCreate(id);
    } catch (error) {
      console.error('Error creating draft session', error);
    }
  }

  // Event handlers
  function handleViewCurrent(event) {
    const { id } = event.detail ?? {};
    if (id) console.debug('View current session', id);
  }

  function handleHistoryView(event) {
    const { id } = event.detail ?? {};
    if (id) console.debug('View history session', id);
  }

  function handleHistoryEdit(event) {
    const { id } = event.detail ?? {};
    if (id) console.debug('Edit history session', id);
  }

  function handleHistoryDelete(event) {
    const { id } = event.detail ?? {};
    if (id) console.debug('Delete history session (not implemented)', id);
  }

  // Lifecycle
  onMount(() => {
    timer = setInterval(() => {
      now = new Date();
    }, 1000);

    refreshAll().catch((error) => {
      console.error('Initial load failed', error);
    });

    return () => clearInterval(timer);
  });
</script>

<!-- ─────────────────────────────────────────────────────────────
     TOPBAR (dashboard tag + idioma + login) 
     ───────────────────────────────────────────────────────────── -->
<Topbar
  title="Storyteller Dashboard"
  flagSrc="/flags/en_UK.png"   
  flagAlt="English"
  langCode="EN"
  on:lang={() => { /* aquí harás el toggle de idioma cuando llegue i18n */ }}
/>

<!-- ─────────────────────────────────────────────────────────────
     ENCABEZADO (Título + Efecto visual)
     ───────────────────────────────────────────────────────────── -->
<header class="landing-header">
  <img
    src="/logo.svg"
    alt="Logo"
    class="logo"
    on:error={(e) => (e.target.style.display = 'none')}
  />
  <div>
    <h1>El Narrador de la Aldea</h1>
  </div>
</header>

<main>
  <!-- ─────────────────────────────────────────────────────────────
       ESTADO PARTIDA EN CURSO (Estado actual + Botones de acción)
       ───────────────────────────────────────────────────────────── -->
  <CurrentSessionCard
    session={current}
    loading={loadingCurrent}
    canView={!!current}
    on:create={createAndGo}
    on:view={handleViewCurrent}
  />

  <!-- ─────────────────────────────────────────────────────────────
       HISTÓRICO DE SESIONES (solo finalizadas/canceladas)
       ───────────────────────────────────────────────────────────── -->
  <div class="history-anchor">
    <HistoryCard
      items={historyItems}
      loading={loadingHistory}
      error={errorHistory}
      on:view={handleHistoryView}
      on:edit={handleHistoryEdit}
      on:delete={handleHistoryDelete}
    />
  </div>
</main>

<!-- ─────────────────────────────────────────────────────────────
     PIE DE PAGINA (reloj + firma)
     ───────────────────────────────────────────────────────────── -->
<Footbar
  signature="@chatgpt-juarnamon ip"
  locale="en-GB"
  timeZone="Europe/Budapest"
  showSeconds={true}
/>

<!-- ─────────────────────────────────────────────────────────────
     LANDING (Estilos Locales)
     ───────────────────────────────────────────────────────────── -->
<style>
  /* ─────────────────────────────────────────────────────────────
     TÍTULO PRINCIPAL – “El Narrador de la Aldea”
     ───────────────────────────────────────────────────────────── */
  .landing-header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1rem 0.5rem;
    border-bottom: none;
  }

  .landing-header .logo {
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
  }

  .landing-header h1 {
    /* Tamaño mayor para llenar el espacio visual entre el tejado y el sombrero */
    font-size: clamp(2.2rem, 43.8vw, 3.2rem);
    color: #f4d47c; /* tono cálido, inspirado en la lámpara */
    
    /* Sombra múltiple para dar volumen y sensación de luz cálida */
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 22px rgba(255, 180, 40, 0.4),
      3px 3px 12px rgba(0, 0, 0, 0.9);

    font-family: "Merriweather", serif;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: center;
    margin-top: 0;
    margin-bottom: 0;

    /* Transición suave para futuros efectos dinámicos (hover o fade) */
    transition: text-shadow 0.4s ease, color 0.4s ease;
  }

  .landing-header h1 {
    /* Efecto parpadeo de luz */
    animation: flickerGlow 6s ease-in-out infinite;
  }

  /* Keyframes para el parpadeo de luz */
  @keyframes flickerGlow {
    0%, 100% {
      text-shadow:
        0 0 8px rgba(255, 200, 60, 0.7),
        0 0 22px rgba(255, 180, 40, 0.4),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 1;
    }
    38% {
      text-shadow:
        0 0 10px rgba(255, 210, 80, 0.8),
        0 0 25px rgba(255, 190, 60, 0.5),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.97;
    }
    41% {
      text-shadow:
        0 0 5px rgba(255, 190, 40, 0.6),
        0 0 15px rgba(255, 170, 30, 0.3),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.9;
    }
    47% {
      text-shadow:
        0 0 12px rgba(255, 220, 90, 0.8),
        0 0 28px rgba(255, 200, 70, 0.5),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 1;
    }
    63% {
      text-shadow:
        0 0 7px rgba(255, 180, 40, 0.6),
        0 0 18px rgba(255, 160, 30, 0.3),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.92;
    }
    75% {
      text-shadow:
        0 0 10px rgba(255, 205, 70, 0.7),
        0 0 22px rgba(255, 185, 50, 0.4),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.96;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     CUERPO PRINCIPAL
     ───────────────────────────────────────────────────────────── */
  .history-anchor {
    width: 100%;
    /* empuja ligeramente el histórico por debajo del farol en 16:9 / desktop */
    margin-top: 18px;
  }

  /* pantallas anchas: el farol cae un poco más abajo; empujamos un poco más */
  @media (min-width: 1280px) and (min-height: 720px) {
    .history-anchor { margin-top: 26px; }
  }

  /* monitores grandes (1440+ o altura 900+): el farol queda más bajo; compensamos */
  @media (min-width: 1440px), (min-height: 900px) {
    .history-anchor { margin-top: 34px; }
  }

  /* tablet/móvil: mantenemos el bloque pegado a la card, sin desplazamientos bruscos */
  @media (max-width: 900px) {
    .history-anchor { margin-top: 12px; }
  }
</style>

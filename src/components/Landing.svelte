<script>
  import { onMount } from 'svelte';
  import Topbar from './Topbar.svelte';
  import Header from './landing/Header.svelte';
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
<Header />

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
  signature="@chatgpt-juarnamon intellectual property"
  locale="en-GB"
  timeZone="Europe/Budapest"
  showSeconds={true}
/>

<!-- ─────────────────────────────────────────────────────────────
     LANDING (Estilos Locales)
     ───────────────────────────────────────────────────────────── -->
<style>
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

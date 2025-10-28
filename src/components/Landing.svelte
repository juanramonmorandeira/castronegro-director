<script>
  import { onMount } from 'svelte';
  import Topbar from './Topbar.svelte';
  import Header from './landing/Header.svelte';
  import CurrentSessionCard from './landing/CurrentSessionCard.svelte';
  import HistoryCard from './landing/HistoryCard.svelte';
  import Footbar from './Footbar.svelte';
  import { getCurrentSession, listSessionHistory, createSessionDraft } from '../lib/db.js';
  import { normalizeStatus } from '../lib/utils.js';
  import { locale as localeStore, t } from '../lib/i18n.js';

  const HISTORY_LIMIT = 20;
  const dateOptions = Intl.DateTimeFormat().resolvedOptions();
  const tz = dateOptions.timeZone || 'UTC';
  const clockLocale = dateOptions.locale || 'en-GB';
  const FLAG_BY_LOCALE = {
    en: '/flags/en_UK.png',
    es: '/flags/es_ES.png',
    hu: '/flags/hu_HU.png'
  };
  const DEFAULT_FLAG_SRC = FLAG_BY_LOCALE.en;

  export let onCreate = () => {};

  let current = null;
  let historyItems = [];
  let loadingCurrent = true;
  let loadingHistory = true;
  let errorHistory = null;

  const getLocaleKey = (value) => (value || 'en').split(/[-_]/)[0].toLowerCase();

  $: localeKey = getLocaleKey($localeStore);
  $: topbarFlagSrc = FLAG_BY_LOCALE[localeKey] ?? DEFAULT_FLAG_SRC;
  $: topbarLangCode = localeKey;

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
      status: normalizeStatus(doc.status),
    };
  };

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
      errorHistory = error?.message ?? $t('landing.history.load_failed');
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
        title: $t('common.untitled_session'),
        language: localeKey,
      });
      await refreshAll();
      onCreate(id);
    } catch (error) {
      console.error('Error creating draft session', error);
    }
  }

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

  onMount(() => {
    refreshAll().catch((error) => {
      console.error('Initial load failed', error);
    });
  });
</script>

<!-- ─────────────────────────────────────────────────────────────
     TOPBAR (dashboard tag + idioma + login) 
     ───────────────────────────────────────────────────────────── -->
<Topbar
  flagSrc={topbarFlagSrc}
  langCode={topbarLangCode}
  on:lang={() => { /* aquí harás el toggle de idioma cuando llegue i18n */ }}
/>

<!-- ─────────────────────────────────────────────────────────────
     ENCABEZADO (Título + Efecto visual)
     ───────────────────────────────────────────────────────────── -->
<Header />

<main class="main-padding">
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
      dateLocale={clockLocale}
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
  locale={clockLocale}
  timeZone={tz}
  showSeconds={true}
/>

<!-- ─────────────────────────────────────────────────────────────
     LANDING (Estilos Locales)
     ───────────────────────────────────────────────────────────── -->
<style>
  /* ─────────────────────────────────────────────────────────────
     CUERPO PRINCIPAL
     ───────────────────────────────────────────────────────────── */
  main {
    display: grid;
    gap: clamp(2rem, 5vw, 3.5rem);
    justify-items: center;
    padding: 0 clamp(1.25rem, 5vw, 3rem) clamp(2rem, 6vw, 3.5rem);
    box-sizing: border-box;
  }

  main > * {
    width: 100%;
  }

  .history-anchor {
    width: 100%;
  }
</style>
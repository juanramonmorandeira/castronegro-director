<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import CurrentSessionCard from '../components/storytellers/CurrentSessionCard.svelte';
  import HistoryCard from '../components/storytellers/HistoryCard.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import { locale as localeStore, t } from '../lib/i18n.js';
  import {
    APP_VIEWS
  } from '../lib/navigation.js';
  import {
    resolveViewTarget,
    getViewerContext,
    sessionOwnedByViewer,
    normalizeHistoryDoc,
    loadDashboardData,
    createDraftSession,
    removeHistorySession
  } from '../lib/services/dashboardService.js';

  const dispatch = createEventDispatcher();

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
  export let onViewCurrent = () => {};
  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  let current = null;
  let historyDocs = [];
  let historyItems = [];
  let loadingCurrent = true;
  let loadingHistory = true;
let deletingHistoryId = null;
let creating = false;
let alertOpen = false;
let alertMessage = '';
let alertVariant = 'info';
let alertTitle = '';

  const getLocaleKey = (value) => (value || 'en').split(/[-_]/)[0].toLowerCase();

  $: localeKey = getLocaleKey($localeStore);
  $: topbarFlagSrc = FLAG_BY_LOCALE[localeKey] ?? DEFAULT_FLAG_SRC;
  $: topbarLangCode = localeKey;
  $: deleteForbiddenMessage = $t('landing.history.delete_forbidden');
  $: deleteFailedMessage = $t('landing.history.delete_failed');
  $: viewForbiddenMessage = $t('landing.current.view_forbidden');
  $: viewerContext = getViewerContext(user);
  $: currentStatus = current ? current.status : null;
  $: currentViewTarget = resolveViewTarget(currentStatus);
  $: currentOwnedByViewer = sessionOwnedByViewer(current, viewerContext);
  $: canOpenCurrent = !!(current && currentViewTarget && currentOwnedByViewer);

  $: historyItems = (historyDocs ?? []).map((doc) => normalizeHistoryDoc(doc, user));

function openAlert(message, variant = 'info', title = null) {
  alertMessage = message;
  alertVariant = variant;
  alertTitle = title ?? $t('landing.current.heading');
  alertOpen = true;
}

function closeAlert() {
  alertOpen = false;
}

async function loadCurrentSession() {
  loadingCurrent = true;
  try {
    const { current: session } = await loadDashboardData(0);
    current = session;
  } catch (error) {
    console.error('Error loading current session', error);
    current = null;
    openAlert($t('landing.current.load_error'), 'error');
  } finally {
    loadingCurrent = false;
  }
}

async function loadHistory() {
  loadingHistory = true;
  try {
    const { historyDocs: docs } = await loadDashboardData(HISTORY_LIMIT);
    historyDocs = docs ?? [];
  } catch (error) {
    console.error('Error loading history', error);
    const msg = error?.message ?? $t('landing.history.load_failed');
    openAlert(msg, 'error', $t('landing.history.title'));
  } finally {
    loadingHistory = false;
  }
}

  async function refreshAll() {
    loadingCurrent = true;
    loadingHistory = true;
    try {
      const { current: session, historyDocs: docs } = await loadDashboardData(HISTORY_LIMIT);
      current = session;
      historyDocs = docs ?? [];
    } catch (error) {
      console.error('Error refreshing dashboard', error);
      openAlert($t('landing.history.load_failed'), 'error');
    } finally {
      loadingCurrent = false;
      loadingHistory = false;
    }
  }

async function createAndGo() {
  creating = true;
  try {
    const viewer = getViewerContext(user);
    const session = await createDraftSession({
      language: localeKey,
      viewer
    });
    await refreshAll();
    onCreate(session.id);
  } catch (error) {
    console.error('Error creating draft session', error);
    const msg = error?.message ?? $t('landing.current.create_error');
    openAlert(msg, 'error');
  }
  creating = false;
}

  function launchCurrentSession() {
    if (!current || !current.id) return;
    if (!currentOwnedByViewer) {
      openAlert(viewForbiddenMessage, 'warning', $t('landing.current.heading'));
      return;
    }
    if (currentViewTarget === 'configure') {
      onCreate(current.id);
    } else if (currentViewTarget === 'session') {
      onViewCurrent(current.id);
    }
  }

  function handleHistoryView(event) {
    const { id } = event.detail ?? {};
    if (id) console.debug('View history session', id);
  }

async function handleHistoryDelete(event) {
  const { id } = event.detail ?? {};
  if (!id) return;
  const target = historyItems.find((item) => item.id === id);
  if (!target?.canDelete) {
    openAlert(deleteForbiddenMessage, 'warning', $t('landing.history.title'));
    return;
  }
  const viewer = getViewerContext(user);
  if (!viewer) {
    openAlert(deleteForbiddenMessage, 'warning', $t('landing.history.title'));
    return;
  }
  deletingHistoryId = id;
  let deleted = false;
  try {
    await removeHistorySession(id, viewer);
    historyDocs = historyDocs.filter((doc) => doc.id !== id);
    deleted = true;
  } catch (error) {
    console.error('Delete session failed', error);
    const msg = error?.message ?? deleteFailedMessage;
    openAlert(msg, 'error', $t('landing.history.title'));
  } finally {
    if (deleted) {
      await refreshAll();
    }
    deletingHistoryId = null;
  }
}

  function relay(event) {
    dispatch(event.type, event.detail);
  }

  onMount(() => {
    refreshAll().catch((error) => {
      console.error('Initial load failed', error);
    });
  });
</script>

<div class="storyteller-page">
  <Topbar
    flagSrc={topbarFlagSrc}
    langCode={topbarLangCode}
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile={relay}
    on:logout={relay}
    on:lang={() => { /* aquí harás el toggle de idioma cuando llegue i18n */ }}
  />

  <main class="dashboard">
      <CurrentSessionCard
        session={current}
        loading={loadingCurrent}
        canView={canOpenCurrent}
        creating={creating}
        onCreateClick={createAndGo}
        onViewClick={launchCurrentSession}
      />

    <div class="history-anchor">
      <HistoryCard
        items={historyItems}
        loading={loadingHistory || !!deletingHistoryId}
        dateLocale={clockLocale}
        on:view={handleHistoryView}
        on:delete={handleHistoryDelete}
      />
    </div>
  </main>

  <Footbar
    locale={clockLocale}
    timeZone={tz}
    showSeconds={true}
  />
</div>

<AlertPopup
  open={alertOpen}
  title={alertTitle}
  message={alertMessage}
  variant={alertVariant}
  on:close={closeAlert}
/>

<!-- ─────────────────────────────────────────────────────────────
     LANDING (Estilos Locales)
     ───────────────────────────────────────────────────────────── -->
<style>
  .storyteller-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .dashboard {
    display: grid;
    gap: clamp(2rem, 4vw, 3.5rem);
    justify-items: center;
    padding: calc(56px + 2rem) clamp(1.25rem, 5vw, 3rem) clamp(3rem, 6vw, 4rem);
    box-sizing: border-box;
    width: 100%;
  }

  .dashboard > * {
    width: min(var(--page-width-main), 96vw);
  }

  .history-anchor {
    width: 100%;
  }
</style>

<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import CurrentSessionCard from '../components/storytellers/CurrentSessionCard.svelte';
  import HistoryCard from '../components/storytellers/HistoryCard.svelte';
import Footbar from '../components/common/Footbar.svelte';
import AlertPopup from '../components/ui/AlertPopup.svelte';
import { getCurrentSession, listSessionHistory, createSessionDraft, deleteSessionIfCreator } from '../lib/db.js';
import { normalizeStatus } from '../lib/utils.js';
import { locale as localeStore, t } from '../lib/i18n.js';

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
  const CONFIG_STATUSES = new Set(['draft', 'shared', 'waiting']);
  const LIVE_STATUSES = new Set(['in_progress', 'paused']);

  export let onCreate = () => {};
  export let onViewCurrent = () => {};
  export let user = null;

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
  $: viewerContext = getViewerContext();
  $: currentStatus = current ? normalizeStatus(current.status) : null;
  $: currentViewTarget = resolveViewTarget(currentStatus);
  $: currentOwnedByViewer = sessionOwnedByViewer(current, viewerContext);
  $: canOpenCurrent = !!(current && currentViewTarget && currentOwnedByViewer);

  function getViewerContext() {
    if (!user) return null;
    const uid = user.uid ?? user.auth_uid ?? null;
    const email = user.email ? String(user.email).toLowerCase() : null;
    if (!uid && !email) return null;
    return { uid, email };
  }

  function sessionOwnedByViewer(session, viewer = getViewerContext()) {
    if (!session || !viewer) return false;
    const rawOwner = session.created_by;
    let ownerUid = null;
    let ownerEmail = null;
    if (typeof rawOwner === 'string') {
      ownerUid = rawOwner;
    } else if (rawOwner && typeof rawOwner === 'object') {
      ownerUid = rawOwner.uid ?? null;
      ownerEmail = rawOwner.email ? String(rawOwner.email).toLowerCase() : null;
    }
    const viewerUid = viewer.uid ?? null;
    const viewerEmail = viewer.email ?? null;
    if (ownerUid && viewerUid) return ownerUid === viewerUid;
    if (ownerEmail && viewerEmail) return ownerEmail === viewerEmail;
    return false;
  }

  function resolveViewTarget(status) {
    if (!status) return null;
    if (CONFIG_STATUSES.has(status)) return 'configure';
    if (LIVE_STATUSES.has(status)) return 'session';
    return null;
  }

  const normalizeHistoryDoc = (doc) => {
    const winners = Array.isArray(doc.winners)
      ? doc.winners
      : doc.winners
      ? [doc.winners]
      : [];

    const actualPlayers =
      doc.players && typeof doc.players === 'object'
        ? Object.keys(doc.players).length
        : Array.isArray(doc.players)
          ? doc.players.length
          : null;

    const creator = doc.created_by;
    const ownerUid =
      typeof creator === 'string'
        ? creator
        : creator?.uid ?? null;
    const ownerEmail =
      typeof creator === 'object'
        ? (creator?.email ?? '').toLowerCase()
        : '';
    const viewerUid = user?.uid ?? user?.auth_uid ?? null;
    const viewerEmail = (user?.email ?? '').toLowerCase();
    const canDelete =
      !!viewerUid && !!ownerUid
        ? viewerUid === ownerUid
        : !!ownerEmail && !!viewerEmail
          ? ownerEmail === viewerEmail
          : false;

    return {
      id: doc.id,
      title: doc.title ?? doc.settings?.name ?? '—',
      numPlayers: actualPlayers ?? Number(doc.settings?.players_expected ?? 0),
      winners,
      date: doc.updated_at ?? doc.created_at ?? doc.date ?? null,
      status: normalizeStatus(doc.status),
      createdBy: creator,
      canDelete
    };
  };

  $: historyItems = (historyDocs ?? []).map((doc) => normalizeHistoryDoc(doc));

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
    current = await getCurrentSession();
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
    const docs = await listSessionHistory(HISTORY_LIMIT);
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
    await Promise.all([loadCurrentSession(), loadHistory()]);
  }

async function createAndGo() {
  creating = true;
  try {
    const viewer = getViewerContext();
    const session = await createSessionDraft({
      language: localeKey,
      creatorUid: viewer?.uid ?? null
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
  const viewer = getViewerContext();
  if (!viewer) {
    openAlert(deleteForbiddenMessage, 'warning', $t('landing.history.title'));
    return;
  }
  deletingHistoryId = id;
  let deleted = false;
  try {
    await deleteSessionIfCreator(id, viewer);
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
    width: min(100%, 960px);
  }

  .history-anchor {
    width: 100%;
  }
</style>

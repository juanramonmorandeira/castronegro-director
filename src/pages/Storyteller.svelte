<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import CurrentSessionCard from '../components/storytellers/CurrentSessionCard.svelte';
  import HistoryCard from '../components/storytellers/HistoryCard.svelte';
  import Footbar from '../components/common/Footbar.svelte';
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
  let historyError = null;
  let deletingHistoryId = null;
  let creating = false;
  let createError = '';

  const getLocaleKey = (value) => (value || 'en').split(/[-_]/)[0].toLowerCase();

  $: localeKey = getLocaleKey($localeStore);
  $: topbarFlagSrc = FLAG_BY_LOCALE[localeKey] ?? DEFAULT_FLAG_SRC;
  $: topbarLangCode = localeKey;
  $: deleteForbiddenMessage = $t('landing.history.delete_forbidden');
  $: deleteFailedMessage = $t('landing.history.delete_failed');
  $: currentStatus = current ? normalizeStatus(current.status) : null;
  $: currentViewTarget = resolveViewTarget(currentStatus);
  $: canOpenCurrent = !!(current && currentViewTarget);

  function getViewerContext() {
    if (!user) return null;
    const uid = user.uid ?? user.auth_uid ?? null;
    const email = user.email ?? null;
    if (!uid && !email) return null;
    return { uid, email };
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
    historyError = null;
    try {
      const docs = await listSessionHistory(HISTORY_LIMIT);
      historyDocs = docs ?? [];
    } catch (error) {
      console.error('Error loading history', error);
      historyError = error?.message ?? $t('landing.history.load_failed');
    } finally {
      loadingHistory = false;
    }
  }

  async function refreshAll() {
    await Promise.all([loadCurrentSession(), loadHistory()]);
  }

  async function createAndGo() {
    createError = '';
    creating = true;
    try {
      const viewer = getViewerContext();
      console.log('[landing] create new game request');
      const session = await createSessionDraft({
        language: localeKey,
        creatorUid: viewer?.uid ?? null
      });
      console.log('[landing] created session', session);
      await refreshAll();
      onCreate(session.id);
    } catch (error) {
      console.error('Error creating draft session', error);
      createError = error?.message ?? $t('landing.current.create_error');
    }
    creating = false;
  }

  function launchCurrentSession() {
    if (!current || !current.id) return;
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
      historyError = deleteForbiddenMessage;
      return;
    }
    const viewer = getViewerContext();
    if (!viewer) {
      historyError = deleteForbiddenMessage;
      return;
    }
    deletingHistoryId = id;
    historyError = null;
    let deleted = false;
    try {
      await deleteSessionIfCreator(id, viewer);
      historyDocs = historyDocs.filter((doc) => doc.id !== id);
      deleted = true;
    } catch (error) {
      console.error('Delete session failed', error);
      historyError = error?.message ?? deleteFailedMessage;
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
      createError={createError}
      onCreateClick={createAndGo}
      onViewClick={launchCurrentSession}
    />

    <div class="history-anchor">
      <HistoryCard
        items={historyItems}
        loading={loadingHistory || !!deletingHistoryId}
        error={historyError}
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

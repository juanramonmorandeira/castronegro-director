<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import Button from '../components/ui/Button.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import SessionList from '../components/choose/SessionList.svelte';
  import ManualJoin from '../components/choose/ManualJoin.svelte';
  import {
    fetchActiveSessions,
    formatGameCode,
    normalizeGameCode,
    connectUsingGameCode
  } from '../lib/services/sessionSelection.js';

  const dispatch = createEventDispatcher();

  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  let listLoading = false;
  let connectPending = false;
  let listError = '';
  let listInfo = '';

  let gameCode = '';
  let selectedSessionId = '';

  // Lista de sesiones activas
  let sessions = [];
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'info';
  let alertTitle = '';

  function openAlert(message, variant = 'info', title = null) {
    alertMessage = message;
    alertVariant = variant;
    alertTitle = title ?? $t('player.choose_title');
    alertOpen = true;
  }

  function closeAlert() {
    alertOpen = false;
  }

  async function loadActive() {
    listError = '';
    listInfo = '';
    listLoading = true;
    try {
      sessions = await fetchActiveSessions(10);
      if (sessions.length === 0) listInfo = $t('player.no_sessions');
    } catch (e) {
      console.error(e);
      listError = $t('player.load_error');
      openAlert(listError, 'error');
    } finally {
      listLoading = false;
    }
  }

  function scanQr() {
    dispatch('scan-qr');
  }

  function handleManualInput(value) {
    console.debug('[choose] manual input received', value);
    gameCode = formatGameCode(value ?? '');
    selectedSessionId = '';
  }

  async function connectWithGameId() {
    const code = normalizeGameCode(gameCode);
    console.debug('[choose] attempting connection with code', code);
    if (!code) return;
    try {
      connectPending = true;
      console.debug('[choose] connectUsingGameCode start', { code, user: user?.uid });
      const session = await connectUsingGameCode(code, user);
      console.debug('[choose] connectUsingGameCode success', session?.id);
      dispatch('connect', { sessionId: session.id, session, target: 'waiting' });
    } catch (error) {
      console.error('[choose] connectUsingGameCode error', error);
      if (error?.code === 'session/not-found') {
        openAlert($t('player.invalid_id'), 'warning');
      } else if (error?.code === 'session/missing-code') {
        openAlert($t('player.invalid_id'), 'warning');
      } else {
        console.error('[choose] unable to connect player', error);
        handleConnectError(error);
      }
    } finally {
      console.debug('[choose] connectUsingGameCode finished');
      connectPending = false;
    }
  }

  function onPick(session) {
    selectedSessionId = session.id;
    gameCode = formatGameCode(session.game_id ?? session.id ?? '');
  }

  function relay(event) {
    dispatch(event.type, event.detail);
  }

  function handleConnectError(error) {
    const code = error?.code;
    const message =
      code === 'session/full'
        ? $t('player.errors.session_full')
        : code === 'session/unavailable'
          ? $t('player.errors.session_unavailable')
          : code === 'session/missing-player'
            ? $t('player.errors.missing_player')
            : $t('player.errors.generic');
    openAlert(message, 'warning');
  }

  onMount(loadActive);
</script>

<BackgroundLayer />

<div class="page-grid">
  <Topbar
    titleKey="player.choose_title"
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile={relay}
    on:logout={relay}
  />
  <main class="page-main">
    <section class="surface-panel choose-panel" aria-labelledby="choose-title">
      <header class="form-header">
        <h2 id="choose-title" class="panel-title">{$t('player.choose_title')}</h2>
        <p class="panel-subtitle">{$t('player.join_intro')}</p>
      </header>

      <section class="method-block scan-block" aria-labelledby="scan-heading">
        <h3 id="scan-heading" class="section-heading">{$t('player.scan_qr')}</h3>
        <Button
          variant="primary"
          type="button"
          on:click={scanQr}
          aria-label={$t('player.scan_qr')}
          className="full-width"
        >
          {$t('player.scan_qr')}
        </Button>
      </section>

      <SessionList
        heading={$t('player.active_sessions')}
        subheading={$t('player.active_sessions_hint')}
        sessions={sessions}
        selectedId={selectedSessionId}
        loading={listLoading}
        error={listError}
        info={listInfo}
        refreshLabel={$t('player.refresh')}
        tableLabel={$t('player.active_sessions')}
        titleLabel={$t('history.headers.title')}
        idLabel={$t('player.session_id')}
        statusHeaderLabel={$t('history.headers.status')}
        emptyLabel={$t('player.no_sessions')}
        listLabel={$t('player.loading')}
        untitledLabel={$t('common.untitled_session')}
        on:refresh={loadActive}
        on:select={(event) => onPick(event.detail)}
      />

      <ManualJoin
        heading={$t('player.session_id')}
        placeholder={$t('player.session_id_placeholder')}
        hint={$t('player.session_id_hint')}
        value={gameCode}
        connectLabel={$t('player.connect')}
        pendingLabel={`${$t('player.connect')}…`}
        connectDisabled={!normalizeGameCode(gameCode)}
        pending={connectPending}
        on:input={(event) => handleManualInput(event.detail)}
        on:connect={connectWithGameId}
      />
    </section>
  </main>
  <Footbar />
</div>

<AlertPopup
  open={alertOpen}
  title={alertTitle}
  message={alertMessage}
  variant={alertVariant}
  on:close={closeAlert}
/>

<style>
  .choose-panel {
    width: min(640px, 96vw);
    margin: 0 auto;
    gap: var(--space-4);
  }

  .method-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-heading {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-white-contrast);
  }

  .section-subheading {
    margin: 0.15rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted);
  }

  @media (max-width: 640px) {
    .choose-panel {
      width: min(96vw, 520px);
    }
    .sessions-surface {
      max-height: none;
    }
  }
</style>

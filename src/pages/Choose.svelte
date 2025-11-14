<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { listActiveSessions, getSessionByGameId, connectPlayerToSession } from '../lib/db.js';
  import { statusBadgeClass, statusLabel } from '../lib/utils.js';
  import Button from '../components/ui/Button.svelte';
  import InputField from '../components/ui/InputField.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';

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
      sessions = await listActiveSessions(10);
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

  const formatGameCode = (value = '') => {
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleaned) return '';
    const groups = cleaned.match(/.{1,3}/g) || [];
    return groups.join(' ');
  };

  const normalizedGameCode = (value = '') => value.replace(/\s+/g, ' ').trim();

  function handleManualInput(event) {
    gameCode = formatGameCode(event.currentTarget.value);
    selectedSessionId = '';
  }

  async function connectWithGameId() {
    const code = normalizedGameCode(gameCode);
    if (!code) return;
    try {
      connectPending = true;
      const session = await getSessionByGameId(code);
      if (!session) {
        openAlert($t('player.invalid_id'), 'warning');
      } else {
        try {
          await connectPlayerToSession(session.id, user);
          dispatch('connect', { sessionId: session.id, session, target: 'waiting' });
        } catch (error) {
          console.error('[choose] unable to connect player', error);
          handleConnectError(error);
        }
      }
    } catch (e) {
      console.error(e);
      openAlert($t('player.connect_error'), 'error');
    } finally {
      connectPending = false;
    }
  }

  function onPick(session) {
    selectedSessionId = session.id;
    gameCode = formatGameCode(session.game_id ?? session.id ?? '');
  }

  function onRowKey(event, session) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(session);
    }
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

      <section class="method-block sessions-block" aria-labelledby="sessions-heading">
        <div class="sessions-head">
          <div>
            <h3 id="sessions-heading" class="section-heading">{$t('player.active_sessions')}</h3>
            <p class="section-subheading">{$t('player.active_sessions_hint')}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            on:click={loadActive}
            className="refresh-btn"
            disabled={listLoading}
            aria-label={$t('player.refresh')}
          >
            {listLoading ? `${$t('player.refresh')}…` : $t('player.refresh')}
          </Button>
        </div>
        <div class="table-panel sessions-panel">
          {#if listLoading}
            <p class="state info">{$t('player.loading')}</p>
          {:else if listError}
            <p class="state error">{listError}</p>
          {:else if listInfo}
            <p class="state info">{listInfo}</p>
          {:else}
            <table class="app-table choose-table" aria-label={$t('player.active_sessions')}>
              <thead>
                <tr>
                  <th class="title-cell">{$t('history.headers.title')}</th>
                  <th>{$t('player.session_id')}</th>
                  <th>{$t('history.headers.status')}</th>
                </tr>
              </thead>
              <tbody>
                {#if sessions.length === 0}
                  <tr>
                    <td class="empty" colspan="3">{$t('player.no_sessions')}</td>
                  </tr>
                {:else}
                  {#each sessions as s}
                    <tr
                      class:selected={selectedSessionId === s.id}
                      tabindex="0"
                      on:click={() => onPick(s)}
                      on:keydown={(event) => onRowKey(event, s)}
                    >
                      <td
                        class="title-cell"
                        title={s.title ?? $t('common.untitled_session')}
                      >
                        {s.title ?? $t('common.untitled_session')}
                      </td>
                      <td class="code">{s.game_id ?? '—'}</td>
                      <td>
                        <span class="badge {statusBadgeClass(s.status)}">{statusLabel(s.status)}</span>
                      </td>
                    </tr>
                  {/each}
                {/if}
              </tbody>
            </table>
          {/if}
        </div>
      </section>

      <section class="method-block manual-block" aria-labelledby="manual-heading">
        <h3 id="manual-heading" class="section-heading">{$t('player.session_id')}</h3>
        <InputField
          id="game-code"
          placeholder={$t('player.session_id_placeholder')}
          bind:value={gameCode}
          autocomplete="off"
          on:input={handleManualInput}
          aria-labelledby="manual-heading"
          hint={$t('player.session_id_hint')}
        />

        <div class="connect-row">
          <Button
            variant="primary"
            type="button"
            className="full-width"
            on:click={connectWithGameId}
            disabled={!normalizedGameCode(gameCode) || connectPending}
          >
            {connectPending ? `${$t('player.connect')}…` : $t('player.connect')}
          </Button>
        </div>

      </section>
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

  .sessions-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .refresh-btn {
    min-width: 110px;
  }

  .sessions-panel {
    padding: 0;
    overflow-x: auto;
  }

  .choose-table {
    min-width: 560px;
    table-layout: auto;
  }

  .choose-table td.code {
    font-family: var(--font-mono, 'Fira Code', monospace);
    letter-spacing: 0.08em;
    white-space: nowrap;
  }

  .choose-table tbody tr {
    cursor: pointer;
  }

  .state {
    margin: 0;
    font-size: 0.95rem;
  }

  .state.info {
    color: var(--color-gold-info);
  }

  .state.error,
  .error {
    color: var(--color-error-soft);
  }

  .info {
    color: var(--color-gold-info);
  }
  .sessions-panel .state {
    padding: var(--space-3);
  }

  .title-cell {
    max-width: clamp(16ch, 48vw, 28ch);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .full-width {
    width: 100%;
  }

  .manual-block :global(.form-field) {
    width: 100%;
  }

  .connect-row {
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 640px) {
    .choose-panel {
      width: min(96vw, 520px);
    }
    .sessions-surface {
      max-height: none;
    }
    .sessions-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>

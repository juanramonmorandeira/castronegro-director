<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import { t, locale } from '../lib/i18n.js';
  import { formatTime, statusLabel } from '../lib/utils.js';
  import {
    subscribeToSession,
    subscribeWaitingRoomMessages,
    sendWaitingRoomMessage,
    connectPlayerToSession,
    updatePlayerReadyStatus,
    disconnectPlayerFromSession
  } from '../lib/db.js';
import {
    normalizeRoleSelection,
    flattenRoleSelection,
    roleImageSrc,
    getRoleName,
    getRoleShortDescription
  } from '../lib/roles.js';
  import {
    resolvePlayerKey,
    derivePlayerAlias,
    mapPlayers,
    computePlayerCounts
  } from '../lib/players.js';

  const MIN_PLAYERS = 5;
  const MAX_PLAYERS = 15;
  const clampPlayers = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return MIN_PLAYERS;
    return Math.min(Math.max(numeric, MIN_PLAYERS), MAX_PLAYERS);
  };

  export let sessionId = null;
  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  const dispatch = createEventDispatcher();

  let loading = true;
  let sessionTitle = '';
  let sessionDescription = '';
  let sessionStatus = 'waiting';
  let expectedPlayers = MIN_PLAYERS;
  let connectedCount = 0;
  let readyCount = 0;
  let players = [];
  let roles = [];
  let chatMessages = [];
  let chatInput = '';
  let sendingMessage = false;
  let readyPending = false;
  let leavePending = false;
  let ensurePending = false;
  let aliasDisplay = user?.alias ?? user?.name ?? '';
  let sessionError = '';
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'info';
  let alertTitle = '';

  let sessionUnsubscribe = null;
  let chatUnsubscribe = null;

  $: playerKey = resolvePlayerKey(user);
  $: localizedRoles = roles.map((role) => ({
    ...role,
    label: getRoleName(role.role, $locale),
    summary: getRoleShortDescription(role.role, $locale),
    image: roleImageSrc(role.category, role.role)
  }));
  $: isReady = players.find((player) => player.id === playerKey)?.ready ?? false;
  $: readyLabel = isReady ? $t('player.waiting.ready_cancel') : $t('player.waiting.ready_mark');

  function openAlert(message, variant = 'info', title = null) {
    alertMessage = message;
    alertVariant = variant;
    alertTitle = title ?? $t('player.waiting.title');
    alertOpen = true;
  }

  function closeAlert() {
    alertOpen = false;
  }

  function normalizeMessages(list = []) {
    return (list ?? []).map((item) => ({
      id: item.id,
      text: item.message ?? '',
      alias: item.alias ?? $t('common.untitled'),
      createdAt: item.created_at ?? null,
      timeLabel: formatTime(item.created_at, $locale),
      isSelf: playerKey && item.user_id === playerKey
    }));
  }

  function updateSessionSnapshot(snapshot) {
    if (!snapshot) return;
    sessionTitle = snapshot.title ?? snapshot.settings?.name ?? '';
    sessionStatus = snapshot.status ?? sessionStatus;
    const settings = snapshot.settings ?? {};
    sessionDescription = settings.description ?? '';
    expectedPlayers = clampPlayers(settings.players_expected ?? expectedPlayers);
    const normalizedRoles = normalizeRoleSelection(settings.roles ?? {});
    roles = flattenRoleSelection(normalizedRoles);
    const playerMap = snapshot.players ?? {};
    const counts = computePlayerCounts(playerMap);
    const fallbackReady =
      countEntries(
        snapshot.players_ready ??
          snapshot.ready_players ??
          snapshot.ready ??
          snapshot.playersReady ??
          null
      );
    connectedCount = counts.connected || Object.keys(playerMap).length;
    readyCount = Math.max(counts.ready, fallbackReady);
    players = mapPlayers(playerMap);
    if (!aliasDisplay) {
      aliasDisplay = players.find((entry) => entry.id === playerKey)?.alias ?? aliasDisplay;
    }
    loading = false;
    dispatch('session-stats', {
      expected: expectedPlayers,
      connected: connectedCount,
      ready: readyCount,
      status: sessionStatus
    });
  }

  function countEntries(value) {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    return 0;
  }

  function resolveJoinError(code) {
    if (code === 'session/full') return $t('player.waiting.join_full');
    if (code === 'session/unavailable') return $t('player.waiting.join_unavailable');
    return $t('player.errors.generic');
  }

  async function ensureConnection() {
    if (!sessionId || !user || !playerKey) return;
    try {
      ensurePending = true;
      const result = await connectPlayerToSession(sessionId, user);
      aliasDisplay = result?.player?.alias ?? user?.alias ?? derivePlayerAlias(user, '', players.length);
      sessionError = '';
    } catch (error) {
      console.error('[waiting] unable to connect', error);
      sessionError = resolveJoinError(error?.code);
      openAlert(sessionError, 'error');
    } finally {
      ensurePending = false;
    }
  }

  async function toggleReady() {
    if (!sessionId || !playerKey || readyPending) return;
    try {
      readyPending = true;
      await updatePlayerReadyStatus(sessionId, playerKey, !isReady);
    } catch (error) {
      console.error('[waiting] unable to toggle ready', error);
      openAlert($t('player.errors.generic'), 'error');
    } finally {
      readyPending = false;
    }
  }

  async function handleSendMessage(event) {
    event?.preventDefault();
    const text = chatInput.trim();
    if (!text || !sessionId || sendingMessage) return;
    try {
      sendingMessage = true;
      await sendWaitingRoomMessage(sessionId, {
        text,
        alias: aliasDisplay || derivePlayerAlias(user ?? {}, '', players.length),
        playerId: playerKey ?? null,
        avatarURL: user?.avatarURL ?? null
      });
      chatInput = '';
    } catch (error) {
      console.error('[waiting] unable to send message', error);
      openAlert($t('player.waiting.chat_error'), 'error');
    } finally {
      sendingMessage = false;
    }
  }

  async function handleLeaveRoom() {
    if (!sessionId || !playerKey || leavePending) {
      dispatch('leave');
      return;
    }
    try {
      leavePending = true;
      await disconnectPlayerFromSession(sessionId, playerKey);
    } catch (error) {
      console.error('[waiting] unable to leave session', error);
    } finally {
      leavePending = false;
      dispatch('leave');
    }
  }

  onMount(() => {
    if (!sessionId || !user) {
      sessionError = $t('player.waiting.join_unavailable');
      loading = false;
      return () => {};
    }

    ensureConnection();

    sessionUnsubscribe = subscribeToSession(sessionId, (snapshot) => {
      if (!snapshot) {
        sessionError = $t('player.waiting.join_unavailable');
        loading = false;
        return;
      }
      updateSessionSnapshot(snapshot);
    });

    chatUnsubscribe = subscribeWaitingRoomMessages(sessionId, (messages) => {
      chatMessages = normalizeMessages(messages);
    });

    return () => {
      sessionUnsubscribe?.();
      chatUnsubscribe?.();
    };
  });

  onDestroy(() => {
    sessionUnsubscribe?.();
    chatUnsubscribe?.();
  });
</script>

<BackgroundLayer />

<div class="page-grid">
  <Topbar
    titleKey="player.waiting.title"
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile={(event) => dispatch('profile', event.detail)}
    on:logout={(event) => dispatch('logout', event.detail)}
  />

  <main class="page-main waiting-main">
    {#if loading}
      <section class="waiting-card card-glass">
        <p>{$t('common.loading')}</p>
      </section>
    {:else if sessionError}
      <section class="waiting-card card-glass">
        <h2 class="waiting-title">{sessionTitle || $t('common.untitled_session')}</h2>
        <p class="waiting-error">{sessionError}</p>
        <div class="actions-row">
          <button class="btn secondary" type="button" on:click={handleLeaveRoom} disabled={leavePending}>
            {$t('player.waiting.leave_room')}
          </button>
        </div>
      </section>
    {:else}
      <section class="waiting-card card-glass">
        <header class="waiting-header">
          <h2 class="waiting-title panel-title">{$t('player.waiting.title')}</h2>
          <p class="waiting-subtitle">{$t('player.waiting.subtitle')}</p>
        </header>

        <div class="waiting-stack">
          <article class="waiting-section description">
            <header class="section-head description-head">
              <h3>{$t('player.waiting.description_title')}</h3>
            </header>
            <p class="session-name">{sessionTitle || $t('common.untitled_session')}</p>
            <p>
              {sessionDescription
                ? sessionDescription
                : $t('player.waiting.description_empty')}
            </p>
          </article>

          <article class="waiting-section roles full-width">
            <header class="section-head">
              <h3>{$t('player.waiting.roles_title')}</h3>
            </header>
            {#if roles.length === 0}
              <p class="empty">{$t('player.waiting.roles_empty')}</p>
            {:else}
              <ul class="roles-list">
                {#each localizedRoles as role}
                  <li class="role-card">
                    <img src={role.image} alt={role.label} />
                    <div>
                      <strong>{role.label}</strong>
                      <p>{role.summary || role.description}</p>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </article>

          <div class="waiting-grid">
            <article class="waiting-section chat">
              <h3>{$t('player.waiting.chat_title')}</h3>
              <div class="chat-log">
                {#if chatMessages.length === 0}
                  <p class="empty">{$t('player.waiting.chat_empty')}</p>
              {:else}
                {#each chatMessages as message}
                    <div class={`chat-message ${message.isSelf ? 'chat-message--self' : ''}`}>
                      <div class="chat-meta">
                        <span class="chat-alias">{message.alias}</span>
                        <span class="chat-time">{message.timeLabel}</span>
                      </div>
                      <p>{message.text}</p>
                    </div>
                  {/each}
                {/if}
              </div>
              <form class="chat-form" on:submit|preventDefault={handleSendMessage}>
                <input
                  class="input chat-input"
                  type="text"
                  bind:value={chatInput}
                  placeholder={$t('player.waiting.chat_placeholder')}
                  maxlength="240"
                />
                <button class="btn primary" type="submit" disabled={sendingMessage || !chatInput.trim()}>
                  {sendingMessage ? '…' : $t('player.waiting.chat_send')}
                </button>
              </form>
            </article>

            <article class="waiting-section players">
              <div class="section-head">
                <h3>{$t('player.waiting.players_title')}</h3>
                <span class="stat-pill">{connectedCount}/{expectedPlayers}</span>
              </div>
              <ul class="players-list">
                {#if players.length === 0}
                  <li class="empty">{$t('player.waiting.players_empty')}</li>
                {:else}
                  {#each players as participant}
                    <li>
                      <span>{participant.alias}</span>
                      <span
                        class={`status-dot status-dot--${participant.ready ? 'ready' : 'connected'}`}
                        title={
                          participant.ready
                            ? $t('player.waiting.ready_ready')
                            : $t('player.waiting.ready_connected')
                        }
                        aria-label={
                          participant.ready
                            ? $t('player.waiting.ready_ready')
                            : $t('player.waiting.ready_connected')
                        }
                      >
                        <span class="sr-only">
                          {participant.ready
                            ? $t('player.waiting.ready_ready')
                            : $t('player.waiting.ready_connected')}
                        </span>
                      </span>
                    </li>
                  {/each}
                {/if}
              </ul>
              <div class="players-actions">
                <button
                  class="btn start"
                  type="button"
                  on:click={toggleReady}
                  disabled={readyPending || ensurePending}
                >
                  {readyPending ? '…' : readyLabel}
                </button>
                <button
                  class="btn secondary"
                  type="button"
                  on:click={handleLeaveRoom}
                  disabled={leavePending}
                >
                  {leavePending ? '…' : $t('player.waiting.leave_room')}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>
    {/if}
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
  .waiting-main {
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .waiting-card {
    width: min(660px, 94vw);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: clamp(1.75rem, 4vw, 2.5rem);
  }

  .waiting-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }

  .waiting-title {
    margin: 0;
  }

  .waiting-subtitle {
    margin: 0.15rem 0 0;
    color: var(--color-text-secondary);
  }

  .waiting-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

.waiting-grid {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--space-3);
  align-items: stretch;
}

.waiting-section {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--glass-fill);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

  .waiting-section h3,
  .section-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

.waiting-section.chat,
.waiting-section.players {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.75rem;
  min-height: 260px;
  height: 100%;
}

.waiting-section.players {
  height: 100%;
}

  .waiting-section.full-width,
  .waiting-section.description {
    width: 100%;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .description-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }

  .session-name {
    margin: 0;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .waiting-kicker,
  .section-kicker {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
  }


  .stat-pill {
    padding: 0.15rem 0.65rem;
    border-radius: 999px;
    background: var(--glass-hover);
    font-size: 0.85rem;
  }

.players-list,
.roles-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
  min-height: 0;
}

  /* Scrollbar más sutil en la lista de roles */
  .roles-list::-webkit-scrollbar {
    width: 8px;
  }
  .roles-list::-webkit-scrollbar-track {
    background: transparent;
  }
  .roles-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 999px;
  }
  .roles-list::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .roles-list {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
  }

  .players-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 0.45rem 0.75rem;
    background: var(--glass-fill);
  }

  .players-list .empty,
  .waiting-section .empty,
  .chat-log .empty {
    color: var(--color-white-muted);
  }

.players-actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}

  .roles-list .role-card {
    display: flex;
    gap: 0.75rem;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 0.5rem;
    background: var(--glass-fill);
    align-items: flex-start;
  }

  .role-card img {
    width: 48px;
    height: 48px;
    border-radius: 0.5rem;
    background: var(--surface-input);
  }

  .role-card strong {
    display: block;
    margin-bottom: 0.2rem;
  }

  .role-card p {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-white-muted);
  }

  .chat-log {
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: 0.75rem;
    min-height: 200px;
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    background: var(--glass-fill);
    min-height: 0;
  }

  .chat-message {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .chat-message--self {
    align-items: flex-end;
    text-align: right;
  }

  .chat-meta {
    font-size: 0.75rem;
    color: var(--color-white-muted);
    display: flex;
    gap: 0.5rem;
  }

  .chat-form {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .chat-input {
    flex: 1;
    min-width: 220px;
  }

  .status-pill {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .status-dot {
    width: 14px;
    height: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .status-dot--ready {
    background: var(--state-in-progress);
  }

  .status-dot--connected {
    background: var(--state-waiting);
  }

  .waiting-error {
    color: var(--color-white-muted);
  }

  .actions-row {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 768px) {
    .waiting-card {
      gap: var(--space-3);
    }

    .waiting-grid {
      grid-template-columns: 1fr;
    }

    .waiting-section {
      padding: var(--space-3);
    }

    .players-actions {
      flex-direction: row;
      justify-content: flex-end;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .chat-form {
      grid-template-columns: 1fr;
    }

    .chat-input {
      min-width: 100%;
      width: 100%;
    }
  }
</style>

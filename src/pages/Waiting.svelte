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
          <p class="waiting-kicker">{$t('player.waiting.heading')}</p>
          <h2 class="waiting-title">{$t('player.waiting.title')}</h2>
          <p class="waiting-subtitle">{$t('player.waiting.subtitle')}</p>
        </header>

        <div class="waiting-stack">
          <article class="waiting-section description">
            <div class="section-head description-head">
              <p class="section-kicker">{$t('player.waiting.description_title')}</p>
              <h3>{sessionTitle || $t('common.untitled_session')}</h3>
            </div>
            <p>
              {sessionDescription
                ? sessionDescription
                : $t('player.waiting.description_empty')}
            </p>
          </article>

          <article class="waiting-section roles full-width">
            <header class="section-head">
              <h3>{$t('player.waiting.roles_title')}</h3>
              <span class="stat-pill">
                {$t('player.waiting.roles_count', { count: roles.length })}
              </span>
            </header>
            {#if roles.length === 0}
              <p class="empty">{$t('player.waiting.roles_empty')}</p>
            {:else}
              <ul class="roles-list">
                {#each localizedRoles as role}
                  <li class="role-card">
                    <img src={role.image} alt={role.label} />
                    <div>
                      <strong>{role.label} ×{role.count}</strong>
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
                      <span class={`status-pill status-pill--${participant.ready ? 'ready' : 'connected'}`}>
                        {participant.ready
                          ? $t('player.waiting.ready_ready')
                          : $t('player.waiting.ready_connected')}
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
    font-size: clamp(1.5rem, 3vw, 2rem);
    color: var(--color-gold-highlight);
  }

  .waiting-subtitle {
    margin: 0.25rem 0 0;
    color: var(--color-white-muted);
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
    align-items: start;
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

  .waiting-section.chat {
    min-height: 260px;
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

  .waiting-kicker,
  .section-kicker {
    margin: 0;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    color: var(--color-gold-highlight);
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
    gap: 0.5rem;
    flex-wrap: wrap;
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
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .status-pill--ready {
    background: var(--state-in-progress);
    color: var(--color-text-invert);
  }

  .status-pill--connected {
    background: var(--state-waiting);
    color: var(--color-text-invert);
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
      flex-direction: column;
    }

    .chat-form {
      flex-direction: column;
    }

    .chat-input {
      min-width: 100%;
      width: 100%;
    }
  }
</style>

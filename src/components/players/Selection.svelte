<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import Topbar from '../Topbar.svelte';
  import Footbar from '../Footbar.svelte';
  import BackgroundLayer from '../landing/BackgroundLayer.svelte';
  import { t } from '../../lib/i18n.js';
  import { listActiveSessions, getSessionById } from '../../lib/db.js';
  import { formatDateTime, statusBadgeClass, statusLabel } from '../../lib/utils.js';

  const dispatch = createEventDispatcher();

  let loading = false;
  let error = '';
  let info = '';

  // Entrada manual
  let typedId = '';
  // Selección desde la lista
  let selectedId = '';

  // Lista de sesiones activas
  let sessions = [];

  async function loadActive() {
    error = ''; info = '';
    loading = true;
    try {
      sessions = await listActiveSessions(10);
      if (sessions.length === 0) info = $t('player.no_sessions');
    } catch (e) {
      console.error(e);
      error = $t('player.load_error');
    } finally {
      loading = false;
    }
  }

  function scanQr() {
    dispatch('scan-qr');
  }

  async function connectById(id) {
    error = ''; info = '';
    const sessionId = (id || typedId || selectedId || '').trim();
    if (!sessionId) return;
    try {
      loading = true;
      const doc = await getSessionById(sessionId);
      if (!doc) {
        error = $t('player.invalid_id');
      } else {
        dispatch('connect', { sessionId, session: doc });
      }
    } catch (e) {
      console.error(e);
      error = $t('player.connect_error');
    } finally {
      loading = false;
    }
  }

  function onPick(id) {
    selectedId = id === selectedId ? '' : id;
  }

  function onOptionKey(event, id) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPick(id);
    }
  }

  onMount(loadActive);
</script>

<BackgroundLayer />

<div class="page">
  <Topbar titleKey="player.choose_title" />
  <main class="center">
    <div class="layout">
      <section class="auth-card card-glass">
        <h2>{$t('player.join_methods')}</h2>
        <p class="intro">{$t('player.join_intro')}</p>

        <div class="field">
          <button class="btn primary" type="button" on:click={scanQr} aria-label={$t('player.scan_qr')}>
            {$t('player.scan_qr')}
          </button>
        </div>

        <div class="field">
          <label class="label" for="sid">{$t('player.session_id')}</label>
          <div class="id-row">
            <input
              id="sid"
              class="input"
              type="text"
              bind:value={typedId}
              placeholder={$t('player.session_id_placeholder')}
              autocomplete="off"
            />
            <button class="btn outline" type="button" on:click={() => connectById(typedId)} disabled={!typedId}>
              {$t('player.connect')}
            </button>
          </div>
          <small class="hint">{$t('player.session_id_hint')}</small>
        </div>
      </section>

      <section class="auth-card card-glass">
        <div class="head">
          <h3>{$t('player.active_sessions')}</h3>
          <button class="btn outline small" type="button" on:click={loadActive} aria-label={$t('player.refresh')}>
            {$t('player.refresh')}
          </button>
        </div>

        {#if loading}
          <p class="info">{$t('player.loading')}</p>
        {:else if error}
          <p class="error">{error}</p>
        {:else if info}
          <p class="info">{info}</p>
        {:else}
          <div class="list-wrap">
            <ul class="list" role="listbox" aria-label={$t('player.active_sessions')}>
              {#each sessions as s}
                <li
                  class:selected={selectedId === s.id}
                  role="option"
                  aria-selected={selectedId === s.id}
                  on:click={() => onPick(s.id)}
                  on:keydown={(event) => onOptionKey(event, s.id)}
                  tabindex="0"
                >
                  <div class="rowline">
                    <strong class="titleline">{s.title ?? s.id}</strong>
                    <span class="badge {statusBadgeClass(s.status)}">{statusLabel(s.status)}</span>
                  </div>
                  <small>
                    {$t('player.created_at')} {formatDateTime(s.created_at)}
                    · {$t('player.updated_at')} {formatDateTime(s.updated_at)}
                  </small>
                </li>
              {/each}
            </ul>
          </div>

          <div class="field">
            <button class="btn primary" type="button" on:click={() => connectById(selectedId)} disabled={!selectedId}>
              {$t('player.connect_selected')}
            </button>
          </div>
        {/if}
      </section>
    </div>
  </main>
  <Footbar />
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }
  .center {
    display: grid;
    place-items: center;
    padding: 2rem 1rem;
  }
  .layout {
    display: grid;
    gap: 1.5rem;
    width: min(980px, 94vw);
  }
  @media (min-width: 900px) {
    .layout {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .auth-card {
    display: grid;
    gap: 1rem;
    padding: clamp(1.5rem, 3vw, 2.25rem);
  }
  .auth-card h2,
  .auth-card h3 {
    margin: 0;
    font-family: "Merriweather", serif;
    font-size: clamp(1.6rem, 3vw, 2.1rem);
    color: #f4d47c;
    text-align: center;
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 18px rgba(255, 180, 40, 0.4),
      2px 2px 10px rgba(0, 0, 0, 0.85);
  }
  .auth-card h3 {
    font-size: clamp(1.4rem, 2.4vw, 1.8rem);
  }
  .intro {
    margin: 0;
    text-align: center;
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.95rem;
  }
  .field {
    display: grid;
    gap: 0.5rem;
  }
  .label {
    font-weight: 600;
    color: #f0f3f7;
  }
  .input {
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    padding: 0.65rem 0.8rem;
    background: rgba(0, 0, 0, 0.3);
    color: #f5f8fb;
    font-size: 1rem;
  }
  .input:focus {
    outline: 2px solid rgba(255, 232, 140, 0.6);
    outline-offset: 2px;
  }
  .id-row {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .id-row .input {
    flex: 1 1 160px;
  }
  .hint {
    font-size: 0.85rem;
    color: rgba(230, 236, 247, 0.8);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .list-wrap {
    max-height: 45vh;
    overflow-y: auto;
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.6rem;
  }
  .list li {
    padding: 0.75rem 0.85rem;
    border: 1px solid var(--glass-brd);
    border-radius: 0.7rem;
    background: rgba(0, 0, 0, 0.28);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .list li:hover {
    background: rgba(0, 0, 0, 0.35);
  }
  .list li.selected {
    outline: 2px solid rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.4);
  }
  .rowline {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }
  .titleline {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    border: none;
    cursor: pointer;
    padding: 0.65rem 1.4rem;
    font-weight: 600;
  }
  .btn.primary {
    background: rgba(74, 141, 74, 0.8);
    border: 1px solid rgba(74, 141, 74, 0.9);
    color: #f6fff6;
  }
  .btn.primary[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn.outline {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.35);
    color: #f0f3f7;
  }
  .btn.small {
    padding: 0.4rem 0.8rem;
    font-size: 0.9rem;
  }
  .error {
    color: #ff9b9b;
    margin: 0;
  }
  .info {
    color: #ffd27f;
    margin: 0;
  }
</style>

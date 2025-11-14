<script>
  import { createEventDispatcher } from 'svelte';
  import Button from '../ui/Button.svelte';
  import { statusBadgeClass, statusLabel } from '../../lib/utils.js';

  export let heading = '';
  export let subheading = '';
  export let sessions = [];
  export let selectedId = '';
  export let loading = false;
  export let error = '';
  export let info = '';
  export let refreshLabel = '';
  export let tableLabel = '';
  export let titleLabel = '';
  export let idLabel = '';
  export let statusHeaderLabel = '';
  export let emptyLabel = '';
  export let listLabel = '';
  export let untitledLabel = '';

  const dispatch = createEventDispatcher();

  function handleRefresh() {
    if (loading) return;
    dispatch('refresh');
  }

  function handleSelect(session) {
    dispatch('select', session);
  }

  function handleKey(event, session) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(session);
    }
  }
</script>

<section class="method-block sessions-block" aria-labelledby="sessions-heading">
  <div class="sessions-head">
    <div>
      <h3 id="sessions-heading" class="section-heading">{heading}</h3>
      {#if subheading}
        <p class="section-subheading">{subheading}</p>
      {/if}
    </div>
    <Button
      variant="secondary"
      size="sm"
      type="button"
      className="refresh-btn"
      disabled={loading}
      aria-label={refreshLabel}
      on:click={handleRefresh}
    >
      {loading ? `${refreshLabel}…` : refreshLabel}
    </Button>
  </div>
  <div class="table-panel sessions-panel">
    {#if loading}
      <p class="state info">{listLabel}</p>
    {:else if error}
      <p class="state error">{error}</p>
    {:else if info}
      <p class="state info">{info}</p>
    {:else}
      <table class="app-table choose-table" aria-label={tableLabel}>
        <thead>
          <tr>
            <th class="title-cell">{titleLabel}</th>
            <th>{idLabel}</th>
            <th>{statusHeaderLabel}</th>
          </tr>
        </thead>
        <tbody>
          {#if sessions.length === 0}
            <tr>
              <td class="empty" colspan="3">{emptyLabel}</td>
            </tr>
          {:else}
            {#each sessions as session}
              <tr
                class:selected={selectedId === session.id}
                tabindex="0"
                on:click={() => handleSelect(session)}
                on:keydown={(event) => handleKey(event, session)}
              >
                <td class="title-cell" title={session.title ?? untitledLabel}>
                  {session.title ?? untitledLabel}
                </td>
                <td class="code">{session.game_id ?? '—'}</td>
                <td>
                  <span class={`badge ${statusBadgeClass(session.status)}`}>{statusLabel(session.status)}</span>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    {/if}
  </div>
</section>

<style>
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

  .state.info,
  .info {
    color: var(--color-gold-info);
  }

  .state.error,
  .error {
    color: var(--color-error-soft);
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

  @media (max-width: 640px) {
    .sessions-head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>

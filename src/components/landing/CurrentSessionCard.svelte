<script>
  import { createEventDispatcher } from 'svelte';

  // Props
  export let session = null;
  export let loading = false;
  export let canView = false;

  // Events
  const dispatch = createEventDispatcher();
  const emitCreate = () => dispatch('create');
  const emitView = () => session && dispatch('view', { id: session.id });

  // Helpers
  const capitalize = (value) => String(value).charAt(0).toUpperCase() + String(value).slice(1);
  const statusLabel = (status) => (status ? capitalize(status) : 'Unknown');
</script>

<section class="current-card" aria-live="polite">
  <!-- Status box -->
  <div class="status-box" data-has-session={!!session}>
    {#if loading}
      Checking current game session…
    {:else if session}
      <strong>Active game:</strong> {session.title ?? 'Untitled'} — {statusLabel(session.status)}
    {:else}
      No active game sessions right now.
    {/if}
  </div>

  <!-- Primary actions -->
  <div class="actions">
    <button class="primary" on:click={emitCreate} aria-label="Create new game">
      Create new game
    </button>
    <button class="ghost" on:click={emitView} disabled={!session || !canView} aria-label="View current game">
      View current game
    </button>
  </div>
</section>

<style>
  .current-card {
    display: grid;
    gap: 0.75rem;
    width: 100%;
  }

  .status-box {
    text-align: center;
    padding: 0.6rem 0.8rem;
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 10px;
    background: rgba(20, 24, 28, 0.25);
    color: #f0f3f6;
    backdrop-filter: blur(2px);
  }
  .status-box[data-has-session="true"] {
    border-color: rgba(255, 213, 120, 0.5);
    background: rgba(48, 40, 20, 0.25);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;   /* <-- centra los botones */
    flex-wrap: wrap;
  }

  .primary {
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    border: 1px solid #3a5a3a;
    background: rgba(60, 120, 60, 0.25);
    color: #e9ffe9;
    cursor: pointer;
  }
  .ghost {
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #e8ecf1;
    cursor: pointer;
  }
  .ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  @media (max-width: 760px) {
    .current-card { margin-inline: 0.5rem; }
  }
</style>

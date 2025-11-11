<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('cancel');
  }

  function autoAssign() {
    dispatch('auto');
  }

  function confirm() {
    dispatch('save');
  }
</script>

{#if open}
  <div
    class="config-modal-backdrop"
    role="dialog"
    tabindex="0"
    aria-modal="true"
    aria-labelledby="match-title"
    on:click={close}
    on:keydown={(event) => {
      if (event.key === 'Escape') close();
    }}
  >
    <div class="config-modal" role="document" on:click|stopPropagation>
      <header class="modal-header">
        <h3 id="match-title">{$t('configure.match_title')}</h3>
      </header>
      <div class="modal-body">
        <p class="hint">{$t('configure.match_hint')}</p>
        <div class="match-actions">
          <button class="btn secondary" type="button" on:click={autoAssign}>{$t('configure.match_auto')}</button>
          <button class="btn primary" type="button" on:click={confirm}>{$t('configure.match_manual')}</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 14, 0.75);
    display: grid;
    place-items: center;
    z-index: 1200;
    padding: 1rem;
  }
  .config-modal {
    width: min(520px, 95vw);
    background: #04070f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    padding: 1.75rem;
    color: #f5f8fb;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .modal-body {
    display: grid;
    gap: 1rem;
  }
  .hint {
    margin: 0;
    color: rgba(245, 245, 245, 0.7);
  }
  .match-actions {
    display: flex;
    gap: 0.75rem;
  }
  .match-actions .btn {
    flex: 1;
    justify-content: center;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.2rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: #1f6b2b;
    color: #f6fff6;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>

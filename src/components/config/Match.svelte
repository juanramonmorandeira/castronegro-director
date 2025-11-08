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
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="match-title">
    <div class="config-modal">
      <header class="modal-header">
        <h3 id="match-title">{$t('configure.match_title')}</h3>
        <button class="icon-btn" type="button" on:click={close} aria-label={$t('common.actions.cancel')}>
          ×
        </button>
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
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 1200;
    padding: 1rem;
  }
  .config-modal {
    width: min(520px, 95vw);
    background: rgba(8, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 1.5rem;
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
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.2rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: rgba(74, 141, 74, 0.85);
    color: #fff;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
  }
</style>

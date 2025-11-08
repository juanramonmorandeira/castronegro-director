<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  export let open = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('cancel');
  }
</script>

{#if open}
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="distribution-title">
    <div class="config-modal full">
      <header class="modal-header">
        <h3 id="distribution-title">{$t('configure.distribution_title')}</h3>
        <button class="icon-btn" type="button" on:click={close} aria-label={$t('common.actions.cancel')}>
          ×
        </button>
      </header>
      <div class="canvas-placeholder">
        <p>{$t('configure.distribution_hint')}</p>
      </div>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: grid;
    place-items: center;
    z-index: 1250;
    padding: 1rem;
  }
  .config-modal.full {
    width: min(1200px, 98vw);
    min-height: 70vh;
    background: rgba(8, 12, 18, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 24px;
    padding: 1.5rem;
    color: #f5f8fb;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .canvas-placeholder {
    flex: 1;
    border: 1px dashed rgba(255, 255, 255, 0.2);
    border-radius: 18px;
    display: grid;
    place-items: center;
    padding: 2rem;
    color: rgba(245, 245, 245, 0.75);
    text-align: center;
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.4rem;
    cursor: pointer;
  }
</style>

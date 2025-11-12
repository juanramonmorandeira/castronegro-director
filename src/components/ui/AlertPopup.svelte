<script>
  import { createEventDispatcher } from 'svelte';
  import Button from './Button.svelte';
  import { t } from '../../lib/i18n.js';

  export let open = false;
  export let title = '';
  export let message = '';
  export let variant = 'warning'; // warning | error | info

  const dispatch = createEventDispatcher();

  const variantClass = (kind) => {
    if (kind === 'error') return 'alert-panel--error';
    if (kind === 'info') return 'alert-panel--info';
    return 'alert-panel--warning';
  };

  function close() {
    dispatch('close');
  }
</script>

{#if open}
  <div class="alert-overlay" aria-live="assertive">
    <div
      class={`alert-panel ${variantClass(variant)}`}
      role="alertdialog"
      aria-modal="true"
      aria-label={title || $t('common.alerts.default_title')}
      tabindex="-1"
    >
      <header class="alert-header">
        <h3>{title || $t('common.alerts.default_title')}</h3>
      </header>
      <div class="alert-body">
        <p>{message}</p>
      </div>
      <footer class="alert-actions">
        <Button variant="primary" type="button" on:click={close}>
          {$t('common.actions.close')}
        </Button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .alert-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2, 4, 10, 0.75);
    display: grid;
    place-items: center;
    padding: var(--space-4);
    z-index: 2000;
  }

  .alert-panel {
    width: min(420px, 92vw);
    border-radius: var(--radius-lg);
    border: 1px solid var(--glass-border-strong);
    background: rgba(10, 16, 26, 0.95);
    box-shadow: var(--shadow-hard);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .alert-panel--warning {
    border-color: rgba(255, 200, 120, 0.4);
  }

  .alert-panel--error {
    border-color: var(--color-error-soft);
  }

  .alert-panel--info {
    border-color: rgba(150, 200, 255, 0.5);
  }

  .alert-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: var(--color-gold-highlight);
  }

  .alert-close {
    border: none;
    background: none;
    color: var(--color-text-primary);
    font-size: 1.5rem;
    cursor: pointer;
    line-height: 1;
  }

  .alert-body p {
    margin: 0;
    color: var(--color-text-primary);
  }

  .alert-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>

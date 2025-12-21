<script>
  import { toasts, dismissToast } from '../../lib/toast.js';

  const variantClass = (variant) => {
    if (variant === 'error') return 'toast--error';
    if (variant === 'info') return 'toast--info';
    return 'toast--success';
  };
</script>

{#if $toasts.length}
  <div class="toast-host" aria-live="polite">
    {#each $toasts as toast (toast.id)}
      <div class={`toast ${variantClass(toast.variant)}`} role="status">
        <span class="toast__icon" aria-hidden="true">✓</span>
        <span class="toast__message">{toast.message}</span>
        <button class="toast__close" type="button" on:click={() => dismissToast(toast.id)} aria-label="Dismiss">
          ×
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-host {
    position: fixed;
    inset: auto 1.25rem 1.25rem auto;
    z-index: 4000;
    display: grid;
    gap: 0.5rem;
    max-width: min(340px, 90vw);
  }

  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.65rem;
    padding: 0.75rem 0.9rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(7, 11, 18, 0.94);
    box-shadow: 0 14px 40px rgba(0, 0, 0, 0.4);
    color: var(--color-white-contrast);
  }

  .toast--success {
    border-color: rgba(52, 199, 89, 0.4);
  }

  .toast--info {
    border-color: rgba(150, 200, 255, 0.35);
  }

  .toast--error {
    border-color: rgba(229, 62, 62, 0.45);
  }

  .toast__icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(52, 199, 89, 0.2);
    color: #8ff0b1;
    font-weight: 700;
    font-size: 0.95rem;
  }

  .toast--error .toast__icon {
    background: rgba(229, 62, 62, 0.2);
    color: #ffb1ad;
  }

  .toast--info .toast__icon {
    background: rgba(150, 200, 255, 0.2);
    color: #cfe4ff;
  }

  .toast__message {
    line-height: 1.3;
  }

  .toast__close {
    border: none;
    background: transparent;
    color: var(--color-white-muted, #cfd7e3);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 0.1rem 0.25rem;
  }

  .toast__close:hover {
    color: var(--color-white-contrast);
  }
</style>

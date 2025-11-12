<script>
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let description = '';
  export let ariaLabel = '';
  export let size = 'md'; // sm | md | lg | xl
  export let showClose = true;
  export let closeOnBackdrop = true;
  export let className = '';

  const dispatch = createEventDispatcher();

  const widthMap = {
    sm: '460px',
    md: '620px',
    lg: '860px',
    xl: '1100px'
  };

  $: panelWidth = widthMap[size] ?? widthMap.md;

  const uniqueId = `modal-${Math.random().toString(36).slice(2, 9)}`;
  $: titleId = title ? `${uniqueId}-title` : null;
  $: descriptionId = description ? `${uniqueId}-description` : null;

  function close() {
    dispatch('close');
  }

  function handleBackdrop(event) {
    if (event.target === event.currentTarget && closeOnBackdrop) {
      close();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }
</script>

{#if open}
  <div
    class="modal-shell"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={descriptionId || ariaLabel}
    on:click={handleBackdrop}
    on:keydown={handleKeydown}
  >
    <div
      class={`modal-panel modal-panel--${size} ${className}`}
      style={`width:min(${panelWidth}, 96vw);`}
      role="document"
    >
      {#if title || $$slots['header-actions'] || showClose}
        <header class="modal-panel__header">
          <div class="modal-panel__heading">
            {#if title}
              <h2 id={titleId}>{title}</h2>
            {/if}
            {#if description}
              <p id={descriptionId} class="modal-panel__description">{description}</p>
            {/if}
          </div>
          <slot name="header-actions" />
          {#if showClose}
            <button class="modal-panel__close" type="button" on:click={close} aria-label="Close dialog">
              ×
            </button>
          {/if}
        </header>
      {/if}

      <div class="modal-panel__body">
        <slot />
      </div>

      {#if $$slots.footer}
        <footer class="modal-panel__footer">
          <slot name="footer" />
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-shell {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: grid;
    place-items: center;
    background: rgba(3, 6, 14, 0.78);
    padding: 1rem;
    backdrop-filter: blur(4px);
  }

  .modal-panel {
    background: #04070f;
    border: 1px solid var(--glass-hover);
    border-radius: 28px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.65);
    color: var(--color-white-contrast);
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: clamp(1.25rem, 3vw, 1.75rem);
  }

  .modal-panel__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .modal-panel__heading h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
  }

  .modal-panel__description {
    margin: 0.35rem 0 0;
    font-size: 0.92rem;
    color: var(--color-white-muted);
  }

  .modal-panel__close {
    border: none;
    border-radius: 999px;
    width: 34px;
    height: 34px;
    background: var(--glass-hover);
    color: var(--color-white-contrast);
    font-size: 1.2rem;
    cursor: pointer;
  }

  .modal-panel__body {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding-right: 0.25rem;
  }

  .modal-panel__footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  @media (max-width: 640px) {
    .modal-panel__body {
      padding-right: 0;
    }
  }
</style>

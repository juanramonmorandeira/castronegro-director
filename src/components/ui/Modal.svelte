<script>
  import { createEventDispatcher } from 'svelte';

  export let open = false;
  export let title = '';
  export let size = 'md'; // sm | md | lg | xl
  export let ariaLabel = '';
  export let showClose = true;
  export let className = '';

  const dispatch = createEventDispatcher();

  const widthMap = {
    sm: '480px',
    md: '640px',
    lg: '920px',
    xl: '1100px'
  };

  $: modalWidth = widthMap[size] ?? widthMap.md;
  $: hasFooter = !!$$slots?.footer;

  function close() {
    dispatch('close');
  }
</script>

{#if open}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={ariaLabel || title}>
    <div class={`modal-panel modal-panel--${size} ${className}`} style={`width:min(${modalWidth}, 96vw);`}>
      {#if title || showClose}
        <header class="modal-header cluster">
          {#if title}
            <h3 class="section-title">{title}</h3>
          {/if}
          {#if showClose}
            <button class="btn btn--ghost btn--size-sm" type="button" on:click={close} aria-label="Close">
              ×
            </button>
          {/if}
        </header>
      {/if}
      <div class="modal-body">
        <slot />
      </div>
      {#if hasFooter}
        <footer class="modal-footer cluster">
          <slot name="footer" />
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(.modal-panel .section-title) {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  :global(.modal-body) {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  :global(.modal-footer) {
    justify-content: flex-end;
  }
</style>

<script>
  import { createEventDispatcher } from 'svelte';

  export let variant = 'primary'; // primary, secondary, ghost, danger, link
  export let size = 'md'; // sm | md | lg
  export let type = 'button';
  export let loading = false;
  export let disabled = false;
  export let className = '';

  const dispatch = createEventDispatcher();

  function handleClick(event) {
    if (disabled || loading) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    dispatch('click', event);
  }

  $: classes = `btn btn--${variant} btn--size-${size} ${className}`.trim();
</script>

<button
  class={classes}
  type={type}
  disabled={disabled || loading}
  aria-disabled={disabled || loading}
  on:click={handleClick}
  {...$$restProps}
>
  <slot />
</button>

<style>
  :global(.btn--size-sm) {
    height: 2.25rem;
    padding: 0 var(--space-3);
    font-size: 0.9rem;
  }

  :global(.btn--size-md) {
    height: var(--btn-height);
  }

  :global(.btn--size-lg) {
    height: 3.25rem;
    padding: 0 var(--space-5);
    font-size: 1.05rem;
  }
</style>

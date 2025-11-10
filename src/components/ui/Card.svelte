<script>
  export let as = 'div';
  export let padding = 'lg'; // sm | md | lg
  export let interactive = false;
  export let className = '';

  const paddingMap = {
    sm: 'ui-card--pad-sm',
    md: 'ui-card--pad-md',
    lg: 'ui-card--pad-lg'
  };

  $: paddingClass = paddingMap[padding] ?? paddingMap.lg;
</script>

{#if typeof as === 'string'}
  <svelte:element
    this={as}
    class={`ui-card surface-card ${paddingClass} ${interactive ? 'ui-card--interactive' : ''} ${className}`}
    {...$$restProps}
  >
    <slot />
  </svelte:element>
{:else}
  <svelte:component
    this={as}
    class={`ui-card surface-card ${paddingClass} ${interactive ? 'ui-card--interactive' : ''} ${className}`}
    {...$$restProps}
  >
    <slot />
  </svelte:component>
{/if}

<style>
  :global(.ui-card) {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  :global(.ui-card--pad-sm) {
    padding: var(--space-4);
  }
  :global(.ui-card--pad-md) {
    padding: clamp(1.25rem, 2vw, 1.75rem);
  }
  :global(.ui-card--pad-lg) {
    padding: clamp(1.5rem, 3vw, 2.5rem);
  }
  :global(.ui-card--interactive) {
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  :global(.ui-card--interactive:hover) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-hard);
  }
</style>

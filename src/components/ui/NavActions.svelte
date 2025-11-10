<script>
  import { createEventDispatcher } from 'svelte';
  import Button from './Button.svelte';
  import { resolveNavigationActions } from '../../lib/navigation.js';
  import { t } from '../../lib/i18n.js';

  export let intents = [];
  export let layout = 'inline'; // inline | stacked
  export let className = '';
  export let overrides = {};

  const dispatch = createEventDispatcher();

  $: resolved = resolveNavigationActions(intents).map((action) => {
    const override = overrides?.[action.intent] ?? {};
    const labelKey = override.labelKey ?? action.labelKey;
    return {
      ...action,
      ...override,
      label: $t(labelKey)
    };
  });

  function handleClick(intent) {
    dispatch('navigate', { intent });
  }
</script>

{#if resolved.length > 0}
  <div class={`nav-actions nav-actions--${layout} ${className}`}>
    {#each resolved as action}
      <Button
        variant={action.variant}
        size={action.size}
        type="button"
        className="nav-actions__btn"
        on:click={() => handleClick(action.intent)}
      >
        {action.label}
      </Button>
    {/each}
  </div>
{/if}

<style>
  .nav-actions {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    flex-wrap: wrap;
  }

  .nav-actions--stacked {
    flex-direction: column;
    align-items: flex-start;
  }

  .nav-actions__btn {
    text-transform: none;
  }
</style>

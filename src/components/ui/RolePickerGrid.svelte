<script>
  import { createEventDispatcher } from 'svelte';

  export let title = '';
  export let subtitle = '';
  export let options = []; // [{ id, label, image, disabled, selected }]
  export let showTitle = true;
  export let variant = 'storyteller'; // storyteller | player

  const dispatch = createEventDispatcher();

  const select = (option) => {
    if (option?.disabled) return;
    dispatch('select', option);
  };
</script>

{#if showTitle && (title || subtitle)}
  <header class="picker-head">
    {#if title}<h3>{title}</h3>{/if}
    {#if subtitle}<p>{subtitle}</p>{/if}
  </header>
{/if}

<div class={`picker-grid variant-${variant}`}>
  {#each options as option}
    <button
      type="button"
      class={`picker-card ${option.selected ? 'selected' : ''} ${option.disabled ? 'disabled' : ''} variant-${variant}`}
      on:click={() => select(option)}
      aria-pressed={option.selected}
      aria-disabled={option.disabled}
    >
      <img src={option.image} alt={option.label} />
      <span>{option.label}</span>
    </button>
  {/each}
</div>

<style>
  .picker-head {
    margin-bottom: 0.75rem;
  }
  .picker-head h3 {
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
  }
  .picker-head p {
    margin: 0;
    opacity: 0.8;
    font-size: 0.95rem;
  }
  .picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.9rem;
  }
  .picker-card {
    background: rgba(8, 12, 20, 0.9);
    border: 1px solid var(--surface-border, #333);
    border-radius: 14px;
    padding: 0.9rem;
    display: grid;
    gap: 0.5rem;
    justify-items: center;
    cursor: pointer;
    color: var(--text-primary, #fff);
    transition: transform 0.12s ease, border-color 0.15s ease;
  }
  .picker-card:hover {
    border-color: rgba(255, 255, 255, 0.2);
  }
  .picker-card.selected {
    border-color: var(--surface-border, #333);
    box-shadow: none;
  }
  .picker-card.disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .picker-card.variant-player.selected {
    border-color: var(--color-gold-brand, #d4a017);
    box-shadow: 0 0 0 2px rgba(212, 160, 23, 0.35);
  }
  .picker-card img {
    width: 84px;
    height: 84px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid var(--surface-border, #333);
    background: #0d1320;
  }
  .picker-card span {
    font-weight: 600;
    text-align: center;
  }
</style>

<script>
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let title = '';
  export let image = '';
  export let labelEmpty = 'Select';
  export let removable = true;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  const onPick = () => {
    if (disabled) return;
    dispatch('pick');
  };

  const onClear = (event) => {
    event.stopPropagation();
    if (disabled || !value || !removable) return;
    dispatch('clear');
  };
</script>

<button
  type="button"
  class={`role-slot ${value ? 'filled' : 'empty'} ${disabled ? 'disabled' : ''}`}
  on:click={onPick}
  aria-label={value || labelEmpty}
>
  {#if value}
    <div class="role-slot__content">
      {#if image}
        <img src={image} alt={title || value} />
      {/if}
      <span class="role-slot__name">{title || value}</span>
      {#if removable}
        <span
          class="role-slot__remove"
          role="button"
          tabindex="0"
          aria-label="Remove"
          on:click={onClear}
          on:keydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onClear(event);
            }
          }}
        >
          ×
        </span>
      {/if}
    </div>
  {:else}
    <div class="role-slot__empty">
      <span class="plus-circle">+</span>
      <span class="label">{labelEmpty}</span>
    </div>
  {/if}
</button>

<style>
  .role-slot {
    width: 100%;
    min-height: 136px;
    border: 1px dashed var(--surface-border, #333);
    border-radius: 12px;
    background: var(--surface-2, #0f1419);
    color: var(--text-primary, #fff);
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
  }
  .role-slot.filled {
    border-style: solid;
    box-shadow: 0 0 0 1px rgba(212, 160, 23, 0.15);
  }
  .role-slot.disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .role-slot__empty {
    width: 100%;
    height: 100%;
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.02);
    padding: 0.65rem;
  }
  .plus-circle {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--surface-border, #333);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
  .role-slot__content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    justify-content: center;
  }
  .role-slot__content img {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--surface-border, #333);
  }
  .role-slot__name {
    font-weight: 600;
    text-transform: none;
    text-align: center;
  }
  .role-slot__remove {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid var(--surface-border, #333);
    background: var(--surface-1, #131a20);
    color: var(--text-primary, #fff);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }
  .role-slot__remove:focus-visible {
    outline: 2px solid var(--accent, #d4a017);
    outline-offset: 2px;
  }
  .label {
    font-size: 0.95rem;
    opacity: 0.8;
  }
</style>

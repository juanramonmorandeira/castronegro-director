<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let storytellerLabel = '';
  export let playerLabel = '';
  export let selected = 'storyteller';

  const dispatch = createEventDispatcher();

  function handleChange(event) {
    const value = event?.currentTarget?.value ?? selected;
    dispatch('change', value);
  }
</script>

<fieldset class="field">
  {#if label}
    <legend class="label">{label}</legend>
  {/if}
  <div class="role-options">
    <label class="role-option">
      <input
        type="radio"
        name="role"
        value="storyteller"
        checked={selected === 'storyteller'}
        on:change={handleChange}
      />
      <span class="role-chip">{storytellerLabel}</span>
    </label>
    <label class="role-option">
      <input
        type="radio"
        name="role"
        value="player"
        checked={selected === 'player'}
        on:change={handleChange}
      />
      <span class="role-chip">{playerLabel}</span>
    </label>
  </div>
</fieldset>

<style>
  fieldset {
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 12px;
    padding: 1rem;
    text-align: center;
    display: grid;
    gap: 0.75rem;
  }

  legend {
    padding: 0 0.5rem;
  }

  .role-options {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    flex-wrap: wrap;
  }

  .role-option {
    position: relative;
    display: inline-flex;
  }

  .role-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .role-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 140px;
    padding: 0.65rem 1.25rem;
    border-radius: var(--radius-pill);
    border: 1px solid var(--glass-border);
    background: var(--glass-fill);
    color: var(--color-white-muted);
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease,
      box-shadow 0.2s ease;
    cursor: pointer;
  }

  .role-option input:checked + .role-chip {
    background: rgba(255, 232, 140, 0.16);
    border-color: var(--color-gold-info);
    color: var(--color-white-contrast);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }

  .role-option input:focus-visible + .role-chip {
    outline: 2px solid rgba(255, 232, 140, 0.65);
    outline-offset: 2px;
  }
</style>

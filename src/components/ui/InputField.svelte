<script>
  import { createEventDispatcher } from 'svelte';

  export let label = '';
  export let id = '';
  export let type = 'text';
  export let placeholder = '';
  export let hint = '';
  export let error = '';
  export let required = false;
  export let value = '';
  export let disabled = false;
  export let className = '';
  export let showRequiredIndicator = true;

  const dispatch = createEventDispatcher();

  function handleInput(event) {
    value = event.currentTarget.value;
    dispatch('input', event);
  }

  function handleBlur(event) {
    dispatch('blur', event);
  }
</script>

<label class={`form-field ${className}`}>
  {#if label}
    <span class="label">
      {label}
      {#if required && showRequiredIndicator}
        <span aria-hidden="true">*</span>
      {/if}
    </span>
  {/if}
  <input
    class="input-field"
    id={id}
    type={type}
    placeholder={placeholder}
    {required}
    value={value}
    {disabled}
    on:input={handleInput}
    on:blur={handleBlur}
    {...$$restProps}
  />
  {#if error}
    <small class="field-error">{error}</small>
  {:else if hint}
    <small class="field-hint">{hint}</small>
  {/if}
</label>

<style>
  :global(.field-hint) {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  :global(.field-error) {
    font-size: 0.85rem;
    color: #ffc9c9;
  }
</style>

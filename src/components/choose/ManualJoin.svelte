<script>
  import { createEventDispatcher } from 'svelte';
  import InputField from '../ui/InputField.svelte';
  import Button from '../ui/Button.svelte';

  export let heading = '';
  export let placeholder = '';
  export let hint = '';
  export let value = '';
  export let connectDisabled = false;
  export let pending = false;
  export let connectLabel = '';
  export let pendingLabel = '';

  const dispatch = createEventDispatcher();

  function handleInput(event) {
    const value = event?.detail?.target?.value ?? event?.target?.value ?? '';
    dispatch('input', value);
  }

  function handleSubmit() {
    if (connectDisabled || pending) return;
    dispatch('connect');
  }
</script>

<section class="method-block manual-block" aria-labelledby="manual-heading">
  <h3 id="manual-heading" class="section-heading">{heading}</h3>
  <InputField
    id="game-code"
    value={value}
    placeholder={placeholder}
    hint={hint}
    autocomplete="off"
    on:input={(event) => handleInput(event.detail)}
    aria-labelledby="manual-heading"
  />

  <div class="connect-row">
    <Button
      variant="primary"
      type="button"
      disabled={connectDisabled || pending}
      on:click={handleSubmit}
    >
      {pending ? pendingLabel : connectLabel}
    </Button>
  </div>
</section>

<style>
  .method-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .section-heading {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-white-contrast);
  }

  .manual-block :global(.form-field) {
    width: 100%;
  }

.connect-row {
  display: flex;
  flex-direction: column;
}

.connect-row :global(.btn) {
  width: 100%;
}
</style>

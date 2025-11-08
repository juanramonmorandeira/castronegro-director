<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  export let open = false;
  export let categories = [];
  export let selections = {};
  export let limits = {};
  export let override = false;

  const dispatch = createEventDispatcher();

  let draftOverride = override;
  let draftSelections = { ...selections };

  $: if (open) {
    draftOverride = override;
    draftSelections = { ...selections };
  }

  function handleInput(role, value) {
    const numeric = Math.max(0, Number(value) || 0);
    const limit = draftOverride ? null : limits?.[role];
    draftSelections = {
      ...draftSelections,
      [role]: limit == null ? numeric : Math.min(numeric, limit)
    };
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    dispatch('save', { selections: { ...draftSelections }, override: draftOverride });
  }
</script>

{#if open}
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="selection-title">
    <div class="config-modal xl">
      <header class="modal-header">
        <h3 id="selection-title">{$t('configure.selection_title')}</h3>
        <button class="icon-btn" type="button" on:click={close} aria-label={$t('common.actions.cancel')}>
          ×
        </button>
      </header>

      <div class="override-banner">
        <label>
          <input type="checkbox" bind:checked={draftOverride} />
          <span>{$t('configure.role_override_label')}</span>
        </label>
        <p>{$t('configure.selection_hint')}</p>
      </div>

      <div class="categories">
        {#each categories as category}
          <section class="category">
            <header>
              <h4>{$t(`configure.balance_roles.${category}`)}</h4>
              {#if !draftOverride && limits?.[category] != null}
                <span class="badge">{$t('configure.role_limit', { count: limits[category] })}</span>
              {:else}
                <span class="badge ghost">{$t('configure.role_limit_unset')}</span>
              {/if}
            </header>
            <div class="category-body">
              <label>
                <span>{$t('configure.selection_placeholder')}</span>
                <input
                  type="number"
                  min="0"
                  max={draftOverride ? undefined : limits?.[category] ?? undefined}
                  class="input"
                  value={draftSelections[category] ?? 0}
                  on:input={(event) => handleInput(category, event.currentTarget.value)}
                />
              </label>
              <p class="hint">{$t('configure.selection_placeholder_hint')}</p>
            </div>
          </section>
        {/each}
      </div>

      <footer class="modal-actions">
        <button class="btn secondary" type="button" on:click={close}>{$t('common.actions.cancel')}</button>
        <button class="btn primary" type="button" on:click={save}>{$t('common.actions.save')}</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 14, 0.85);
    display: grid;
    place-items: center;
    z-index: 1150;
    padding: 1rem;
  }
  .config-modal {
    width: min(900px, 96vw);
    background: rgba(8, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55);
    color: #f5f8fb;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.6rem;
    cursor: pointer;
  }
  .override-banner {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.05);
  }
  .override-banner label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }
  .override-banner input {
    accent-color: rgba(255, 232, 140, 0.85);
  }
  .override-banner p {
    margin: 0;
    font-size: 0.9rem;
    color: rgba(245, 245, 245, 0.75);
  }
  .categories {
    display: grid;
    gap: 1rem;
  }
  .category {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
  }
  .category header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }
  .category header h4 {
    margin: 0;
    text-transform: capitalize;
  }
  .badge {
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    font-size: 0.75rem;
    background: rgba(255, 232, 140, 0.25);
    color: #fce6a4;
  }
  .badge.ghost {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }
  .category-body {
    margin-top: 0.75rem;
    display: grid;
    gap: 0.35rem;
  }
  .category-body label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .category-body .input {
    width: 120px;
    text-align: center;
  }
  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.65);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.8rem;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: rgba(74, 141, 74, 0.85);
    color: #f6fff6;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>

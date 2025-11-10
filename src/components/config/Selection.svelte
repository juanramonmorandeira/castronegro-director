<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  export let open = false;
  export let categories = [];
  export let roles = {};
  export let selected = {};
  export let limits = {};
  export let override = false;
  export let players = 0;
  export let duplicates = ['common', 'villager', 'werewolf'];
  export let mix = null;

  const dispatch = createEventDispatcher();

  const slugify = (value) => (value ?? '').toLowerCase().replace(/\s+/g, '_');

  const createEmptySelection = () =>
    (categories ?? []).reduce((acc, category) => {
      acc[category] = {};
      return acc;
    }, {});

  const cloneSelection = (source) => {
    const base = createEmptySelection();
    if (!source || typeof source !== 'object') return base;
    for (const category of categories) {
      const entries = source[category];
      if (!entries || typeof entries !== 'object') continue;
      base[category] = Object.entries(entries).reduce((acc, [role, count]) => {
        const numeric = Number(count) || 0;
        if (numeric > 0) acc[role] = numeric;
        return acc;
      }, {});
    }
    return base;
  };

  const categoryRoles = (category) => roles?.[category] ?? [];

  const categoryTotal = (category, data = draftSelections) =>
    Object.values(data?.[category] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);

  const ensureCategory = (category) => {
    if (!draftSelections[category]) {
      draftSelections = { ...draftSelections, [category]: {} };
    }
  };

  const playersLimit = () => Number(players) || 0;

  let draftOverride = override;
  let draftSelections = cloneSelection(selected);
  let duplicateSet = new Set(duplicates.map((entry) => slugify(entry)));
  let wasOpen = false;

  $: duplicateSet = new Set((duplicates ?? []).map((entry) => slugify(entry)));

  $: if (open && !wasOpen) {
    wasOpen = true;
    draftOverride = override;
    draftSelections = cloneSelection(selected);
  } else if (!open && wasOpen) {
    wasOpen = false;
  }

  function clampSelectionToLimits(selection) {
    let updated = false;
    const next = cloneSelection(selection);
    for (const category of categories) {
      const limit = categoryLimit(category);
      if (limit == null) continue;
      let total = categoryTotal(category, next);
      if (total <= limit) continue;
      const entries = Object.entries(next[category] ?? {});
      for (const [role, count] of entries) {
        if (total <= limit) break;
        const reduceBy = Math.min(count, total - limit);
        const remainder = count - reduceBy;
        if (remainder > 0) {
          next[category][role] = remainder;
        } else {
          delete next[category][role];
        }
        total -= reduceBy;
        updated = true;
      }
    }
    return updated ? next : selection;
  }

  $: if (!draftOverride) {
    draftSelections = clampSelectionToLimits(draftSelections);
  }

  const isDuplicable = (role) => duplicateSet.has(slugify(role));

  const categoryLimit = (category) => {
    if (draftOverride) {
      return playersLimit() || null;
    }
    const base = limits?.[category];
    return typeof base === 'number' ? base : null;
  };

  const clampCount = (category, role, desired) => {
    const limit = categoryLimit(category);
    if (limit == null) return Math.max(0, desired);
    const others = categoryTotal(category) - (draftSelections[category]?.[role] ?? 0);
    const available = Math.max(0, limit - others);
    return Math.max(0, Math.min(desired, available));
  };

  const canIncrement = (category) => {
    const limit = categoryLimit(category);
    if (limit == null) return true;
    return categoryTotal(category) < limit;
  };

  function setRoleCount(category, role, count) {
    ensureCategory(category);
    if (count <= 0) {
      if (draftSelections[category][role]) {
        const nextCategory = { ...draftSelections[category] };
        delete nextCategory[role];
        draftSelections = { ...draftSelections, [category]: nextCategory };
      }
      return;
    }
    draftSelections = {
      ...draftSelections,
      [category]: {
        ...draftSelections[category],
        [role]: count
      }
    };
  }

  function toggleRole(category, role) {
    const current = draftSelections[category]?.[role] ?? 0;
    if (current > 0) {
      setRoleCount(category, role, 0);
      return;
    }
    const final = clampCount(category, role, 1);
    if (final <= 0) return;
    setRoleCount(category, role, final);
  }

  function adjustRole(category, role, delta) {
    const current = draftSelections[category]?.[role] ?? 0;
    const desired = Math.max(0, current + delta);
    const finalCount = clampCount(category, role, desired);
    setRoleCount(category, role, finalCount);
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    dispatch('save', { selections: draftSelections, override: draftOverride });
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

      {#if mix}
        <section class="mix-summary">
          <div class="mix-header">
            <span class="section-label">{$t('configure.balance_label')}</span>
            <span class="mix-hint">
              {$t('configure.role_constraints.mix', { value: players || '—' })}
            </span>
          </div>
          <div class="mix-grid">
            {#each categories as category}
              <div class="mix-chip">
                <span class="mix-value">{mix?.[category] ?? 0}</span>
                <span class="mix-label">{$t(`configure.balance_roles.${category}`)}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <div class="categories">
        {#each categories as category}
          <section class="category">
            <header>
              <div>
                <h4>{$t(`configure.balance_roles.${category}`)}</h4>
                <p class="totals">
                  {#if categoryLimit(category) != null}
                    {$t('configure.selection_counts', { selected: categoryTotal(category), required: categoryLimit(category) })}
                  {:else}
                    {$t('configure.selection_counts_unbound', { selected: categoryTotal(category) })}
                  {/if}
                </p>
              </div>
            </header>
            <div class="role-cards">
              {#each categoryRoles(category) as role}
                {#if isDuplicable(role)}
                  <div class={`role-card duplicable ${draftSelections[category]?.[role] ? 'selected' : ''}`}>
                    <img src={`/roles/${category}/${slugify(role)}.png`} alt={role} />
                    <div class="card-info">
                      <span>{role}</span>
                      <div class="counter">
                        <button type="button" on:click={() => adjustRole(category, role, -1)} disabled={(draftSelections[category]?.[role] ?? 0) === 0}>
                          −
                        </button>
                        <span>{draftSelections[category]?.[role] ?? 0}</span>
                        <button
                          type="button"
                          on:click={() => adjustRole(category, role, 1)}
                          disabled={!draftOverride && !canIncrement(category)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                {:else}
                  <button
                    type="button"
                    class={`role-card ${draftSelections[category]?.[role] ? 'selected' : ''}`}
                    on:click={() => toggleRole(category, role)}
                    disabled={!draftSelections[category]?.[role] && !canIncrement(category)}
                  >
                    <img src={`/roles/${category}/${slugify(role)}.png`} alt={role} />
                    <span class="card-info">{role}</span>
                  </button>
                {/if}
              {/each}
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
    width: min(1100px, 96vw);
    max-height: 90vh;
    overflow-y: auto;
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
  .icon-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.6rem;
    cursor: pointer;
  }
  .section-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(248, 248, 250, 0.65);
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
  .mix-summary {
    display: grid;
    gap: 0.5rem;
  }
  .mix-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .mix-hint {
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.6);
  }
  .mix-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .mix-chip {
    background: rgba(8, 14, 22, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.9rem;
    padding: 0.6rem 0.9rem;
    display: grid;
    justify-items: center;
    gap: 0.2rem;
  }
  .mix-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f7f3d7;
  }
  .mix-label {
    font-size: 0.85rem;
    text-transform: capitalize;
    color: rgba(245, 245, 245, 0.78);
  }
  .categories {
    display: grid;
    gap: 1.25rem;
  }
  .category {
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
    display: grid;
    gap: 0.75rem;
  }
  .category header h4 {
    margin: 0;
    text-transform: capitalize;
  }
  .category .totals {
    margin: 0.2rem 0 0;
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.65);
  }
  .role-cards {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
  .role-card {
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.03);
    padding: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #f5f8fb;
  }
  button.role-card {
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.03);
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  button.role-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .role-card img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #0c1624;
    padding: 0.25rem;
  }
  .role-card.duplicable {
    justify-content: space-between;
  }
  .role-card .card-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .role-card.selected {
    border-color: rgba(247, 215, 116, 0.8);
    box-shadow: 0 0 15px rgba(247, 215, 116, 0.25);
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .counter button {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: transparent;
    color: #f5f8fb;
    cursor: pointer;
  }
  .counter button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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

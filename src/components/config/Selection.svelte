<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';

  export let open = false;
  export let categories = [];
  export let roles = {};
  export let selected = {};
  export let limits = {};
  export let resourceLimits = {};
  export let override = false;
  export let players = 0;
  export let totalLimit = 0;
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

  const totalSelected = (data = draftSelections) =>
    (categories ?? []).reduce((sum, category) => sum + categoryTotal(category, data), 0);

  const ensureCategory = (category) => {
    if (!draftSelections[category]) {
      draftSelections = { ...draftSelections, [category]: {} };
    }
  };

  const playersLimit = () => Number(totalLimit || players) || 0;
  const categoryResourceLimit = (category) => {
    const value = resourceLimits?.[category];
    return typeof value === 'number' ? value : null;
  };

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
    const totalLimitValue = playersLimit();
    if (totalLimitValue && totalSelected(next) > totalLimitValue) {
      let overflow = totalSelected(next) - totalLimitValue;
      for (const category of [...categories].reverse()) {
        if (overflow <= 0) break;
        const entries = Object.entries(next[category] ?? {});
        for (const [role, count] of entries) {
          if (overflow <= 0) break;
          const reduceBy = Math.min(count, overflow);
          const remainder = count - reduceBy;
          if (remainder > 0) {
            next[category][role] = remainder;
          } else {
            delete next[category][role];
          }
          overflow -= reduceBy;
          updated = true;
        }
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
      return categoryResourceLimit(category);
    }
    const base = limits?.[category];
    return typeof base === 'number' ? base : null;
  };

  const clampCount = (category, role, desired) => {
    const limit = categoryLimit(category);
    const currentValue = draftSelections[category]?.[role] ?? 0;
    let candidate = Math.max(0, desired);
    if (limit != null) {
      const others = categoryTotal(category) - currentValue;
      const available = Math.max(0, limit - others);
      candidate = Math.min(candidate, available);
    }
    const totalCap = playersLimit();
    if (totalCap) {
      const othersTotal = totalSelected() - currentValue;
      const available = Math.max(0, totalCap - othersTotal);
      candidate = Math.min(candidate, available);
    }
    return candidate;
  };

  const canIncrement = (category, increment = 1) => {
    const totalCap = playersLimit();
    if (totalCap && totalSelected() + increment > totalCap) {
      return false;
    }
    const limit = categoryLimit(category);
    if (limit == null) return true;
    return categoryTotal(category) + increment <= limit;
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
    if (!canIncrement(category)) return;
    const final = clampCount(category, role, 1);
    if (final <= 0) return;
    setRoleCount(category, role, final);
  }

  function adjustRole(category, role, delta) {
    const current = draftSelections[category]?.[role] ?? 0;
    const desired = Math.max(0, current + delta);
    if (delta > 0 && !canIncrement(category, delta)) {
      return;
    }
    const finalCount = clampCount(category, role, desired);
    setRoleCount(category, role, finalCount);
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    dispatch('save', { selections: draftSelections, override: draftOverride });
  }
  const selectionDescription = $t('configure.selection_hint');
</script>

<Modal
  open={open}
  title={$t('configure.selection_title')}
  description={selectionDescription}
  size="xl"
  closeOnBackdrop={false}
  on:close={close}
>
  <div class="selection-body">
      <div class="override-banner">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={draftOverride} />
          <span>{$t('configure.role_override_label')}</span>
        </label>
        <p class="override-hint">{$t('configure.selection_hint')}</p>
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
                          disabled={!canIncrement(category)}
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

  </div>

  <svelte:fragment slot="footer">
    <button class="btn secondary" type="button" on:click={close}>{$t('common.actions.cancel')}</button>
    <button class="btn primary" type="button" on:click={save}>{$t('common.actions.save')}</button>
  </svelte:fragment>
</Modal>

<style>
  .selection-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
.section-label {
  font-size: 0.95rem;
  text-transform: none;
  letter-spacing: 0.04em;
  color: var(--color-white-contrast);
}
  .override-banner {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1rem 1.25rem;
    border-radius: 20px;
    border: 1px solid var(--glass-border);
    background: rgba(8, 12, 20, 0.85);
  }
  .override-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }
  .override-banner input {
    accent-color: rgba(255, 232, 140, 0.85);
    width: 1rem;
    height: 1rem;
  }
  .override-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-white-muted);
  }
  .mix-summary {
    display: grid;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 24px;
    border: 1px solid var(--glass-hover);
    background: rgba(6, 10, 18, 0.85);
  }
  .mix-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
  .mix-hint {
    font-size: 0.85rem;
    color: var(--color-white-muted);
  }
  .mix-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }
  .mix-chip {
    background: rgba(10, 16, 26, 0.9);
    border: 1px solid var(--glass-hover);
    border-radius: 18px;
    padding: 0.85rem 0.9rem;
    display: grid;
    justify-items: center;
    gap: 0.3rem;
    min-height: 90px;
  }
  .mix-value {
    font-size: 1.65rem;
    font-weight: 700;
    color: var(--color-gold-info);
  }
  .mix-label {
    font-size: 0.85rem;
    text-transform: capitalize;
    color: var(--color-white-muted);
  }
  .categories {
    display: grid;
    gap: 1.25rem;
  }
  .category {
    border: 1px solid var(--glass-hover);
    border-radius: 20px;
    padding: 1.2rem;
    background: rgba(6, 12, 20, 0.75);
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
    color: var(--color-white-muted);
  }
  .role-cards {
    display: grid;
    gap: 0.85rem;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  }
  .role-card {
    border: 1px solid var(--glass-border);
    border-radius: 18px;
    background: rgba(10, 14, 20, 0.7);
    padding: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--color-white-contrast);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  button.role-card {
    border: 1px solid var(--glass-border);
    background: rgba(10, 14, 20, 0.7);
    width: 100%;
    text-align: left;
    cursor: pointer;
  }
  button.role-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .role-card img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--surface-chip);
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
    border-color: rgba(247, 215, 116, 0.9);
    box-shadow: 0 0 20px rgba(247, 215, 116, 0.25);
    transform: translateY(-2px);
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(4, 7, 12, 0.85);
    border-radius: 999px;
    padding: 0.3rem 0.5rem;
  }
  .counter button {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-white-contrast);
    cursor: pointer;
  }
  .counter button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .counter span {
    font-weight: 600;
    min-width: 1.5rem;
    text-align: center;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: #1f6b2b;
    color: var(--color-green-text);
  }
  .btn.secondary {
    background: var(--glass-hover);
    color: var(--color-white-contrast);
    border: 1px solid var(--glass-border-strong);
  }
</style>

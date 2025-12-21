<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

  export let open = false;
  export let categories = [];
  export let roles = {};
  export let selected = {};
  export let limits = {};
  export let resourceLimits = {};
  export let override = false;
  export let players = 0;
  export let totalLimit = 0;
  export let duplicates = ['trusted', 'villager', 'werewolf', 'brothers', 'sisters'];
  export let mix = null;
  export let actorRoles = [];
  export let thiefRoles = [];

  const dispatch = createEventDispatcher();

  const slugify = (value) => (value ?? '').toLowerCase().replace(/\s+/g, '_');
  const createEmptySelection = () =>
    (categories ?? []).reduce((acc, category) => ({ ...acc, [category]: {} }), {});

  const cloneSelection = (source) => {
    const base = createEmptySelection();
    if (!source || typeof source !== 'object') return base;
    categories.forEach((category) => {
      const entries = source[category];
      if (!entries || typeof entries !== 'object') return;
      base[category] = Object.entries(entries).reduce((acc, [role, count]) => {
        const numeric = Number(count) || 0;
        if (numeric > 0) acc[role] = numeric;
        return acc;
      }, {});
    });
    return base;
  };

  const categoryRoles = (category) => roles?.[category] ?? [];
  const categoryTotal = (category, data = draftSelections) =>
    Object.values(data?.[category] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const totalSelected = (data = draftSelections) =>
    (categories ?? []).reduce((sum, category) => sum + categoryTotal(category, data), 0);

  const playersLimit = () => {
    const candidate = Number(totalLimit || players);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  };
  const categoryResourceLimit = (category) => {
    const value = resourceLimits?.[category];
    return typeof value === 'number' ? value : null;
  };
  const playersByMix = () => Number(mix?.players ?? players) || 0;

  const allowedCountsForRole = (role) => {
    const slug = slugify(role);
    const playerCount = playersByMix();
    if (slug === 'brothers') {
      if (playerCount >= 13) return [3, 6, 9];
      if (playerCount >= 10) return [3, 6];
      if (playerCount >= 5) return [3];
      return [3];
    }
    if (slug === 'sisters') {
      if (playerCount >= 13) return [2, 4, 6, 8];
      if (playerCount >= 10) return [2, 4, 6];
      if (playerCount >= 5) return [2, 4];
      return [2];
    }
    return null;
  };

  const alignToAllowedCount = (role, candidate) => {
    const allowed = allowedCountsForRole(role);
    if (!allowed || !allowed.length) return candidate;
    const pool = [0, ...allowed].sort((a, b) => a - b);
    const capped = pool.filter((value) => value <= candidate);
    if (!capped.length) return 0;
    return capped[capped.length - 1];
  };

  const nextAllowedCount = (role, current, delta) => {
    const allowed = allowedCountsForRole(role);
    if (!allowed || !allowed.length) {
      return Math.max(0, current + delta);
    }
    const pool = [0, ...allowed].sort((a, b) => a - b);
    let index = pool.indexOf(current);
    if (index === -1) {
      index = pool.findIndex((value) => value > current);
      if (index === -1) index = pool.length - 1;
      else if (index > 0) index -= 1;
    }
    const nextIndex = Math.min(pool.length - 1, Math.max(0, index + (delta > 0 ? 1 : -1)));
    return pool[nextIndex];
  };

  let draftOverride = override;
  let draftSelections = cloneSelection(selected);
  let wasOpen = false;
  let actorChoices = ['', '', ''];
  let thiefChoices = ['', ''];
  let actorActive = false;
  let pickerOpen = false;
  let pickerType = null; // 'actor' | 'thief'
  let pickerIndex = 0;

  const duplicateSet = new Set((duplicates ?? []).map((entry) => slugify(entry)));
  const actorSlots = [0, 1, 2];
  const thiefSlots = [0, 1];

  $: if (open && !wasOpen) {
    wasOpen = true;
    draftOverride = override;
    draftSelections = cloneSelection(selected);
    actorChoices = Array.isArray(actorRoles) ? [...actorRoles].slice(0, 3) : ['', '', ''];
    while (actorChoices.length < 3) actorChoices.push('');
    thiefChoices = Array.isArray(thiefRoles) ? [...thiefRoles].slice(0, 2) : ['', ''];
    while (thiefChoices.length < 2) thiefChoices.push('');
  } else if (!open && wasOpen) {
    wasOpen = false;
  }

  const canonicalSlug = (value) => {
    const base = slugify(value);
    return base.startsWith('the_') ? base.slice(4) : base;
  };

  const hasRoleSelected = (slug) => {
    const target = canonicalSlug(slug);
    return Object.values(draftSelections ?? {}).some((category) =>
      Object.entries(category ?? {}).some(
        ([role, count]) => canonicalSlug(role) === target && Number(count) > 0
      )
    );
  };

  const categoryLimit = (category) => {
    if (draftOverride) return categoryResourceLimit(category);
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
    if (totalCap != null) {
      const othersTotal = totalSelected() - currentValue;
      const available = Math.max(0, totalCap - othersTotal);
      candidate = Math.min(candidate, available);
    }
    return alignToAllowedCount(role, candidate);
  };

  const canIncrement = (category, role = null, increment = 1) => {
    const current = role ? draftSelections[category]?.[role] ?? 0 : categoryTotal(category);
    const desired = role ? nextAllowedCount(role, current, increment) : current + increment;
    if (desired <= current) return false;
    const final = clampCount(category, role, desired);
    return final > current;
  };

  function setRoleCount(category, role, count) {
    if (!draftSelections[category]) draftSelections = { ...draftSelections, [category]: {} };
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
    const base = allowedCountsForRole(role)?.[0] ?? 1;
    const final = clampCount(category, role, base);
    if (final <= 0) return;
    setRoleCount(category, role, final);
  }

  function adjustRole(category, role, delta) {
    const current = draftSelections[category]?.[role] ?? 0;
    const desired = nextAllowedCount(role, current, delta);
    if (delta > 0 && !canIncrement(category, role, delta)) return;
    const finalCount = clampCount(category, role, desired);
    setRoleCount(category, role, finalCount);
  }

$: hasActorRole = hasRoleSelected('actor');
$: actorActive =
  hasActorRole ||
  actorChoices.some(Boolean) ||
  Boolean(draftSelections?.Ambiguous?.actor ?? draftSelections?.ambiguous?.actor);
const thiefActive = hasRoleSelected('thief') || thiefChoices.some(Boolean);
$: console.warn('[selection] actor state', {
  actorActive,
  hasActorRole,
  actorChoices,
  ambiguous: draftSelections?.ambiguous,
  draftKeys: Object.keys(draftSelections || {}),
  ambiguousKeys: Object.keys(draftSelections?.ambiguous || draftSelections?.Ambiguous || {})
});

$: if (!hasRoleSelected('actor') && actorChoices.some(Boolean)) {
  actorChoices = ['', '', ''];
}
$: if (!hasRoleSelected('thief') && thiefChoices.some(Boolean)) {
  thiefChoices = ['', ''];
}

$: console.debug('[selection] actorActive', actorActive, {
  hasActorRole,
  actorChoices,
  ambiguous: draftSelections?.ambiguous
});

  $: actorSelectedSlugs = new Set(actorChoices.filter(Boolean).map((role) => slugify(role)));
  $: thiefSelectedSlugs = new Set(thiefChoices.filter(Boolean).map((role) => slugify(role)));

  $: categoryStats = (categories ?? []).reduce((acc, category) => {
    acc[category] = {
      selected: categoryTotal(category, draftSelections),
      limit: categoryLimit(category)
    };
    return acc;
  }, {});

  const villagerRoles = () => categoryRoles('villagers');

  $: availableVillagers = villagerRoles().filter((role) => {
    const slug = slugify(role);
    const selectedInVillagers = (draftSelections?.villagers?.[role] ?? 0) > 0;
    return !selectedInVillagers && !actorSelectedSlugs.has(slug) && !thiefSelectedSlugs.has(slug);
  });

  const isActorReserved = (role) => {
    const slug = slugify(role);
    return actorSelectedSlugs.has(slug) && !duplicateSet.has(slug);
  };

  const isBlockedByActor = (role) => isActorReserved(role);

  const allRoleCategory = (() => {
    const map = new Map();
    Object.entries(roles ?? {}).forEach(([category, list]) => {
      (list ?? []).forEach((role) => {
        map.set(slugify(role), category);
      });
    });
    return map;
  })();

  const availableThiefRoles = () => {
    const pool = [];
    Object.entries(roles ?? {}).forEach(([category, list]) => {
      (list ?? []).forEach((role) => {
        const slug = slugify(role);
        const alreadySelected = (draftSelections?.[category]?.[role] ?? 0) > 0;
        if (alreadySelected) return;
        if (thiefSelectedSlugs.has(slug)) return;
        pool.push(role);
      });
    });
    return pool;
  };

  function openPicker(type, index) {
    pickerType = type;
    pickerIndex = index;
    pickerOpen = true;
  }

  function handleActorPick(role) {
    if (!actorActive) return;
    if (!role) return;
    const slug = slugify(role);
    if (actorSelectedSlugs.has(slug)) return;
    if ((draftSelections?.villagers?.[role] ?? 0) > 0) return;
    const next = [...actorChoices];
    next[pickerIndex] = role;
    actorChoices = next.slice(0, 3);
    pickerOpen = false;
  }

  function handleThiefPick(role) {
    if (!thiefActive) return;
    if (!role) return;
    const slug = slugify(role);
    if (thiefSelectedSlugs.has(slug)) return;
    if (availableThiefRoles().every((entry) => slugify(entry) !== slug)) return;
    const next = [...thiefChoices];
    next[pickerIndex] = role;
    thiefChoices = next.slice(0, 2);
    pickerOpen = false;
  }

  function autoFillThief() {
    const pool = availableThiefRoles();
    if (!pool.length) return;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    thiefChoices = shuffled.slice(0, 2);
  }

  $: if (thiefActive && !draftOverride && thiefChoices.every((slot) => !slot)) {
    autoFillThief();
  }

  function clearActorSlot(index) {
    const next = [...actorChoices];
    next[index] = '';
    actorChoices = next;
  }

  function clearThiefSlot(index) {
    const next = [...thiefChoices];
    next[index] = '';
    thiefChoices = next;
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    const actorPayload = actorActive ? actorChoices.filter(Boolean) : [];
    const thiefPayload = thiefActive ? thiefChoices.filter(Boolean) : [];
    dispatch('save', {
      selections: draftSelections,
      override: draftOverride,
      actorRoles: actorPayload,
      thiefRoles: thiefPayload
    });
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
        {$t('configure.role_override_label')}
      </label>
      <p class="override-hint">{$t('configure.role_override_active')}</p>
    </div>

    {#if mix}
      <div class="mix-summary">
        <div class="mix-header">
          <h3>{$t('configure.balance_label')}</h3>
          <p class="mix-hint">{$t('configure.selection_hint')}</p>
        </div>
        <div class="mix-grid">
          {#each Object.entries(mix || {}) as [key, value]}
            {#if typeof value === 'number'}
              <div class="mix-chip">
                <span class="mix-value">{value}</span>
                <span class="mix-label">{key}</span>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <div class="categories">
      {#each categories as category}
        <section class="category">
          <header class="category-header">
            <div>
              <h4>{category}</h4>
              <p class="totals">
                {#if categoryStats?.[category]?.limit != null}
                  {categoryStats?.[category]?.selected} / {categoryStats?.[category]?.limit} selected
                {:else}
                  {categoryStats?.[category]?.selected} selected
                {/if}
              </p>
            </div>
          </header>
          <div class="role-cards">
            {#each categoryRoles(category) as role}
              {#if duplicateSet.has(slugify(role))}
                <div class={`role-card duplicable ${draftSelections[category]?.[role] ? 'selected' : ''}`}>
                  <img src={`/roles/${category}/${slugify(role)}.png`} alt={role} />
                  <div class="card-info">
                    <span>{role}</span>
                    <div class="counter">
                      <button
                        type="button"
                        on:click={() => adjustRole(category, role, -1)}
                        disabled={(draftSelections[category]?.[role] ?? 0) === 0}
                      >
                        −
                      </button>
                      <span>{draftSelections[category]?.[role] ?? 0}</span>
                      <button type="button" on:click={() => adjustRole(category, role, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <button
                  type="button"
                  class={`role-card ${draftSelections[category]?.[role] ? 'selected' : ''} ${isBlockedByActor(role) ? 'blocked-by-actor' : ''}`}
                  on:click={() => toggleRole(category, role)}
                  disabled={isBlockedByActor(role)}
                >
                  <img src={`/roles/${category}/${slugify(role)}.png`} alt={role} />
                  <span class="card-info">{role}</span>
                </button>
              {/if}
            {/each}
          </div>
        </section>

      {/each}

      {#if actorActive}
        <section class="category actor-category">
          <header class="category-header">
            <div>
              <h4>The Actor's Characters</h4>
              <p class="totals">Choose up to 3 villagers.</p>
            </div>
          </header>
          <div class="actor-slots">
            {#each actorSlots as index}
              {#if actorChoices[index]}
                <div class="actor-slot filled">
                  <img src={`/roles/villagers/${slugify(actorChoices[index])}.png`} alt={actorChoices[index]} />
                  <div class="actor-slot__info">
                    <span>{actorChoices[index]}</span>
                    <button type="button" class="actor-clear" on:click={() => clearActorSlot(index)}>×</button>
                  </div>
                </div>
              {:else}
                <div class="actor-slot empty">
                  <button type="button" class="actor-add" on:click={() => openPicker('actor', index)}>
                    <span class="plus">+</span>
                    <span class="actor-add__label">Select villager</span>
                  </button>
                </div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}

      {#if thiefActive}
        <section class="category actor-category">
          <header class="category-header">
            <div>
              <h4>The Thief's Characters</h4>
              <p class="totals">Two roles (any category). Override to pick manually.</p>
            </div>
          </header>
          <div class="actor-slots">
            {#each thiefSlots as index}
              {#if thiefChoices[index]}
                <div class="actor-slot filled">
                  <img
                    src={`/roles/${allRoleCategory.get(slugify(thiefChoices[index])) ?? 'villagers'}/${slugify(thiefChoices[index])}.png`}
                    alt={thiefChoices[index]}
                  />
                  <div class="actor-slot__info">
                    <span>{thiefChoices[index]}</span>
                    {#if draftOverride}
                      <button type="button" class="actor-clear" on:click={() => clearThiefSlot(index)}>×</button>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="actor-slot empty">
                  <button
                    type="button"
                    class="actor-add"
                    on:click={() => openPicker('thief', index)}
                    disabled={!draftOverride}
                  >
                    <span class="plus">+</span>
                    <span class="actor-add__label">{draftOverride ? 'Select role' : 'Auto-selected'}</span>
                  </button>
                </div>
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </div>

  <svelte:fragment slot="footer">
    <Button variant="primary" type="button" on:click={save}>{$t('common.actions.save')}</Button>
  </svelte:fragment>

  {#if pickerOpen}
    <Modal
      open={pickerOpen}
      title={pickerType === 'actor' ? 'Select villager for Actor' : 'Select role for Thief'}
      size="lg"
      on:close={() => (pickerOpen = false)}
    >
      <div class="picker-grid">
        {#if pickerType === 'actor'}
          {#each availableVillagers as role}
            <button type="button" class="picker-card" on:click={() => handleActorPick(role)}>
              <img src={`/roles/villagers/${slugify(role)}.png`} alt={role} />
              <span>{role}</span>
            </button>
          {/each}
        {:else}
          {#each availableThiefRoles() as role}
            <button
              type="button"
              class="picker-card"
              disabled={!draftOverride}
              on:click={() => {
                if (draftOverride) handleThiefPick(role);
              }}
            >
              <img
                src={`/roles/${allRoleCategory.get(slugify(role)) ?? 'villagers'}/${slugify(role)}.png`}
                alt={role}
              />
              <span>{role}</span>
            </button>
          {/each}
        {/if}
      </div>
    </Modal>
  {/if}
</Modal>

<style>
  .selection-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
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

  .category-header h4 {
    margin: 0;
    text-transform: capitalize;
  }

  .totals {
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
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .role-card.selected {
    border-color: rgba(247, 215, 116, 0.9);
    box-shadow: 0 0 20px rgba(247, 215, 116, 0.25);
    transform: translateY(-2px);
  }

  .role-card img {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--surface-chip);
    padding: 0.25rem;
  }

  .role-card .card-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .role-card.duplicable {
    justify-content: space-between;
  }

  .role-card.blocked-by-actor {
    filter: grayscale(1);
    opacity: 0.55;
    cursor: not-allowed;
    position: relative;
  }

  .role-card.blocked-by-actor:hover {
    transform: none;
    box-shadow: none;
    border-color: var(--glass-border);
  }

  /* badge removed per request */

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

  .actor-category {
    border: 1px dashed var(--glass-hover);
    background: rgba(10, 14, 20, 0.6);
  }

  .actor-slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
  }

  .actor-slot {
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    padding: 0.65rem;
    background: rgba(12, 16, 24, 0.75);
    display: grid;
    gap: 0.45rem;
    min-height: 110px;
    align-content: center;
    justify-items: center;
  }

  .actor-slot img {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--surface-chip);
    padding: 0.25rem;
  }

  .actor-slot__info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .actor-clear {
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-white-contrast);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
  }

  .actor-slot.empty {
    place-items: center;
  }

  .actor-add {
    display: grid;
    place-items: center;
    gap: 0.4rem;
    border: 1px dashed var(--glass-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-white-contrast);
    border-radius: 12px;
    padding: 0.75rem;
    cursor: pointer;
    width: 100%;
  }

  .actor-add:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .actor-add .plus {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--glass-border);
    display: grid;
    place-items: center;
    font-size: 1.2rem;
  }

  .actor-add__label {
    font-size: 0.9rem;
  }

  .picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 0.85rem;
  }

  .picker-card {
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    background: rgba(10, 14, 20, 0.75);
    padding: 0.85rem;
    display: grid;
    gap: 0.35rem;
    justify-items: center;
    color: var(--color-white-contrast);
    cursor: pointer;
  }

  .picker-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .picker-card img {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--surface-chip);
    padding: 0.25rem;
  }
</style>

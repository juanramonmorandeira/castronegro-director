<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';
  import roleDefinitions from '../../../reference-data/datasets/roles.json' with { type: 'json' };

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
  export let exclusionList = [];
  export let includeSheriff = true;
  export let includeTownCrier = true;
  export let tweakRoleMix = false;
  export let roleMixOverride = null;

  const dispatch = createEventDispatcher();

  const slugify = (value) => (value ?? '').toLowerCase().replace(/\s+/g, '_');
  const createEmptySelection = () =>
    (categories ?? []).reduce((acc, category) => ({ ...acc, [category]: {} }), {});

  const MIX_KEYS = ['villagers', 'ambiguous', 'werewolves', 'loners'];
  const cloneMix = (source) => {
    const base = {};
    MIX_KEYS.forEach((key) => {
      const value = source?.[key];
      base[key] = Number.isFinite(Number(value)) ? Number(value) : 0;
    });
    return base;
  };

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
  let draftExclusionList = [];
  let actorActive = false;
  let pickerOpen = false;
  let pickerType = null; // 'actor' | 'thief'
  let pickerIndex = 0;
  let draftIncludeSheriff = true;
  let showSheriffHint = false;
  let draftIncludeTownCrier = true;
  let showTownCrierHint = false;
  let showOverrideHint = false;
  let draftTweakRoleMix = false;
  let showTweakHint = false;
  let draftMix = null;
  let showExclusionEditor = true;
  let showExclusionHint = false;

  const duplicateSet = new Set((duplicates ?? []).map((entry) => slugify(entry)));
  const hasRoleInSelection = (selection = {}, slug = '') => {
    const target = canonicalSlug(slug);
    return Object.values(selection ?? {}).some((category) =>
      Object.entries(category ?? {}).some(
        ([role, count]) => canonicalSlug(role) === target && Number(count) > 0
      )
    );
  };
  const actorSlots = [0, 1, 2];
  const thiefSlots = [0, 1];
  let exclusionSlugs = [];
  let exclusionSetMemo = new Set();
  $: exclusionSlugs = (draftExclusionList ?? []).map((entry) => slugify(entry)).filter(Boolean);
  $: exclusionSetMemo = new Set(exclusionSlugs);
  const isExcluded = (role) => exclusionSetMemo.has(slugify(role));

  const toggleExclusion = (role, checked) => {
    const current = new Set(draftExclusionList ?? []);
    const slug = slugify(role);
    if (checked) current.add(slug);
    else current.delete(slug);
    draftExclusionList = Array.from(current);
  };

  const toggleGroupExclusion = (roles = [], checked) => {
    const current = new Set(draftExclusionList ?? []);
    roles.forEach((role) => {
      const slug = slugify(role);
      if (checked) current.add(slug);
      else current.delete(slug);
    });
    draftExclusionList = Array.from(current);
  };

  $: if (open && !wasOpen) {
    wasOpen = true;
    draftOverride = override;
    draftSelections = cloneSelection(selected);
    draftIncludeSheriff = includeSheriff !== false;
    draftIncludeTownCrier = includeTownCrier !== false;
    showSheriffHint = false;
    showOverrideHint = false;
    draftTweakRoleMix = !!tweakRoleMix;
    showTweakHint = false;
    draftMix = cloneMix(roleMixOverride ?? mix ?? {});
    actorChoices = Array.isArray(actorRoles) ? [...actorRoles].slice(0, 3) : ['', '', ''];
    while (actorChoices.length < 3) actorChoices.push('');
    thiefChoices = Array.isArray(thiefRoles) ? [...thiefRoles].slice(0, 2) : ['', ''];
    while (thiefChoices.length < 2) thiefChoices.push('');
    draftExclusionList = Array.isArray(exclusionList)
      ? exclusionList.map((entry) => slugify(entry)).filter(Boolean)
      : [];
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
$: thiefActive =
  hasRoleSelected('thief') ||
  hasRoleInSelection(selected, 'thief') ||
  (draftSelections?.ambiguous?.thief ?? 0) > 0 ||
  thiefChoices.some(Boolean);

$: if (!hasRoleSelected('actor') && actorChoices.some(Boolean)) {
  actorChoices = ['', '', ''];
}

// Debug removed to avoid noisy console

  $: actorSelectedSlugs = new Set(actorChoices.filter(Boolean).map((role) => slugify(role)));
  $: thiefSelectedSlugs = new Set(thiefChoices.filter(Boolean).map((role) => slugify(role)));

  $: categoryStats = (categories ?? []).reduce((acc, category) => {
    acc[category] = {
      selected: categoryTotal(category, draftSelections),
      limit: categoryLimit(category)
    };
    return acc;
  }, {});

$: mixTotal = MIX_KEYS.reduce((sum, key) => sum + (Number(draftMix?.[key]) || 0), 0);
$: if (draftTweakRoleMix && (!draftMix || MIX_KEYS.every((key) => draftMix?.[key] == null))) {
    draftMix = cloneMix(roleMixOverride ?? mix ?? {});
  }

  const mixLimit = () => {
    const cap = playersLimit();
    return cap ?? null;
  };

  const setMixValue = (key, value) => {
    const cap = mixLimit();
    const current = Number(draftMix?.[key]) || 0;
    let desired = Math.max(0, Math.floor(Number(value) || 0));
    if (cap != null) {
      const others = mixTotal - current;
      const maxAllowed = Math.max(0, cap - others);
      desired = Math.min(desired, maxAllowed);
    }
    draftMix = { ...(draftMix ?? {}), [key]: desired };
  };

  const adjustMix = (key, delta) => {
    const current = Number(draftMix?.[key]) || 0;
    setMixValue(key, current + delta);
  };
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
    Object.entries(roleDefinitions ?? {}).forEach(([role, data]) => {
      if (!role || typeof data !== 'object') return;
      if (role === 'defaults') return;
      const category = data?.category ?? 'villagers';
      map.set(slugify(role), category);
    });
    return map;
  })();

$: allRolesList = (() => {
  return Object.keys(roleDefinitions ?? {}).filter((role) => role && role !== 'defaults');
})();

$: rolesByCategory = (() => {
  const bucket = { villagers: [], ambiguous: [], loners: [], werewolves: [] };
  Object.entries(roleDefinitions ?? {}).forEach(([role, data]) => {
    if (!role || role === 'defaults') return;
    const cat = data?.category ?? 'villagers';
    if (bucket[cat]) bucket[cat].push(role);
  });
  return bucket;
})();

$: exclusionCandidates = [...allRolesList].sort((a, b) => a.localeCompare(b));

  const multiPlayerRoles = new Set(['brothers', 'sisters']);
  const nonDuplicable = (role) => !['trusted', 'villager', 'werewolf'].includes(slugify(role));

  const thiefAvailablePool = (respectExclusions = true) => {
    const pool = [];
    allRolesList.forEach((role) => {
      const slug = slugify(role);
      if (multiPlayerRoles.has(slug)) return;
      const category = allRoleCategory.get(slug) ?? 'villagers';
      const alreadySelected =
        Number(draftSelections?.[category]?.[role] ?? 0) > 0 ||
        Object.values(draftSelections ?? {}).some((cat) => Number(cat?.[role] ?? 0) > 0);
      if (alreadySelected && nonDuplicable(role)) return;
      if (respectExclusions && isExcluded(role)) return; // auto selección respeta exclusiones
      pool.push(role);
    });
    return pool;
  };

  // Alias para reutilizar la lista de disponibles del ladrón
  const availableThiefRoles = (respectExclusions = true) => thiefAvailablePool(respectExclusions);

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
    if (thiefAvailablePool(false).every((entry) => slugify(entry) !== slug)) return;
    const next = [...thiefChoices];
    next[pickerIndex] = role;
    thiefChoices = next.slice(0, 2);
    pickerOpen = false;
  }

  function autoFillThief() {
    const pool = thiefAvailablePool(true);
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
    // Auto-relleno de slots del Thief si quedan huecos
    const thiefPool = thiefAvailablePool();
    const filledThiefChoices = [...thiefChoices];
    if (thiefActive) {
      for (let i = 0; i < filledThiefChoices.length; i += 1) {
        if (filledThiefChoices[i]) continue;
        const chosen = thiefPool.find(
          (role) => !filledThiefChoices.includes(role)
        );
        if (chosen) filledThiefChoices[i] = chosen;
      }
    }

    const actorPayload = actorActive ? actorChoices.filter(Boolean) : [];
    const thiefPayload = thiefActive ? filledThiefChoices.filter(Boolean) : [];
    dispatch('save', {
      selections: draftSelections,
      override: draftOverride,
      includeSheriff: draftIncludeSheriff,
      includeTownCrier: draftIncludeTownCrier,
      tweakRoleMix: draftTweakRoleMix,
      roleMixOverride: draftTweakRoleMix ? draftMix : null,
      actorRoles: actorPayload,
      thiefRoles: thiefPayload,
      exclusionList: draftExclusionList.filter(Boolean)
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
      <div class="toggle-stack">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={draftOverride} />
          {$t('configure.role_override_label')}
        </label>
        <button
          class="info-pill"
          type="button"
          aria-label={$t('configure.role_override_active')}
          title={$t('configure.role_override_active')}
          aria-pressed={showOverrideHint}
          aria-expanded={showOverrideHint}
          on:click={() => (showOverrideHint = !showOverrideHint)}
        >
          i
        </button>
        {#if showOverrideHint}
          <p class="info-popover">{$t('configure.role_override_active')}</p>
        {/if}
      </div>
      <div class="toggle-stack">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={draftTweakRoleMix} />
          {$t('configure.tweak_mix_label')}
        </label>
        <button
          class="info-pill"
          type="button"
          aria-label={$t('configure.tweak_mix_hint')}
          title={$t('configure.tweak_mix_hint')}
          aria-pressed={showTweakHint}
          aria-expanded={showTweakHint}
          on:click={() => (showTweakHint = !showTweakHint)}
        >
          i
        </button>
        {#if showTweakHint}
          <p class="info-popover">{$t('configure.tweak_mix_hint')}</p>
        {/if}
      </div>
      <div class="toggle-stack">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={showExclusionEditor} />
          {$t('configure.exclusions_toggle_label')}
        </label>
        <button
          class="info-pill"
          type="button"
          aria-label={$t('configure.exclusions_toggle_hint')}
          title={$t('configure.exclusions_toggle_hint')}
          aria-pressed={showExclusionHint}
          aria-expanded={showExclusionHint}
          on:click={() => (showExclusionHint = !showExclusionHint)}
        >
          i
        </button>
        {#if showExclusionHint}
          <p class="info-popover">{$t('configure.exclusions_toggle_hint')}</p>
        {/if}
      </div>
      <div class="toggle-stack">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={draftIncludeSheriff} />
          {$t('configure.sheriff_include_label')}
        </label>
        <button
          class="info-pill"
          type="button"
          aria-label={$t('configure.sheriff_include_hint')}
          title={$t('configure.sheriff_include_hint')}
          aria-pressed={showSheriffHint}
          aria-expanded={showSheriffHint}
          on:click={() => (showSheriffHint = !showSheriffHint)}
        >
          i
        </button>
        {#if showSheriffHint}
          <p class="info-popover">{$t('configure.sheriff_include_hint')}</p>
        {/if}
      </div>
      <div class="toggle-stack">
        <label class="override-toggle">
          <input type="checkbox" bind:checked={draftIncludeTownCrier} />
          {$t('configure.towncrier_include_label')}
        </label>
        <button
          class="info-pill"
          type="button"
          aria-label={$t('configure.towncrier_include_hint')}
          title={$t('configure.towncrier_include_hint')}
          aria-pressed={showTownCrierHint}
          aria-expanded={showTownCrierHint}
          on:click={() => (showTownCrierHint = !showTownCrierHint)}
        >
          i
        </button>
        {#if showTownCrierHint}
          <p class="info-popover">{$t('configure.towncrier_include_hint')}</p>
        {/if}
      </div>
    </div>

    {#if showExclusionEditor}
      <div class="exclusions-box">
        <div class="exclusions-header">
          <h3>{$t('configure.thief_exclusions_label')}</h3>
        </div>
        <div class="exclusions-groups">
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) =>
                toggleGroupExclusion(['pyromaniac', 'scandalmonger'], e.currentTarget.checked)
              }
              checked={['pyromaniac', 'scandalmonger'].every((role) => exclusionSetMemo.has(slugify(role)))}
            />
            <span>{$t('configure.exclusions_group_village')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) => toggleGroupExclusion(['gypsy', 'town_crier'], e.currentTarget.checked)}
              checked={['gypsy', 'town_crier'].every((role) => exclusionSetMemo.has(slugify(role)))}
            />
            <span>{$t('configure.exclusions_group_newmoon')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) => {
                const pool = rolesByCategory?.ambiguous ?? [];
                toggleGroupExclusion(pool, e.currentTarget.checked);
              }}
              checked={(rolesByCategory?.ambiguous ?? []).every((role) => exclusionSetMemo.has(slugify(role)))}
            />
            <span>{$t('configure.exclusions_group_ambiguous')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) => {
                const pool = rolesByCategory?.loners ?? [];
                toggleGroupExclusion(pool, e.currentTarget.checked);
              }}
              checked={(rolesByCategory?.loners ?? []).every((role) => exclusionSetMemo.has(slugify(role)))}
            />
            <span>{$t('configure.exclusions_group_loners')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) => toggleGroupExclusion(['brothers', 'sisters'], e.currentTarget.checked)}
              checked={['brothers', 'sisters'].every((role) => exclusionSetMemo.has(slugify(role)))}
            />
            <span>{$t('configure.exclusions_group_multiplayer')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) => {
                const pool = [...(rolesByCategory?.werewolves ?? []), 'white'];
                toggleGroupExclusion(pool, e.currentTarget.checked);
              }}
              checked={[...(rolesByCategory?.werewolves ?? []), 'white'].every((role) =>
                exclusionSetMemo.has(slugify(role))
              )}
            />
            <span>{$t('configure.exclusions_group_werewolves')}</span>
          </label>
          <label class="exclusion-chip exclusion-chip--group">
            <input
              type="checkbox"
              on:change={(e) =>
                toggleGroupExclusion(['brothers', 'sisters', 'trusted', 'villager'], e.currentTarget.checked)
              }
              checked={['brothers', 'sisters', 'trusted', 'villager'].every((role) =>
                exclusionSetMemo.has(slugify(role))
              )}
            />
            <span>{$t('configure.exclusions_group_no_power_villagers')}</span>
          </label>
        </div>
        <div class="excluded-summary">
          <span>{$t('configure.exclusions_current')}</span>
          {#if (draftExclusionList ?? []).length}
            <div class="excluded-chips">
              {#each draftExclusionList as role}
                <span class="excluded-chip">{role}</span>
              {/each}
            </div>
          {:else}
            <span class="empty-exclusions">{$t('configure.exclusions_none')}</span>
          {/if}
        </div>
        <div class="exclusions-grid">
          {#each exclusionCandidates as role}
            <label class={`exclusion-chip ${exclusionSetMemo.has(slugify(role)) ? 'exclusion-chip--excluded' : ''}`}>
              <input
                type="checkbox"
                value={role}
                on:change={(event) => {
                  toggleExclusion(role, event.currentTarget.checked);
                }}
                checked={exclusionSetMemo.has(slugify(role))}
              />
              <img
                src={`/roles/${allRoleCategory.get(slugify(role)) ?? 'villagers'}/${slugify(role)}.png`}
                alt={role}
              />
              <span>{role}</span>
            </label>
          {/each}
          {#if !exclusionCandidates.length}
            <p class="empty-exclusions">{$t('configure.thief_exclusions_empty')}</p>
          {/if}
        </div>
      </div>
    {/if}

    {#if draftMix || mix}
      <div class="mix-summary">
        <div class="mix-header">
          <h3>{$t('configure.balance_label')}</h3>
        </div>
        <div class="mix-grid">
          {#each MIX_KEYS as key}
            <div class="mix-chip">
              {#if draftTweakRoleMix}
                <div class="mix-counter">
                  <button type="button" on:click={() => adjustMix(key, -1)} disabled={(draftMix?.[key] ?? 0) <= 0}>
                    −
                  </button>
                  <span class="mix-value">{draftMix?.[key] ?? 0}</span>
                  <button type="button" on:click={() => adjustMix(key, 1)}>
                    +
                  </button>
                </div>
              {:else}
                <span class="mix-value">{draftMix?.[key] ?? mix?.[key] ?? 0}</span>
              {/if}
              <span class="mix-label">{key}</span>
            </div>
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
            <h4>Thief's Roles</h4>
            <p class="totals">Select 2 roles for the Thief.</p>
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
                  <button type="button" class="actor-clear" on:click={() => clearThiefSlot(index)}>×</button>
                  </div>
                </div>
              {:else}
                <div class="actor-slot empty">
                  <button type="button" class="actor-add" on:click={() => openPicker('thief', index)}>
                    <span class="plus">+</span>
                    <span class="actor-add__label">Select role</span>
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
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem 1rem;
    padding: 1rem 1.25rem;
    border-radius: 20px;
    border: 1px solid var(--glass-border);
    background: rgba(8, 12, 20, 0.85);
    align-items: start;
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

  .toggle-stack {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-pill {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-white-contrast);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .info-pill:active {
    transform: scale(0.96);
  }

  .info-popover {
    margin: 0;
    margin-left: 0.5rem;
    font-size: 0.85rem;
    color: var(--color-white-muted);
    background: rgba(12, 16, 24, 0.9);
    border: 1px solid var(--glass-hover);
    border-radius: 10px;
    padding: 0.5rem 0.75rem;
    max-width: 320px;
    display: inline-block;
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
    gap: 0.35rem;
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

  .mix-counter {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(4, 7, 12, 0.85);
    border-radius: 999px;
    padding: 0.35rem 0.6rem;
  }

  .mix-counter button {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-white-contrast);
    cursor: pointer;
  }

  .mix-counter button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .exclusions-box {
    border: 1px solid var(--glass-hover);
    border-radius: 20px;
    padding: 1rem 1.25rem;
    background: rgba(6, 12, 20, 0.85);
    display: grid;
    gap: 0.6rem;
  }

  .exclusions-header h3 {
    margin: 0;
  }

  .exclusions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.6rem;
  }

  .exclusion-chip {
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    padding: 0.4rem 0.65rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(10, 14, 20, 0.7);
    color: var(--color-white-contrast);
    min-height: 46px;
  }

  .exclusion-chip--group {
    border: none;
    background: transparent;
    padding: 0;
    min-height: auto;
    gap: 0.35rem;
  }

  .exclusion-chip--excluded {
    filter: grayscale(1);
    opacity: 0.6;
  }

  .exclusion-chip img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--surface-chip);
    padding: 0.15rem;
    display: block;
  }

  .exclusions-hints {
    color: var(--color-white-muted);
    font-size: 0.9rem;
    margin: 0;
  }

  .exclusions-groups {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem 0.75rem;
  }

  .excluded-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-white-muted);
    font-size: 0.9rem;
  }

  .excluded-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .excluded-chip {
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.06);
    color: var(--color-white-contrast);
  }

  .empty-exclusions {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--color-white-muted);
    font-size: 0.9rem;
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

<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import { slugifyRole } from '../../lib/roles.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

  export let open = false;
  export let players = [];
  export let testPlayers = [];
  export let roles = [];
  export let assignments = {};

  const shuffle = (list = []) => {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  };

  const dispatch = createEventDispatcher();

  let draftAssignments = {};
  let userModified = false;
  let lastSyncedKey = '';
  let lastOpenState = false;
  let draftTestPlayers = [];
  let newPlayerName = '';

  const resolveRoleSlug = (role) => {
    if (!role) return '';
    return role.slug ?? slugifyRole(role.role ?? '');
  };

  function normalizeAssignments(source = {}) {
    const result = {};
    Object.entries(source ?? {}).forEach(([playerId, data]) => {
      if (!data) return;
      if (typeof data === 'string') {
        const slug = slugifyRole(data);
        if (slug) result[playerId] = slug;
      } else if (typeof data === 'object') {
        const slug = slugifyRole(data.slug ?? data.role ?? '');
        if (slug) result[playerId] = slug;
      }
    });
    return result;
  }

  $: normalizedAssignments = normalizeAssignments(assignments);
  $: normalizedKey = JSON.stringify(normalizedAssignments);

  $: if (open && !lastOpenState) {
    draftAssignments = normalizedAssignments;
    userModified = false;
    lastSyncedKey = normalizedKey;
    draftTestPlayers = Array.isArray(testPlayers) ? [...testPlayers] : [];
    newPlayerName = '';
  }

  $: if (open && normalizedKey !== lastSyncedKey && !userModified) {
    draftAssignments = normalizedAssignments;
    lastSyncedKey = normalizedKey;
    draftTestPlayers = Array.isArray(testPlayers) ? [...testPlayers] : [];
    newPlayerName = '';
  }

  $: lastOpenState = open;

  $: roleCapacities = (roles ?? []).reduce((acc, role) => {
    const slug = resolveRoleSlug(role);
    if (!slug) return acc;
    acc[slug] = Number(role.count) || 0;
    return acc;
  }, {});

  $: roleUsage = Object.values(draftAssignments ?? {}).reduce((acc, slug) => {
    if (!slug) return acc;
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});

  $: matchPlayers = [...(players ?? []), ...(draftTestPlayers ?? [])];

  function roleInstanceIndex(slug, playerId) {
    const total = roleCapacities[slug] ?? 0;
    if (total <= 1) return null;
    const assigned = (matchPlayers ?? []).filter((player) => draftAssignments[player.id] === slug);
    const position = assigned.findIndex((player) => player.id === playerId);
    if (position >= 0) return position + 1;
    const nextIndex = assigned.length + 1;
    return Math.min(nextIndex, total);
  }

  function formatRoleLabel(role, playerId, available = null) {
    const slug = resolveRoleSlug(role);
    const total = Number(role.count) || 0;
    if (!slug || total <= 1) return role.role;
    if (available === 0) return `${role.role} (0/${total})`;
    const index = roleInstanceIndex(slug, playerId) ?? 1;
    return `${role.role} (${index}/${total})`;
  }

  function remainingFor(slug, currentSelection) {
    if (!slug) return 0;
    const capacity = roleCapacities[slug] ?? 0;
    const used = roleUsage[slug] ?? 0;
    if (currentSelection === slug) return capacity - used + 1;
    return capacity - used;
  }

  function assign(playerId, value) {
    const next = { ...draftAssignments };
    if (!value) {
      delete next[playerId];
    } else {
      next[playerId] = value;
    }
    draftAssignments = next;
    userModified = true;
  }

  function createTestPlayer(name) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'player';
    const suffix = Math.floor(Math.random() * 10000);
    return {
      id: `test-${slug}-${Date.now()}-${suffix}`,
      alias: name.trim(),
      ready: true
    };
  }

  function addTestPlayer() {
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    if (draftTestPlayers.some((player) => player.alias.toLowerCase() === trimmed.toLowerCase())) {
      newPlayerName = '';
      return;
    }
    draftTestPlayers = [...draftTestPlayers, createTestPlayer(trimmed)];
    newPlayerName = '';
  }

  function removeTestPlayer(id) {
    draftTestPlayers = draftTestPlayers.filter((player) => player.id !== id);
    if (draftAssignments[id]) {
      const next = { ...draftAssignments };
      delete next[id];
      draftAssignments = next;
    }
  }

  function close() {
    dispatch('cancel');
  }

  function autoAssign() {
    if (!Array.isArray(matchPlayers) || !Array.isArray(roles)) return;
    const pool = [];
    roles.forEach((role) => {
      const count = Number(role.count) || 0;
      const slug = role.slug ?? role.role;
      for (let index = 0; index < count; index += 1) {
        if (slug) pool.push(slug);
      }
    });
    if (!pool.length) return;
    const randomized = shuffle(pool);
    const next = {};
    (matchPlayers ?? []).forEach((player, index) => {
      const slug = randomized[index];
      if (slug) next[player.id] = slug;
    });
    draftAssignments = next;
  }

  function confirm() {
    const payload = {};
    (matchPlayers ?? []).forEach((player) => {
      const slug = draftAssignments[player.id];
      if (!slug) return;
      const role = (roles ?? []).find((item) => item.slug === slug);
      if (!role) return;
      payload[player.id] = {
        role: role.role,
        slug: role.slug,
        category: role.category,
        alias: player.alias ?? player.name ?? player.id
      };
    });
    dispatch('save', { assignments: payload, testPlayers: draftTestPlayers });
  }

  $: hasPlayers = Array.isArray(matchPlayers) && matchPlayers.length > 0;
  $: hasRoles = Array.isArray(roles) && roles.length > 0;
  const hint = $t('configure.match_hint');
</script>

<Modal
  open={open}
  title={$t('configure.match_title')}
  description={hint}
  size="lg"
  on:close={close}
>
  <div class="match-body">
    <div class="test-players card-outline">
      <div class="section-header">
        <label class="section-label" for="test-player-input">{$t('configure.match_offline_players_label')}</label>
        <small class="section-hint">{$t('configure.match_offline_players_hint')}</small>
      </div>
      <div class="test-input-row">
        <input
          id="test-player-input"
          class="test-input"
          placeholder="Nombre o alias"
          bind:value={newPlayerName}
          on:keydown={(event) => event.key === 'Enter' && addTestPlayer()}
        />
        <Button variant="secondary" type="button" on:click={addTestPlayer}>
          Añadir
        </Button>
      </div>
      {#if draftTestPlayers.length}
        <div class="test-chip-list" aria-live="polite">
          {#each draftTestPlayers as player}
            <span class="test-chip">
              {player.alias}
              <button
                type="button"
                class="chip-remove"
                aria-label={`Eliminar ${player.alias}`}
                on:click={() => removeTestPlayer(player.id)}
              >
                ×
              </button>
            </span>
          {/each}
        </div>
      {/if}
    </div>

    {#if !hasPlayers}
      <p class="match-empty">{$t('configure.match_no_players')}</p>
    {:else if !hasRoles}
      <p class="match-empty">{$t('configure.match_no_roles')}</p>
    {:else}
      <table class="match-table">
        <thead>
          <tr>
            <th>{$t('configure.match_players_title')}</th>
            <th>{$t('configure.match_roles_title')}</th>
          </tr>
        </thead>
        <tbody>
          {#each matchPlayers as player}
            <tr>
              <td>
                <div class="player-info">
                  <span class="player-alias">{player.alias}</span>
                  <span class={`status-pill status-pill--${player.ready ? 'ready' : 'connected'}`}>
                    {player.ready
                      ? $t('configure.match_status_ready')
                      : $t('configure.match_status_connected')}
                  </span>
                </div>
              </td>
              <td>
                <select
                  class="match-select"
                  bind:value={draftAssignments[player.id]}
                  on:change={(event) => assign(player.id, event?.currentTarget?.value ?? '')}
                >
                  <option value="">{ $t('configure.match_unassigned') }</option>
                  {#each roles as role}
                    {@const slug = resolveRoleSlug(role)}
                    {#if role.count > 0}
                      {#if remainingFor(slug, draftAssignments[player.id]) > 0 || draftAssignments[player.id] === slug}
                        <option value={slug}>
                          {formatRoleLabel(role, player.id)}
                        </option>
                      {:else}
                        <option value={slug} disabled>
                          {formatRoleLabel(role, player.id, 0)}
                        </option>
                      {/if}
                    {:else}
                      <option value={slug} disabled>{role.role}</option>
                    {/if}
                  {/each}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <svelte:fragment slot="footer">
    <Button
      variant="ghost"
      type="button"
      on:click={autoAssign}
      disabled={!hasPlayers || !hasRoles}
    >
      {$t('configure.match_auto')}
    </Button>
    <Button
      variant="primary"
      type="button"
      on:click={confirm}
      disabled={!hasPlayers || !hasRoles}
    >
      {$t('common.actions.save')}
    </Button>
  </svelte:fragment>
</Modal>

<style>
  .match-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-outline {
    border: 1px solid var(--glass-border);
    border-radius: 0.85rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .test-players {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    font-weight: 600;
    color: var(--color-white-muted);
  }

  .section-hint {
    margin: 0;
    color: var(--color-white-dim);
    font-size: 0.85rem;
  }

  .test-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .test-input {
    flex: 1;
    background: var(--surface-input);
    border: 1px solid var(--glass-border-strong);
    border-radius: 0.65rem;
    padding: 0.5rem 0.75rem;
    color: var(--color-white-contrast);
  }

  .test-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .test-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.35rem 0.65rem;
    background: var(--glass-hover);
    border: 1px solid var(--glass-border);
    border-radius: 999px;
  }

  .chip-remove {
    background: transparent;
    border: none;
    color: var(--color-white-muted);
    cursor: pointer;
    line-height: 1;
  }

  .match-empty {
    margin: 0;
    color: var(--color-white-muted);
  }

  .match-table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--glass-border);
    border-radius: 1rem;
    overflow: hidden;
  }

  .match-table th,
  .match-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--glass-border);
  }

  .match-table thead {
    background: var(--glass-hover);
    text-align: left;
    font-weight: 600;
    color: var(--color-white-muted);
  }

  .match-table tbody tr:nth-child(odd) {
    background: rgba(255, 255, 255, 0.03);
  }

  .player-info {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .player-alias {
    font-weight: 600;
  }

  .status-pill {
    font-size: 0.75rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .status-pill--ready {
    background: var(--state-in-progress);
    color: var(--color-text-invert);
  }

  .status-pill--connected {
    background: var(--state-waiting);
    color: var(--color-text-invert);
  }

  .match-select {
    width: 100%;
    background: var(--surface-input);
    border: 1px solid var(--glass-border-strong);
    border-radius: 0.65rem;
    padding: 0.5rem 0.75rem;
    color: var(--color-white-contrast);
  }

</style>

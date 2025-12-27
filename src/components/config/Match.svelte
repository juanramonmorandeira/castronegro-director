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
  export let seatingOrder = [];
  export let expectedSeats = 0;

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
  let draftSeatRoles = [];
  let draftSeating = [];
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
  $: normalizedSeatingKey = JSON.stringify(seatingOrder ?? []);

  $: if (open && !lastOpenState) {
    draftAssignments = normalizedAssignments;
    draftSeating = seatingOrder ?? [];
    draftSeatRoles = buildSeatRoles(draftSeating, draftAssignments);
    userModified = false;
    lastSyncedKey = normalizedKey;
    draftTestPlayers = Array.isArray(testPlayers) ? [...testPlayers] : [];
    newPlayerName = '';
  }

  $: if (open && normalizedKey !== lastSyncedKey && !userModified) {
    draftAssignments = normalizedAssignments;
    draftSeatRoles = buildSeatRoles(draftSeating, draftAssignments);
    lastSyncedKey = normalizedKey;
    draftTestPlayers = Array.isArray(testPlayers) ? [...testPlayers] : [];
    newPlayerName = '';
  }

  $: seatsCount = expectedSeats > 0 ? expectedSeats : (players?.length ?? 0);

  $: lastOpenState = open;

  $: roleCapacities = (roles ?? []).reduce((acc, role) => {
    const slug = resolveRoleSlug(role);
    if (!slug) return acc;
    acc[slug] = Number(role.count) || 0;
    return acc;
  }, {});

  $: roleUsage = (draftSeatRoles ?? []).reduce((acc, slug) => {
    if (!slug) return acc;
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});

  $: matchPlayers = [...(players ?? []), ...(draftTestPlayers ?? [])];
  $: playersMap = new Map((matchPlayers ?? []).map((p) => [p.id, p]));

  const buildSeatAssignments = (order = [], count = seatsCount) => {
    const seats = [];
    const used = new Set();
    (order ?? []).forEach((id) => {
      if (seats.length >= count) return;
      if (playersMap.has(id) && !used.has(id)) {
        seats.push(id);
        used.add(id);
      }
    });
    while (seats.length < count) seats.push(null);
    return seats;
  };

  const ensureSeatArrays = (count) => {
    if (!Array.isArray(draftSeating)) draftSeating = [];
    if (!Array.isArray(draftSeatRoles)) draftSeatRoles = [];
    while (draftSeating.length < count) draftSeating.push(null);
    while (draftSeatRoles.length < count) draftSeatRoles.push('');
    if (draftSeating.length > count) draftSeating = draftSeating.slice(0, count);
    if (draftSeatRoles.length > count) draftSeatRoles = draftSeatRoles.slice(0, count);
  };

  const buildSeatRoles = (seats = [], assignmentMap = {}) => {
    const roles = [];
    seats.forEach((playerId) => {
      if (playerId && assignmentMap[playerId]) {
        roles.push(assignmentMap[playerId]);
      } else {
        roles.push('');
      }
    });
    return roles;
  };

  $: if (open) {
    draftSeating = buildSeatAssignments(userModified ? draftSeating : seatingOrder, seatsCount);
    ensureSeatArrays(seatsCount);
    if (!userModified) {
      draftSeatRoles = buildSeatRoles(draftSeating, normalizedAssignments);
    }
  }

  const setSeat = (index, playerId) => {
    if (index < 0 || index >= seatsCount) return;
    const next = [...draftSeating];
    const normalized = playerId || null;
    // Remove player from any other seat
    if (normalized) {
      draftSeating.forEach((id, idx) => {
        if (idx !== index && id === normalized) {
          next[idx] = null;
        }
      });
    }
    next[index] = normalized;
    draftSeating = next;
    userModified = true;
  };

  $: seatedIds = new Set(draftSeating.filter(Boolean));
  $: queuePlayers = (matchPlayers ?? []).filter((p) => !seatedIds.has(p.id));

  const isOffline = (player) => {
    if (!player) return false;
    if (player.offline === true) return true;
    if (typeof player.id === 'string' && player.id.startsWith('test-')) return true;
    return false;
  };

  function roleInstanceIndex(slug) {
    const total = roleCapacities[slug] ?? 0;
    if (total <= 1) return null;
    const assigned = (draftSeatRoles ?? []).filter((value) => value === slug);
    const nextIndex = assigned.length + 1;
    return Math.min(nextIndex, total);
  }

  function formatRoleLabel(role, available = null) {
    const slug = resolveRoleSlug(role);
    const total = Number(role.count) || 0;
    if (!slug || total <= 1) return role.role;
    if (available === 0) return `${role.role} (0/${total})`;
    const index = roleInstanceIndex(slug) ?? 1;
    return `${role.role} (${index}/${total})`;
  }

  function remainingFor(slug, currentSelection) {
    if (!slug) return 0;
    const capacity = roleCapacities[slug] ?? 0;
    const used = roleUsage[slug] ?? 0;
    if (currentSelection === slug) return capacity - used + 1;
    return capacity - used;
  }

  function assignSeatRole(index, value) {
    ensureSeatArrays(seatsCount);
    draftSeatRoles[index] = value || '';
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
    const seatIndex = draftSeating.findIndex((playerId) => playerId === id);
    if (seatIndex >= 0) {
      setSeat(seatIndex, null);
    }
  }

  function close() {
    dispatch('cancel');
  }

  function autoAssign() {
    if (!Array.isArray(roles)) return;
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
    ensureSeatArrays(seatsCount);
    draftSeatRoles = draftSeatRoles.map((_, index) => randomized[index] ?? '');
    userModified = true;
  }

  function confirm() {
    const payload = {};
    ensureSeatArrays(seatsCount);
    draftSeating.forEach((playerId, index) => {
      const slug = draftSeatRoles[index];
      if (!playerId || !slug) return;
      const role = (roles ?? []).find((item) => resolveRoleSlug(item) === slug);
      if (!role) return;
      payload[playerId] = {
        role: role.role,
        slug: resolveRoleSlug(role),
        category: role.category,
        alias: playersMap.get(playerId)?.alias ?? playersMap.get(playerId)?.name ?? playerId
      };
    });
    dispatch('save', {
      assignments: payload,
      testPlayers: draftTestPlayers,
      seatingOrder: draftSeating.slice(0, seatsCount)
    });
  }

  $: hasPlayers = Array.isArray(matchPlayers) && matchPlayers.length > 0;
  $: hasRoles = Array.isArray(roles) && roles.length > 0;
  const hint = 'Assign seats and roles.';
</script>

<Modal
  open={open}
  title="Match"
  description={hint}
  size="lg"
  on:close={close}
>
  <div class="match-body">
    {#if !hasPlayers}
      <p class="match-empty">{$t('configure.match_no_players')}</p>
    {:else if !hasRoles}
      <p class="match-empty">{$t('configure.match_no_roles')}</p>
    {:else}
      <div class="match-table card-outline">
        <div class="match-table-header">
          <h3>Player's table</h3>
        </div>
        <div class="table-grid">
          <div class="table-row table-head">
            <div class="col-seat">Seat</div>
            <div class="col-player">Player</div>
            <div class="col-role">Role</div>
          </div>
          {#each Array(seatsCount) as _, index}
            <div class="table-row">
              <div class="col-seat">#{index}</div>
              <div class="col-player">
                <select
                  class="match-select"
                  value={draftSeating[index] ?? ''}
                  on:change={(event) => setSeat(index, event?.currentTarget?.value ?? '')}
                >
                  <option value="">Select a player</option>
                  {#if draftSeating[index] && playersMap.has(draftSeating[index])}
                    <option value={draftSeating[index]}>
                      {playersMap.get(draftSeating[index]).alias}
                    </option>
                  {/if}
                  {#each queuePlayers as player}
                    <option value={player.id}>{player.alias}</option>
                  {/each}
                </select>
              </div>
              <div class="col-role">
                <select
                  class="match-select"
                  bind:value={draftSeatRoles[index]}
                  on:change={(event) => assignSeatRole(index, event?.currentTarget?.value ?? '')}
                >
                  <option value="">Select a role</option>
                  {#each roles as role}
                    {@const slug = resolveRoleSlug(role)}
                    {#if role.count > 0}
                      {#if remainingFor(slug, draftSeatRoles[index]) > 0 || draftSeatRoles[index] === slug}
                        <option value={slug}>
                          {formatRoleLabel(role)}
                        </option>
                      {:else}
                        <option value={slug} disabled>
                          {formatRoleLabel(role, 0)}
                        </option>
                      {/if}
                    {:else}
                      <option value={slug} disabled>{role.role}</option>
                    {/if}
                  {/each}
                </select>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <section class="queue-section card-outline">
        <header class="section-header">
          <div>
            <h3>Player's queue</h3>
          </div>
        </header>
        <div class="queue-list {queuePlayers.length === 0 ? 'queue-list--empty' : ''}">
          {#each queuePlayers as player}
            <div class="queue-item">
              <div class="player-info">
                <span class="player-alias">{player.alias}</span>
                <span class={`status-pill status-pill--${isOffline(player) ? 'offline' : 'online'}`}>
                  {isOffline(player) ? 'offline' : 'online'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <div class="test-players card-outline inline-section">
        <div class="section-header">
          <h3>Add offline players</h3>
          <p class="section-hint">Create placeholders for players who are not connected.</p>
        </div>
        <div class="test-input-row">
          <input
            id="test-player-input"
            class="test-input"
            placeholder="Name or alias"
            bind:value={newPlayerName}
            on:keydown={(event) => event.key === 'Enter' && addTestPlayer()}
          />
          <Button variant="secondary" type="button" on:click={addTestPlayer}>
            Add
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
                      aria-label={`Remove ${player.alias}`}
                      on:click={() => removeTestPlayer(player.id)}
                    >
                      ×
                    </button>
                  </span>
            {/each}
          </div>
        {/if}
      </div>
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
    padding: 1.2rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.35rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.05rem;
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

  .status-pill--online {
    background: var(--state-in-progress);
    color: var(--color-text-invert);
  }

  .status-pill--offline {
    background: var(--glass-border);
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

  .seating-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .seat-section,
  .queue-section {
    display: grid;
    gap: 0.75rem;
  }

  .seat-list {
    display: grid;
    gap: 0.5rem;
  }

  .seat-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.5rem;
    align-items: center;
  }

  .seat-number {
    min-width: 44px;
    padding: 0.4rem 0.6rem;
    border-radius: 0.65rem;
    background: var(--glass-hover);
    text-align: center;
    font-weight: 700;
    color: var(--color-white-contrast);
  }

  .seat-player-meta {
    display: flex;
    align-items: center;
  }

  .queue-list {
    display: grid;
    gap: 0.5rem;
    min-height: 0.75rem;
  }

  .queue-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.8rem;
    border: 1px solid var(--glass-border);
  }

  .queue-actions .pill-btn {
    padding: 0.35rem 0.7rem;
  }

  .queue-list--empty {
    min-height: 0;
    padding: 0;
  }

  .match-table {
    display: grid;
    gap: 0.75rem;
  }

  .match-table-header h3 {
    margin: 0;
    font-size: 1.05rem;
  }

  .table-grid {
    display: grid;
    gap: 0.35rem;
  }

  .table-row {
    display: grid;
    grid-template-columns: 0.4fr 1fr 1fr;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem 0.6rem;
    border: 1px solid var(--glass-border);
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.02);
  }

  .table-head {
    background: var(--glass-hover);
    font-weight: 700;
  }

  .col-seat {
    font-weight: 700;
  }

  .placeholder {
    color: var(--color-white-muted);
    font-size: 0.9rem;
  }

  @media (max-width: 900px) {
    .seating-grid {
      grid-template-columns: 1fr;
    }

    .match-row {
      grid-template-columns: 1fr;
    }
  }

</style>

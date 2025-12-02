<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

  export let open = false;
  export let players = [];
  export let roles = [];
  export let assignments = {};
  export let savedMessage = '';

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
  let lastOpenState = false;

  function normalizeAssignments(source = {}) {
    const result = {};
    Object.entries(source ?? {}).forEach(([playerId, data]) => {
      if (!data) return;
      if (typeof data === 'string') {
        result[playerId] = data;
      } else if (typeof data === 'object') {
        const slug = data.slug ?? data.role ?? '';
        if (slug) result[playerId] = slug;
      }
    });
    return result;
  }

  $: if (open && !lastOpenState) {
    draftAssignments = normalizeAssignments(assignments);
  }

  $: lastOpenState = open;

  $: roleCapacities = (roles ?? []).reduce((acc, role) => {
    const slug = role.slug ?? role.role;
    acc[slug] = Number(role.count) || 0;
    return acc;
  }, {});

  $: roleUsage = Object.values(draftAssignments ?? {}).reduce((acc, slug) => {
    if (!slug) return acc;
    acc[slug] = (acc[slug] ?? 0) + 1;
    return acc;
  }, {});

  function remainingFor(slug, currentSelection) {
    if (!slug) return 0;
    const capacity = roleCapacities[slug] ?? 0;
    const used = roleUsage[slug] ?? 0;
    if (currentSelection === slug) return capacity - used + 1;
    return capacity - used;
  }

  function assign(playerId, event) {
    const value = event?.currentTarget?.value ?? '';
    const next = { ...draftAssignments };
    if (!value) {
      delete next[playerId];
    } else {
      next[playerId] = value;
    }
    draftAssignments = next;
  }

  function close() {
    dispatch('cancel');
  }

  function autoAssign() {
    if (!Array.isArray(players) || !Array.isArray(roles)) return;
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
    (players ?? []).forEach((player, index) => {
      const slug = randomized[index];
      if (slug) next[player.id] = slug;
    });
    draftAssignments = next;
  }

  function confirm() {
    const payload = {};
    (players ?? []).forEach((player) => {
      const slug = draftAssignments[player.id];
      if (!slug) return;
      const role = (roles ?? []).find((item) => item.slug === slug);
      if (!role) return;
      payload[player.id] = {
        role: role.role,
        slug: role.slug,
        category: role.category
      };
    });
    dispatch('save', { assignments: payload });
  }

  $: hasPlayers = Array.isArray(players) && players.length > 0;
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
          {#each players as player}
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
                  on:change={(event) => assign(player.id, event)}
                  value={draftAssignments[player.id] ?? ''}
                >
                  <option value="">{ $t('configure.match_unassigned') }</option>
                  {#each roles as role}
                    {#if role.count > 0}
                      {#if remainingFor(role.slug, draftAssignments[player.id]) > 0 || draftAssignments[player.id] === role.slug}
                        <option value={role.slug}>
                          {role.role} ({remainingFor(role.slug, draftAssignments[player.id])}/{role.count})
                        </option>
                      {:else}
                        <option value={role.slug} disabled>
                          {role.role} (0/{role.count})
                        </option>
                      {/if}
                    {:else}
                      <option value={role.slug} disabled>{role.role}</option>
                    {/if}
                  {/each}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <div class="match-actions">
      <Button variant="ghost" type="button" on:click={autoAssign} disabled={!hasPlayers || !hasRoles}>
        {$t('configure.match_auto')}
      </Button>
      <div class="spacer"></div>
      <Button variant="primary" type="button" on:click={confirm} disabled={!hasPlayers || !hasRoles}>
        {$t('common.actions.save')}
      </Button>
    </div>

    {#if savedMessage}
      <p class="action-hint" aria-live="polite">{savedMessage}</p>
    {/if}
  </div>
</Modal>

<style>
  .match-body {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
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

  .match-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .match-actions .spacer {
    flex: 1;
  }

  .btn {
    min-width: 120px;
  }
</style>

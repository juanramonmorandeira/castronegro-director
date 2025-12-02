<script>
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { slugifyRole } from '../lib/roles.js';

  export let sessionId = null;
  export let selection = null;
  export let tokens = [];
  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  let logEntries = [];
  let draftNote = '';
  let sessionStatus = 'in_progress';
  let currentPhaseIndex = 0;
  let lockedThroughIndex = -1;
  let phaseExpanded = true;
  let logExpanded = true;
  let boardFullscreen = false;
  let boardElement;
  let positions = {};
  let activeId = null;
  let activePointerId = null;
  let boardRect = null;
  let pointerOffset = { x: 0, y: 0 };
  let victoryExpanded = false;
  let victoryStates = {
    village: false,
    werewolves: false,
    lovers: false,
    piper: false,
    angel: false,
    draw: false
  };
  let finishEnabled = false;

  $: roleSet = (() => {
    const set = new Set();
    if (!selection) return set;
    Object.values(selection ?? {}).forEach((category) => {
      Object.keys(category ?? {}).forEach((role) => set.add(slugifyRole(role)));
    });
    return set;
  })();

  const phaseBlocks = [
    {
      titleKey: 'session.phases.preparation.title',
      subtitleKey: 'session.phases.preparation.subtitle',
      steps: [
        { key: 'cards_dealt' },
        { key: 'prejudiced_manipulator', requires: ['prejudiced_manipulator'] },
        { key: 'gypsy_cards', requires: ['gypsy'] },
        { key: 'town_crier_cards', requires: ['town_crier'] },
        { key: 'thief_cards', requires: ['thief'] },
        { key: 'actor_cards', requires: ['actor'] },
        { key: 'sheriff_election' }
      ]
    },
    {
      titleKey: 'session.phases.first_night.title',
      subtitleKey: 'session.phases.first_night.subtitle',
      steps: [
        { key: 'thief', requires: ['thief'] },
        { key: 'actor', requires: ['actor'] },
        { key: 'cupid', requires: ['cupid'] },
        { key: 'seer', requires: ['seer'] },
        { key: 'fox', requires: ['fox'] },
        { key: 'lovers', requires: ['cupid'] },
        { key: 'wandering_judge', requires: ['wandering_judge'] },
        { key: 'sisters', requires: ['two_sisters', 'sisters'] },
        { key: 'brothers', requires: ['three_brothers', 'brothers'] },
        { key: 'wild_child', requires: ['wild_child'] },
        { key: 'bear_tamer', requires: ['bear_tamer'] },
        { key: 'scandalmonger', requires: ['scandalmonger'] },
        { key: 'pyromaniac', requires: ['pyromaniac'] },
        { key: 'defender', requires: ['defender'] },
        { key: 'werewolves', requires: ['werewolf', 'wolf_hound', 'white_werewolf', 'cursed_wolf_father', 'big_bad_wolf'] },
        { key: 'baker', requires: ['baker'] },
        { key: 'cursed_wolf_father', requires: ['cursed_wolf_father'] },
        { key: 'big_bad_wolf', requires: ['big_bad_wolf'] },
        { key: 'witch', requires: ['witch'] },
        { key: 'gypsy', requires: ['gypsy'] },
        { key: 'piper', requires: ['piper'] },
        { key: 'charmed', requires: ['piper'] }
      ]
    },
    {
      titleKey: 'session.phases.each_night.title',
      subtitleKey: 'session.phases.each_night.subtitle',
      steps: [
        { key: 'actor_night', requires: ['actor'] },
        { key: 'seer', requires: ['seer'] },
        { key: 'fox', requires: ['fox'] },
        { key: 'scandalmonger', requires: ['scandalmonger'] },
        { key: 'pyromaniac', requires: ['pyromaniac'] },
        { key: 'defender', requires: ['defender'] },
        { key: 'werewolves', requires: ['werewolf', 'wolf_hound', 'wild_child', 'cursed_wolf_father', 'white_werewolf', 'big_bad_wolf'] },
        { key: 'baker', requires: ['baker'] },
        { key: 'white_werewolf', requires: ['white_werewolf'] },
        { key: 'cursed_wolf_father', requires: ['cursed_wolf_father'] },
        { key: 'big_bad_wolf', requires: ['big_bad_wolf'] },
        { key: 'witch', requires: ['witch'] },
        { key: 'gypsy', requires: ['gypsy'] },
        { key: 'piper', requires: ['piper'] },
        { key: 'charmed', requires: ['piper'] }
      ]
    },
    {
      titleKey: 'session.phases.each_day.title',
      subtitleKey: 'session.phases.each_day.subtitle',
      steps: [
        { key: 'victims' },
        { key: 'bear_grunt', requires: ['bear_tamer'] },
        { key: 'medium', requires: ['gypsy'] },
        { key: 'town_crier', requires: ['town_crier'] },
        { key: 'debate' },
        { key: 'vote' },
        { key: 'angel', requires: ['angel'] },
        { key: 'second_vote', requires: ['wandering_judge'] }
      ]
    }
  ];

  $: phases = phaseBlocks
    .map((phase) => {
      const steps = phase.steps.filter((step) => {
        if (!step.requires || step.requires.length === 0) return true;
        return step.requires.some((slug) => roleSet.has(slug));
      });
      return { ...phase, steps };
    })
    .filter((phase) => phase.steps.length > 0);
  $: if (currentPhaseIndex >= phases.length) {
    currentPhaseIndex = Math.max(0, phases.length - 1);
  }
  $: finishEnabled = Object.values(victoryStates).some(Boolean);

  const phaseLabel = () => $t(phases[currentPhaseIndex]?.titleKey ?? '') || '—';
  const subphaseLabel = () => $t(phases[currentPhaseIndex]?.subtitleKey ?? '') || '';

  function togglePhase() {
    phaseExpanded = !phaseExpanded;
  }

  function toggleLogbook() {
    logExpanded = !logExpanded;
  }

  function toggleFullscreen() {
    boardFullscreen = !boardFullscreen;
  }

  $: syncPositions();

  function syncPositions() {
    if (!tokens) return;
    const columns = Math.max(1, Math.ceil(Math.sqrt(tokens.length || 1)));
    const rows = Math.max(1, Math.ceil((tokens.length || 1) / columns));
    const next = {};
    tokens.forEach((token, index) => {
      if (positions[token.id]) {
        next[token.id] = positions[token.id];
      } else {
        const col = index % columns;
        const row = Math.floor(index / columns);
        next[token.id] = {
          x: ((col + 1) / (columns + 1)) * 100,
          y: ((row + 1) / (rows + 1)) * 100
        };
      }
    });
    positions = next;
  }

  function handlePointerDown(token, event) {
    if (!boardElement) return;
    boardRect = boardElement.getBoundingClientRect();
    const pos = positions[token.id] ?? { x: 50, y: 50 };
    pointerOffset = {
      x: ((event.clientX - boardRect.left) / boardRect.width) * 100 - pos.x,
      y: ((event.clientY - boardRect.top) / boardRect.height) * 100 - pos.y
    };
    activeId = token.id;
    activePointerId = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updatePosition(clientX, clientY) {
    if (!boardRect || !activeId) return;
    const relativeX = ((clientX - boardRect.left) / boardRect.width) * 100 - pointerOffset.x;
    const relativeY = ((clientY - boardRect.top) / boardRect.height) * 100 - pointerOffset.y;
    const x = Math.min(95, Math.max(5, relativeX));
    const y = Math.min(95, Math.max(5, relativeY));
    positions = { ...positions, [activeId]: { x, y } };
  }

  function handlePointerMove(event) {
    if (!activeId) return;
    updatePosition(event.clientX, event.clientY);
  }

  function handlePointerUp() {
    if (activePointerId != null) {
      boardElement?.releasePointerCapture?.(activePointerId);
    }
    activeId = null;
    activePointerId = null;
  }

  function handlePointerLeave() {
    handlePointerUp();
  }

  function addNote() {
    const text = draftNote.trim();
    if (!text) return;
    const stamp = new Date().toLocaleTimeString();
    logEntries = [{ text, stamp }, ...logEntries];
    draftNote = '';
  }

  function nextPhase() {
    if (currentPhaseIndex < phases.length - 1) {
      currentPhaseIndex += 1;
    }
  }

  function prevPhase() {
    if (currentPhaseIndex <= lockedThroughIndex) return;
    if (currentPhaseIndex > 0) currentPhaseIndex -= 1;
  }

  function closeDay() {
    lockedThroughIndex = Math.max(lockedThroughIndex, currentPhaseIndex);
  }

  function pauseSession() {
    sessionStatus = sessionStatus === 'paused' ? 'in_progress' : 'paused';
  }

  function finishSession() {
    sessionStatus = 'finished';
  }

  function cancelSession() {
    sessionStatus = 'cancelled';
  }

  const victoryChecklist = [
    { id: 'village', key: 'session.victory.village' },
    { id: 'werewolves', key: 'session.victory.werewolves' },
    { id: 'lovers', key: 'session.victory.lovers' },
    { id: 'piper', key: 'session.victory.piper' },
    { id: 'angel', key: 'session.victory.angel' },
    { id: 'draw', key: 'session.victory.draw' }
  ];

  function toggleVictory(id) {
    victoryStates = { ...victoryStates, [id]: !victoryStates[id] };
  }

</script>

<BackgroundLayer
  backgroundUrl="/backgrounds/background-village.png"
  fogUrl="/backgrounds/fog-texture.png"
/>

<div class="page">
  <Topbar
    titleKey="session.title"
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile
    on:logout
  />

  <main class="session-main">
    <section class={`panel distribution-panel ${boardFullscreen ? 'fullscreen' : ''}`}>
      <header class="panel__header">
        <div>
          <h1 class="panel-title">{$t('session.title')}</h1>
          <p class="panel-subtitle muted">{$t('session.distribution.hint')}</p>
        </div>
        <button class="btn ghost btn--size-sm" type="button" on:click={toggleFullscreen}>
          {boardFullscreen ? $t('session.controls.exit_fullscreen') : $t('session.controls.fullscreen')}
        </button>
      </header>
      <div
        class="distribution-board"
        bind:this={boardElement}
        on:pointermove={handlePointerMove}
        on:pointerup={handlePointerUp}
        on:pointerleave={handlePointerLeave}
      >
        {#if tokens.length === 0}
          <p class="board-empty">{$t('configure.role_preview_empty')}</p>
        {:else}
          {#each tokens as token}
            <button
              type="button"
              class={`role-token category-${token.category}`}
              style={`--x:${positions[token.id]?.x ?? 50}%; --y:${positions[token.id]?.y ?? 50}%;`}
              title={token.role}
              on:pointerdown={(event) => handlePointerDown(token, event)}
            >
              {#if token.player}
                <span class="token-player">{token.player}</span>
              {:else}
                <span class="token-player token-player--placeholder"></span>
              {/if}
              <span class="token-circle">
                {#if token.image}
                  <img src={token.image} alt={token.role} draggable="false" />
                {:else}
                  <span class="token-initials">{token.role?.[0] ?? '?'}</span>
                {/if}
              </span>
              <span class="token-role" aria-hidden="true">{token.role}</span>
              <span class="sr-only">{token.role}</span>
            </button>
          {/each}
        {/if}
      </div>
    </section>

    <section class={`panel phase-order ${phaseExpanded ? 'expanded' : 'collapsed'}`}>
      <header class="panel__header collapsible" role="button" tabindex="0" on:click={togglePhase} on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && togglePhase()}>
        <p class="eyebrow">{$t('session.phases.label')}</p>
        <span class="caret">{phaseExpanded ? '˄' : '˅'}</span>
      </header>
      {#if phaseExpanded}
        <div class="phase-grid">
          {#each phases as phase}
            <article class="phase-card">
              <p class="eyebrow">{$t(phase.subtitleKey)}</p>
              <h3>{$t(phase.titleKey)}</h3>
              <ul>
                {#each phase.steps as step}
                  <li>{$t(`session.phases.steps.${step.key}`)}</li>
                {/each}
              </ul>
            </article>
          {/each}
        </div>
      {/if}
    </section>

    <section class={`panel logbook ${logExpanded ? 'expanded' : 'collapsed'}`}>
      <header class="panel__header collapsible" role="button" tabindex="0" on:click={toggleLogbook} on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && toggleLogbook()}>
        <p class="eyebrow">{$t('session.logbook.label')}</p>
        <span class="caret">{logExpanded ? '˄' : '˅'}</span>
      </header>
      {#if logExpanded}
        <div class="logbook__editor">
          <textarea
            placeholder={$t('session.logbook.placeholder')}
            bind:value={draftNote}
            rows="4"
          ></textarea>
          <button class="btn primary" type="button" on:click={addNote}>{$t('session.logbook.add_entry')}</button>
        </div>
        <div class="logbook__entries">
          {#if logEntries.length === 0}
            <p class="hint">{$t('session.logbook.empty')}</p>
          {:else}
            {#each logEntries as entry, index}
              <div class="log-entry">
                <div class="log-entry__meta">{entry.stamp} — {$t('session.logbook.entry_label', { num: logEntries.length - index })}</div>
                <p>{entry.text}</p>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </section>

    <section class={`panel victory-panel ${victoryExpanded ? 'expanded' : 'collapsed'}`}>
      <header
        class="panel__header collapsible"
        role="button"
        tabindex="0"
        on:click={() => (victoryExpanded = !victoryExpanded)}
        on:keydown={(event) => (event.key === 'Enter' || event.key === ' ') && (victoryExpanded = !victoryExpanded)}
      >
        <div>
          <p class="eyebrow">{$t('session.victory.label')}</p>
          <h2>{$t('session.victory.subtitle')}</h2>
        </div>
        <span class="caret">{victoryExpanded ? '˄' : '˅'}</span>
      </header>
      {#if victoryExpanded}
        <div class="victory-grid">
          {#each victoryChecklist as item}
            <label class="victory-item">
              <input
                type="checkbox"
                checked={victoryStates[item.id]}
                on:change={() => toggleVictory(item.id)}
              />
              <span>{$t(item.key)}</span>
            </label>
          {/each}
        </div>
      {/if}
    </section>
  </main>

  <Footbar>
    <div slot="actions" class="session-dock">
      <div class="dock-left">
        <span class={`status-pill status-pill--${sessionStatus}`}>{$t(`status.${sessionStatus}`)}</span>
        <span class="phase-label">{phaseLabel()}</span>
        {#if subphaseLabel()}
          <span class="subphase">{subphaseLabel()}</span>
        {/if}
      </div>
      <div class="dock-controls">
        <button class="btn secondary btn--size-sm" type="button" on:click={prevPhase} disabled={currentPhaseIndex <= lockedThroughIndex}>{$t('session.controls.previous')}</button>
        <button class="btn secondary btn--size-sm" type="button" on:click={nextPhase} disabled={currentPhaseIndex >= phases.length - 1}>{$t('session.controls.next')}</button>
        <button class="btn ghost btn--size-sm" type="button" on:click={closeDay}>{$t('session.controls.close_day')}</button>
        <button class="btn ghost btn--size-sm" type="button" on:click={pauseSession}>{sessionStatus === 'paused' ? $t('session.controls.resume') : $t('session.controls.pause')}</button>
        <button class="btn danger btn--size-sm" type="button" on:click={finishSession} disabled={!finishEnabled}>{$t('session.controls.finish')}</button>
        <button class="btn danger btn--size-sm" type="button" on:click={cancelSession}>{$t('session.controls.cancel')}</button>
      </div>
    </div>
  </Footbar>
</div>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .session-main {
    width: min(var(--page-width-main), 95vw);
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: calc(var(--bar-height) + 2rem) 1rem clamp(2.5rem, 5vw, 3.5rem);
    box-sizing: border-box;
  }

  .panel {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: clamp(1.25rem, 3vw, 1.75rem);
    display: grid;
    gap: var(--space-3);
    box-shadow: var(--shadow-soft);
  }

  .panel__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .collapsible {
    cursor: pointer;
    user-select: none;
  }

  .caret {
    margin-left: auto;
    font-size: 1.1rem;
  }

  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.78rem;
    color: var(--color-white-muted);
    margin: 0 0 0.2rem 0;
  }

  .distribution-panel h1 {
    margin: 0;
  }

  .panel__meta {
    color: var(--color-white-muted);
    font-size: 0.9rem;
  }

  .distribution-panel {
    position: relative;
  }

.distribution-panel.fullscreen {
  position: fixed;
  inset: 12px;
  z-index: 2000;
  padding: var(--space-4);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
}

.distribution-board {
  flex: 1;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  position: relative;
  overflow: hidden;
  min-height: 420px;
  margin-top: 0.5rem;
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.04), transparent 60%);
  touch-action: none;
  height: 100%;
}

  .board-empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    color: var(--color-white-muted);
    text-align: center;
  }

  .role-token {
    position: absolute;
    left: var(--x);
    top: var(--y);
    transform: translate(-50%, -50%);
    width: 110px;
    color: var(--color-white-contrast);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.05rem;
    padding: 0.1rem 0.1rem 0.2rem;
    font-weight: 600;
    cursor: grab;
    background: transparent;
    border: none;
  }

  .role-token:active {
    cursor: grabbing;
  }

  .token-player {
    font-size: 0.75rem;
    color: var(--color-white-muted);
    min-height: 1em;
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .token-player--placeholder {
    visibility: hidden;
  }

  .token-circle {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .token-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
  }

  .token-initials {
    font-size: 1.6rem;
    font-weight: 700;
  }

  .token-role {
    font-size: 0.85rem;
    text-align: center;
  }

  .phase-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-3);
  }

  .phase-card {
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: var(--space-3);
    background: rgba(255, 255, 255, 0.02);
  }

  .phase-card h3 {
    margin: 0 0 0.4rem 0;
  }

  .phase-card ul {
    margin: 0;
    padding-left: 1.1rem;
    color: var(--color-white-muted);
    line-height: 1.5;
  }

  .logbook__editor {
    display: grid;
    gap: var(--space-2);
  }

  textarea {
    width: 100%;
    border-radius: 14px;
    border: 1px solid var(--glass-border);
    background: var(--surface-input);
    color: var(--color-white-contrast);
    padding: 0.9rem 1rem;
    font: inherit;
  }

  .logbook__entries {
    display: grid;
    gap: var(--space-2);
  }

  .log-entry {
    border: 1px solid var(--glass-border);
    border-radius: 14px;
    padding: var(--space-3);
    background: rgba(255, 255, 255, 0.02);
  }

  .log-entry__meta {
    color: var(--color-white-muted);
    font-size: 0.9rem;
    margin-bottom: 0.25rem;
  }

  .victory-panel .victory-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.5rem 1rem;
  }

  .victory-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    color: var(--color-white-contrast);
  }

  .status-pill {
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-pill--in_progress { background: var(--state-in-progress); color: var(--color-text-invert); }
  .status-pill--paused { background: var(--state-waiting); color: var(--color-text-invert); }
  .status-pill--finished { background: var(--state-gold-brand, var(--color-gold-brand)); color: var(--color-text-invert); }
  .status-pill--cancelled { background: var(--color-rose-500); color: var(--color-white-contrast); }

  .phase-label { font-weight: 700; }
  .subphase { color: var(--color-white-muted); }

  .session-dock {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.25rem 0.5rem;
  }

  .dock-left {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .dock-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .panel__header { flex-direction: column; }
    .dock-controls {
      width: 100%;
      justify-content: flex-start;
    }
  }
</style>

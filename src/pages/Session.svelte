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
  let finishEnabled = false;
  let loversLinks = [];
  let protectedTargets = [];
  let pendingDeaths = [];
  let infectedTargets = [];
  let consumedSpecialIds = [];
  let deadCharacters = [];
  let victoryResult = {};
  $: loverSet = new Set(loversLinks.flat?.() ?? loversLinks.reduce((acc, pair) => acc.concat(pair), []));
  $: deadSet = new Set(deadCharacters);

  const roleAliases = {
    // Canonical aliases to catch variants/translation leftovers in selections and steps
    bad: 'bad',
    big_bad_wolf: 'bad',
    wolf_hound: 'hound',
    white_werewolf: 'white',
    cursed_wolf_father: 'father',
    wandering_judge: 'judge',
    judge: 'judge',
    the_judge: 'judge',
    the_wandering_judge: 'judge',
    bear_tamer: 'tamer',
    wild_child: 'child',
    two_sisters: 'sisters',
    three_brothers: 'brothers',
    prejudiced_manipulator: 'manipulator'
  };

  const normalizeRoleSlug = (slug = '') => {
    const normalized = slugifyRole(slug);
    return roleAliases[normalized] ?? normalized;
  };

  $: roleSet = (() => {
    const set = new Set();
    if (!selection) return set;
    Object.values(selection ?? {}).forEach((category) => {
      Object.keys(category ?? {}).forEach((role) => {
        const normalized = slugifyRole(role);
        set.add(normalized);
        set.add(normalizeRoleSlug(normalized));
      });
    });
    return set;
  })();

  $: specialTokens = tokens?.filter((token) => token.category === 'special') ?? [];
  $: characterTokens = tokens?.filter((token) => token.category !== 'special') ?? [];

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
        { key: 'wandering_judge', requires: ['wandering_judge', 'judge', 'the_judge'] },
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
        { key: 'werewolves', requires: ['werewolf', 'wolf_hound', 'wild_child', 'cursed_wolf_father', 'white_werewolf', 'big_bad_wolf', 'bad'] },
        { key: 'baker', requires: ['baker'] },
        { key: 'white_werewolf', requires: ['white_werewolf'] },
        { key: 'cursed_wolf_father', requires: ['cursed_wolf_father'] },
        { key: 'big_bad_wolf', requires: ['big_bad_wolf', 'bad'] },
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

  const hasAnyRole = (required = []) =>
    required.some((slug) => {
      const normalized = slugifyRole(slug);
      if (roleSet.has(normalized)) return true;
      const alias = normalizeRoleSlug(normalized);
      return alias ? roleSet.has(alias) : false;
    });

  $: phases = phaseBlocks
    .map((phase) => {
      const steps = phase.steps.filter((step) => {
        if (!step.requires || step.requires.length === 0) return true;
        return hasAnyRole(step.requires);
      });
      return { ...phase, steps };
    })
    .filter((phase) => phase.steps.length > 0);
  $: if (currentPhaseIndex >= phases.length) {
    currentPhaseIndex = Math.max(0, phases.length - 1);
  }
  $: finishEnabled = sessionStatus === 'finished' || Object.values(victoryResult).some(Boolean);

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
    const characters = tokens.filter((token) => token.category !== 'special');
    const specials = tokens.filter((token) => token.category === 'special');

    const columns = Math.max(1, Math.ceil(Math.sqrt(characters.length || 1)));
    const rows = Math.max(1, Math.ceil((characters.length || 1) / columns));
    const xRange = characterArea.xMax - characterArea.xMin;
    const yRange = characterArea.yMax - characterArea.yMin;

    const next = {};

    characters.forEach((token, index) => {
      if (positions[token.id]) {
        next[token.id] = positions[token.id];
      } else {
        const col = index % columns;
        const row = Math.floor(index / columns);
        next[token.id] = {
          x: characterArea.xMin + ((col + 1) / (columns + 1)) * xRange,
          y: characterArea.yMin + ((row + 1) / (rows + 1)) * yRange
        };
      }
    });

    specials.forEach((token, index) => {
      if (positions[token.id]) {
        next[token.id] = positions[token.id];
      } else {
        next[token.id] = palettePosition(index, specials.length);
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
    const x = Math.min(characterArea.xMax, Math.max(characterArea.xMin, relativeX));
    const y = Math.min(characterArea.yMax, Math.max(characterArea.yMin, relativeY));
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
    resolveBoardEffects();
    resetSpecialPositions();
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

  const TARGET_SNAP_DISTANCE = 8; // percentage distance threshold to consider a token placed on a character

  const uniqueList = (list = []) => Array.from(new Set(list));
  const addToSet = (existing = [], items = []) => {
    const set = new Set(existing);
    items.forEach((item) => item && set.add(item));
    return Array.from(set);
  };

  const getTokenById = (id) => tokens.find((token) => token.id === id);

  const nameForToken = (tokenId) => {
    const token = getTokenById(tokenId);
    if (!token) return tokenId;
    const baseName = token.player ? `${token.role} (${token.player})` : token.role;
    return baseName || tokenId;
  };

  function resolveBoardEffects() {
    if (!tokens?.length) return;
    const characters = tokens.filter((token) => token.category !== 'special');
    const specials = tokens.filter((token) => token.category === 'special');

    const specialPlacements = [];

    const findCharacterTarget = (special) => {
      const origin = positions[special.id];
      if (!origin) return null;
      let best = null;
      let bestDistance = TARGET_SNAP_DISTANCE;
      characters.forEach((character) => {
        const pos = positions[character.id];
        if (!pos) return;
        const dx = pos.x - origin.x;
        const dy = pos.y - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= bestDistance) {
          bestDistance = distance;
          best = character.id;
        }
      });
      return best;
    };

    const specialTargets = specials.reduce((acc, special) => {
      const target = findCharacterTarget(special);
      if (!target) return acc;
      const key = slugifyRole(special.role);
      const record = { targetId: target, tokenId: special.id };
      acc[key] = acc[key] ?? [];
      acc[key].push(record);
      specialPlacements.push(record);
      return acc;
    }, {});

    const cupidEntries = specialTargets.cupid_hearts ?? [];
    const cupidTargets = uniqueList(cupidEntries.map((entry) => entry.targetId));
    const defenderTargets = uniqueList((specialTargets.defender_shield ?? []).map((entry) => entry.targetId));
    const healTargets = uniqueList((specialTargets.witch_heal ?? []).map((entry) => entry.targetId));
    const venomTargets = uniqueList((specialTargets.witch_venom ?? []).map((entry) => entry.targetId));
    const wolfTargets = uniqueList((specialTargets.werewolves_claws ?? []).map((entry) => entry.targetId));
    const infectionTargets = uniqueList(
      [...(specialTargets.cursed_wolf_father ?? []), ...(specialTargets.father_bite ?? [])].map((entry) => entry.targetId)
    );
    const usedPotionIds = [
      ...(specialTargets.witch_heal ?? []).map((entry) => entry.tokenId),
      ...(specialTargets.witch_venom ?? []).map((entry) => entry.tokenId)
    ];
    const usedCupidIds = cupidEntries.map((entry) => entry.tokenId);

    const loversSet = new Set(loversLinks.map((pair) => pair.join('|')));
    if (cupidTargets.length >= 2) {
      const [first, second] = cupidTargets;
      const pair = [first, second].sort();
      const key = pair.join('|');
      if (!loversSet.has(key)) loversSet.add(key);
    }
    const lovers = Array.from(loversSet).map((pair) => pair.split('|'));

    const deaths = new Set([...wolfTargets, ...venomTargets]);
    healTargets.forEach((id) => deaths.delete(id));
    defenderTargets.forEach((id) => deaths.delete(id));

    deadCharacters.forEach((id) => deaths.add(id)); // keep previous deaths

    lovers.forEach(([a, b]) => {
      if (deaths.has(a)) deaths.add(b);
      if (deaths.has(b)) deaths.add(a);
    });

    const isFirstNight =
      phases[currentPhaseIndex]?.titleKey === 'session.phases.first_night.title' ||
      phases[currentPhaseIndex]?.subtitleKey === 'session.phases.first_night.subtitle';
    const angelId = characters.find((token) => slugifyRole(token.role) === 'angel')?.id;
    const angelFalls = angelId && deaths.has(angelId) && isFirstNight;

    const summary = [];
    const loversNames = lovers.map(([a, b]) => `${nameForToken(a)} ❤️ ${nameForToken(b)}`);
    if (loversNames.length) summary.push(`${$t('session.phases.steps.lovers')}: ${loversNames.join(', ')}`);
    if (defenderTargets.length) summary.push(`${$t('session.phases.steps.defender')}: ${defenderTargets.map(nameForToken).join(', ')}`);
    if (healTargets.length) summary.push(`${$t('session.phases.steps.witch')} (heal): ${healTargets.map(nameForToken).join(', ')}`);
    if (venomTargets.length) summary.push(`${$t('session.phases.steps.witch')} (venom): ${venomTargets.map(nameForToken).join(', ')}`);
    if (wolfTargets.length) summary.push(`${$t('session.phases.steps.werewolves')}: ${wolfTargets.map(nameForToken).join(', ')}`);
    if (infectionTargets.length) summary.push(`${$t('session.phases.steps.cursed_wolf_father')}: ${infectionTargets.map(nameForToken).join(', ')}`);
    if (deaths.size) summary.push(`${$t('session.victory.werewolves') || 'Eliminations'}: ${Array.from(deaths).map(nameForToken).join(', ')}`);
    if (angelFalls) summary.push(`${$t('session.victory.angel') || 'Angel wins'} — ${$t('session.controls.finish')}`);

    if (summary.length) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [{ text: summary.join(' | '), stamp }, ...logEntries];
    }

    loversLinks = lovers;
    protectedTargets = defenderTargets;
    pendingDeaths = Array.from(deaths);
    deadCharacters = addToSet(deadCharacters, Array.from(deaths));
    infectedTargets = infectionTargets;
    consumedSpecialIds = addToSet(consumedSpecialIds, [...usedPotionIds, ...usedCupidIds]);
    victoryResult = evaluateVictory(characters, deadCharacters, lovers);

    if (angelFalls) {
      sessionStatus = 'finished';
    }
  }

  function evaluateVictory(characters = [], deadList = [], lovers = []) {
    const dead = new Set(deadList);
    const alive = characters.filter((token) => !dead.has(token.id));
    const aliveWolves = alive.filter((token) => token.category === 'werewolves').length;
    const aliveOthers = alive.length - aliveWolves;
    const villageWins = alive.length > 0 && aliveWolves === 0;
    const werewolvesWin = aliveWolves > 0 && aliveWolves >= aliveOthers;

    let loversWin = false;
    if (lovers.length) {
      const loverIds = new Set(lovers.flat());
      const aliveIds = new Set(alive.map((token) => token.id));
      const allAliveAreLovers = alive.every((token) => loverIds.has(token.id));
      const allLoversAlive = Array.from(loverIds).every((id) => aliveIds.has(id));
      loversWin = loverIds.size > 0 && allAliveAreLovers && allLoversAlive;
    }

    return {
      village: villageWins,
      werewolves: werewolvesWin,
      lovers: loversWin,
      piper: false,
      angel: false,
      draw: false
    };
  }

  const paletteArea = {
    startX: 6.5,
    endX: 21.5,
    startY: 15,
    endY: 85,
    columns: 2
  };

  const characterArea = {
    xMin: 30,
    xMax: 95,
    yMin: 8,
    yMax: 92
  };

  const palettePosition = (index, total) => {
    const cols = Math.min(paletteArea.columns, Math.max(1, total));
    const rows = Math.max(1, Math.ceil(total / cols));
    const col = index % cols;
    const row = Math.floor(index / cols);
    const xPad = 1.6;
    const yPad = 1.1;
    const xMin = paletteArea.startX + xPad;
    const xMax = paletteArea.endX - xPad;
    const yMin = paletteArea.startY + yPad;
    const yMax = paletteArea.endY - yPad;
    const idealStep = cols > 1 ? (xMax - xMin) / (cols - 1) : (xMax - xMin) / 2;
    const yStepRaw = rows > 1 ? (yMax - yMin) / (rows - 1) : (yMax - yMin) / 2;
    const step = Math.min(idealStep, yStepRaw);

    const gridWidth = step * (cols - 1);
    const gridHeight = step * (rows - 1);
    const xStart = cols > 1 ? (xMin + xMax - gridWidth) / 2 : (xMin + xMax) / 2;
    const yStart = rows > 1 ? (yMin + yMax - gridHeight) / 2 : (yMin + yMax) / 2;

    return {
      x: xStart + col * step,
      y: yStart + row * step
    };
  };

  function resetSpecialPositions() {
    if (!tokens?.length) return;
    const specials = tokens.filter((token) => token.category === 'special');
    const next = { ...positions };
    specials.forEach((token, index) => {
      next[token.id] = palettePosition(index, specials.length);
    });
    positions = next;
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
        <div class="token-palette" aria-hidden={specialTokens.length === 0}>
          {#each specialTokens as token}
            <button
              type="button"
              class={`role-token category-${token.category} token-action ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''} ${activeId !== token.id ? 'palette-item' : ''}`}
              style={`--x:${positions[token.id]?.x ?? 50}%; --y:${positions[token.id]?.y ?? 50}%;`}
              title={token.role}
              disabled={consumedSpecialIds.includes(token.id)}
              on:pointerdown={(event) => handlePointerDown(token, event)}
            >
              <span class="token-player token-player--placeholder"></span>
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
        </div>

        {#if characterTokens.length === 0}
          <p class="board-empty">{$t('configure.role_preview_empty')}</p>
        {:else}
          {#each characterTokens as token}
            <button
              type="button"
              class={`role-token category-${token.category} ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''} ${loverSet.has(token.id) ? 'token-lover' : ''} ${deadSet.has(token.id) ? 'token-dead' : ''}`}
              style={`--x:${positions[token.id]?.x ?? 50}%; --y:${positions[token.id]?.y ?? 50}%;`}
              title={token.role}
              disabled={consumedSpecialIds.includes(token.id)}
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
              {#if loverSet.has(token.id)}
                <span class="token-badge token-badge--lover" aria-hidden="true">♥</span>
              {/if}
              {#if deadSet.has(token.id)}
                <span class="token-badge token-badge--dead" aria-hidden="true">✖</span>
              {/if}
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
    grid-template-rows: auto 1fr;
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
.distribution-panel.fullscreen .distribution-board {
  min-height: calc(100vh - (var(--bar-height) * 2) - 3rem);
}

  .distribution-board {
    flex: 1;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-lg);
    position: relative;
    overflow: hidden;
    min-height: 520px;
    margin-top: 0;
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

  .token-action {
    width: 68px;
    padding: 0.05rem 0.05rem 0.15rem;
  }

  .token-action .token-circle {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    aspect-ratio: 1 / 1;
  }

  .token-action .token-initials {
    font-size: 1.05rem;
  }

  .token-action .token-role {
    display: none;
  }

  .palette-item {
    position: static;
    transform: none;
    left: auto;
    top: auto;
    width: 100%;
    justify-self: center;
  }

  .token-consumed {
    opacity: 0.45;
    filter: grayscale(0.9);
    cursor: not-allowed;
  }

  .token-consumed .token-circle {
    border-style: dashed;
  }

  .token-lover::after {
    content: '♥';
    position: absolute;
    top: 4px;
    right: 6px;
    font-size: 0.95rem;
    color: #ff6fa2;
    text-shadow: 0 0 6px rgba(255, 111, 162, 0.7);
    pointer-events: none;
  }

  .token-dead {
    opacity: 0.55;
    filter: grayscale(0.85);
  }

  .token-dead .token-circle {
    border-color: rgba(255, 255, 255, 0.2);
  }

  .token-badge {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    font-weight: 800;
    color: var(--color-white-contrast);
    text-shadow: 0 0 6px rgba(0, 0, 0, 0.65);
  }

  .token-badge--dead {
    font-size: 1.2rem;
  }

  .token-palette {
    position: absolute;
    top: 6%;
    bottom: 6%;
    left: 3%;
    width: 17%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-lg);
    padding: var(--space-2);
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(8px);
    box-shadow: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    place-content: center;
    align-content: center;
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

<script>
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { slugifyRole, roleImageSrc } from '../lib/roles.js';
  import { createEventDispatcher } from 'svelte';
  import { getSessionPositions, setRolePosition } from '../lib/stores/rolePositions.js';

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
  let charmedTargets = [];
  let consumedSpecialIds = [];
  let deadCharacters = [];
  let victoryResult = {};
  let sheriffHolderId = null;
  let sheriffAvailable = true;
  let sheriffDisabled = false;
  let preparationResolved = false;
  let nightNumber = 0;
  let dayNumber = 0;
  $: sessionKey = sessionId ?? 'default';
  let lastProtectedTargets = [];
  let activeSpecialIds = [];
  $: activeSpecialTokens = (specialTokens ?? []).filter((token) => activeSpecialIds.includes(token.id));
  $: loverSet = new Set(loversLinks.flat?.() ?? loversLinks.reduce((acc, pair) => acc.concat(pair), []));
  $: loverIdsSet = new Set(loverSet);
  $: deadSet = new Set(deadCharacters);
  $: infectedIdSet = new Set(infectedTargets);
  $: console.info('[session] infected state', { infectedTargets, infectedIdSet: Array.from(infectedIdSet) });
  let elderResilience = new Set();

  const dispatch = createEventDispatcher();

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
  const infectedSlugMap = {
    the_two_sisters: 'sisters',
    two_sisters: 'sisters',
    sisters: 'sisters',
    the_three_brothers: 'brothers',
    three_brothers: 'brothers',
    brothers: 'brothers',
    the_cupid: 'cupid',
    cupid: 'cupid',
    the_seer: 'seer',
    seer: 'seer'
  };

  const PHASE_KEY_PREPARATION = 'session.phases.preparation.title';
  const PHASE_KEY_FIRST_NIGHT = 'session.phases.first_night.title';
  const PHASE_KEY_FIRST_DAY = 'session.phases.first_day.title';
  const PHASE_KEY_EACH_NIGHT = 'session.phases.each_night.title';
  const PHASE_KEY_EACH_DAY = 'session.phases.each_day.title';
  const PHASE_ORDER_KEYS = [
    PHASE_KEY_PREPARATION,
    PHASE_KEY_FIRST_NIGHT,
    PHASE_KEY_FIRST_DAY,
    PHASE_KEY_EACH_NIGHT,
    PHASE_KEY_EACH_DAY
  ];

  const canonicalInfectedSlug = (slug = '') => {
    if (!slug) return '';
    const normalized = slugifyRole(slug);
    const alias = roleAliases[normalized];
    const mapped =
      infectedSlugMap[normalized] ||
      (alias ? infectedSlugMap[alias] : null) ||
      (normalized.startsWith('the_') ? normalized.slice(4) : null);
    return mapped || normalized;
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

  const dayPhaseSteps = [
    { key: 'victims' },
    { key: 'bear_grunt', requires: ['bear_tamer'] },
    { key: 'medium', requires: ['gypsy'] },
    { key: 'town_crier', requires: ['town_crier'] },
    { key: 'debate' },
    { key: 'vote' },
    { key: 'angel', requires: ['angel'] },
    { key: 'second_vote', requires: ['wandering_judge'] }
  ];

  const phaseBlocks = [
    {
      titleKey: PHASE_KEY_PREPARATION,
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
      titleKey: PHASE_KEY_FIRST_NIGHT,
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
      titleKey: PHASE_KEY_FIRST_DAY,
      subtitleKey: 'session.phases.first_day.subtitle',
      steps: dayPhaseSteps
    },
    {
      titleKey: PHASE_KEY_EACH_NIGHT,
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
      titleKey: PHASE_KEY_EACH_DAY,
      subtitleKey: 'session.phases.each_day.subtitle',
      steps: dayPhaseSteps
    }
  ];

  const hasAnyRole = (required = []) =>
    required.some((slug) => {
      const normalized = slugifyRole(slug);
      if (roleSet.has(normalized)) return true;
      const alias = normalizeRoleSlug(normalized);
      return alias ? roleSet.has(alias) : false;
    });

  $: phases = phaseBlocks.map((phase) => {
    const steps = phase.steps.filter((step) => {
      if (!step.requires || step.requires.length === 0) return true;
      return hasAnyRole(step.requires);
    });
    return { ...phase, steps };
  });
  $: if (currentPhaseIndex >= phases.length) {
    currentPhaseIndex = Math.max(0, phases.length - 1);
  }
  $: finishEnabled = sessionStatus === 'finished' || Object.values(victoryResult).some(Boolean);

  $: currentPhaseKeyValue = PHASE_ORDER_KEYS[Math.min(currentPhaseIndex, PHASE_ORDER_KEYS.length - 1)];
  $: currentPhaseLabel = (() => {
    const key = currentPhaseKeyValue;
    if (!key) return '—';
    return $t(key) || '—';
  })();
  $: console.info('[session] phase reactive', {
    currentPhaseIndex,
    currentPhaseKeyValue,
    currentPhaseLabel,
    phasesKeys: phases.map((p) => p.titleKey)
  });

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
    const characters = characterTokens;
    const specials = specialTokens;
    const savedPositions = getSessionPositions(sessionKey);

    const columns = Math.max(1, Math.ceil(Math.sqrt(characters.length || 1)));
    const rows = Math.max(1, Math.ceil((characters.length || 1) / columns));
    const xRange = characterArea.xMax - characterArea.xMin;
    const yRange = characterArea.yMax - characterArea.yMin;

    const next = {};

    characters.forEach((token, index) => {
      if (positions[token.id]) {
        next[token.id] = positions[token.id];
      } else if (savedPositions[token.id]) {
        next[token.id] = savedPositions[token.id];
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
    const token = getTokenById(activeId);
    if (token && token.category !== 'special') {
      setRolePosition(sessionKey, activeId, { x, y });
    }
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

  const phaseIndexByKey = (key) => phases.findIndex((phase) => phase.titleKey === key);
  $: isPreparationPhase = currentPhaseKeyValue === PHASE_KEY_PREPARATION;
  $: isFirstNightPhase = currentPhaseKeyValue === PHASE_KEY_FIRST_NIGHT;
  $: isEachNightPhase = currentPhaseKeyValue === PHASE_KEY_EACH_NIGHT;
  $: isNightPhase = isFirstNightPhase || isEachNightPhase;
  $: isFirstDayPhase = currentPhaseKeyValue === PHASE_KEY_FIRST_DAY;
  $: isEachDayPhase = currentPhaseKeyValue === PHASE_KEY_EACH_DAY;
  $: isDayPhase = isFirstDayPhase || isEachDayPhase;
  $: console.info('[session] phase flags', {
    isPreparationPhase,
    isFirstNightPhase,
    isEachNightPhase,
    isNightPhase,
    isFirstDayPhase,
    isEachDayPhase,
    isDayPhase
  });

  function advancePhase(currentKey = currentPhaseKey()) {
    if (currentPhaseIndex < phases.length - 1) {
      currentPhaseIndex += 1;
      console.info('[session] advancePhase', {
        from: currentKey,
        toIndex: currentPhaseIndex,
        toKey: PHASE_ORDER_KEYS[Math.min(currentPhaseIndex, PHASE_ORDER_KEYS.length - 1)],
        phases: phases.map((p) => p.titleKey),
        orderKeys: PHASE_ORDER_KEYS
      });
    }
  }

  function evaluatePhase() {
    const phaseKeyNow = PHASE_ORDER_KEYS[Math.min(currentPhaseIndex, PHASE_ORDER_KEYS.length - 1)];
    console.info('[session] evaluatePhase', {
      phaseKeyNow,
      currentIndex: currentPhaseIndex,
      phases: phases.map((p) => p.titleKey),
      orderKeys: PHASE_ORDER_KEYS,
      nightNumber,
      dayNumber,
      isPreparationPhase,
      isNightPhase,
      isDayPhase
    });
    resolveBoardEffects(phaseKeyNow);
    lockedThroughIndex = Math.max(lockedThroughIndex, currentPhaseIndex);
    if (phaseKeyNow === PHASE_KEY_PREPARATION) {
      preparationResolved = true;
    }
    if (phaseKeyNow === PHASE_KEY_FIRST_NIGHT) {
      nightNumber = 1;
    } else if (phaseKeyNow === PHASE_KEY_EACH_NIGHT) {
      nightNumber = Math.max(1, nightNumber + 1);
    }
    if (phaseKeyNow === PHASE_KEY_FIRST_DAY) {
      dayNumber = 1;
    } else if (phaseKeyNow === PHASE_KEY_EACH_DAY) {
      dayNumber = Math.max(1, dayNumber + 1);
    }
    advancePhase(phaseKeyNow);
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

  function finishSession() {
    sessionStatus = 'finished';
  }

  function cancelSession() {
    sessionStatus = 'cancelled';
  }

  function goToConfigure() {
    dispatch('configure', { sessionId });
  }

  const TARGET_SNAP_DISTANCE = 14; // percentage distance threshold to consider a token placed on a character

  const uniqueList = (list = []) => Array.from(new Set(list));
  const addToSet = (existing = [], items = []) => {
    const set = new Set(existing);
    items.forEach((item) => item && set.add(item));
    return Array.from(set);
  };

  const findTargetForSpecial = (specialId, characterList = []) => {
    if (!specialId || !positions[specialId]) return null;
    const origin = positions[specialId];
    const characters = characterList.length ? characterList : tokens.filter((t) => t.category !== 'special');
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

  const getTokenById = (id) => tokens.find((token) => token.id === id);

  function convertAngelToVillager(angelId) {
    tokens = tokens.map((token) => {
      if (token.id !== angelId) return token;
      return {
        ...token,
        role: 'Villager',
        category: 'villagers',
        image: roleImageSrc('villagers', 'villager')
      };
    });
  }

  const infectedImageFor = (token) => {
    const baseCategory = token.category;
    const finalSlug = canonicalInfectedSlug(token.role);
    return `/roles/infected/${baseCategory}/wolf-${finalSlug}.png`;
  };

  const displayCategory = (token) => (infectedIdSet.has(token.id) ? 'werewolves' : token.category);
  const displayImage = (token) => {
    if (infectedIdSet.has(token.id)) {
      const path = infectedImageFor(token);
      console.info('[session] display infected image', { id: token.id, role: token.role, path });
      return path;
    }
    return token.image;
  };
  const isSheriffToken = (token) => slugifyRole(token?.role) === 'sheriff_badge';
  const sheriffPhaseEligible = () =>
    !sheriffDisabled && (isPreparationPhase || isFirstDayPhase || isEachDayPhase);

  function deploySpecialToken(token) {
    if (!token || token.category !== 'special') return;
    const slug = slugifyRole(token.role);
    if (sheriffDisabled && slug === 'sheriff_badge') return;
    // Phase gating
    if (isPreparationPhase) {
      if (slug !== 'sheriff_badge') return;
    } else if (isNightPhase) {
      if (slug === 'sheriff_badge' || slug === 'villagers_elimination') return;
    } else if (isDayPhase) {
      if (slug !== 'villagers_elimination') return;
    }
    if (slug === 'sheriff_badge' && !sheriffPhaseEligible()) return;
    // Father bite auto-target: attach to the current werewolf claws target if present.
    if (slug === 'cursed_wolf_father' || slug === 'father_bite') {
      const clawsId = activeSpecialIds.find((id) => slugifyRole(getTokenById(id)?.role) === 'werewolves_claws');
      console.info('[session] deploy father-bite', { clawsId, activeSpecialIds, positions });
      if (!clawsId) return;
      const target = findTargetForSpecial(clawsId);
      console.info('[session] father-bite target', { target });
      if (!target) return;
      positions = { ...positions, [token.id]: positions[target] };
      activeSpecialIds = [...activeSpecialIds, token.id];
      return;
    }
    if (consumedSpecialIds.includes(token.id) || activeSpecialIds.includes(token.id)) return;
    const index = activeSpecialIds.length;
    const pos = deployedPosition(index);
    positions = { ...positions, [token.id]: pos };
    activeSpecialIds = [...activeSpecialIds, token.id];
  }

  const nameForToken = (tokenId) => {
    const token = getTokenById(tokenId);
    if (!token) return tokenId;
    const baseName = token.player ? `${token.role} (${token.player})` : token.role;
    return baseName || tokenId;
  };

  function resolveBoardEffects(currentPhaseKeyValue = currentPhaseKey()) {
    if (!tokens?.length) return;
    const characters = tokens.filter((token) => token.category !== 'special');
    const specials = tokens.filter((token) => token.category === 'special');
    const phaseKeyNow = currentPhaseKeyValue || currentPhaseKey();
    const isFirstNight = phaseKeyNow === PHASE_KEY_FIRST_NIGHT && nightNumber === 0;
    const isFirstDay = phaseKeyNow === PHASE_KEY_FIRST_DAY && dayNumber === 0;
    const previousSheriff = sheriffHolderId;

    const specialPlacements = [];
    const sheriffToken = specials.find((token) => slugifyRole(token.role) === 'sheriff_badge');
    const sheriffTokenId = sheriffToken?.id;
    const allowedSpecials = specials.filter((token) => {
      const slug = slugifyRole(token.role);
      if (isPreparationPhase) return slug === 'sheriff_badge';
      if (isNightPhase) return slug !== 'sheriff_badge' && slug !== 'villagers_elimination';
      if (isDayPhase) return slug === 'villagers_elimination' || slug === 'sheriff_badge';
      return true;
    });
    console.info('[session] specials filter', {
      phaseKeyNow,
      isPreparationPhase,
      isNightPhase,
      isDayPhase,
      allowed: allowedSpecials.map((t) => slugifyRole(t.role))
    });

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

    const specialTargets = allowedSpecials.reduce((acc, special) => {
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
    const defenderEntries = specialTargets.defender_shield ?? [];
    const defenderTargetsRaw = defenderEntries.map((entry) => entry.targetId);
    const defenderTargets = uniqueList(defenderTargetsRaw);
    const healTargets = uniqueList((specialTargets.witch_heal ?? []).map((entry) => entry.targetId));
    const venomTargets = uniqueList((specialTargets.witch_venom ?? []).map((entry) => entry.targetId));
    const wolfTargets = uniqueList((specialTargets.werewolves_claws ?? []).map((entry) => entry.targetId));
    const eliminationTargets = uniqueList((specialTargets.villagers_elimination ?? []).map((entry) => entry.targetId));
    const infectionTargetsCurrent = uniqueList(
      [...(specialTargets.cursed_wolf_father ?? []), ...(specialTargets.father_bite ?? [])].map((entry) => entry.targetId)
    );
    // Ensure Father infection tracks the same target as the werewolves claws token.
    const specialsBySlug = (slug) =>
      specials.filter((token) => slugifyRole(token.role) === slug).map((token) => token.id);
    const clawsId = specialsBySlug('werewolves_claws').find((id) => activeSpecialIds.includes(id));
    const fatherId = specialsBySlug('cursed_wolf_father')
      .concat(specialsBySlug('father_bite'))
      .find((id) => activeSpecialIds.includes(id));
    if (clawsId && fatherId) {
      const clawsTarget = findTargetForSpecial(clawsId, characters);
      console.info('[session] resolve effects claws/father', {
        clawsId,
        fatherId,
        clawsTarget,
        positions,
        activeSpecialIds
      });
      if (clawsTarget) infectionTargetsCurrent.push(clawsTarget);
    }
    const infectionTargetsUnique = uniqueList(
      infectionTargetsCurrent.filter((id) => {
        const token = getTokenById(id);
        return token?.category && token.category !== 'werewolves';
      })
    );
    const sheriffAssignments = specialTargets.sheriff_badge ?? [];
    const sheriffTarget = sheriffAssignments[0]?.targetId ?? null;
    const piperTargets = uniqueList((specialTargets.piper_charm ?? []).map((entry) => entry.targetId));
    const usedPotionIds = [
      ...(specialTargets.witch_heal ?? []).map((entry) => entry.tokenId),
      ...(specialTargets.witch_venom ?? []).map((entry) => entry.tokenId)
    ];
    const usedCupidIds = cupidEntries.map((entry) => entry.tokenId);
    const usedPiperIds = (specialTargets.piper_charm ?? []).map((entry) => entry.tokenId);
    const usedFatherIds = [
      ...(specialTargets.cursed_wolf_father ?? []).map((entry) => entry.tokenId),
      ...(specialTargets.father_bite ?? []).map((entry) => entry.tokenId)
    ];

    const loversSet = new Set(loversLinks.map((pair) => pair.join('|')));
    if (cupidTargets.length >= 2) {
      const [first, second] = cupidTargets;
      const pair = [first, second].sort();
      const key = pair.join('|');
      if (!loversSet.has(key)) loversSet.add(key);
    } else {
      // No pareja completa: no consumimos corazones ni marcamos amantes
      cupidEntries.length = 0;
    }
    const lovers = Array.from(loversSet).map((pair) => pair.split('|'));
    const loverIds = new Set(lovers.flat());

    const deaths = new Set([...wolfTargets, ...venomTargets, ...eliminationTargets]);
    healTargets.forEach((id) => deaths.delete(id));
    const effectiveDefenders = defenderTargets.filter((id) => !lastProtectedTargets.includes(id));
    effectiveDefenders.forEach((id) => deaths.delete(id));
    // Infection overrides death for targets hit by wolves and marked by father bite.
    const isElder = (id) => canonicalInfectedSlug(getTokenById(id)?.role) === 'elder';

    const infectionSet = new Set(infectionTargetsUnique);
    infectionTargetsUnique.forEach((id) => {
      if (deaths.has(id) && wolfTargets.includes(id)) {
        deaths.delete(id);
      }
    });

    // Elder: primer impacto (garras y/o infección en la misma noche) se ignora por completo.
    const elderSkip = new Set();
    const elderTargets = uniqueList([...wolfTargets, ...infectionTargetsUnique]).filter(isElder);
    elderTargets.forEach((id) => {
      if (!elderResilience.has(id)) {
        elderResilience.add(id);
        deaths.delete(id);
        infectionSet.delete(id);
        elderSkip.add(id);
      }
    });

    const appliedInfections = [];
    infectionTargetsUnique.forEach((id) => {
      if (elderSkip.has(id)) return; // primer impacto ignorado
      appliedInfections.push(id);
    });
    console.info('[session] infection summary', {
      infectionTargetsUnique,
      appliedInfections,
      infectedAlready: infectedTargets,
      infectionSet: Array.from(new Set(appliedInfections)),
      wolfTargets,
      deaths: Array.from(deaths)
    });

    deadCharacters.forEach((id) => deaths.add(id)); // keep previous deaths

    lovers.forEach(([a, b]) => {
      if (deaths.has(a)) deaths.add(b);
      if (deaths.has(b)) deaths.add(a);
    });

    const angelId = characters.find((token) => slugifyRole(token.role) === 'angel')?.id;
    const nextNightNumber =
      nightNumber +
      (phaseKeyNow === PHASE_KEY_FIRST_NIGHT ? 1 : phaseKeyNow === PHASE_KEY_EACH_NIGHT ? 1 : 0);
    const nextDayNumber =
      dayNumber + (phaseKeyNow === PHASE_KEY_FIRST_DAY ? 1 : phaseKeyNow === PHASE_KEY_EACH_DAY ? 1 : 0);
    const angelFallsNight = angelId && (deaths.has(angelId) || infectionSet.has(angelId)) && isFirstNight;
    let angelWin = false;
    if (angelFallsNight) {
      angelWin = true;
      deaths.delete(angelId);
      infectionSet.delete(angelId);
    }
    const convertAfterCycle = nextNightNumber >= 1 && nextDayNumber >= 1;
    if (!angelWin && convertAfterCycle && angelId && !deaths.has(angelId) && !infectionSet.has(angelId)) {
      console.info('[session] angel converts to villager', { nightNumber, dayNumber, nextNightNumber, nextDayNumber });
      convertAngelToVillager(angelId);
    }

    const infectionsToApply = angelWin && angelId ? appliedInfections.filter((id) => id !== angelId) : appliedInfections;
    const summary = [];
    const sheriffNotes = [];
    const loversNames = lovers.map(([a, b]) => `${nameForToken(a)} ❤️ ${nameForToken(b)}`);
    if (loversNames.length) summary.push(`${$t('session.phases.steps.lovers')}: ${loversNames.join(', ')}`);
    const failedDefenders = defenderTargets.filter((id) => lastProtectedTargets.includes(id));
    if (effectiveDefenders.length) summary.push(`${$t('session.phases.steps.defender')}: ${effectiveDefenders.map(nameForToken).join(', ')}`);
    if (failedDefenders.length) summary.push(`${$t('session.phases.steps.defender')}: ${failedDefenders.map(nameForToken).join(', ')} (${ $t('session.phases.steps.defender') } failed)`);
    if (healTargets.length) summary.push(`${$t('session.phases.steps.witch')} (heal): ${healTargets.map(nameForToken).join(', ')}`);
    if (venomTargets.length) summary.push(`${$t('session.phases.steps.witch')} (venom): ${venomTargets.map(nameForToken).join(', ')}`);
    if (wolfTargets.length) summary.push(`${$t('session.phases.steps.werewolves')}: ${wolfTargets.map(nameForToken).join(', ')}`);
    if ((angelWin && infectionsToApply.length) || (!angelWin && appliedInfections.length)) {
      const list = angelWin ? infectionsToApply : appliedInfections;
      summary.push(`${$t('session.phases.steps.cursed_wolf_father')}: ${list.map(nameForToken).join(', ')}`);
    }
    if (piperTargets.length) summary.push(`${$t('session.phases.steps.piper') || 'Piper charms'}: ${piperTargets.map(nameForToken).join(', ')}`);
    if (deaths.size) summary.push(`${$t('session.victory.werewolves') || 'Eliminations'}: ${Array.from(deaths).map(nameForToken).join(', ')}`);
    if (angelFallsNight) {
      summary.push(`${$t('session.victory.angel') || 'Angel wins'} — ${$t('session.controls.finish')}`);
      finishEnabled = true;
      victoryResult = { ...victoryResult, angel: true };
    }

    // Ángel linchado en el primer día: victoria inmediata.
    if (!angelFallsNight && isFirstDay && angelId && deaths.has(angelId)) {
      angelWin = true;
      deaths.delete(angelId);
      infectionSet.delete(angelId);
      summary.push(`${$t('session.victory.angel') || 'Angel wins'} — ${$t('session.controls.finish')}`);
      finishEnabled = true;
      victoryResult = { ...victoryResult, angel: true };
    }

    if (sheriffTarget) {
      sheriffHolderId = sheriffTarget;
      sheriffAvailable = false;
      if (sheriffTokenId && !consumedSpecialIds.includes(sheriffTokenId)) {
        consumedSpecialIds = addToSet(consumedSpecialIds, [sheriffTokenId]);
        activeSpecialIds = activeSpecialIds.filter((id) => id !== sheriffTokenId);
      }
      if (previousSheriff !== sheriffTarget) {
        sheriffNotes.push(`${$t('session.sheriff.assigned')}: ${nameForToken(sheriffTarget)}`);
      }
    }

    const sheriffRoleSlug = sheriffHolderId ? slugifyRole(getTokenById(sheriffHolderId)?.role) : null;
    const sheriffLost = sheriffHolderId && deaths.has(sheriffHolderId);
    if (sheriffLost) {
      const lostName = nameForToken(sheriffHolderId);
      sheriffHolderId = null;
      if (sheriffRoleSlug === 'idiot') {
        sheriffDisabled = true;
        sheriffAvailable = false;
        sheriffNotes.push(`${$t('session.sheriff.lost')}: ${lostName} — badge retired`);
      } else {
        sheriffDisabled = false;
        sheriffAvailable = true;
        sheriffNotes.push(`${$t('session.sheriff.lost')}: ${lostName}`);
        if (sheriffTokenId) {
          consumedSpecialIds = consumedSpecialIds.filter((id) => id !== sheriffTokenId);
        }
      }
    }

    if (summary.length) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [{ text: summary.join(' | '), stamp }, ...logEntries];
    }
    if (sheriffNotes.length) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [{ text: sheriffNotes.join(' | '), stamp }, ...logEntries];
    }

    loversLinks = lovers;
    protectedTargets = defenderTargets;
    pendingDeaths = Array.from(deaths);
    deadCharacters = addToSet(deadCharacters, Array.from(deaths));
    infectedTargets = addToSet(infectedTargets, infectionsToApply);
    charmedTargets = addToSet(charmedTargets, piperTargets);
    const cupidConsumption = cupidTargets.length >= 2 ? usedCupidIds : [];
    consumedSpecialIds = addToSet(consumedSpecialIds, [...usedPotionIds, ...cupidConsumption, ...usedFatherIds]);
    const computedVictory = evaluateVictory(characters, deadCharacters, lovers, infectedTargets);
    victoryResult = { ...computedVictory, angel: angelWin || computedVictory.angel };
    lastProtectedTargets = defenderTargets;

    // reset tokens de acción al panel lateral
    activeSpecialIds = sheriffHolderId && sheriffTokenId ? [] : [];
    resetSpecialPositions();
  }

  function evaluateVictory(characters = [], deadList = [], lovers = [], infectedList = []) {
    const dead = new Set(deadList);
    const alive = characters.filter((token) => !dead.has(token.id));
    const infectedSet = new Set(infectedList);
    const aliveWolves = alive.filter((token) => token.category === 'werewolves' || infectedSet.has(token.id)).length;
    const aliveOthers = alive.filter((token) => token.category !== 'werewolves' && !infectedSet.has(token.id)).length;
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

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const deployedPosition = (index = 0) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const baseX = paletteArea.endX + 4;
    const baseY = paletteArea.startY + 8;
    const xStep = 7;
    const yStep = 12;
    return {
      x: clamp(baseX + col * xStep, characterArea.xMin, characterArea.xMax),
      y: clamp(baseY + row * yStep, characterArea.yMin, characterArea.yMax)
    };
  };

  function resetSpecialPositions() {
    if (!tokens?.length) return;
    const specials = tokens.filter((token) => token.category === 'special');
    const next = { ...positions };
    specials.forEach((token, index) => {
      const isSheriff = slugifyRole(token.role) === 'sheriff_badge';
      if (isSheriff) return; // sheriff token hidden/managed via badge mark
      if (activeSpecialIds.includes(token.id) && positions[token.id]) {
        next[token.id] = positions[token.id];
      } else {
        next[token.id] = palettePosition(index, specials.length);
      }
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
              class={`palette-token ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''}`}
              title={token.role}
              disabled={
                consumedSpecialIds.includes(token.id) ||
                activeSpecialIds.includes(token.id) ||
                (isPreparationPhase && !isSheriffToken(token)) ||
                (isNightPhase && (isSheriffToken(token) || slugifyRole(token.role) === 'villagers_elimination')) ||
                (isDayPhase && slugifyRole(token.role) !== 'villagers_elimination') ||
                (isSheriffToken(token) && (!sheriffPhaseEligible() || sheriffDisabled))
              }
              on:click={() => deploySpecialToken(token)}
            >
              <span class="palette-token__circle">
                {#if token.image}
                  <img src={token.image} alt={token.role} draggable="false" />
                {:else}
                  <span class="token-initials">{token.role?.[0] ?? '?'}</span>
                {/if}
              </span>
              <span class="sr-only">{token.role}</span>
            </button>
          {/each}
        </div>

        {#if characterTokens.length === 0 && activeSpecialTokens.length === 0}
          <p class="board-empty">{$t('configure.role_preview_empty')}</p>
        {:else}
          {#each characterTokens as token (token.id + (infectedIdSet.has(token.id) ? '-infected' : '-clean'))}
            <button
              type="button"
              class={`role-token category-${displayCategory(token)} ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''} ${loverIdsSet?.has(token.id) ? 'token-lover' : ''} ${deadSet.has(token.id) ? 'token-dead' : ''} ${infectedTargets.includes(token.id) ? 'token-infected' : ''}`}
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
                {#if displayImage(token)}
                  <img src={displayImage(token)} alt={token.role} draggable="false" />
                {:else}
                  <span class="token-initials">{token.role?.[0] ?? '?'}</span>
                {/if}
              </span>
              <span class="token-role" aria-hidden="true">{token.role}</span>
              <span class="sr-only">{token.role}</span>
              {#if deadSet.has(token.id)}
                <span class="token-badge token-badge--dead" aria-hidden="true">✖</span>
              {/if}
              {#if charmedTargets?.includes(token.id)}
                <span class="token-badge token-badge--charmed" aria-hidden="true">♪</span>
              {/if}
              {#if lastProtectedTargets?.includes(token.id)}
                <span class="token-badge token-badge--protected" aria-hidden="true">🛡</span>
              {/if}
              {#if loverIdsSet?.has(token.id)}
                <span class="token-badge token-badge--lover" aria-hidden="true">♥</span>
              {/if}
              {#if charmedTargets?.includes(token.id)}
                <span class="token-badge token-badge--charmed" aria-hidden="true">♪</span>
              {/if}
              {#if sheriffHolderId === token.id}
                <span class="token-badge token-badge--sheriff" aria-hidden="true">★</span>
              {/if}
            </button>
          {/each}
          {#each activeSpecialTokens as token}
            <button
              type="button"
              class={`role-token category-${token.category} token-action ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''}`}
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
        <span class="phase-pill">{$t('session.phases.current')}: {currentPhaseLabel}</span>
      </div>
      <div class="dock-controls">
        <button class="btn secondary btn--size-sm" type="button" on:click={goToConfigure}>Configure</button>
        <button class="btn ghost btn--size-sm" type="button" on:click={evaluatePhase}>{$t('session.controls.evaluate_phase')}</button>
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
    z-index: 1;
  }

  .role-token:active {
    cursor: grabbing;
  }

  .token-player {
    font-size: 0.75rem;
    color: var(--color-white-muted);
    min-height: 1em;
    max-width: 100%;
    text-align: center;
  }

  .token-player--placeholder {
    visibility: hidden;
  }

  .token-circle {
    width: 92px;
    height: 92px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.35);
    background: rgba(3, 6, 14, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }

  .token-circle img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    border-radius: 50%;
    pointer-events: none;
    user-select: none;
  }

  .token-initials {
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .token-role {
    width: 110px;
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.98rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: var(--color-white-muted);
    margin-top: 8px;
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
    pointer-events: none;
  }

  .token-action .token-initials {
    font-size: 1.05rem;
  }

  .token-action .token-role {
    display: none;
  }

  .role-token.category-villagers .token-circle {
    border-color: var(--color-green-cta--primary);
  }
  .role-token.category-ambiguous .token-circle {
    border-color: var(--color-gold-info);
  }
  .role-token.category-loners .token-circle {
    border-color: var(--color-white-contrast);
  }
  .role-token.category-werewolves .token-circle {
    border-color: var(--color-error-strong);
  }
  .role-token.category-special .token-circle {
    border-color: var(--color-gold-info);
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
  .token-badge--charmed {
    font-size: 1.2rem;
    color: var(--color-gold-info);
    text-shadow: 0 0 8px rgba(0, 0, 0, 0.65);
    top: 4px;
    left: 4px;
    right: auto;
    bottom: auto;
  }
  .token-badge--protected {
    font-size: 1rem;
    color: var(--color-white-contrast);
    text-shadow: 0 0 6px rgba(0, 0, 0, 0.55);
    bottom: 4px;
    right: 6px;
    left: auto;
    top: auto;
  }
  .token-badge--lover { top: 4px; right: 6px; left: auto; bottom: auto; }
  .token-badge--dead { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); }
  .token-badge--sheriff {
    bottom: 4px;
    left: 6px;
    right: auto;
    top: auto;
    background: linear-gradient(135deg, #f6c744, #d48a0d);
    color: #111;
    border: 1px solid rgba(0, 0, 0, 0.45);
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.15);
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

  .palette-token {
    display: grid;
    place-items: center;
    gap: 0.15rem;
    padding: 0.35rem;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .palette-token__circle {
    width: 52px;
    height: 52px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, 0.12);
    overflow: hidden;
  }

  .palette-token__circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
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

  .phase-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.32rem 0.85rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--color-white-contrast);
  }

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

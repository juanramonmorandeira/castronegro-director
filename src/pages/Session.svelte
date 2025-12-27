<script>
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import {
    slugifyRole,
    roleImageSrc,
    getRoleDefinition,
    createEmptyRoleSelection,
    buildDistributionTokens,
    getRoleName
  } from '../lib/roles.js';
  import roleDefinitions from '../../reference-data/datasets/roles.json' with { type: 'json' };
  import { showToast } from '../lib/toast.js';
  import { createEventDispatcher, onMount } from 'svelte';
  import { getSessionPositions, setRolePosition } from '../lib/stores/rolePositions.js';
  import Modal from '../components/ui/Modal.svelte';
  import RoleSlotPicker from '../components/ui/RoleSlotPicker.svelte';
  import RolePickerGrid from '../components/ui/RolePickerGrid.svelte';
  import { getSessionById, updateSession } from '../lib/db.js';

  export let sessionId = null;
  export let selection = null;
  export let tokens = [];
  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;
  export let actorRoles = [];
  export let thiefRoles = [];
  export let exclusionList = [];

  const PHASE_KEY_PREPARATION = 'session.phases.preparation.title';
  const PHASE_KEY_FIRST_NIGHT = 'session.phases.first_night.title';
  const PHASE_KEY_FIRST_DAY = 'session.phases.first_day.title';
  const PHASE_KEY_EACH_NIGHT = 'session.phases.each_night.title';
  const PHASE_KEY_EACH_DAY = 'session.phases.each_day.title';
  const PHASE_KEY_HUNTER = 'session.phases.hunter.title';
  const PHASE_KEY_KNIGHT = 'session.phases.knight.title';
  const PHASE_KEY_SHERIFF = 'session.phases.sheriff.title';
  const PHASE_KEY_END = 'session.phases.end.title';
  const PREPARATION_PHASES = [
    'prep_characters',
    'prep_buildings',
    'prep_manipulator',
    'prep_gypsy',
    'prep_town_crier_cards',
    'prep_actor',
    'prep_thief',
    'prep_sheriff',
    'prep_town_crier'
  ];
  const BASE_PHASE_SEQUENCE = [
    PHASE_KEY_PREPARATION,
    PHASE_KEY_FIRST_NIGHT,
    PHASE_KEY_FIRST_DAY,
    PHASE_KEY_EACH_NIGHT,
    PHASE_KEY_EACH_DAY
  ];
  const ALL_PHASE_KEYS = new Set([
    ...BASE_PHASE_SEQUENCE,
    PHASE_KEY_HUNTER,
    PHASE_KEY_SHERIFF,
    PHASE_KEY_END,
    ...PREPARATION_PHASES
  ]);

  const normalizePhaseKey = (key) => {
    if (!key) return PHASE_KEY_END;
    const aliases = {
      sheriff: PHASE_KEY_SHERIFF,
      sheriff_interphase: PHASE_KEY_SHERIFF
    };
    const mapped = aliases[key] ?? key;
    return ALL_PHASE_KEYS.has(mapped) ? mapped : PHASE_KEY_END;
  };

  let logEntries = [];
  let draftNote = '';
  let sessionStatus = 'in_progress';
  let phaseState = {
    previous: null,
    current: PHASE_KEY_PREPARATION,
    next: PHASE_KEY_FIRST_NIGHT,
    pendingInterphases: [],
    pendingPreparation: [],
    baseIndex: 0
  };
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
  let includeTownCrier = true;
  let preparationResolved = false;
  let nightNumber = 0;
  let dayNumber = 0;
  let resetLoading = false;
  let previewOpen = false;
  let previewToken = null;
  let pendingHunterShot = false;
  let pendingSheriffSuccession = false;
  let includeSheriff = true;
  const MANIPULATOR_TOKEN_ID = 'special-manipulator-division';
  let manipulatorAssignments = {};
  let manipulatorModalOpen = false;
  let manipulatorDone = false;
  let actorPrepDone = false;
  let actorModalOpen = false;
  let actorSelection = null;
  let actorTempSpecialIds = [];
  let actorCurrentRoleSlug = null;
  let actorState = { available: [], consumed: [], currentNightChoice: null };
  let actorPrepChoices = [];
  let actorPrepModalOpen = false;
  let actorPrepOptions = [];
  let actorPickerOpen = false;
  let actorPickerIndex = 0;
  let actorPickerOptions = [];
  let actorBaseTokenId = null;
  let actorOriginalToken = null;
  let foxModalOpen = false;
  let foxSelection = null;
  let foxReveal = null; // { role: 'werewolf'|'villager', image: string }
  let foxState = { lastResult: null, available: true, lastNightUsed: null, lastNightUsedKey: null };
  let foxSpecialId = null;
  let foxBaseTokenId = null;
  let whiteBaseTokenId = null;
  let whiteSoloActive = false;
  let judgeModalOpen = false;
  let judgeTokenId = null;
  let pendingJudgeExtraDay = false;
  let childModelTarget = null;
  let childConversionPending = false;
  let houndModalOpen = false;
  let houndTokenId = null;
  let houndChoice = null; // 'wolves' | 'village'
  let houndSelection = null;
  let knightPending = false;
  let knightTokenId = null;
  let woundedQueue = []; // [{ id, dueNight, resolved?: boolean }]
  let knightTargetId = null;
  let thiefModalOpen = false;
  let thiefOffer = [];
  let thiefChoice = null;
  let thiefSpecialId = null;
  let thiefBaseTokenId = null;
  let thiefAlive = false;
  let thiefPrepChoices = [];
  let thiefPrepModalOpen = false;
  let thiefPrepDone = false;
  let thiefPickerOpen = false;
  let thiefPickerIndex = 0;
  let thiefPickerOptions = [];
  let prepConfirmOpen = false;
  let prepConfirmMode = null; // 'actor' | 'thief'
  $: sessionKey = sessionId ?? 'default';
  let lastProtectedTargets = [];
  let activeSpecialIds = [];
  $: activeSpecialTokens = (specialTokens ?? []).filter((token) => activeSpecialIds.includes(token.id));
  $: loverSet = new Set(loversLinks.flat?.() ?? loversLinks.reduce((acc, pair) => acc.concat(pair), []));
  $: loverIdsSet = new Set(loverSet);
  $: deadSet = new Set(deadCharacters);
  $: infectedIdSet = new Set(infectedTargets);
  $: console.info('[session] infected state', { infectedTargets, infectedIdSet: Array.from(infectedIdSet) });
  $: seerPresent = characterTokens.some((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'seer');
  $: aliveRoleSet = (() => {
    const set = new Set();
    (characterTokens ?? []).forEach((token) => {
      if (deadSet.has(token.id)) return;
      const slug = normalizeRoleSlug(slugifyRole(token.role));
      set.add(slug);
      // Infectados cuentan como hombres lobo para usos de fichas de acción.
      if (infectedIdSet.has(token.id)) {
        set.add('werewolf');
        set.add('werewolves');
      }
    });
    return set;
  })();
  $: seerActive = seerPresent && aliveRoleSet.has('seer');
  $: foxBaseTokenId = characterTokens.find((token) => slugifyRole(token.role) === 'fox')?.id ?? null;
  $: foxSpecialId = specialTokens.find((token) => slugifyRole(token.role) === 'fox_senses')?.id ?? null;
  $: foxAlive = foxBaseTokenId && !deadSet.has(foxBaseTokenId) && !infectedIdSet.has(foxBaseTokenId);
  $: whiteBaseTokenId = characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'white')?.id ?? null;
  $: whiteAlive = whiteBaseTokenId ? !deadSet.has(whiteBaseTokenId) : false;
  $: whiteNightIndex = isFirstNightPhase
    ? 1
    : isEachNightPhase
      ? Math.max(1, nightNumber || 1)
      : nightNumber || 0;
  $: whiteClawActive = isNightPhase && whiteAlive && whiteNightIndex >= 2 && whiteNightIndex % 2 === 0;
  $: judgeTokenId = specialTokens.find((token) => slugifyRole(token.role) === 'judge_maze')?.id ?? null;
  $: judgeAlive = characterTokens.some(
    (token) =>
      !deadSet.has(token.id) && ['judge', 'wandering_judge', 'the_judge'].includes(normalizeRoleSlug(slugifyRole(token.role)))
  );
  $: childTokenId = characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'child')?.id ?? null;
  $: childAlive = childTokenId ? !deadSet.has(childTokenId) : false;
  $: childSpecialId = specialTokens.find((token) => slugifyRole(token.role) === 'child_lighthouse')?.id ?? null;
  $: houndTokenId = characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'hound')?.id ?? null;
  $: houndAlive = houndTokenId ? !deadSet.has(houndTokenId) : false;
  $: houndSpecialId = specialTokens.find((token) => slugifyRole(token.role) === 'hound_choice')?.id ?? null;
  $: knightTokenId = characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'knight')?.id ?? null;
  $: knightAlive = knightTokenId ? !deadSet.has(knightTokenId) : false;
  $: thiefSpecialId = specialTokens.find((token) => slugifyRole(token.role) === 'thief_mask')?.id ?? null;
  const woundedIdsSet = () => new Set(woundedQueue.map((entry) => entry.id));
  let elderResilience = new Set();
  const currentLocale = typeof navigator !== 'undefined' ? navigator.language : 'en';

  const sanitizeActorRoles = (list = []) => {
    if (!Array.isArray(list)) return [];
    const clean = list
      .map((role) => (typeof role === 'string' ? role : role?.role ?? ''))
      .filter(Boolean)
      .slice(0, 3);
    const seen = new Set();
    return clean.filter((role) => {
      const slug = slugifyRole(role);
      if (seen.has(slug)) return false;
      seen.add(slug);
      return slug;
    });
  };

  $: if ((!actorState?.available || actorState.available.length === 0) && Array.isArray(actorRoles) && actorRoles.length) {
    actorState = { ...actorState, available: sanitizeActorRoles(actorRoles) };
  }
  $: if (!actorPrepChoices.length && Array.isArray(actorRoles) && actorRoles.length) {
    actorPrepChoices = sanitizeActorRoles(actorRoles);
  }
  $: if (!thiefPrepChoices.length && Array.isArray(thiefRoles) && thiefRoles.length) {
    thiefPrepChoices = thiefRoles.slice(0, 2);
    while (thiefPrepChoices.length < 2) thiefPrepChoices.push('');
  }
  $: if (thiefPrepChoices.length < 2) {
    const next = [...thiefPrepChoices];
    while (next.length < 2) next.push('');
    thiefPrepChoices = next;
  }
  $: if (actorPrepChoices.length < 3) {
    const next = [...actorPrepChoices];
    while (next.length < 3) next.push('');
    actorPrepChoices = next;
  }

  onMount(() => {
    const bootstrap = async () => {
      if (!sessionId) {
        actorState = { available: sanitizeActorRoles(actorRoles), consumed: [], currentNightChoice: null };
        return;
      }
      try {
        const session = await getSessionById(sessionId);
        const settings = session?.settings ?? {};
        const phasesRemote = session?.game_phases ?? {};
        const remoteState = session?.actor_state ?? {};
        const remoteFox = session?.fox_state ?? {};
        const available = sanitizeActorRoles(settings.actor_roles ?? actorRoles);
        includeSheriff = settings.include_sheriff ?? true;
        includeTownCrier = settings.include_town_crier ?? true;
        sheriffAvailable = includeSheriff;
        thiefRoles = Array.isArray(settings.thief_roles)
          ? settings.thief_roles.map((role) => slugifyRole(role)).filter(Boolean).slice(0, 2)
          : thiefRoles;
        manipulatorAssignments = settings.manipulator_assignments ?? manipulatorAssignments;
        actorPrepChoices = Array.isArray(settings.actor_roles) ? sanitizeActorRoles(settings.actor_roles) : actorPrepChoices;
        thiefPrepChoices = Array.isArray(settings.thief_roles)
          ? settings.thief_roles.map((role) => slugifyRole(role)).filter(Boolean).slice(0, 2)
          : thiefPrepChoices;
        thiefPrepDone = Array.isArray(thiefPrepChoices) && thiefPrepChoices.filter(Boolean).length > 0;
        exclusionList = Array.isArray(settings.exclusion_list)
          ? settings.exclusion_list.map((slug) => slugifyRole(slug))
          : Array.isArray(settings.thief_exclusions)
            ? settings.thief_exclusions.map((slug) => slugifyRole(slug))
            : exclusionList;
        const prepRemote = phasesRemote.pending_preparation ?? null;
        const prepQueue = Array.isArray(prepRemote) ? prepRemote : buildPreparationQueue();
    actorState = {
      available,
      consumed: Array.isArray(remoteState.consumed) ? remoteState.consumed.map((item) => slugifyRole(item)).filter(Boolean) : [],
      currentNightChoice: remoteState.currentNightChoice ?? null
    };
    actorPrepChoices = Array.isArray(settings.actor_roles) ? sanitizeActorRoles(settings.actor_roles) : actorPrepChoices;
    actorPrepDone = actorPrepChoices.filter(Boolean).length > 0;
        thiefPrepChoices = Array.isArray(settings.thief_roles)
          ? settings.thief_roles.map((role) => slugifyRole(role)).filter(Boolean).slice(0, 2)
          : thiefPrepChoices;
        foxState = {
          lastResult: remoteFox.lastResult ?? null,
          available: remoteFox.available ?? true,
          lastNightUsed: remoteFox.lastNightUsed ?? null,
          lastNightUsedKey: remoteFox.lastNightUsedKey ?? null
        };
        const normalizedCurrent = normalizePhaseKey(phasesRemote.current ?? (prepQueue[0] ?? PHASE_KEY_FIRST_NIGHT));
        const remoteBase = BASE_PHASE_SEQUENCE.indexOf(normalizedCurrent);
        const safeBaseIndex = remoteBase >= 0 ? remoteBase : 0;
        phaseState = {
          previous: phasesRemote.previous ?? null,
          current: normalizedCurrent,
          next: normalizePhaseKey(phasesRemote.next ?? PHASE_KEY_FIRST_NIGHT),
          pendingInterphases: phasesRemote.pending_interphases ?? [],
          pendingPreparation: prepQueue,
          baseIndex: phasesRemote.base_index ?? safeBaseIndex
        };
      } catch (error) {
        console.error('[session] unable to load actor state', error);
        actorState = { available: sanitizeActorRoles(actorRoles), consumed: [], currentNightChoice: null };
        foxState = { lastResult: null, available: true, lastNightUsed: null, lastNightUsedKey: null };
        phaseState = {
          previous: null,
          current: (buildPreparationQueue()[0] ?? PHASE_KEY_FIRST_NIGHT),
          next: PHASE_KEY_FIRST_NIGHT,
          pendingInterphases: [],
          pendingPreparation: buildPreparationQueue(),
          baseIndex: 0
        };
      }
    };
    bootstrap();
    return () => {};
  });

  const dispatch = createEventDispatcher();

  const roleAliases = {
    // Canonical aliases to catch variants/translation leftovers in selections and steps
    the_actor: 'actor',
    actor: 'actor',
    el_comediante: 'actor',
    comediante: 'actor',
    comedian: 'actor',
    bad: 'bad',
    big_bad_wolf: 'bad',
    wolf_hound: 'hound',
    white_werewolf: 'white',
    the_white_werewolf: 'white',
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
  const SHORT_ROLE_LABELS = {
    angel: 'Angel',
    bad: 'Bad',
    father: 'Father',
    white: 'White',
    werewolf: 'Werewolf',
    wolf_hound: 'Hound',
    hound: 'Hound',
    child: 'Child',
    gypsy: 'Gypsy',
    tamer: 'Tamer',
    scapegoat: 'Scapegoat',
    fox: 'Fox',
    seer: 'Seer',
    witch: 'Witch',
    hunter: 'Hunter',
    elder: 'Elder',
    defender: 'Defender',
    pyromaniac: 'Pyromaniac',
    scandalmonger: 'Scandalmonger',
    piper: 'Piper',
    manipulator: 'Manipulator',
    judge: 'Judge',
    knight: 'Knight',
    cupid: 'Cupid',
    idiot: 'Idiot',
    villager: 'Villager',
    trusted: 'Trusted',
    brothers: 'Brothers',
    sisters: 'Sisters',
    actor: 'Actor',
    thief: 'Thief',
    ginasta: 'Gypsy'
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
  const allRolesList = Object.entries(roleDefinitions ?? {}).map(([slug, def]) => ({
    slug,
    category: def?.category ?? 'villagers'
  }));
  const multiPlayerRoles = new Set(['brothers', 'sisters']);
  const duplicableThiefRoles = new Set(['trusted', 'villager', 'werewolf']);
  const wolfAlignedSlugs = new Set(['werewolf', 'bad', 'father', 'white']);
  const exclusionSet = () => new Set((exclusionList ?? []).map((item) => slugifyRole(item)));

  const shuffleArray = (list = []) => list.map((item) => ({ sort: Math.random(), item })).sort((a, b) => a.sort - b.sort).map((entry) => entry.item);

  const roleCategoryFor = (slug) => {
    const normalized = normalizeRoleSlug(slug);
    const entry = roleDefinitions?.[normalized];
    return entry?.category ?? 'villagers';
  };
  $: actorPrepOptions = actorPrepPool({ respectExclusions: false });
  const isPrepPhaseKey = (key) => typeof key === 'string' && key.startsWith('prep_');
  const prepDefaults = () => buildPreparationQueue();
  const actorPrepPool = ({ respectExclusions = false } = {}) => {
    const inPlay = new Set(characterTokens.map((token) => normalizeRoleSlug(slugifyRole(token.role))));
    const excluded = respectExclusions ? exclusionSet() : new Set();
    return allRolesList
      .filter(({ category }) => category === 'villagers')
      .map(({ slug }) => normalizeRoleSlug(slug))
      .filter((slug) => {
        if (!slug) return false;
        if (multiPlayerRoles.has(slug)) return false;
        if (['trusted', 'villager', 'werewolf'].includes(slug)) return false; // sin poder/no permitidos
        if (['werewolf', 'bad', 'father', 'white'].includes(slug)) return false;
        const def = roleDefinitions?.[slug];
        if (def?.category === 'loners') return false;
        if (def?.category === 'ambiguous') return false;
        if (excluded.has(slug)) return false;
        if (inPlay.has(slug)) return false;
        return true;
      });
  };
  const fillActorPrepSlots = () => {
    const pool = actorPrepPool({ respectExclusions: true });
    const filled = [...actorPrepChoices];
    for (let i = 0; i < 3; i += 1) {
      if (filled[i]) continue;
      const pick = pool.find((role) => !filled.includes(role));
      if (pick) filled[i] = pick;
    }
    actorPrepChoices = filled.slice(0, 3);
  };

  const openActorPrepPicker = (index) => {
    if (actorPrepDone) return;
    actorPickerIndex = index;
    const current = actorPrepChoices[index];
    const pickedSet = new Set(actorPrepChoices.filter(Boolean));
    actorPickerOptions = actorPrepOptions.filter((slug) => !pickedSet.has(slug) || slug === current);
    actorPickerOpen = true;
  };

  const chooseActorPrepRole = (slug) => {
    actorPrepChoices = actorPrepChoices.map((val, idx) => (idx === actorPickerIndex ? slug : val));
    actorPickerOpen = false;
  };
  const fillThiefPrepSlots = () => {
    const pool = thiefPoolAvailable(true);
    const filled = [...thiefPrepChoices];
    for (let i = 0; i < 2; i += 1) {
      if (filled[i]) continue;
      const pick = pool.find((role) => !filled.includes(role));
      if (pick) filled[i] = pick;
    }
    thiefPrepChoices = filled.slice(0, 2);
  };

  const openThiefPrepPicker = (index) => {
    if (thiefPrepDone) return;
    thiefPickerIndex = index;
    const current = thiefPrepChoices[index];
    const pickedSet = new Set(thiefPrepChoices.filter(Boolean));
    thiefPickerOptions = thiefPoolAvailable(false).filter((slug) => !pickedSet.has(slug) || slug === current);
    thiefPickerOpen = true;
  };

  const chooseThiefPrepRole = (slug) => {
    thiefPrepChoices = thiefPrepChoices.map((val, idx) => (idx === thiefPickerIndex ? slug : val));
    thiefPickerOpen = false;
  };


  const thiefPoolAvailable = (respectExclusions = true) => {
    const inPlay = new Set(characterTokens.map((token) => normalizeRoleSlug(slugifyRole(token.role))));
    const excluded = respectExclusions ? exclusionSet() : new Set();
    const actorChosen = new Set(actorPrepChoices.filter(Boolean).map((role) => normalizeRoleSlug(role)));
    return allRolesList
      .map(({ slug }) => normalizeRoleSlug(slug))
      .filter((slug) => {
        if (!slug) return false;
        if (slug === 'thief') return false;
        if (multiPlayerRoles.has(slug)) return false;
        if (respectExclusions && excluded.has(slug)) return false;
        if (actorChosen.has(slug)) return false;
        if (!duplicableThiefRoles.has(slug) && inPlay.has(slug)) return false;
        return true;
      });
  };

  const buildThiefOffer = () => {
    const manual = Array.isArray(thiefRoles)
      ? thiefRoles.map((role) => normalizeRoleSlug(role)).filter(Boolean)
      : Array.isArray(thiefPrepChoices)
        ? thiefPrepChoices.map((role) => normalizeRoleSlug(role)).filter(Boolean)
        : [];
    const validManual = manual.filter((slug) => thiefPoolAvailable(false).includes(slug));
    const offer = [...validManual];
    const pool = shuffleArray(thiefPoolAvailable(true));
    for (const slug of pool) {
      if (offer.length >= 2) break;
      if (offer.includes(slug)) continue;
      offer.push(slug);
    }
    while (offer.length < 2 && thiefPoolAvailable(false).length) {
      const fallback = thiefPoolAvailable(false).find((slug) => !offer.includes(slug));
      if (!fallback) break;
      offer.push(fallback);
    }
    return offer.slice(0, 2);
  };

  const isWolfAlignedSlug = (slug) => wolfAlignedSlugs.has(normalizeRoleSlug(slug));
  const deriveRoleSpecialTokens = (roleSlug) => {
    const slug = normalizeRoleSlug(roleSlug);
    const templates = [
      {
        roles: ['cupid'],
        create: () => [
          { role: 'Cupid Hearts', image: '/tokens/cupido-hearts.png' },
          { role: 'Cupid Hearts', image: '/tokens/cupido-hearts.png' }
        ]
      },
      {
        roles: ['defender'],
        create: () => [{ role: 'defender_shield', image: '/tokens/defender-shield.png' }]
      },
      {
        roles: ['witch'],
        create: () => [
          { role: 'witch_heal', image: '/tokens/witch-heal.png' },
          { role: 'witch_venom', image: '/tokens/witch-venom.png' }
        ]
      },
      {
        roles: ['hunter'],
        create: () => [{ role: 'hunter_bullet', image: '/tokens/hunter-bullet.png' }]
      },
      {
        roles: ['piper'],
        create: () => [
          { role: 'piper_charm', image: '/tokens/piper-flute.png' },
          { role: 'piper_charm', image: '/tokens/piper-flute.png' }
        ]
      },
      {
        roles: ['white'],
        create: () => [{ role: 'white_claw', image: '/tokens/white-claw.png' }]
      },
      {
        roles: ['werewolf', 'bad', 'father'],
        create: () => [{ role: 'werewolves_claws', image: '/tokens/werewolves-claw.png' }]
      },
      {
        roles: ['father'],
        create: () => [{ role: 'father_bite', image: '/tokens/father-bite.png' }]
      },
      {
        roles: ['judge'],
        create: () => [{ role: 'judge_maze', image: '/tokens/judge-maze.png' }]
      },
      {
        roles: ['child'],
        create: () => [{ role: 'child_lighthouse', image: '/tokens/child-lighthouse.png' }]
      },
      {
        roles: ['hound'],
        create: () => [{ role: 'hound_choice', image: '/tokens/hound-choice.png' }]
      },
      {
        roles: ['knight'],
        create: () => [{ role: 'knight_sword', image: '/tokens/knight-sword.png' }]
      }
    ];
    const matching = templates.find((entry) => entry.roles.includes(slug));
    if (!matching) return [];
    return matching.create().map((tpl, index) => ({
      id: `special-${slugifyRole(tpl.role)}-converted-${Date.now()}-${index}`,
      role: tpl.role,
      category: 'special',
      image: tpl.image,
      owner: slug
    }));
  };

  const ensureRoleSpecialTokens = (roleSlug) => {
    const slug = normalizeRoleSlug(roleSlug);
    const extras = deriveRoleSpecialTokens(slug).filter(
      (extra) => !specialTokens.some((token) => slugifyRole(token.role) === slugifyRole(extra.role))
    );
    return extras;
  };

  const actorPoolAvailable = () => {
    const inPlay = new Set(characterTokens.map((token) => normalizeRoleSlug(slugifyRole(token.role))));
    const excluded = exclusionSet();
    return allRolesList
      .filter(({ category }) => category === 'villagers')
      .map(({ slug }) => normalizeRoleSlug(slug))
      .filter((slug) => {
        if (!slug) return false;
        if (multiPlayerRoles.has(slug)) return false;
        if (['trusted', 'villager', 'werewolf'].includes(slug)) return false; // sin poderes o no permitidos
        if (excluded.has(slug)) return false;
        if (inPlay.has(slug)) return false;
        return true;
      });
  };

  const ensureActorAvailable = () => {
    if (!actorAlive) return;
    if (actorAvailable.length > 0) return;
    const pool = actorPoolAvailable();
    const shuffled = shuffleArray(pool).slice(0, 3);
    if (shuffled.length) {
      actorState = { ...actorState, available: shuffled };
    }
  };

  const cleanActorName = (slug) => shortRoleLabel(slug);

  const openThiefModal = (tokenId = null) => {
    thiefSpecialId = tokenId ?? thiefSpecialId;
    thiefOffer = buildThiefOffer();
    thiefChoice = null;
    thiefModalOpen = true;
    actorPrepModalOpen = false;
    thiefPrepModalOpen = false;
  };

  const applyThiefChoice = () => {
    const forcedWolf = thiefOffer.length === 2 && thiefOffer.every((slug) => isWolfAlignedSlug(slug));
    if (!thiefChoice && forcedWolf) {
      showToast({
        message: $t?.('session.errors.thief_must_choose_wolf') ?? 'The Thief must choose one of the wolf roles.',
        variant: 'error'
      });
      return;
    }
    const targetSlug = thiefChoice ? normalizeRoleSlug(thiefChoice) : null;
    const targetDefinition = targetSlug ? getRoleDefinition(targetSlug) : null;
    const targetCategory = targetDefinition?.category ?? 'villagers';
    const targetRoleLabel = targetSlug ? shortRoleLabel(targetSlug) : 'Villager';
    const targetImage = roleImageSrc(targetCategory, targetSlug || 'villager');
    if (thiefBaseTokenId) {
      tokens = tokens.map((token) =>
        token.id === thiefBaseTokenId
          ? {
              ...token,
              role: targetSlug || 'villager',
              category: targetCategory,
              image: targetImage
            }
          : token
      );
    }
    const extraSpecials = targetSlug ? ensureRoleSpecialTokens(targetSlug) : [];
    if (extraSpecials.length) {
      tokens = [...tokens, ...extraSpecials];
    }
    if (thiefSpecialId) {
      consumedSpecialIds = addToSet(consumedSpecialIds, [thiefSpecialId]);
      activeSpecialIds = activeSpecialIds.filter((id) => id !== thiefSpecialId);
    }
    const stamp = new Date().toLocaleTimeString();
    logEntries = [
      {
        text: thiefChoice
          ? $t?.('session.logbook.thief_adopts_role', { role: targetRoleLabel }) ??
            `Thief adopts ${targetRoleLabel}`
          : $t?.('session.logbook.thief_becomes_villager') ?? 'Thief becomes a Villager',
        stamp
      },
      ...logEntries
    ];
    thiefModalOpen = false;
  };

  const persistThiefPrepChoices = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, { 'settings.thief_roles': thiefPrepChoices.filter(Boolean) });
    } catch (error) {
      console.error('[session] unable to persist thief prep choices', error);
    }
  };

  const persistPrepRoles = async (key, values) => {
    if (!sessionId) return;
    const payload = {};
    if (key === 'actor') payload['settings.actor_roles'] = values.slice(0, 3);
    if (key === 'thief') payload['settings.thief_roles'] = values.slice(0, 2);
    if (!Object.keys(payload).length) return;
    try {
      await updateSession(sessionId, payload);
    } catch (error) {
      console.error('[session] unable to persist prep roles', key, error);
    }
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
  const buildPreparationQueue = () => {
    const queue = [];
    queue.push('prep_characters');
    const includeBuildings = false;
    if (includeBuildings) queue.push('prep_buildings');
    const hasRole = (slug) => roleSet.has(normalizeRoleSlug(slug));
    if (hasRole('manipulator')) queue.push('prep_manipulator');
    if (hasRole('gypsy')) queue.push('prep_gypsy');
    if (includeTownCrier && hasRole('town_crier')) queue.push('prep_town_crier_cards');
    if (hasRole('actor')) queue.push('prep_actor');
    if (hasRole('thief')) queue.push('prep_thief');
    if (includeSheriff) queue.push('prep_sheriff');
    if (includeTownCrier && hasRole('town_crier')) queue.push('prep_town_crier');
    return queue;
  };

  $: effectiveTokens =
    includeSheriff || !Array.isArray(tokens)
      ? tokens
      : tokens.filter((token) => slugifyRole(token.role) !== 'sheriff_badge');
  $: specialTokens = effectiveTokens?.filter((token) => token.category === 'special') ?? [];
  $: characterTokens = effectiveTokens?.filter((token) => token.category !== 'special') ?? [];
  $: actorToken =
    characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'actor') ?? null;
  $: actorBaseTokenId = actorToken?.id ?? actorBaseTokenId;
  $: thiefBaseTokenId =
    characterTokens.find((token) => normalizeRoleSlug(slugifyRole(token.role)) === 'thief')?.id ?? null;
  $: thiefAlive = thiefBaseTokenId ? !deadSet.has(thiefBaseTokenId) : false;
  $: actorAvailable = (actorState?.available ?? []).slice(0, 3);
  $: actorConsumed = new Set(actorState?.consumed ?? []);
  $: actorRemaining = actorAvailable.filter((role) => !actorConsumed.has(slugifyRole(role)));
  $: actorAlive = actorToken ? !deadSet.has(actorToken.id) : false;
  $: actorExhausted = actorRemaining.length === 0 && !actorState.currentNightChoice;
  const ACTOR_TOKEN_ID = 'special-actor-cards';
  $: ensureActorAvailable();
  $: actorActionToken =
    actorAlive
      ? {
          id: ACTOR_TOKEN_ID,
          role: 'actor_cards',
          category: 'special',
          image: '/tokens/actor-cards.png'
        }
      : null;
  $: actorActionDisabled =
    !actorAlive ||
    (!isNightPhase && !actorState.currentNightChoice);
  $: manipulatorMarkersVersion = JSON.stringify(manipulatorAssignments ?? {});
  $: manipulatorActionToken =
    normalizedPhaseKey === 'prep_manipulator' ||
    (phaseState?.pendingPreparation ?? []).includes('prep_manipulator')
      ? {
          id: MANIPULATOR_TOKEN_ID,
          role: 'manipulator_division',
          category: 'special',
          image: '/tokens/manipulator-division.png'
        }
      : null;
  $: manipulatorPaletteToken =
    manipulatorActionToken ||
    (consumedSpecialIds.includes(MANIPULATOR_TOKEN_ID)
      ? {
          id: MANIPULATOR_TOKEN_ID,
          role: 'manipulator_division',
          category: 'special',
          image: '/tokens/manipulator-division.png'
        }
      : null);
  $: paletteSpecialTokensPrep = manipulatorPaletteToken ? [manipulatorPaletteToken] : [];
  $: paletteSpecialTokens = (() => {
    const base = actorActionToken ? [...specialTokens, actorActionToken] : specialTokens;
    const extra = manipulatorPaletteToken ? [manipulatorPaletteToken] : [];
    if (isPrepPhaseKey(normalizedPhaseKey)) {
      return [...extra, ...base];
    }
    const merged = [...base];
    extra.forEach((token) => {
      if (!merged.some((t) => t.id === token.id)) merged.push(token);
    });
    return merged;
  })();
  $: console.info('[actor] state', {
    actorAlive,
    actorBaseTokenId,
    actorToken,
    actorAvailable,
    actorConsumed: Array.from(actorConsumed),
    actorRemaining,
    actorCurrentRoleSlug,
    actorActionToken,
    actorActionDisabled,
    isNightPhase,
    currentPhaseKeyValue
  });

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
        { key: 'sisters_each', requires: ['two_sisters', 'sisters'], each: true },
        { key: 'brothers_each', requires: ['three_brothers', 'brothers'], each: true },
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

  const isEvenEachNight = () => {
    if (!isEachNightPhase) return false;
    const current = Math.max(1, nightNumber || 1);
    return current % 2 === 0;
  };

  const sistersAlive = () =>
    characterTokens.filter(
      (token) => !deadSet.has(token.id) && ['two_sisters', 'sisters'].includes(normalizeRoleSlug(slugifyRole(token.role)))
    );
  const brothersAlive = () =>
    characterTokens.filter(
      (token) => !deadSet.has(token.id) && ['three_brothers', 'brothers'].includes(normalizeRoleSlug(slugifyRole(token.role)))
    );

  $: phases = phaseBlocks.map((phase) => {
    const steps = phase.steps.filter((step) => {
      if (step.each && !isEvenEachNight()) return false;
      if (step.key === 'sheriff_election' && !includeSheriff) return false;
      if (!step.requires || step.requires.length === 0) return true;
      if (!hasAnyRole(step.requires)) return false;
      if (step.key === 'sisters_each' && sistersAlive().length < 2) return false;
      if (step.key === 'brothers_each' && brothersAlive().length < 2) return false;
      return true;
    });
    return { ...phase, steps };
  });
  $: finishEnabled = sessionStatus === 'finished' || Object.values(victoryResult).some(Boolean);

  $: currentPhaseKeyValue = phaseState.current;
  $: normalizedPhaseKey = normalizePhaseKey(currentPhaseKeyValue);
  const prettyPrepLabel = (slug) => {
    const map = {
      prep_characters: $t('session.prep.characters') ?? 'Characters',
      prep_buildings: $t('session.prep.buildings') ?? 'Buildings',
      prep_manipulator: $t('session.prep.manipulator') ?? 'Manipulator',
      prep_gypsy: $t('session.prep.gypsy') ?? 'Gypsy',
      prep_town_crier_cards: $t('session.prep.town_crier_cards') ?? 'Town Crier Cards',
      prep_actor: $t('session.prep.actor') ?? 'Actor',
      prep_thief: $t('session.prep.thief') ?? 'Thief',
      prep_sheriff: $t('session.phases.sheriff.title'),
      prep_town_crier: $t('session.prep.town_crier') ?? 'Town Crier'
    };
    return map[slug] ?? slug;
  };
  $: currentPhaseLabel = (() => {
    const key = normalizedPhaseKey;
    if (!key) return '—';
    if (key.startsWith('prep_')) {
      const step = prettyPrepLabel(key);
      const base = $t('session.phases.preparation.title') || 'Preparation';
      return `${base} (${step})`;
    }
    return $t(key) || '—';
  })();
  $: thiefOfferData = thiefOffer.map((slug) => ({
    slug,
    name: getRoleName(slug, currentLocale),
    category: roleCategoryFor(slug)
  }));
  $: console.info('[session] phase reactive', {
    phaseState,
    currentPhaseKeyValue,
    normalizedPhaseKey,
    currentPhaseLabel
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
    const specials = paletteSpecialTokens;
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

  const persistActorState = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, {
        actor_state: {
          available: actorState.available,
          consumed: actorState.consumed,
          currentNightChoice: actorState.currentNightChoice
        }
      });
    } catch (error) {
      console.error('[session] unable to persist actor state', error);
    }
  };

  const persistFoxState = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, {
        fox_state: {
          lastResult: foxState.lastResult,
          available: foxState.available,
          lastNightUsed: foxState.lastNightUsed,
          lastNightUsedKey: foxState.lastNightUsedKey
        }
      });
    } catch (error) {
      console.error('[session] unable to persist fox state', error);
    }
  };

  const persistPhaseState = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, {
        game_phases: {
          previous: normalizePhaseKey(phaseState.previous),
          current: normalizePhaseKey(phaseState.current),
          next: normalizePhaseKey(phaseState.next),
          phase_summary: [], // extend if needed
          pending_interphases: phaseState.pendingInterphases,
          pending_preparation: phaseState.pendingPreparation,
          base_index: phaseState.baseIndex
        }
      });
    } catch (error) {
      console.error('[session] unable to persist phase state', error);
    }
  };

  const actorRoleLabel = (slug) => shortRoleLabel(slug);
  const shortRoleLabel = (slugOrToken) => {
    const value =
      typeof slugOrToken === 'object' && slugOrToken !== null && slugOrToken.role
        ? slugOrToken.role
        : slugOrToken;
    const norm = normalizeRoleSlug(value);
    if (SHORT_ROLE_LABELS[norm]) return SHORT_ROLE_LABELS[norm];
    const base = norm.replace(/^the_/, '').replace(/_/g, ' ');
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  function addActorLogEntry(selectedSlug) {
    const text =
      $t?.('session.logbook.actor_becomes', { role: actorRoleLabel(selectedSlug) }) ??
      `Actor becomes ${actorRoleLabel(selectedSlug)} for this night`;
    const stamp = new Date().toLocaleTimeString();
    logEntries = [{ text, stamp }, ...logEntries];
  }

  const foxOptions = [
    { key: 'werewolf', image: roleImageSrc('werewolves', 'werewolf') },
    { key: 'villager', image: roleImageSrc('villagers', 'villager') }
  ];

  function addFoxLogEntry(result) {
    const stamp = new Date().toLocaleTimeString();
    const text =
      result === 'werewolf'
        ? $t?.('session.fox.log.werewolf') ?? 'Fox senses a werewolf nearby'
        : $t?.('session.fox.log.villager') ?? 'Fox senses no werewolves';
    logEntries = [{ text, stamp }, ...logEntries];
  }

  function removeActorTempSpecialTokens() {
    if (!actorTempSpecialIds.length) return;
    tokens = tokens.filter((token) => !actorTempSpecialIds.includes(token.id));
    activeSpecialIds = activeSpecialIds.filter((id) => !actorTempSpecialIds.includes(id));
    consumedSpecialIds = consumedSpecialIds.filter((id) => !actorTempSpecialIds.includes(id));
    const nextPositions = { ...positions };
    actorTempSpecialIds.forEach((id) => delete nextPositions[id]);
    positions = nextPositions;
    actorTempSpecialIds = [];
  }

  function buildActorSpecialTokens(roleSlug) {
    const slug = normalizeRoleSlug(slugifyRole(roleSlug));
    const specials = [];
    const add = (opts) => specials.push(opts);

    const derived = deriveRoleSpecialTokens(slug).map((tpl) => ({ ...tpl, actorRole: slug }));
    specials.push(...derived);
    return specials;
  }

  function transformActorToken(roleSlug) {
    if (!actorBaseTokenId) {
      const actorToken = characterTokens.find((token) => slugifyRole(token.role) === 'actor');
      actorBaseTokenId = actorToken?.id ?? null;
    }
    if (!actorBaseTokenId) return;
    const definition = getRoleDefinition(roleSlug);
    const category = definition?.category ?? 'villagers';
    const canonical = normalizeRoleSlug(roleSlug);
    const image = roleImageSrc(category, canonical);
    tokens = tokens.map((token) => {
      if (token.id !== actorBaseTokenId) return token;
      actorOriginalToken = actorOriginalToken ?? token;
      return {
        ...token,
        role: canonical,
        category,
        image
      };
    });
  }

  function injectActorRole(roleSlug, { silent = false, persist = true } = {}) {
    if (!roleSlug) return;
    const slug = normalizeRoleSlug(roleSlug);
    if (!slug) return;
    if (actorConsumed.has(slug)) return;

    // Update actor state
    const consumed = Array.from(new Set([...(actorState.consumed ?? []), slug]));
    actorState = { ...actorState, consumed, currentNightChoice: slug };
    actorCurrentRoleSlug = slug;

    // Apply visual/logic changes
    transformActorToken(slug);
    removeActorTempSpecialTokens();
    const specials = buildActorSpecialTokens(slug);
    actorTempSpecialIds = specials.map((token) => token.id);
    tokens = [...tokens, ...specials];

    if (!silent) {
      addActorLogEntry(slug);
    }
    if (persist) {
      persistActorState();
    }
  }

  function revertActorIdentity() {
    if (actorCurrentRoleSlug && actorOriginalToken && actorBaseTokenId) {
      tokens = tokens.map((token) => (token.id === actorBaseTokenId ? actorOriginalToken : token));
    }
    actorCurrentRoleSlug = null;
    actorState = { ...actorState, currentNightChoice: null };
    removeActorTempSpecialTokens();
    persistActorState();
  }

  function closeFoxModal() {
    foxModalOpen = false;
    foxSelection = null;
  }

  function foxRevealToken(result) {
    if (result === 'werewolf') {
      return {
        role: $t?.('session.fox.option.werewolf') ?? 'Werewolf',
        category: 'werewolves',
        image: roleImageSrc('werewolves', 'werewolf')
      };
    }
    return {
      role: $t?.('session.fox.option.villager') ?? 'Villager',
      category: 'villagers',
      image: roleImageSrc('villagers', 'villager')
    };
  }

  async function confirmFoxSelection() {
    if (!foxSelection) return;
    foxModalOpen = false;
    const currentNight = isNightPhase ? currentNightCounter || nightNumber || 0 : nightNumber || 0;
    foxState = {
      ...foxState,
      lastResult: foxSelection,
      available: foxSelection !== 'villager',
      lastNightUsed: currentNight,
      lastNightUsedKey: normalizedPhaseKey
    };
    if (foxSpecialId && !consumedSpecialIds.includes(foxSpecialId)) {
      consumedSpecialIds = [...consumedSpecialIds, foxSpecialId];
      activeSpecialIds = activeSpecialIds.filter((id) => id !== foxSpecialId);
    }
    addFoxLogEntry(foxSelection);
    await persistFoxState();
    previewToken = foxRevealToken(foxSelection);
    previewOpen = true;
  }

  function openActorModal() {
    if (!actorAlive) return;
    if (actorRemaining.length === 0 && !actorState.currentNightChoice) {
      const pool = actorPoolAvailable();
      const auto = shuffleArray(pool).slice(0, 3);
      if (auto.length) {
        actorState = { ...actorState, available: auto };
      }
    }
    const nextRemaining = actorState.available
      ? actorState.available.filter((role) => !actorConsumed.has(slugifyRole(role)))
      : actorRemaining;
    actorSelection = actorState.currentNightChoice ?? nextRemaining[0] ?? null;
    actorModalOpen = true;
  }

  function closeActorModal() {
    actorModalOpen = false;
    actorSelection = actorState.currentNightChoice ?? null;
  }

  function confirmActorSelection() {
    if (!actorSelection) {
      closeActorModal();
      return;
    }
    injectActorRole(actorSelection, { silent: false });
    actorModalOpen = false;
  }

  $: if (actorState.currentNightChoice && actorCurrentRoleSlug !== actorState.currentNightChoice) {
    injectActorRole(actorState.currentNightChoice, { silent: true, persist: false });
  }

  const phaseIndexByKey = (key) => phases.findIndex((phase) => phase.titleKey === key);
  $: isPreparationPhase = normalizedPhaseKey === PHASE_KEY_PREPARATION || isPrepPhaseKey(normalizedPhaseKey);
  $: isFirstNightPhase = normalizedPhaseKey === PHASE_KEY_FIRST_NIGHT;
  $: isEachNightPhase = normalizedPhaseKey === PHASE_KEY_EACH_NIGHT;
  $: isNightPhase = isFirstNightPhase || isEachNightPhase;
  $: isFirstDayPhase = normalizedPhaseKey === PHASE_KEY_FIRST_DAY;
  $: isEachDayPhase = normalizedPhaseKey === PHASE_KEY_EACH_DAY;
  $: isDayPhase = isFirstDayPhase || isEachDayPhase;
  $: isHunterInterphase = normalizedPhaseKey === PHASE_KEY_HUNTER;
  $: isSheriffInterphase = normalizedPhaseKey === PHASE_KEY_SHERIFF;
  $: isEndPhase = normalizedPhaseKey === PHASE_KEY_END;
  $: console.info('[session] phase flags', {
    isPreparationPhase,
    isFirstNightPhase,
    isEachNightPhase,
    isNightPhase,
    isFirstDayPhase,
    isEachDayPhase,
    isDayPhase
  });
  $: currentNightCounter = isFirstNightPhase ? 1 : isEachNightPhase ? Math.max(1, nightNumber || 1) : nightNumber;
  $: if (
    isNightPhase &&
    foxAlive &&
    foxState.lastResult === 'werewolf' &&
    !foxState.available &&
    foxState.lastNightUsedKey !== normalizedPhaseKey
  ) {
    foxState = { ...foxState, available: true };
    if (foxSpecialId) {
      consumedSpecialIds = consumedSpecialIds.filter((id) => id !== foxSpecialId);
    }
    persistFoxState();
  }

  const nextBaseIndex = (index) => {
    if (index < 0) return 0;
    if (index >= BASE_PHASE_SEQUENCE.length - 1) return 3; // loop to each_night
    return index + 1;
  };

  function evaluatePhase() {
    const phaseKeyNow = normalizePhaseKey(phaseState.current);
    console.info('[session] evaluatePhase', {
      phaseKeyNow,
      phaseState,
      nightNumber,
      dayNumber,
      isPreparationPhase,
      isNightPhase,
      isDayPhase,
      pendingInterphases: phaseState.pendingInterphases
    });
    const resolutionOk = resolveBoardEffects(phaseKeyNow);
    if (resolutionOk === false) return;
    if (actorState.currentNightChoice && !isEndPhase) {
      revertActorIdentity();
    }
    const sheriffToken = specialTokens.find((token) => slugifyRole(token.role) === 'sheriff_badge');
    const sheriffTokenId = sheriffToken?.id;
    if (includeSheriff && pendingSheriffSuccession && !sheriffHolderId && !sheriffTokenId) {
      pendingSheriffSuccession = false;
    }
    const interphaseQueue = [...(phaseState.pendingInterphases ?? [])];
    const prepQueue = [...(phaseState.pendingPreparation ?? [])];
    if (!isPrepPhaseKey(phaseKeyNow) && prepQueue.length) {
      phaseState = {
        ...phaseState,
        previous: phaseKeyNow,
        current: prepQueue[0],
        next: null,
        pendingPreparation: prepQueue.slice(1)
      };
      if (prepQueue[0] === 'prep_actor' && !actorPrepDone) {
        actorPrepModalOpen = true;
      }
      if (prepQueue[0] === 'prep_thief' && !thiefPrepDone) thiefPrepModalOpen = true;
      if (prepQueue[0] === 'prep_manipulator') {
        manipulatorModalOpen = true;
        manipulatorDone = false;
      }
      persistPhaseState();
      return;
    }
    if (isPrepPhaseKey(phaseKeyNow)) {
      if (phaseKeyNow === 'prep_actor' && !actorPrepDone) actorPrepModalOpen = true;
      if (phaseKeyNow === 'prep_thief' && !thiefPrepDone) thiefPrepModalOpen = true;
      if (phaseKeyNow === 'prep_manipulator') {
        // no auto-open; modal se abre solo por el token o al entrar
        manipulatorDone = true;
        // solo persiste; markers ya pintados en el modal
        persistManipulatorAssignments();
      }
      // Validations for empty slots
      const needsActorPrompt = false;
      // ya no forzamos confirmaciones por huecos
      const remainingPrep = prepQueue.filter((slug) => slug !== phaseKeyNow);
      if (remainingPrep.length) {
        phaseState = {
          ...phaseState,
          previous: phaseKeyNow,
          current: remainingPrep[0],
          next: null,
          pendingPreparation: remainingPrep.slice(1)
        };
        if (remainingPrep[0] === 'prep_actor') actorPrepModalOpen = true;
        if (remainingPrep[0] === 'prep_thief' && !thiefPrepDone) thiefPrepModalOpen = true;
      } else {
        phaseState = {
          ...phaseState,
          previous: phaseKeyNow,
          current: PHASE_KEY_FIRST_NIGHT,
          next: PHASE_KEY_FIRST_DAY,
          pendingPreparation: [],
          baseIndex: 1
        };
      }
      if (phaseKeyNow === 'prep_manipulator' && manipulatorActionToken) {
        if (!consumedSpecialIds.includes(MANIPULATOR_TOKEN_ID)) {
          consumedSpecialIds = [...consumedSpecialIds, MANIPULATOR_TOKEN_ID];
          activeSpecialIds = activeSpecialIds.filter((id) => id !== MANIPULATOR_TOKEN_ID);
        }
      }
      persistPhaseState();
      return;
    }
    if (phaseKeyNow === PHASE_KEY_KNIGHT) {
      // La inter-fase de Knight ya se está resolviendo; no reencolarla.
      knightPending = false;
    }
    // Victory check triggers end phase
    if (Object.values(victoryResult).some(Boolean)) {
      phaseState = { ...phaseState, previous: phaseKeyNow, current: PHASE_KEY_END, next: PHASE_KEY_END, pendingInterphases: [] };
      persistPhaseState();
      return;
    }
    // Identify new interphases to enqueue
    const newInterphases = [];
    if (pendingHunterShot) newInterphases.push(PHASE_KEY_HUNTER);
    if (knightPending) newInterphases.push(PHASE_KEY_KNIGHT);
    if (includeSheriff && pendingSheriffSuccession) newInterphases.push(PHASE_KEY_SHERIFF);
    if (pendingJudgeExtraDay) newInterphases.push(PHASE_KEY_EACH_DAY);
    const mergedQueue = [...interphaseQueue, ...newInterphases].filter(Boolean);
    if (newInterphases.includes(PHASE_KEY_EACH_DAY)) {
      pendingJudgeExtraDay = false;
    }
    // enforce Hunter -> Sheriff order
    const orderedQueue = [];
    if (mergedQueue.includes(PHASE_KEY_HUNTER)) orderedQueue.push(PHASE_KEY_HUNTER);
    if (mergedQueue.includes(PHASE_KEY_KNIGHT)) orderedQueue.push(PHASE_KEY_KNIGHT);
    if (mergedQueue.includes(PHASE_KEY_SHERIFF)) orderedQueue.push(PHASE_KEY_SHERIFF);
    if (mergedQueue.includes(PHASE_KEY_EACH_DAY)) orderedQueue.push(PHASE_KEY_EACH_DAY);

    const advanceBaseIndex = () => {
      const nextIndex = nextBaseIndex(phaseState.baseIndex);
      phaseState = { ...phaseState, baseIndex: nextIndex };
      return nextIndex;
    };

    const setNextPhase = (nextKey) => {
      phaseState = { ...phaseState, previous: phaseKeyNow, current: nextKey, next: null, pendingInterphases: orderedQueue.slice(1) };
    };

    // If resolving an interphase, drop it and move to next interphase or base phase
    if (phaseKeyNow === PHASE_KEY_HUNTER || phaseKeyNow === PHASE_KEY_KNIGHT || phaseKeyNow === PHASE_KEY_SHERIFF) {
      const remainingQueue = orderedQueue.filter((key) => key !== phaseKeyNow);
      if (remainingQueue.length) {
        phaseState = { ...phaseState, previous: phaseKeyNow, current: remainingQueue[0], next: null, pendingInterphases: remainingQueue.slice(1) };
      } else {
        const nextIndex = phaseState.baseIndex;
        const nextBase = BASE_PHASE_SEQUENCE[nextIndex] ?? PHASE_KEY_EACH_NIGHT;
        phaseState = { ...phaseState, previous: phaseKeyNow, current: nextBase, next: null, pendingInterphases: [] };
      }
      persistPhaseState();
      return;
    }

    // Base phase bookkeeping
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

    // Decide next phase
    if (orderedQueue.length) {
      phaseState = {
        ...phaseState,
        previous: phaseKeyNow,
        current: orderedQueue[0],
        next: null,
        pendingInterphases: orderedQueue.slice(1),
        baseIndex: nextBaseIndex(BASE_PHASE_SEQUENCE.indexOf(phaseKeyNow))
      };
    } else {
      const nextIndex = nextBaseIndex(BASE_PHASE_SEQUENCE.indexOf(phaseKeyNow));
      const nextBase = BASE_PHASE_SEQUENCE[nextIndex] ?? PHASE_KEY_EACH_NIGHT;
      phaseState = {
        ...phaseState,
        previous: phaseKeyNow,
        current: nextBase,
        next: null,
        baseIndex: nextIndex,
        pendingInterphases: []
      };
    }
    persistPhaseState();
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
  const persistActorPrepChoices = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, { 'settings.actor_roles': actorPrepChoices.filter(Boolean) });
    } catch (error) {
      console.error('[session] unable to persist actor prep choices', error);
    }
  };

  async function resetSessionStateTemp() {
    if (!sessionId) return;
    resetLoading = true;
    // Local resets
    deadCharacters = [];
    pendingDeaths = [];
    infectedTargets = [];
    charmedTargets = [];
    consumedSpecialIds = [];
    activeSpecialIds = [];
    loversLinks = [];
    protectedTargets = [];
    victoryResult = {};
    sheriffHolderId = null;
    sheriffAvailable = true;
    sheriffDisabled = false;
    pendingSheriffSuccession = false;
    pendingJudgeExtraDay = false;
    judgeModalOpen = false;
    manipulatorAssignments = {};
    manipulatorDone = false;
    actorPrepDone = false;
    thiefPrepDone = false;
    thiefPrepChoices = ['', ''];
    childModelTarget = null;
    pendingHunterShot = false;
    preparationResolved = false;
    nightNumber = 0;
    dayNumber = 0;
    actorOriginalToken = null;
    actorCurrentRoleSlug = null;
    actorTempSpecialIds = [];
    actorState = { available: sanitizeActorRoles(actorRoles), consumed: [], currentNightChoice: null };
    foxState = { lastResult: null, available: true, lastNightUsed: null, lastNightUsedKey: null };
    childModelTarget = null;
    childConversionPending = false;
    houndChoice = null;
    houndSelection = null;
    houndModalOpen = false;
    knightPending = false;
    knightTargetId = null;
    woundedQueue = [];
    tokens = tokens.map((token) => {
      if (token.id === actorBaseTokenId && actorToken) {
        return actorToken;
      }
      return token;
    });
    // Reset phase state
    const prepQueue = buildPreparationQueue();
    phaseState = {
      previous: null,
      current: prepQueue[0] ?? PHASE_KEY_FIRST_NIGHT,
      next: PHASE_KEY_FIRST_NIGHT,
      pendingInterphases: [],
      pendingPreparation: prepQueue.slice(1),
      baseIndex: 0
    };
    try {
      await updateSession(sessionId, {
        game_phases: {
          previous: null,
          current: prepQueue[0] ?? PHASE_KEY_FIRST_NIGHT,
          next: PHASE_KEY_FIRST_NIGHT,
          phase_summary: [],
          pending_interphases: [],
          pending_preparation: prepQueue.slice(1),
          base_index: 0
        },
        'settings.manipulator_assignments': {},
        actor_state: {
          available: sanitizeActorRoles(actorRoles),
          consumed: [],
          currentNightChoice: null
        },
        fox_state: {
          lastResult: null,
          available: true,
          lastNightUsed: null,
          lastNightUsedKey: null
        }
      });
    } catch (error) {
      console.error('[session] reset failed', error);
    } finally {
      resetLoading = false;
    }
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
  const markerAssets = {
    charmed: '/markers/charmed-flute.png',
    protected: '/markers/defended-shield.png',
    lover: '/markers/lovers-heart.png',
    sheriff: '/markers/sheriff-star.png',
    seer: '/markers/seer-eye.png',
    model: '/markers/model-lantern.png',
    injured: '/markers/injured-wound.png',
    manipulated_blue: '/markers/manipulated-blue.png',
    manipulated_cream: '/markers/manipulated-cream.png'
  };
  const houndOptions = [
    {
      key: 'wolves',
      labelKey: 'session.hound.choice_wolves',
      image: roleImageSrc('werewolves', 'werewolf')
    },
    {
      key: 'village',
      labelKey: 'session.hound.choice_village',
      image: roleImageSrc('villagers', 'villager')
    }
  ];
  const MARKER_START_ANGLE = 45; // arranque en abajo-derecha
  const MARKER_MAX_SPREAD = 210;
  const MARKER_MIN_STEP = 28;
  const MARKER_RADIUS = 52;
  const statusMarkersFor = (token, _version = '') => {
    const markers = [];
    if (charmedTargets?.includes(token.id)) {
      markers.push({ type: 'charmed', icon: markerAssets.charmed, title: 'Charmed' });
    }
    if (lastProtectedTargets?.includes(token.id)) {
      markers.push({ type: 'protected', icon: markerAssets.protected, title: 'Protected' });
    }
    if (loverIdsSet?.has(token.id)) {
      markers.push({ type: 'lover', icon: markerAssets.lover, title: 'Lover' });
    }
    if (sheriffHolderId === token.id) {
      markers.push({ type: 'sheriff', icon: markerAssets.sheriff, title: 'Sheriff' });
    }
    if (childModelTarget && token.id === childModelTarget) {
      markers.push({ type: 'model', icon: markerAssets.model, title: 'Model' });
    }
    if (woundedQueue.some((entry) => entry.id === token.id)) {
      markers.push({ type: 'injured', icon: markerAssets.injured, title: 'Wounded by Knight' });
    }
    if (manipulatorAssignments?.[token.id] === 'blue') {
      markers.push({ type: 'manipulated_blue', icon: markerAssets.manipulated_blue, title: 'Manipulated (blue)' });
    } else if (manipulatorAssignments?.[token.id] === 'cream') {
      markers.push({ type: 'manipulated_cream', icon: markerAssets.manipulated_cream, title: 'Manipulated (cream)' });
    }
    return markers;
  };
  const markerPlacementsFor = (token, version = '') => {
    const markers = [];
    if (seerPresent) {
      markers.push({
        type: 'seer',
        icon: markerAssets.seer,
        title: $t?.('session.preview.view_role') || 'View role',
        action: true,
        disabled: !seerActive
      });
    }
    markers.push(...statusMarkersFor(token, version));
    if (!markers.length) return [];
    const count = markers.length;
    const spread = Math.min(MARKER_MAX_SPREAD, Math.max(MARKER_MIN_STEP * (count - 1), 0));
    const step = count > 1 ? spread / (count - 1) : 0;
    return markers.map((marker, index) => ({
      ...marker,
      angle: MARKER_START_ANGLE - step * index
    }));
  };
  const isSheriffToken = (token) => slugifyRole(token?.role) === 'sheriff_badge';
  const ownerSlugForSpecial = (slug) => {
    switch (slug) {
      case 'cupid_hearts':
        return 'cupid';
      case 'piper_charm':
        return 'piper';
      case 'defender_shield':
        return 'defender';
      case 'witch_heal':
      case 'witch_venom':
        return 'witch';
      case 'hunter_bullet':
        return 'hunter';
      case 'thief_mask':
        return 'thief';
      case 'knight_sword':
        return 'knight';
      case 'werewolves_claws':
        return 'werewolf';
      case 'judge_maze':
        return 'judge';
      case 'white_claw':
        return 'white';
      case 'child_lighthouse':
        return 'child';
      case 'fox_senses':
        return 'fox';
      case 'knight_sword':
        return 'knight';
      case 'cursed_wolf_father':
      case 'father_bite':
        return 'cursed_wolf_father';
      default:
        return null;
    }
  };
  const allManipulatorAssigned = () => {
    const ids = characterTokens.map((t) => t.id);
    return ids.every((id) => manipulatorAssignments?.[id]);
  };

  $: if (normalizedPhaseKey === 'prep_manipulator' && !manipulatorModalOpen && !manipulatorDone) {
    manipulatorModalOpen = true;
  }

  const setManipulatorTeam = (tokenId, team) => {
    manipulatorAssignments = { ...(manipulatorAssignments ?? {}), [tokenId]: team };
  };

  const persistManipulatorAssignments = async () => {
    if (!sessionId) return;
    try {
      await updateSession(sessionId, { 'settings.manipulator_assignments': manipulatorAssignments });
    } catch (error) {
      console.error('[session] unable to persist manipulator assignments', error);
    }
  };
  const isWerewolfAligned = (id) => {
    const token = getTokenById(id);
    if (!token) return false;
    if (infectedIdSet.has(id)) return true;
    if (token.category === 'werewolves') return true;
    const slug = normalizeRoleSlug(slugifyRole(token.role));
    return (
      slug === 'werewolf' ||
      slug === 'bad' || // alias de Big Bad Wolf
      slug === 'big_bad_wolf' ||
      slug === 'white' ||
      slug === 'white_werewolf' ||
      slug === 'cursed_wolf_father' ||
      slug === 'father' ||
      slug === 'wolf_hound' ||
      slug === 'wild_child'
    );
  };
  const anyWerewolfAlignedAlive = () =>
    characterTokens.some((token) => !deadSet.has(token.id) && isWerewolfAligned(token.id));
  const specialOwnerAlive = (token) => {
    if (!token || token.category !== 'special') return true;
    const slug = slugifyRole(token.role);
    const ownerSlug = ownerSlugForSpecial(slug);
    if (!ownerSlug) return true; // ficha no vinculada a rol concreto
    const canonical = normalizeRoleSlug(ownerSlug);
    if (canonical === 'sheriff') {
      return includeSheriff && sheriffAvailable;
    }
    if (canonical === 'werewolf') {
      return (
        aliveRoleSet.has('werewolf') ||
        aliveRoleSet.has('werewolves') ||
        aliveRoleSet.has('bad') || // alias para Big Bad Wolf
        anyWerewolfAlignedAlive()
      );
    }
    if (canonical === 'hunter') {
      return tokens.some((t) => {
        if (t.category === 'special') return false;
        const isHunter = slugifyRole(t.role) === 'hunter';
        if (!isHunter) return false;
        return deadSet.has(t.id) || pendingDeaths.includes(t.id);
      });
    }
    if (canonical === 'knight') {
      return !knightPending && !aliveRoleSet.has('knight') ? false : true;
    }
    return aliveRoleSet.has(canonical);
  };
  const sheriffPhaseEligible = () =>
    !sheriffDisabled && (isPreparationPhase || isFirstDayPhase || isEachDayPhase || isSheriffInterphase);
  const openPreview = (token) => {
    if (!token || token.category === 'special') return;
    if (!seerActive) return;
    previewToken = token;
    previewOpen = true;
  };
  const closePreview = () => {
    previewToken = null;
    previewOpen = false;
  };

  const isPaletteDisabled = (token) => {
    if (!token || token.category !== 'special') return true;
    if (!specialOwnerAlive(token)) return true;
    const slug = slugifyRole(token.role);
    // Pool de preparación: todos los tokens deshabilitados salvo el badge en prep_sheriff o el token de división en prep_manipulator
    if (isPrepPhaseKey(normalizedPhaseKey)) {
      if (slug === 'sheriff_badge' && normalizedPhaseKey === 'prep_sheriff') return false;
      if (slug === 'manipulator_division' && normalizedPhaseKey === 'prep_manipulator') return false;
      return true;
    }
    if (slug === 'manipulator_division') {
      return normalizedPhaseKey !== 'prep_manipulator';
    }
    if (slug === 'fox_senses') {
      if (!foxAlive) return true;
      if (!isNightPhase) return true;
      if (foxState.lastResult === 'villagers') return true;
      if (!foxState.available) return true;
    }
    if (slug === 'judge_maze') {
      if (!judgeAlive) return true;
      if (consumedSpecialIds.includes(token.id)) return true;
      if (!isDayPhase) return true;
    }
    if (slug === 'manipulator_division') {
      if (normalizedPhaseKey !== 'prep_manipulator') return true;
    }
    if (slug === 'child_lighthouse') {
      if (!isFirstNightPhase) return true;
      if (consumedSpecialIds.includes(token.id)) return true;
    }
    if (slug === 'hound_choice') {
      if (!isFirstNightPhase) return true;
      if (consumedSpecialIds.includes(token.id)) return true;
    }
    if (slug === 'thief_mask') {
      if (!thiefAlive) return true;
      if (!isFirstNightPhase) return true;
      if (consumedSpecialIds.includes(token.id)) return true;
    }
    if (slug === 'knight_sword') {
      if (!knightPending) return true;
      if (consumedSpecialIds.includes(token.id)) return true;
      if (normalizedPhaseKey !== PHASE_KEY_KNIGHT) return true;
    }
    if (slug === 'white_claw') {
      if (!isNightPhase) return true;
      if (!whiteAlive) return true;
      if (!whiteClawActive) return true;
    }
    if (sheriffDisabled && slug === 'sheriff_badge') return true;
    if (isHunterInterphase) return slug !== 'hunter_bullet';
    if (isSheriffInterphase) return !isSheriffToken(token);
    if (isEndPhase) return true;
    if (normalizedPhaseKey === PHASE_KEY_PREPARATION) return slug !== 'sheriff_badge';
    if (isNightPhase) return slug === 'sheriff_badge' || slug === 'villagers_guillotine' || slug === 'hunter_bullet';
    if (isDayPhase) return !['villagers_guillotine', 'judge_maze'].includes(slug);
    if (isSheriffToken(token) && !sheriffPhaseEligible()) return true;
    return false;
  };

  function deploySpecialToken(token) {
    if (!token || token.category !== 'special') return;
    if (!specialOwnerAlive(token)) return;
    const slug = slugifyRole(token.role);
    if (sheriffDisabled && slug === 'sheriff_badge') return;
    // Phase gating
    if (isPaletteDisabled(token)) return;
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

  function resolveBoardEffects(currentPhaseKeyValue = normalizePhaseKey(phaseState.current)) {
    if (!tokens?.length) return;
    const characters = tokens.filter((token) => token.category !== 'special');
    const specials = tokens.filter((token) => token.category === 'special');
    const phaseKeyNow = currentPhaseKeyValue || currentPhaseKey();
    const isPreparationKey = phaseKeyNow === PHASE_KEY_PREPARATION;
    const isNightKey = phaseKeyNow === PHASE_KEY_FIRST_NIGHT || phaseKeyNow === PHASE_KEY_EACH_NIGHT;
    const isDayKey = phaseKeyNow === PHASE_KEY_FIRST_DAY || phaseKeyNow === PHASE_KEY_EACH_DAY;
    const isFirstNight = phaseKeyNow === PHASE_KEY_FIRST_NIGHT && nightNumber === 0;
    const isFirstDay = phaseKeyNow === PHASE_KEY_FIRST_DAY && dayNumber === 0;
    const previousSheriff = sheriffHolderId;

    const specialPlacements = [];
    const sheriffToken = specials.find((token) => slugifyRole(token.role) === 'sheriff_badge');
    const sheriffTokenId = sheriffToken?.id;
    const allowedSpecials = specials.filter((token) => {
      const slug = slugifyRole(token.role);
      if (!specialOwnerAlive(token)) return false;
      if (slug === 'white_claw' && !whiteClawActive) return false;
      if (phaseKeyNow === PHASE_KEY_HUNTER) return slug === 'hunter_bullet';
      if (phaseKeyNow === PHASE_KEY_KNIGHT) return slug === 'knight_sword';
      if (phaseKeyNow === PHASE_KEY_SHERIFF) return includeSheriff && slug === 'sheriff_badge';
      if (phaseKeyNow === PHASE_KEY_END) return false;
      if (pendingSheriffSuccession && slug === 'sheriff_badge') return true;
      if (isPreparationKey) return slug === 'sheriff_badge';
      if (isNightKey) return !['sheriff_badge', 'villagers_guillotine', 'hunter_bullet'].includes(slug);
      if (isDayKey) return ['villagers_guillotine', 'judge_maze'].includes(slug);
      return true;
    });
    console.info('[session] specials filter', {
      phaseKeyNow,
      isPreparationPhase: isPreparationKey,
      isNightPhase: isNightKey,
      isDayPhase: isDayKey,
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
    const wolfTargetsRaw = uniqueList((specialTargets.werewolves_claws ?? []).map((entry) => entry.targetId));
    const wolfTargets = wolfTargetsRaw.filter((id) => !isWerewolfAligned(id)); // los lobos no pueden eliminar a roles alineados con ellos
    const eliminationTargets = uniqueList((specialTargets.villagers_guillotine ?? []).map((entry) => entry.targetId));
    const hunterShotEntries = specialTargets.hunter_bullet ?? [];
    const hunterShotTargets = uniqueList(hunterShotEntries.map((entry) => entry.targetId));
    const childModelEntries = specialTargets.child_lighthouse ?? [];
    const childModelTargetResolved = childModelEntries[0]?.targetId ?? null;
    const houndChoiceEntries = specialTargets.hound_choice ?? [];
    const houndAnswered = houndChoiceEntries.length > 0 || houndChoice;
    const knightSwordEntries = specialTargets.knight_sword ?? [];
    const knightTargetResolved = knightSwordEntries[0]?.targetId ?? null;
    const infectionTargetsCurrent = uniqueList(
      [...(specialTargets.cursed_wolf_father ?? []), ...(specialTargets.father_bite ?? [])].map((entry) => entry.targetId)
    );
    if (
      phaseKeyNow === PHASE_KEY_FIRST_NIGHT &&
      childAlive &&
      childSpecialId &&
      !consumedSpecialIds.includes(childSpecialId) &&
      !childModelTargetResolved &&
      !childModelTarget
    ) {
      showToast({
        message: $t?.('session.errors.child_model_required') ?? 'The Wild Child must choose a role model before advancing.',
        variant: 'error'
      });
      return false;
    }
    if (
      phaseKeyNow === PHASE_KEY_KNIGHT &&
      knightPending &&
      !(specialTargets.knight_sword ?? []).length
    ) {
      showToast({
        message: $t?.('session.errors.knight_target_required') ?? 'You must mark the wounded werewolf for the Knight.',
        variant: 'error'
      });
      return false;
    }
    if (
      phaseKeyNow === PHASE_KEY_KNIGHT &&
      knightPending &&
      knightTargetResolved &&
      !isWerewolfAligned(knightTargetResolved)
    ) {
      showToast({
        message: $t?.('session.errors.knight_target_required') ?? 'You must mark the wounded werewolf for the Knight.',
        variant: 'error'
      });
      return false;
    }
    if (
      phaseKeyNow === PHASE_KEY_FIRST_NIGHT &&
      houndAlive &&
      houndSpecialId &&
      !consumedSpecialIds.includes(houndSpecialId) &&
      !houndAnswered
    ) {
      showToast({
        message: $t?.('session.errors.hound_alignment_required') ?? 'The Wolf-Hound must choose alignment before advancing.',
        variant: 'error'
      });
      return false;
    }
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
    const whiteClawEntries = specialTargets.white_claw ?? [];
    const whiteClawTargets = uniqueList(whiteClawEntries.map((entry) => entry.targetId)).filter(
      (id) => id && isWerewolfAligned(id) && (!whiteBaseTokenId || id !== whiteBaseTokenId)
    );
    const sheriffAssignments = specialTargets.sheriff_badge ?? [];
    const sheriffTarget = sheriffAssignments[0]?.targetId ?? null;
    const piperTargets = uniqueList((specialTargets.piper_charm ?? []).map((entry) => entry.targetId));
    const usedPotionIds = [
      ...(specialTargets.witch_heal ?? []).map((entry) => entry.tokenId),
      ...(specialTargets.witch_venom ?? []).map((entry) => entry.tokenId)
    ];
    const usedHunterBulletIds = hunterShotEntries.map((entry) => entry.tokenId);
    const usedCupidIds = cupidEntries.map((entry) => entry.tokenId);
    const usedPiperIds = (specialTargets.piper_charm ?? []).map((entry) => entry.tokenId);
    const usedFatherIds = [
      ...(specialTargets.cursed_wolf_father ?? []).map((entry) => entry.tokenId),
      ...(specialTargets.father_bite ?? []).map((entry) => entry.tokenId)
    ];
    const usedChildIds = (specialTargets.child_lighthouse ?? []).map((entry) => entry.tokenId);
    const usedHoundIds = (specialTargets.hound_choice ?? []).map((entry) => entry.tokenId);
    const usedKnightIds = (specialTargets.knight_sword ?? []).map((entry) => entry.tokenId);

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
    if (childModelTargetResolved) {
      childModelTarget = childModelTargetResolved;
    }
    if (houndChoiceEntries.length && !houndChoice) {
      houndChoice = houndChoiceEntries[0]?.targetId === 'wolves' ? 'wolves' : 'village';
    }
    const woundedSet = new Set(woundedQueue.map((entry) => entry.id));
    if (phaseKeyNow === PHASE_KEY_KNIGHT && knightTargetResolved && isWerewolfAligned(knightTargetResolved)) {
      knightTargetId = knightTargetResolved;
      const due = (nightNumber || 0) + 1;
      woundedQueue = [...woundedQueue, { id: knightTargetResolved, dueNight: due }];
      const stamp = new Date().toLocaleTimeString();
      const woundedName = nameForToken(knightTargetResolved);
      logEntries = [
        { text: ($t?.('session.logbook.knight_retaliates', { target: woundedName }) ?? `Knight wounds ${woundedName}`), stamp },
        ...logEntries
      ];
    }

    const deaths = new Set([...wolfTargets, ...venomTargets, ...eliminationTargets]);
    hunterShotTargets.forEach((id) => deaths.add(id));
    healTargets.forEach((id) => deaths.delete(id));
    const woundDueNow = isNightKey
      ? woundedQueue.filter((entry) => entry.dueNight && entry.dueNight <= (nightNumber || 0)).map((entry) => entry.id)
      : [];
    woundDueNow.forEach((id) => deaths.add(id));
    const knightKilledByWolves =
      knightTokenId && wolfTargetsRaw.includes(knightTokenId) && deaths.has(knightTokenId) && !infectionTargetsUnique.includes(knightTokenId);
    if (knightKilledByWolves) {
      knightPending = true;
      knightTargetId = null;
    }
    // Defender: solo protege de garras y solo si no fue protegido la noche anterior.
    const effectiveDefenders = defenderTargets.filter((id) => !lastProtectedTargets.includes(id));
    const defendedWolfTargets = wolfTargets.filter((id) => effectiveDefenders.includes(id));
    defendedWolfTargets.forEach((id) => deaths.delete(id));
    // Infection overrides death for targets hit by wolves and marked by father bite.
    const isElder = (id) => canonicalInfectedSlug(getTokenById(id)?.role) === 'elder';

    const infectionSet = new Set(infectionTargetsUnique);
    infectionTargetsUnique.forEach((id) => {
      if (deaths.has(id) && wolfTargets.includes(id)) {
        deaths.delete(id);
      }
    });
    const whiteClawKills = new Set(whiteClawTargets);

    if (childModelTargetResolved && childTokenId) {
      const stamp = new Date().toLocaleTimeString();
      const modelName = nameForToken(childModelTargetResolved);
      logEntries = [
        { text: ($t?.('session.logbook.child_model_chosen', { model: modelName }) ?? `Wild Child chooses ${modelName} as model`), stamp },
        ...logEntries
      ];
    }

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

    // White claw kills are unstoppable (no heal/defense) and only affect wolf-aligned targets.
    whiteClawKills.forEach((id) => {
      deaths.add(id);
      infectionSet.delete(id);
    });

    // Wounded queue: mark resolved entries when targets fall.
    woundedQueue = woundedQueue.map((entry) =>
      deaths.has(entry.id) || deadSet.has(entry.id) ? { ...entry, resolved: true, dueNight: null } : entry
    );

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
    const angelFallsNight = angelId && deaths.has(angelId) && isFirstNight;
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
    if (whiteClawTargets.length) summary.push(`White claw: ${whiteClawTargets.map(nameForToken).join(', ')}`);
    if (hunterShotTargets.length) summary.push(`Hunter: ${hunterShotTargets.map(nameForToken).join(', ')}`);
    const idiotSurvivors = [];
    if (isDayPhase) {
      // El tonto del pueblo sobrevive si es ejecutado de día, pero pierde voto.
      const idiotDeaths = Array.from(deaths).filter(
        (id) => normalizeRoleSlug(slugifyRole(getTokenById(id)?.role)) === 'idiot'
      );
      if (idiotDeaths.length) {
        idiotDeaths.forEach((id) => deaths.delete(id));
        idiotSurvivors.push(...idiotDeaths);
      }
    }
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

    // Wild Child conversion if model dies and child survives this phase.
    const childToken = childTokenId ? getTokenById(childTokenId) : null;
    const childAlreadyWolf = normalizeRoleSlug(slugifyRole(childToken?.role)) === 'werewolf';
    if (
      childToken &&
      !childAlreadyWolf &&
      childModelTarget &&
      (deaths.has(childModelTarget) || deadSet.has(childModelTarget)) &&
      !deaths.has(childTokenId)
    ) {
      tokens = tokens.map((token) =>
        token.id === childTokenId
          ? {
              ...token,
              role: 'werewolf',
              category: 'werewolves',
              image: roleImageSrc('werewolves', 'werewolf')
            }
          : token
      );
      const stamp = new Date().toLocaleTimeString();
      logEntries = [
        { text: ($t?.('session.logbook.child_turns_wolf') ?? 'Wild Child becomes a Werewolf'), stamp },
        ...logEntries
      ];
    }

    // Wolf-Hound alignment application (only matters if still alive).
    const houndToken = houndTokenId ? getTokenById(houndTokenId) : null;
    if (houndToken && !deaths.has(houndTokenId) && houndChoice) {
      const becomesWolf = houndChoice === 'wolves';
      tokens = tokens.map((token) =>
        token.id === houndTokenId
          ? {
              ...token,
              role: becomesWolf ? 'werewolf' : 'villager',
              category: becomesWolf ? 'werewolves' : 'villagers',
              image: roleImageSrc(becomesWolf ? 'werewolves' : 'villagers', becomesWolf ? 'werewolf' : 'villager')
            }
          : token
      );
      const stamp = new Date().toLocaleTimeString();
      logEntries = [
        {
          text:
            becomesWolf
              ? $t?.('session.logbook.hound_joined_wolves') ?? 'Wolf-Hound joins the werewolves'
              : $t?.('session.logbook.hound_remains_villager') ?? 'Wolf-Hound stays with the villagers',
          stamp
        },
        ...logEntries
      ];
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
      pendingSheriffSuccession = false;
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
        pendingSheriffSuccession = false;
      } else {
        sheriffDisabled = false;
        sheriffAvailable = true;
        sheriffNotes.push(`${$t('session.sheriff.lost')}: ${lostName}`);
        if (sheriffTokenId) {
          consumedSpecialIds = consumedSpecialIds.filter((id) => id !== sheriffTokenId);
        }
        pendingSheriffSuccession = true;
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
    // Idiot pierde el voto si sobrevivió al ajusticiamiento.
    if (idiotSurvivors.length) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [
        { text: `${$t('session.phases.steps.idiot') || 'Idiot'} survives the vote and loses voting rights`, stamp },
        ...logEntries
      ];
    }
    const cupidConsumption = cupidTargets.length >= 2 ? usedCupidIds : [];
    consumedSpecialIds = addToSet(consumedSpecialIds, [
      ...usedPotionIds,
      ...cupidConsumption,
      ...usedFatherIds,
      ...usedHunterBulletIds,
      ...usedChildIds,
      ...usedHoundIds,
      ...usedKnightIds
    ]);
    const deadHunters = characters
      .filter((token) => slugifyRole(token.role) === 'hunter')
      .map((token) => token.id)
      .filter((id) => deaths.has(id));
    const availableHunterBullets = specials.filter(
      (token) => slugifyRole(token.role) === 'hunter_bullet' && !consumedSpecialIds.includes(token.id)
    );
    pendingHunterShot = deadHunters.length > 0 && availableHunterBullets.length > 0;
    const computedVictory = evaluateVictory(characters, deadCharacters, lovers, infectedTargets, charmedTargets);
    if (computedVictory.whiteSolo && !whiteSoloActive) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [
        {
          text: 'White se queda como único lobo: los hombres lobo ya no pueden ganar; White debe eliminar a todos los demás para vencer.',
          stamp
        },
        ...logEntries
      ];
    }
    whiteSoloActive = computedVictory.whiteSolo;
    if (computedVictory.white) {
      const stamp = new Date().toLocaleTimeString();
      logEntries = [{ text: 'White wins — finish', stamp }, ...logEntries];
    }
    victoryResult = { ...computedVictory, angel: angelWin || computedVictory.angel };
    if (Object.values(victoryResult).some(Boolean)) {
      phaseState = { ...phaseState, previous: phaseKeyNow, current: PHASE_KEY_END, next: PHASE_KEY_END, pendingInterphases: [] };
      persistPhaseState();
      return;
    }
    if (isNightKey) {
      lastProtectedTargets = defenderTargets;
    }

    // reset tokens de acción al panel lateral
    activeSpecialIds = sheriffHolderId && sheriffTokenId ? [] : [];
    resetSpecialPositions();
    return true;
  }

  function evaluateVictory(characters = [], deadList = [], lovers = [], infectedList = [], charmedList = []) {
    const dead = new Set(deadList);
    const alive = characters.filter((token) => !dead.has(token.id));
    const infectedSet = new Set(infectedList);
    const charmedSet = new Set(charmedList);
    const isWolfAligned = (token) => {
      if (infectedSet.has(token.id)) return true;
      if (token.category === 'werewolves') return true;
      const slug = normalizeRoleSlug(slugifyRole(token.role));
      return (
        slug === 'werewolf' ||
        slug === 'bad' ||
        slug === 'big_bad_wolf' ||
        slug === 'white' ||
        slug === 'white_werewolf' ||
        slug === 'cursed_wolf_father' ||
        slug === 'father' ||
        slug === 'wolf_hound' ||
        slug === 'wild_child'
      );
    };
    const whiteAlive = alive.some(
      (token) => normalizeRoleSlug(slugifyRole(token.role)) === 'white' && !infectedSet.has(token.id)
    );
    const aliveWolvesAll = alive.filter(isWolfAligned);
    const otherAliveWolves = aliveWolvesAll.filter(
      (token) => normalizeRoleSlug(slugifyRole(token.role)) !== 'white'
    );
    const whiteSoloMode = whiteAlive && otherAliveWolves.length === 0;
    const aliveOthers = alive.length - aliveWolvesAll.length;
    const whiteSoloWin = whiteSoloMode && alive.length === 1;
    const villageWins = !whiteAlive && otherAliveWolves.length === 0;
    const werewolvesWin = !whiteSoloMode && aliveWolvesAll.length > 0 && aliveWolvesAll.length >= aliveOthers;

    let loversWin = false;
    if (lovers.length) {
      const loverIds = new Set(lovers.flat());
      const aliveIds = new Set(alive.map((token) => token.id));
      const allAliveAreLovers = alive.every((token) => loverIds.has(token.id));
      const allLoversAlive = Array.from(loverIds).every((id) => aliveIds.has(id));
      loversWin = loverIds.size > 0 && allAliveAreLovers && allLoversAlive;
    }

    const piperToken = characters.find((token) => slugifyRole(token.role) === 'piper');
    const piperAlive = piperToken && !dead.has(piperToken.id);
    const piperWin =
      piperAlive &&
      alive
        .filter((token) => slugifyRole(token.role) !== 'piper')
        .every((token) => charmedSet.has(token.id));

    return {
      village: villageWins,
      werewolves: werewolvesWin,
      lovers: loversWin,
      piper: piperWin,
      white: whiteSoloWin,
      whiteSolo: whiteSoloMode,
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
        <div class="token-palette" aria-hidden={paletteSpecialTokens.length === 0}>
          {#each paletteSpecialTokens as token}
            <button
              type="button"
              class={`palette-token ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''} ${!consumedSpecialIds.includes(token.id) && !activeSpecialIds.includes(token.id) && !isPaletteDisabled(token) ? 'palette-token--highlight' : ''}`}
              title={token.role}
              disabled={
                (token.id === ACTOR_TOKEN_ID && (actorActionDisabled || isPreparationPhase)) ||
                consumedSpecialIds.includes(token.id) ||
                activeSpecialIds.includes(token.id) ||
                isPaletteDisabled(token)
              }
              on:click={() => {
                if (token.id === ACTOR_TOKEN_ID) {
                  console.info('[actor] click actor token', { actorActionDisabled, isNightPhase, actorRemaining });
                  if (!actorActionDisabled) openActorModal();
                } else if (slugifyRole(token.role) === 'fox_senses') {
                  if (foxAlive && foxState.available && isNightPhase) {
                    foxSelection = null;
                    foxModalOpen = true;
                  }
                } else if (slugifyRole(token.role) === 'judge_maze') {
                  judgeModalOpen = true;
                } else if (slugifyRole(token.role) === 'hound_choice') {
                  houndSelection = houndChoice;
                  houndModalOpen = true;
                } else if (slugifyRole(token.role) === 'thief_mask') {
                  openThiefModal(token.id);
                } else if (slugifyRole(token.role) === 'manipulator_division') {
                  manipulatorModalOpen = true;
                } else {
                  deploySpecialToken(token);
                }
              }}
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
          {#each characterTokens as token (token.id + (infectedIdSet.has(token.id) ? '-infected' : '-clean') + manipulatorMarkersVersion)}
            <button
              type="button"
              class={`role-token category-${displayCategory(token)} ${consumedSpecialIds.includes(token.id) ? 'token-consumed' : ''} ${deadSet.has(token.id) ? 'token-dead' : ''} ${infectedTargets.includes(token.id) ? 'token-infected' : ''}`}
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
              <span class="token-circle-wrapper">
                <span class="token-circle">
                  {#if displayImage(token)}
                    <img src={displayImage(token)} alt={token.role} draggable="false" />
                  {:else}
                    <span class="token-initials">{token.role?.[0] ?? '?'}</span>
                  {/if}
                </span>
                <div class="token-markers">
                  {#each markerPlacementsFor(token) as marker (marker.type)}
                    {#if marker.action}
                      <div
                        class="token-marker token-marker--action"
                        style={`--marker-angle:${marker.angle}deg; --marker-radius:${MARKER_RADIUS}px;`}
                        aria-label={marker.title}
                        role="button"
                        tabindex="0"
                        aria-disabled={marker.disabled}
                        on:click|stopPropagation={() => !marker.disabled && openPreview(token)}
                        on:pointerdown|stopPropagation
                        on:keydown|stopPropagation={(event) => {
                          if (marker.disabled) return;
                          if (event.key === 'Enter' || event.key === ' ') openPreview(token);
                        }}
                      >
                        <img src={marker.icon} alt="" aria-hidden="true" />
                      </div>
                    {:else}
                      <span
                        class="token-marker"
                        style={`--marker-angle:${marker.angle}deg; --marker-radius:${MARKER_RADIUS}px;`}
                        title={marker.title}
                        aria-hidden="true"
                      >
                        <img src={marker.icon} alt="" />
                      </span>
                    {/if}
                  {/each}
                </div>
              </span>
              <span class="token-role" aria-hidden="true">{shortRoleLabel(token)}</span>
              <span class="sr-only">{shortRoleLabel(token)}</span>
              {#if deadSet.has(token.id)}
                <span class="token-badge token-badge--dead" aria-hidden="true">✖</span>
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
        <button class="btn ghost btn--size-sm" type="button" on:click={evaluatePhase} disabled={finishEnabled || isEndPhase}>
          {$t('session.controls.evaluate_phase')}
        </button>
        <button class="btn danger btn--size-sm" type="button" on:click={resetSessionStateTemp} disabled={resetLoading}>
          Reset (temp)
        </button>
        <button class="btn danger btn--size-sm" type="button" on:click={finishSession} disabled={!finishEnabled}>
          {$t('session.controls.finish')}
        </button>
        <button class="btn danger btn--size-sm" type="button" on:click={cancelSession}>{$t('session.controls.cancel')}</button>
      </div>
    </div>
  </Footbar>

  <Modal
    open={manipulatorModalOpen}
    title={$t?.('session.prep.manipulator') ?? 'Manipulator'}
    size="lg"
    closeOnBackdrop={false}
    showClose={false}
    on:close={() => (manipulatorModalOpen = false)}
  >
        <div class="manipulator-modal">
          <div class="manipulator-grid">
            {#each characterTokens as token}
              <div class="manipulator-row">
                <div class="manipulator-role">
                  <img src={token.image} alt={token.role} class="manipulator-avatar" />
                  <span>{token.player ?? token.role}</span>
                </div>
                <div class="manipulator-actions">
                  <button
                    type="button"
                    class={`manipulator-chip ${manipulatorAssignments?.[token.id] === 'blue' ? 'selected' : ''}`}
                    on:click={() => setManipulatorTeam(token.id, 'blue')}
                    aria-pressed={manipulatorAssignments?.[token.id] === 'blue'}
                  >
                    <img src="/markers/manipulated-blue.png" alt="Blue team" />
                  </button>
                  <button
                    type="button"
                    class={`manipulator-chip ${manipulatorAssignments?.[token.id] === 'cream' ? 'selected' : ''}`}
                    on:click={() => setManipulatorTeam(token.id, 'cream')}
                    aria-pressed={manipulatorAssignments?.[token.id] === 'cream'}
                  >
                    <img src="/markers/manipulated-cream.png" alt="Cream team" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
          <div class="modal-actions">
            <button class="btn primary" type="button" on:click={() => {
              const msgKey = $t?.('session.errors.manipulator_assign');
              const errText =
                msgKey && msgKey !== 'session.errors.manipulator_assign'
                  ? msgKey
                  : 'Assign all roles to a team before continuing.';
              if (!allManipulatorAssigned()) {
                showToast({
                  message: errText,
                  variant: 'error'
                });
                return;
              }
              // Forzar reactividad y pintar marcadores inmediatamente
              manipulatorAssignments = { ...(manipulatorAssignments ?? {}) };
              manipulatorDone = true;
              persistManipulatorAssignments();
              manipulatorModalOpen = false;
            }}>
              {$t('common.actions.done')}
            </button>
          </div>
    </div>
  </Modal>

  <Modal
    open={actorPrepModalOpen}
    title={$t('session.prep.actor_characters') ?? "The Actor's Characters"}
    size="lg"
    closeOnBackdrop={false}
    showClose={false}
    on:close={() => (actorPrepModalOpen = false)}
  >
    <div class="prep-actor-modal">
      <p class="prep-actor-subtitle">{$t('session.prep.actor_subtitle') ?? 'Choose up to 3 villagers.'}</p>
      <div class="prep-actor-slots">
        {#each actorPrepChoices as choice, index}
          <RoleSlotPicker
            value={choice}
            title={choice ? cleanActorName(choice) : ''}
            image={choice ? roleImageSrc(getRoleDefinition(choice)?.category ?? 'villagers', slugifyRole(choice)) : ''}
            labelEmpty={$t('configure.role_preview_empty') ?? 'Select villager'}
            removable={!actorPrepDone}
            on:pick={() => openActorPrepPicker(index)}
            on:clear={() => (actorPrepChoices = actorPrepChoices.map((v, i) => (i === index ? '' : v)))}
          />
        {/each}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" type="button" on:click={fillActorPrepSlots}>
          {$t('common.actions.autofill') ?? 'Autofill'}
        </button>
        <button
          class="btn primary"
          type="button"
          on:click={() => {
            actorPrepDone = true;
            persistActorPrepChoices();
            actorPrepModalOpen = false;
          }}
        >
          {$t('common.actions.done')}
        </button>
      </div>
    </div>
  </Modal>

  <Modal
    open={thiefPrepModalOpen}
    title={$t('session.prep.thief_roles') ?? "Thief's Roles"}
    size="lg"
    closeOnBackdrop={false}
    showClose={false}
    on:close={() => (thiefPrepModalOpen = false)}
  >
    <div class="prep-actor-modal">
      <p class="prep-actor-subtitle">
        {$t('session.prep.thief_subtitle') ?? 'Select 2 roles for the Thief.'}
      </p>
      <div class="prep-actor-slots two">
        {#each thiefPrepChoices as choice, index}
          <RoleSlotPicker
            value={choice}
            title={choice ? cleanActorName(choice) : ''}
            image={choice ? roleImageSrc(getRoleDefinition(choice)?.category ?? 'villagers', slugifyRole(choice)) : ''}
            labelEmpty={$t('session.prep.thief_slot_label') ?? 'Select role'}
            removable={true}
            on:pick={() => openThiefPrepPicker(index)}
            on:clear={() => (thiefPrepChoices = thiefPrepChoices.map((v, i) => (i === index ? '' : v)))}
          />
        {/each}
      </div>
      <div class="modal-actions">
        <button class="btn ghost" type="button" on:click={fillThiefPrepSlots}>
          {$t('common.actions.autofill') ?? 'Autofill'}
        </button>
        <button
          class="btn primary"
          type="button"
          on:click={() => {
            thiefPrepDone = true;
            thiefRoles = thiefPrepChoices.map((r) => normalizeRoleSlug(r));
            persistThiefPrepChoices();
            thiefPrepModalOpen = false;
          }}
        >
          {$t('common.actions.done')}
        </button>
      </div>
    </div>
  </Modal>

  <Modal
    open={thiefPickerOpen}
    title="Select a role"
    size="lg"
    closeOnBackdrop={true}
    showClose={true}
    on:close={() => (thiefPickerOpen = false)}
  >
    {#if thiefPickerOptions.length === 0}
      <p class="hint">{$t?.('configure.role_preview_empty') ?? 'No roles available'}</p>
    {:else}
      <RolePickerGrid
        showTitle={false}
        variant="storyteller"
        options={thiefPickerOptions.map((option) => ({
          id: option,
          label: cleanActorName(option),
          image: roleImageSrc(getRoleDefinition(option)?.category ?? 'villagers', slugifyRole(option)),
          selected: false,
          disabled: false
        }))}
        on:select={(event) => chooseThiefPrepRole(event.detail.id)}
      />
    {/if}
  </Modal>
  <Modal
    open={actorPickerOpen}
    title="Select a role"
    size="lg"
    closeOnBackdrop={true}
    showClose={true}
    on:close={() => (actorPickerOpen = false)}
  >
    {#if actorPickerOptions.length === 0}
      <p class="hint">{$t?.('configure.role_preview_empty') ?? 'No roles available'}</p>
    {:else}
      <RolePickerGrid
        showTitle={false}
        variant="storyteller"
        options={actorPickerOptions.map((option) => ({
          id: option,
          label: cleanActorName(option),
          image: roleImageSrc(getRoleDefinition(option)?.category ?? 'villagers', slugifyRole(option)),
          selected: false,
          disabled: false
        }))}
        on:select={(event) => chooseActorPrepRole(event.detail.id)}
      />
    {/if}
  </Modal>

  <style>
    .manipulator-modal {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .manipulator-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    .manipulator-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--surface-border, #333);
      border-radius: 8px;
      background: var(--surface-2, #0f1419);
    }
    .manipulator-role {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    .manipulator-role span {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .manipulator-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--surface-border, #333);
      background: #000;
    }
    .manipulator-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .manipulator-chip {
      width: 48px;
      height: 48px;
      border-radius: 8px;
      border: 1px solid var(--surface-border, #333);
      background: var(--surface-1, #131a20);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .manipulator-chip img {
      width: 40px;
      height: 40px;
      object-fit: contain;
    }
    .manipulator-chip.selected {
      border-color: var(--accent, #d4a017);
      box-shadow: 0 0 0 2px rgba(212, 160, 23, 0.3);
    }
    .prep-actor-modal {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .prep-actor-subtitle {
      opacity: 0.8;
      margin: 0;
      font-size: 0.95rem;
    }
    .prep-actor-slots {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
    }
    .prep-actor-slots.two {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    .prep-actor-tile {
      border: 1px solid var(--surface-border, #333);
      border-radius: 10px;
      background: var(--surface-2, #0f1419);
      min-height: 140px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      color: var(--text-primary, #fff);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }
    .prep-actor-inner {
      width: 100%;
      margin: 0;
    }
    .prep-actor-tile.filled {
      border-style: solid;
      box-shadow: 0 0 0 2px rgba(212, 160, 23, 0.2);
    }
    .prep-actor-tile img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--surface-border, #333);
    }
    .prep-actor-tile .plus {
      font-size: 1.4rem;
      opacity: 0.8;
    }
    .prep-actor-tile .label {
      font-size: 0.95rem;
      opacity: 0.8;
    }
    .prep-actor-tile .plus-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--surface-border, #333);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .prep-actor-tile .name {
      font-weight: 600;
      text-align: center;
      padding: 0 0.5rem;
    }
    .prep-actor-filled {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      width: 100%;
    }
    .prep-actor-filled-footer {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      justify-content: center;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 1px solid var(--surface-border, #333);
      background: var(--surface-1, #131a20);
      color: var(--text-primary, #fff);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      padding: 0;
    }
    .prep-actor-picker {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .prep-actor-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0.9rem;
    }
    .prep-actor-card {
      background: var(--surface-2, #0f1419);
      color: var(--text-primary, #fff);
      border: 1px solid var(--surface-border, #333);
      border-radius: 12px;
      padding: 0.9rem;
      min-height: 150px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease;
    }
    .prep-actor-card:hover {
      border-color: var(--accent, #d4a017);
      box-shadow: 0 0 0 2px rgba(212, 160, 23, 0.2);
      transform: translateY(-2px);
    }
    .prep-actor-card img {
      width: 84px;
      height: 84px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--surface-border, #333);
    }
    .prep-actor-card span {
      text-align: center;
      font-weight: 600;
      color: var(--text-primary, #fff);
    }
  </style>

  <Modal
    open={actorModalOpen}
    title="Choose a role to play"
    size="lg"
    closeOnBackdrop={true}
    showClose={false}
    on:close={closeActorModal}
  >
    {#if actorAvailable.length === 0}
      <p class="hint">{$t?.('configure.role_preview_empty') ?? 'No roles available'}</p>
    {:else}
      <RolePickerGrid
        title=""
        subtitle=""
        variant="player"
        options={actorAvailable.map((role) => {
          const slug = slugifyRole(role);
          return {
            id: slug,
            label: actorRoleLabel(role),
            image: roleImageSrc(getRoleDefinition(role)?.category ?? 'villagers', slug),
            disabled: actorConsumed.has(slug),
            selected: actorSelection === slug
          };
        })}
        showTitle={false}
        on:select={(event) => {
          const option = event.detail;
          if (option?.disabled) return;
          actorSelection = option.id;
        }}
      />
    {/if}
    <svelte:fragment slot="footer">
      <button class="btn ghost" type="button" on:click={closeActorModal}>
        {$t?.('common.actions.cancel') ?? 'Cancel'}
      </button>
      <button class="btn primary" type="button" on:click={confirmActorSelection} disabled={!actorSelection || actorConsumed.has(actorSelection)}>
        {$t?.('common.actions.done') ?? 'Done'}
      </button>
    </svelte:fragment>
  </Modal>

  <Modal
    open={foxModalOpen}
    title={$t?.('session.fox.modal_title') ?? 'Your search results'}
    size="md"
    closeOnBackdrop={true}
    showClose={false}
    on:close={closeFoxModal}
  >
    <RolePickerGrid
      showTitle={false}
      variant="player"
      options={foxOptions.map((option) => ({
        id: option.key,
        label: $t?.(`session.fox.option.${option.key}`) ?? option.key,
        image: option.image,
        selected: foxSelection === option.key,
        disabled: false
      }))}
      on:select={(event) => (foxSelection = event.detail.id)}
    />
    <svelte:fragment slot="footer">
      <button class="btn ghost" type="button" on:click={closeFoxModal}>
        {$t?.('common.actions.cancel') ?? 'Cancel'}
      </button>
      <button class="btn primary" type="button" on:click={confirmFoxSelection} disabled={!foxSelection}>
        {$t?.('common.actions.done') ?? 'Done'}
      </button>
    </svelte:fragment>
  </Modal>

  <Modal
    open={judgeModalOpen}
    title={$t?.('session.judge.modal_title') ?? 'Use the Judge’s deck?'}
    size="md"
    closeOnBackdrop={true}
    showClose={false}
    on:close={() => (judgeModalOpen = false)}
  >
    <p class="hint">{$t?.('session.judge.modal_body') ?? 'Adds an extra day phase immediately after this one. Single use.'}</p>
    <svelte:fragment slot="footer">
      <button class="btn ghost" type="button" on:click={() => (judgeModalOpen = false)}>
        {$t?.('common.actions.cancel') ?? 'Cancel'}
      </button>
      <button
        class="btn primary"
        type="button"
        on:click={() => {
          if (!judgeTokenId) return;
          pendingJudgeExtraDay = true;
          judgeModalOpen = false;
          consumedSpecialIds = addToSet(consumedSpecialIds, [judgeTokenId]);
          activeSpecialIds = activeSpecialIds.filter((id) => id !== judgeTokenId);
          const stamp = new Date().toLocaleTimeString();
          logEntries = [
            { text: $t?.('session.logbook.judge_extra_day') ?? 'Judge calls an extra day phase.', stamp },
            ...logEntries
          ];
        }}
      >
        {$t?.('common.actions.done') ?? 'Confirm'}
      </button>
    </svelte:fragment>
  </Modal>

  <Modal
    open={houndModalOpen}
    title={$t?.('session.hound.modal_title') ?? 'Choose between Werewolves or Villagers'}
    size="md"
    closeOnBackdrop={true}
    showClose={false}
    on:close={() => (houndModalOpen = false)}
  >
    <p class="hint">{$t?.('session.hound.modal_body') ?? 'Choose whether the Wolf-Hound sides with the wolves or stays with the villagers. Single use.'}</p>
    <RolePickerGrid
      showTitle={false}
      variant="player"
      options={houndOptions.map((option) => ({
        id: option.key,
        label: $t?.(option.labelKey) ?? option.key,
        image: option.image,
        selected: houndSelection === option.key,
        disabled: false
      }))}
      on:select={(event) => (houndSelection = event.detail.id)}
    />
    <svelte:fragment slot="footer">
      <button class="btn ghost" type="button" on:click={() => (houndModalOpen = false)}>
        {$t?.('common.actions.cancel') ?? 'Cancel'}
      </button>
      <button
        class="btn primary"
        type="button"
        disabled={!houndSelection}
        on:click={() => {
          if (!houndSpecialId || !houndSelection) return;
          houndChoice = houndSelection;
          consumedSpecialIds = addToSet(consumedSpecialIds, [houndSpecialId]);
          activeSpecialIds = activeSpecialIds.filter((id) => id !== houndSpecialId);
          houndModalOpen = false;
        }}
      >
        {$t?.('common.actions.done') ?? 'Done'}
      </button>
    </svelte:fragment>
  </Modal>

  <Modal
    open={thiefModalOpen}
    title="Choose a role to impersonate"
    size="md"
    closeOnBackdrop={true}
    showClose={false}
    on:close={() => (thiefModalOpen = false)}
  >
    <p class="hint">
      {$t?.('session.thief.modal_body') ??
      'Select one of the two roles. If both are wolf-aligned, the Thief must choose one of them. Single use.'}
    </p>
    {#if thiefOfferData.length === 0}
      <p class="empty-exclusions">{$t?.('session.thief.no_roles') ?? 'No roles available for the Thief.'}</p>
    {:else}
      <RolePickerGrid
        showTitle={false}
        variant="player"
        options={thiefOfferData.map((option) => ({
          id: option.slug,
          label: option.name,
          image: roleImageSrc(option.category, option.slug),
          selected: thiefChoice === option.slug,
          disabled: false
        }))}
        on:select={(event) => (thiefChoice = event.detail.id)}
      />
    {/if}
    <svelte:fragment slot="footer">
      <button class="btn ghost" type="button" on:click={() => (thiefModalOpen = false)}>
        {$t?.('common.actions.cancel') ?? 'Cancel'}
      </button>
      <button
        class="btn primary"
        type="button"
        disabled={
          thiefOfferData.length === 0 ||
          (thiefOffer.length === 2 && thiefOffer.every((slug) => isWolfAlignedSlug(slug)) && !thiefChoice)
        }
        on:click={applyThiefChoice}
      >
        {$t?.('common.actions.done') ?? 'Done'}
      </button>
    </svelte:fragment>
  </Modal>

  <Modal
    open={previewOpen}
    title={previewToken ? previewToken.role : ''}
    size="xl"
    closeOnBackdrop={true}
    showClose={false}
    on:close={closePreview}
  >
    {#if previewToken}
      <div class="preview-wrapper">
        <img src={displayImage(previewToken)} alt={previewToken.role} class="preview-image" />
        <p class="preview-caption">{previewToken.player ? `${previewToken.role} (${previewToken.player})` : previewToken.role}</p>
      </div>
    {/if}
    <svelte:fragment slot="footer">
      <button class="btn primary" type="button" on:click={closePreview}>{$t('common.actions.close')}</button>
    </svelte:fragment>
  </Modal>
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
    position: relative;
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

  .token-circle-wrapper {
    position: relative;
    width: 92px;
    height: 92px;
    display: grid;
    place-items: center;
    overflow: visible;
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
    z-index: 2;
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
    right: 36px;
    left: auto;
    top: auto;
  }
  .token-badge--lover { top: 4px; right: 6px; left: auto; bottom: auto; }
  .token-badge--dead { top: 50%; left: 50%; right: auto; bottom: auto; transform: translate(-50%, -50%); }

  .token-markers {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  }

  .token-marker {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.65);
    display: grid;
    place-items: center;
    transform: translate(-50%, -50%)
      rotate(var(--marker-angle, 0deg))
      translate(var(--marker-radius, 56px))
      rotate(calc(var(--marker-angle, 0deg) * -1));
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
    pointer-events: none;
  }

  .token-marker img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
  }

  .token-marker--action {
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0;
    background: rgba(0, 0, 0, 0.65);
    cursor: pointer;
    pointer-events: auto;
    transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
  }

  .token-marker--action:focus-visible {
    outline: 2px solid var(--color-gold-info);
    outline-offset: 2px;
  }

  .token-marker--action:hover {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .token-marker--action:disabled,
  .token-marker--action[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35), inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  }

  .preview-wrapper {
    display: grid;
    place-items: center;
    gap: 1rem;
    padding: 1rem;
  }

  .preview-image {
    max-width: min(420px, 80vw);
    max-height: 70vh;
    object-fit: contain;
  }

  .preview-caption {
    margin: 0;
    color: var(--color-white-muted);
    font-weight: 600;
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

  .palette-token--highlight .palette-token__circle {
    border-color: var(--color-gold-brand);
    box-shadow: 0 0 0 1px rgba(217, 179, 108, 0.5);
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

  .actor-modal-body {
    display: grid;
    gap: 1rem;
  }

  .actor-modal-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.9rem;
    overflow: visible;
    padding-top: 1rem;
  }

  .actor-card {
    background: rgba(8, 12, 20, 0.9);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: 0.9rem;
    display: grid;
    gap: 0.65rem;
    justify-items: center;
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease;
    color: var(--color-white-contrast);
  }

  .actor-card img {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 50%;
    background: #0d1320;
    border: 1px solid var(--glass-hover);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);
  }

  .actor-card.selected {
    border-color: var(--surface-border, #333);
    box-shadow: none;
  }

  .actor-card.consumed {
    cursor: not-allowed;
    opacity: 0.35;
    filter: grayscale(1);
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

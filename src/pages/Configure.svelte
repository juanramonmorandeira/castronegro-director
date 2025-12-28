<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import PropertiesModal from '../components/config/Properties.svelte';
  import SelectionModal from '../components/config/Selection.svelte';
  import MatchModal from '../components/config/Match.svelte';
  import ShareModal from '../components/config/Share.svelte';
  import NavActions from '../components/ui/NavActions.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import { NAV_INTENT } from '../lib/navigation.js';
  import { showToast } from '../lib/toast.js';
  import { t } from '../lib/i18n.js';
  import { getSessionById, updateSession, subscribeToSession, savePlayerRoleAssignments } from '../lib/db.js';
  import { getGamesMetadata, getAssistTasks, getBalanceTable, getResourcesTable } from '../lib/gameMetadata.js';
  import {
    ROLE_CATEGORIES as ROLE_BREAKDOWN_ORDER,
    DUPLICATE_ROLE_NAMES,
    createEmptyRoleSelection,
    normalizeRoleSelection,
    roleImageSrc,
    slugifyRole,
    buildDistributionTokens,
    flattenRoleSelection
  } from '../lib/roles.js';
  import { mapPlayers, computePlayerCounts } from '../lib/players.js';

  export let sessionId;
  export let user = null;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;

  const dispatch = createEventDispatcher();

  const dateOptions = Intl.DateTimeFormat().resolvedOptions();
  const tz = dateOptions.timeZone || 'UTC';
  const clockLocale = dateOptions.locale || 'en-GB';

  const metadata = getGamesMetadata();
  const balanceTable = getBalanceTable();
  const resourcesTable = getResourcesTable();
  const rawAssistTasks = getAssistTasks();

  const minPlayers = 5;
  const maxPlayers = 15;

  const availableRulesets = metadata?.rulesets_values?.length
    ? metadata.rulesets_values
    : ['basic'];
  const availableStorytellers = metadata?.storyteller_values?.length
    ? metadata.storyteller_values
    : ['human', 'human-AI', 'AI'];
  const availableLanguages = metadata?.language_values?.length
    ? metadata.language_values
    : ['en'];
  const defaultLanguage = availableLanguages[0] ?? 'en';
  const DEFAULT_ACTOR_EXCLUSIONS = [];
  const DEFAULT_THIEF_EXCLUSIONS = [];

  const DEFAULT_ASSIST_TASKS = [
    'Roles_Selection',
    'Roles_Matching',
    'Introduction',
    'Night',
    'Day',
    'Votes',
    'Execution',
    'Summary',
    'Logbook'
  ];

  const assistTaskOptions = rawAssistTasks?.length
    ? [
        ...DEFAULT_ASSIST_TASKS.filter((task) => rawAssistTasks.includes(task)),
        ...rawAssistTasks.filter((task) => !DEFAULT_ASSIST_TASKS.includes(task))
      ]
    : DEFAULT_ASSIST_TASKS;

  const ASSIST_TASK_TRANSLATIONS = {
    Roles_Selection: 'roles_selection',
    Roles_Matching: 'roles_matching',
    Introduction: 'introduction',
    Night: 'night',
    Day: 'day',
    Votes: 'votes',
    Execution: 'execution',
    Summary: 'summary',
    Logbook: 'logbook'
  };

  const clampPlayers = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return minPlayers;
    return Math.min(Math.max(numeric, minPlayers), maxPlayers);
  };

  const readableTask = (task) => task.replace(/_/g, ' ');

  function categoryTotal(category, selection = selectedRoles) {
    return Object.values(selection?.[category] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  const normalizeMixOverride = (mix) => {
    if (!mix || typeof mix !== 'object') return null;
    const keys = ['villagers', 'ambiguous', 'werewolves', 'loners'];
    const normalized = {};
    keys.forEach((key) => {
      const value = Number(mix?.[key]);
      normalized[key] = Number.isFinite(value) ? value : 0;
    });
    return normalized;
  };

  function buildAutoSelection() {
    if (!playerBreakdown || !rulesetRoles) return selectedRoles;
    const next = createEmptyRoleSelection();
    for (const category of ROLE_BREAKDOWN_ORDER) {
      let remaining = playerBreakdown?.[category] ?? 0;
      if (!remaining) continue;
      const pool = rulesetRoles?.[category] ?? [];
      for (const role of pool) {
        if (remaining <= 0) break;
        const lower = slugifyRole(role);
        if (DUPLICATE_ROLE_NAMES.has(lower)) {
          next[category][role] = remaining;
          remaining = 0;
        } else if (!next[category][role]) {
          next[category][role] = 1;
          remaining -= 1;
        }
      }
      if (remaining > 0 && pool.length) {
        const fallback = pool.find((role) => DUPLICATE_ROLE_NAMES.has(slugifyRole(role))) ?? pool[0];
        next[category][fallback] = (next[category][fallback] ?? 0) + remaining;
      }
    }
    return next;
  }

let loading = true;
let saving = false;
let forceStartHintVisible = false;
let overrideRoleLimits = false;
let includeSheriff = true;
let includeTownCrier = true;
let tweakRoleMix = false;
let roleMixOverride = null;
let basePlayerBreakdown = null;
let activeModal = null;
  let connectedCount = 0;
  let readyCount = 0;
  let sessionStatus = 'draft';
  let form = {
    name: '',
    game_id: '',
    description: '',
    rulesets: metadata?.defaults?.rulesets ?? availableRulesets[0],
    players_expected: metadata?.defaults?.players_expected ?? minPlayers,
    storyteller: metadata?.defaults?.storyteller ?? availableStorytellers[0],
    language: metadata?.defaults?.language ?? defaultLanguage,
    assistEnabled: metadata?.defaults?.assist_enabled ?? false,
    assistTasks: [],
    include_sheriff: true,
    include_town_crier: false
  };

  if (form.storyteller === 'AI' || form.storyteller === 'human-AI') {
    form.assistEnabled = true;
  } else {
    form.assistEnabled = false;
  }

let selectedRoles = createEmptyRoleSelection();
let rolesCustomized = false;
let selectedActorRoles = [];
let selectedThiefRoles = [];
let selectedActorExclusions = [...DEFAULT_ACTOR_EXCLUSIONS];
  let selectedThiefExclusions = [...DEFAULT_THIEF_EXCLUSIONS];
  let seatingOrder = [];
let autoSeedKey = '';
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'info';
  let alertTitle = '';
  let livePlayers = {};
  let playerList = [];
  let playerAssignments = {};
  let distributionTokens = [];
  let testPlayers = [];
let matchPlayers = [];
  let sessionUnsubscribe = null;

  const countEntries = (value) => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return 0;
  };

  const prettifyTestAlias = (playerId) => {
    if (typeof playerId !== 'string' || !playerId.startsWith('test-')) return null;
    const parts = playerId.split('-').slice(1); // remove "test"
    // Remove trailing numeric parts (timestamp + random suffix).
    while (parts.length && /^\d+$/.test(parts[parts.length - 1])) {
      parts.pop();
    }
    const name = parts.join(' ');
    if (!name) return null;
    return name.replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const deriveTestPlayers = (assignments = {}, knownPlayers = []) => {
    const knownIds = new Set((knownPlayers ?? []).map((player) => player.id));
    return Object.entries(assignments ?? {})
      .filter(([playerId]) => !knownIds.has(playerId))
      .map(([playerId, data]) => ({
        id: playerId,
        alias: data?.alias || data?.player || prettifyTestAlias(playerId) || playerId,
        ready: true
      }));
  };

  function updatePlayerStats(players = {}, legacyReadySource = null) {
    livePlayers = players && typeof players === 'object' ? players : {};
    const counts = computePlayerCounts(livePlayers);
    const fallbackConnected = countEntries(livePlayers);
    const legacyReady = countEntries(
      legacyReadySource ??
        {}
    );
    connectedCount = counts.connected || fallbackConnected;
    readyCount = Math.max(counts.ready, legacyReady);
    playerList = mapPlayers(livePlayers);
  }

  function handleSessionSnapshot(snapshot) {
    if (!snapshot) return;
    sessionStatus = snapshot.status ?? sessionStatus;
    playerAssignments = snapshot.player_roles ?? {};
    seatingOrder = Array.isArray(snapshot.settings?.seating_order) ? snapshot.settings.seating_order : seatingOrder;
    if (Array.isArray(snapshot.settings?.test_players)) {
      testPlayers = snapshot.settings.test_players;
    }
    const legacyReadySource =
      snapshot.players_ready ??
      snapshot.ready_players ??
      snapshot.ready ??
      snapshot.playersReady ??
      null;
    updatePlayerStats(snapshot.players ?? {}, legacyReadySource);
    if (!testPlayers.length) {
      const derived = deriveTestPlayers(playerAssignments, playerList);
      if (derived.length) {
        testPlayers = derived;
      }
    }
  }

  $: derivedAssistEnabled =
    form.storyteller === 'AI'
      ? true
      : form.storyteller === 'human'
        ? false
        : form.assistEnabled;

  $: if (!derivedAssistEnabled && form.assistTasks.length) {
    form.assistTasks = [];
  }

  $: basePlayerBreakdown = balanceTable?.[String(form.players_expected)] ?? null;
  $: playerBreakdown = tweakRoleMix && roleMixOverride ? roleMixOverride : basePlayerBreakdown;
  $: rulesetResources = resourcesTable?.[form.rulesets] ?? null;
  $: rulesetRoles = rulesetResources?.roles ?? {};
  $: roleLimits = ROLE_BREAKDOWN_ORDER.reduce((acc, role) => {
    const mixLimit = playerBreakdown?.[role];
    const resourceLimit = rulesetResources?.[role];
    if (mixLimit == null && resourceLimit == null) {
      acc[role] = null;
    } else if (mixLimit == null) {
      acc[role] = resourceLimit;
    } else if (resourceLimit == null) {
      acc[role] = mixLimit;
    } else {
      acc[role] = Math.min(mixLimit, resourceLimit);
    }
    return acc;
  }, {});
  $: resourceLimits = ROLE_BREAKDOWN_ORDER.reduce((acc, role) => {
    acc[role] = rulesetResources?.[role] ?? null;
    return acc;
  }, {});

  const hasSelectedRoles = (selection) =>
    ROLE_BREAKDOWN_ORDER.some((category) => Object.keys(selection?.[category] ?? {}).length > 0);

  $: if (!rolesCustomized) {
    const seedKey = `${form.rulesets}|${form.players_expected}|${selectionAssistEnabled ? 'auto' : 'manual'}`;
    if (playerBreakdown && rulesetRoles && seedKey !== autoSeedKey) {
      selectedRoles = selectionAssistEnabled ? buildAutoSelection() : createEmptyRoleSelection();
      autoSeedKey = seedKey;
    } else if (!selectionAssistEnabled && hasSelectedRoles(selectedRoles)) {
      selectedRoles = createEmptyRoleSelection();
      autoSeedKey = seedKey;
    }
  }

  $: totalSelectedRoles = ROLE_BREAKDOWN_ORDER.reduce(
    (sum, category) => sum + categoryTotal(category, selectedRoles),
    0
  );
  $: roleOptions = flattenRoleSelection(selectedRoles);
  $: canShareSession = totalSelectedRoles >= clampPlayers(form.players_expected);
  $: rolesMatchingTaskEnabled =
    Array.isArray(form.assistTasks) && form.assistTasks.includes('Roles_Matching');
  // Siempre permitimos abrir el modal de emparejar cuando el narrador no es 100% IA
  // para que el narrador humano pueda revisar o ajustar, aunque la IA asista.
  $: matchEnabled = form.storyteller !== 'AI';
  $: selectionAssistEnabled =
    form.storyteller === 'AI' ||
    (form.storyteller === 'human-AI' && Array.isArray(form.assistTasks) && form.assistTasks.includes('Roles_Selection'));
  $: expectedPlayersCount = clampPlayers(form.players_expected);
  $: allPlayersReady =
    expectedPlayersCount > 0 &&
    connectedCount >= expectedPlayersCount &&
    readyCount >= expectedPlayersCount;
  $: startActionDisabled = sessionStatus !== 'paused' && !allPlayersReady;
  $: distributionTokens = buildDistributionTokens(selectedRoles, playerAssignments, playerList, {
    includeSheriff: form.include_sheriff !== false
  });
$: matchPlayers = playerList;
  $: if (sessionId && !loading) {
    dispatch('session-stats', {
      expected: expectedPlayersCount,
      connected: connectedCount,
      ready: readyCount,
      status: sessionStatus
    });
  }

  function getAssistTaskLabel(task) {
    const key = ASSIST_TASK_TRANSLATIONS[task];
    if (!key) return readableTask(task);
    const lookup = $t(`configure.assist_tasks.${key}`);
    return typeof lookup === 'string' ? lookup : readableTask(task);
  }

  onMount(() => {
    if (!sessionId) {
      loading = false;
      return () => {};
    }

    sessionUnsubscribe = subscribeToSession(sessionId, handleSessionSnapshot);

    (async () => {
      try {
        const session = await getSessionById(sessionId);
        if (session) {
          handleSessionSnapshot(session);
          const settings = session.settings ?? {};
        form = {
          name: session.title ?? settings.name ?? '',
          game_id: session.game_id ?? '',
          description: settings.description ?? form.description,
          rulesets: settings.rulesets ?? form.rulesets,
          players_expected: clampPlayers(settings.players_expected ?? form.players_expected),
          storyteller: settings.storyteller ?? form.storyteller,
          language: settings.language ?? form.language,
          assistEnabled: !!settings.assist_enabled,
          assistTasks: Array.isArray(settings.assist_tasks)
            ? settings.assist_tasks.filter((task) => assistTaskOptions.includes(task))
            : [],
          include_sheriff: settings.include_sheriff ?? true,
          include_town_crier: settings.include_town_crier ?? false
        };
        overrideRoleLimits = settings.override_limits ?? false;
        includeSheriff = form.include_sheriff;
        includeTownCrier = form.include_town_crier;
        tweakRoleMix = settings.tweak_role_mix ?? false;
        roleMixOverride = normalizeMixOverride(settings.role_mix_override);
        if (settings.roles) {
          selectedRoles = normalizeRoleSelection(settings.roles);
          rolesCustomized = true;
        }
        if (Array.isArray(settings.actor_roles)) {
          selectedActorRoles = settings.actor_roles.slice(0, 3);
        }
        if (Array.isArray(settings.thief_roles)) {
          selectedThiefRoles = settings.thief_roles.map((role) => slugifyRole(role)).filter(Boolean).slice(0, 2);
        }
        selectedThiefExclusions = Array.isArray(settings.thief_exclusions)
          ? settings.thief_exclusions
          : [...DEFAULT_THIEF_EXCLUSIONS];
        selectedActorExclusions = Array.isArray(settings.actor_exclusions)
          ? settings.actor_exclusions
          : [...DEFAULT_ACTOR_EXCLUSIONS];
        seatingOrder = Array.isArray(settings.seating_order) ? settings.seating_order : [];
        if (form.storyteller === 'human') {
          form.assistEnabled = false;
          form.assistTasks = [];
        } else if (form.storyteller === 'AI' && !form.assistTasks.length && assistTaskOptions.length) {
          form.assistEnabled = true;
          form.assistTasks = [...assistTaskOptions];
        }
        }
      } catch (error) {
        console.error('[configure] unable to load session', error);
        openAlert($t('configure.errors.load_failed'), 'error');
      } finally {
        loading = false;
      }
    })();

    return () => {
      if (sessionUnsubscribe) {
        sessionUnsubscribe();
        sessionUnsubscribe = null;
      }
    };
  });

  async function saveConfig() {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    saving = true;
    try {
      const trimmedName = form.name.trim();
      if (!trimmedName) {
        openAlert($t('configure.errors.missing_title'), 'warning');
        saving = false;
        return;
      }
      const languageValue =
        form.storyteller === 'human' ? defaultLanguage : form.language;
      const assistEnabled = derivedAssistEnabled;
      const trimmedDescription = form.description?.trim() ?? '';

      const nextStatus = sessionStatus === 'draft' ? 'draft' : sessionStatus;

      const payload = {
        title: trimmedName,
        'settings.description': trimmedDescription,
        'settings.rulesets': form.rulesets,
        'settings.players_expected': clampPlayers(form.players_expected),
        'settings.storyteller': form.storyteller,
        'settings.language': languageValue,
        'settings.assist_enabled': assistEnabled,
        'settings.assist_tasks': assistEnabled ? form.assistTasks : [],
        'settings.roles': selectedRoles,
        'settings.actor_roles': selectedActorRoles,
        'settings.include_sheriff': includeSheriff,
        'settings.override_limits': overrideRoleLimits,
        status: nextStatus
      };

      await updateSession(sessionId, payload);
      showToast({ message: $t('configure.saved'), variant: 'success' });
    } catch (error) {
      console.error('[configure] unable to save session', error);
      openAlert($t('configure.errors.save_failed'), 'error');
    } finally {
      saving = false;
    }
  }

  async function goBack() {
    if (!ensureTitlePresent()) return;
    const persisted = await persistTitleDescription();
    if (!persisted) return;
    dispatch('back');
  }

  function openModal(name) {
    activeModal = name;
  }

  async function shareSession() {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    if (!form.game_id) {
      openAlert($t('configure.errors.missing_game_id'), 'warning');
      return;
    }
    if (!canShareSession) {
      openAlert($t('configure.errors.share_unavailable'), 'warning');
      return;
    }
    try {
      await updateSession(sessionId, { status: 'shared' });
      sessionStatus = 'shared';
      openModal('share');
    } catch (error) {
      console.error('[configure] unable to mark session as shared', error);
      openAlert($t('configure.errors.share_failed'), 'error');
    }
  }

  function closeModal() {
    activeModal = null;
  }

  async function handleNavIntent(event) {
    const intent = event?.detail?.intent;
    if (intent === NAV_INTENT.BACK_TO_DASHBOARD) {
      await goBack();
    }
  }

  const ensureTitlePresent = () => {
    const trimmed = form.name?.trim() ?? '';
    if (trimmed) return true;
    showToast({ message: $t('configure.errors.missing_title'), variant: 'error' });
    return false;
  };

  async function persistTitleDescription() {
    if (!sessionId) return false;
    const trimmedName = form.name?.trim() ?? '';
    if (!trimmedName) {
      showToast({ message: $t('configure.errors.missing_title'), variant: 'error' });
      return false;
    }
    const trimmedDescription = form.description?.trim() ?? '';
    try {
      await updateSession(sessionId, {
        title: trimmedName,
        'settings.description': trimmedDescription
      });
      return true;
    } catch (error) {
      console.error('[configure] unable to save title/description', error);
      openAlert($t('configure.errors.save_failed'), 'error');
      return false;
    }
  }

  async function handlePropertiesSave(event) {
    const detail = event?.detail ?? {};
    if (!detail.value) return;
    form = { ...form, ...detail.value };
    if (!ensureTitlePresent()) return;
    const trimmedName = form.name.trim();
    const trimmedDescription = form.description?.trim() ?? '';
    const languageValue = form.storyteller === 'human' ? defaultLanguage : form.language;
    const assistEnabled = derivedAssistEnabled;
    const payload = {
      title: trimmedName,
      'settings.description': trimmedDescription,
      'settings.rulesets': form.rulesets,
      'settings.players_expected': clampPlayers(form.players_expected),
      'settings.storyteller': form.storyteller,
      'settings.language': languageValue,
      'settings.assist_enabled': assistEnabled,
      'settings.assist_tasks': assistEnabled ? form.assistTasks : [],
      'settings.actor_roles': selectedActorRoles,
      'settings.include_sheriff': includeSheriff,
      'settings.include_town_crier': includeTownCrier
    };
    try {
      await updateSession(sessionId, payload);
      showToast({ message: $t('configure.saved'), variant: 'success' });
    } catch (error) {
      console.error('[configure] unable to save properties', error);
      openAlert($t('configure.errors.save_failed'), 'error');
    }
  }

  async function handleSelectionSave(event) {
    const detail = event?.detail ?? {};
    if (detail.selections) {
      selectedRoles = normalizeRoleSelection(detail.selections);
      rolesCustomized = true;
      autoSeedKey = `${form.rulesets}|${form.players_expected}`;
    }
    if (typeof detail.tweakRoleMix === 'boolean') {
      tweakRoleMix = detail.tweakRoleMix;
    }
    if (detail.roleMixOverride) {
      roleMixOverride = normalizeMixOverride(detail.roleMixOverride);
    } else if (!tweakRoleMix) {
      roleMixOverride = null;
    }
    if (Array.isArray(detail.actorRoles)) {
      selectedActorRoles = detail.actorRoles.slice(0, 3);
    }
    if (Array.isArray(detail.thiefRoles)) {
      selectedThiefRoles = detail.thiefRoles.map((role) => slugifyRole(role)).filter(Boolean).slice(0, 2);
    }
    if (Array.isArray(detail.actorExclusions)) {
      selectedActorExclusions = detail.actorExclusions;
    }
    if (Array.isArray(detail.thiefExclusions)) {
      selectedThiefExclusions = detail.thiefExclusions;
    }
    if (typeof detail.override === 'boolean') {
      overrideRoleLimits = detail.override;
    }
    if (typeof detail.includeSheriff === 'boolean') {
      includeSheriff = detail.includeSheriff;
      form.include_sheriff = includeSheriff;
    }
    if (typeof detail.includeTownCrier === 'boolean') {
      includeTownCrier = detail.includeTownCrier;
      form.include_town_crier = includeTownCrier;
    }
    if (!sessionId) {
      showToast({ message: $t('configure.errors.missing_session'), variant: 'error' });
      return;
    }
    try {
      await updateSession(sessionId, {
        'settings.roles': selectedRoles,
        'settings.actor_roles': selectedActorRoles,
        'settings.thief_roles': selectedThiefRoles,
        // Guardamos la lista de exclusiones en ambas claves por compatibilidad
        'settings.actor_exclusions': selectedActorExclusions,
        'settings.thief_exclusions': selectedThiefExclusions,
        'settings.override_limits': overrideRoleLimits,
        'settings.include_sheriff': includeSheriff,
        'settings.include_town_crier': includeTownCrier,
        'settings.tweak_role_mix': tweakRoleMix,
        'settings.role_mix_override': roleMixOverride,
        'settings.seating_order': seatingOrder
      });
      showToast({ message: $t('configure.saved'), variant: 'success' });
    } catch (error) {
      console.error('[configure] unable to save selection', error);
      openAlert($t('configure.errors.save_failed'), 'error');
    }
  }

  async function handleMatchSave(event) {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    const assignments = event?.detail?.assignments ?? {};
    const manualPlayers = Array.isArray(event?.detail?.testPlayers) ? event.detail.testPlayers : testPlayers;
    testPlayers = manualPlayers;
    try {
      await savePlayerRoleAssignments(sessionId, assignments);
      const seatingOrderDetail = event?.detail?.seatingOrder ?? [];
      if (Array.isArray(seatingOrderDetail)) {
        seatingOrder = seatingOrderDetail;
        await updateSession(sessionId, {
          'settings.seating_order': seatingOrderDetail,
          'settings.test_players': manualPlayers
        });
      }
      playerAssignments = assignments;
      showToast({ message: $t('configure.saved'), variant: 'success' });
    } catch (error) {
      console.error('[configure] unable to save role assignments', error);
      openAlert($t('configure.errors.save_failed'), 'error');
    }
  }

  function handleShareClose() {
    closeModal();
  }

  function handleShareSave() {
    showToast({ message: $t('configure.saved'), variant: 'success' });
  }

  async function handleStartOrContinue() {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    if (!ensureTitlePresent()) return;
    const persisted = await persistTitleDescription();
    if (!persisted) return;
    if (sessionStatus !== 'paused' && startActionDisabled) {
      openAlert($t('configure.errors.start_requirements', { expected: expectedPlayersCount }), 'warning');
      return;
    }
    const nextStatus = sessionStatus === 'paused' ? 'in_progress' : 'waiting';
    try {
      await updateSession(sessionId, { status: nextStatus });
      sessionStatus = nextStatus;
      if (nextStatus === 'in_progress') {
        dispatch('start', {
          sessionId,
          tokens: distributionTokens,
          selection: selectedRoles,
          players: playerList,
          actorRoles: selectedActorRoles
        });
      }
    } catch (error) {
      console.error('[configure] unable to update session status', error);
      openAlert($t('configure.errors.start_failed'), 'error');
    }
  }

  // Botón temporal para bypass de requisitos de inicio (solo para diseño/testing).
  function handleForceStart() {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    if (!ensureTitlePresent()) return;
    persistTitleDescription().then((ok) => {
      if (!ok) return;
      forceStartHintVisible = true;
      dispatch('start', {
        sessionId,
        force: true,
        tokens: distributionTokens,
        selection: selectedRoles,
        players: playerList,
        actorRoles: selectedActorRoles
      });
    });
  }
</script>

<BackgroundLayer
  backgroundUrl="/backgrounds/background-village.png"
  fogUrl="/backgrounds/fog-texture.png"
/>

<div class="page">
  <Topbar
    titleKey="configure.title"
    user={user}
    showSessionIndicator={showSessionIndicator}
    sessionIndicator={sessionIndicator}
    on:profile={(event) => dispatch('profile', event.detail)}
    on:logout={(event) => dispatch('logout', event.detail)}
  />

  <main class="config-main">
    {#if loading}
      <div class="info-card card-glass">{$t('configure.loading')}</div>
    {:else}
      <section class="config-card card-glass">
        <header class="config-header">
          <div class="header-stack">
            <div class="form-header">
              <h2 class="panel-title">{$t('configure.title')}</h2>
              <p class="panel-subtitle">{$t('configure.intro')}</p>
            </div>
            <label class="field title-field">
              <span class="section-label">{$t('configure.title_label')}</span>
              <input
                class="input"
                type="text"
                bind:value={form.name}
                placeholder={$t('configure.title_placeholder')}
                maxlength="80"
              />
            </label>
            <label class="field description-field">
              <span class="section-label">{$t('configure.description_label')}</span>
              <textarea
                class="input description-input"
                bind:value={form.description}
                placeholder={$t('configure.description_placeholder')}
                maxlength="400"
                rows="3"
              ></textarea>
              <small class="hint">{$t('configure.description_hint')}</small>
            </label>
          </div>
        </header>

        <div class="actions-grid">
          <button class="pill-btn" type="button" on:click={() => openModal('properties')}>
            {$t('configure.btn_properties')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('selection')}>
            {$t('configure.btn_selection')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('match')} disabled={!matchEnabled}>
            {$t('configure.btn_match')}
          </button>
          <button class="pill-btn" type="button" on:click={shareSession} disabled={!form.game_id || !canShareSession}>
            Share
          </button>
        </div>

        <footer class="actions">
          <div class="left-actions">
            <NavActions
              intents={[NAV_INTENT.BACK_TO_DASHBOARD]}
              on:navigate={handleNavIntent}
            />
          </div>
          <div class="right-actions">
            <button
              class={`btn ${sessionStatus === 'paused' ? 'primary' : 'start'}`}
              type="button"
              on:click={handleStartOrContinue}
              disabled={sessionStatus === 'paused' ? false : startActionDisabled}
            >
              {sessionStatus === 'paused'
                ? $t('configure.continue_button')
                : $t('configure.start_button')}
            </button>
          </div>
          {#if sessionStatus !== 'paused' && startActionDisabled}
            <span class="hint start-hint">
              {$t('configure.start_disabled_hint')}
            </span>
          {/if}
          <button class="btn danger" type="button" on:click={handleForceStart}>
            Force start (temp)
          </button>
          {#if forceStartHintVisible}
            <span class="hint start-hint">Modo prueba: inicio forzado habilitado</span>
          {/if}
        </footer>
      </section>
    {/if}
  </main>

  <Footbar
    locale={clockLocale}
    timeZone={tz}
    showSeconds={true}
  />
</div>

<PropertiesModal
  open={activeModal === 'properties'}
  value={{
    rulesets: form.rulesets,
    players_expected: form.players_expected,
    storyteller: form.storyteller,
    language: form.language,
    assistEnabled: form.assistEnabled,
    assistTasks: form.assistTasks
  }}
  options={{
    minPlayers,
    maxPlayers,
    availableRulesets,
    availableStorytellers,
    availableLanguages,
    assistTaskOptions
  }}
  on:save={handlePropertiesSave}
  on:cancel={closeModal}
/>

  <SelectionModal
    open={activeModal === 'selection'}
    categories={ROLE_BREAKDOWN_ORDER}
    roles={rulesetRoles}
    selected={selectedRoles}
    actorRoles={selectedActorRoles}
    thiefRoles={selectedThiefRoles}
    actorExclusions={selectedActorExclusions}
    thiefExclusions={selectedThiefExclusions}
    limits={roleLimits}
    resourceLimits={resourceLimits}
    override={overrideRoleLimits}
    includeSheriff={includeSheriff}
    includeTownCrier={includeTownCrier}
    players={form.players_expected}
    mix={playerBreakdown}
    totalLimit={clampPlayers(form.players_expected)}
    duplicates={[...DUPLICATE_ROLE_NAMES]}
    tweakRoleMix={tweakRoleMix}
    roleMixOverride={roleMixOverride}
    on:save={handleSelectionSave}
    on:cancel={closeModal}
  />

<MatchModal
  open={activeModal === 'match'}
  players={matchPlayers}
  testPlayers={testPlayers}
  roles={roleOptions}
  assignments={playerAssignments}
  seatingOrder={seatingOrder}
  expectedSeats={clampPlayers(form.players_expected)}
  on:save={handleMatchSave}
  on:cancel={closeModal}
/>

<ShareModal
  open={activeModal === 'share'}
  gameId={form.game_id}
  on:cancel={handleShareClose}
  on:save={handleShareSave}
/>

<AlertPopup
  open={alertOpen}
  title={alertTitle}
  message={alertMessage}
  variant={alertVariant}
  on:close={closeAlert}
/>

<style>
  .page {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
  }

  .config-main {
    display: grid;
    place-items: center;
    padding: calc(56px + 2rem) 1rem 3rem;
  }

  .config-card {
    width: min(var(--page-width-main), 95vw);
    padding: clamp(1.75rem, 4vw, 2.5rem);
    display: grid;
    gap: 2rem;
  }

  .info-card {
    text-align: center;
    color: var(--color-white-muted);
    font-size: 1rem;
  }

  .config-header {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.5rem;
  }

  .header-stack {
    flex: 1 1 320px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-label {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: none;
    color: var(--color-white-contrast);
  }

  .title-field {
    margin-top: 0.5rem;
    width: 100%;
    align-items: flex-start;
  }

  .title-field .section-label {
    margin-bottom: 0.25rem;
  }

  .title-field .input {
    width: 100%;
  }

  .description-field textarea {
    width: 100%;
    resize: vertical;
    min-height: 100px;
  }

  .description-input {
    min-height: 96px;
  }


  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.8rem;
  }

  .pill-btn {
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: var(--color-white-contrast);
    padding: 0.65rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pill-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hint {
    color: var(--color-white-muted);
    font-size: 0.85rem;
  }

  .start-hint {
    width: 100%;
  }

  .input {
    background: var(--surface-input);
    border: 1px solid rgba(250, 252, 255, 0.18);
    border-radius: 0.8rem;
    padding: 0.65rem 0.9rem;
    color: var(--color-white-contrast);
    font-size: 1rem;
    transition: border-color 0.25s ease, background 0.25s ease;
  }

  .input:focus-visible {
    outline: 2px solid rgba(255, 232, 160, 0.65);
    outline-offset: 2px;
    border-color: rgba(255, 232, 160, 0.65);
    background: rgba(15, 22, 30, 0.7);
  }


  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .left-actions,
  .right-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn {
    /* Usa el estilo global de botones */
  }

  .save-btn {
    min-width: 150px;
  }

  @media (max-width: 720px) {
    .config-card {
      gap: 1.5rem;
      padding: 1.5rem;
    }
    .actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .actions .btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>

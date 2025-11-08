<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import PropertiesModal from '../components/config/Properties.svelte';
  import SelectionModal from '../components/config/Selection.svelte';
  import MatchModal from '../components/config/Match.svelte';
  import DistributionModal from '../components/config/Distribution.svelte';
  import ShareModal from '../components/config/Share.svelte';
  import { t } from '../lib/i18n.js';
  import { getSessionById, updateSession } from '../lib/db.js';
  import { getGamesMetadata, getAssistTasks, getBalanceTable, getResourcesTable } from '../lib/gameMetadata.js';

  export let sessionId;
  export let user = null;

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

  const ROLE_BREAKDOWN_ORDER = ['villagers', 'ambiguous', 'outsiders', 'werewolves'];

  const clampPlayers = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return minPlayers;
    return Math.min(Math.max(numeric, minPlayers), maxPlayers);
  };

  const readableTask = (task) => task.replace(/_/g, ' ');

  let loading = true;
  let saving = false;
  let saved = false;
  let overrideRoleLimits = false;
  let activeModal = null;
  let connectedCount = 0;
  let readyCount = 0;
  let sessionStatus = 'draft';
  let form = {
    name: '',
    game_id: '',
    rulesets: metadata?.defaults?.rulesets ?? availableRulesets[0],
    players_expected: metadata?.defaults?.players_expected ?? minPlayers,
    storyteller: metadata?.defaults?.storyteller ?? availableStorytellers[0],
    language: metadata?.defaults?.language ?? defaultLanguage,
    assistEnabled: metadata?.defaults?.assist_enabled ?? false,
    assistTasks: []
  };

  if (form.storyteller === 'AI' || form.storyteller === 'human-AI') {
    form.assistEnabled = true;
  } else {
    form.assistEnabled = false;
  }

  let roleSelections = ROLE_BREAKDOWN_ORDER.reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  let roleSeedKey = '';

  const countEntries = (value) => {
    if (Array.isArray(value)) return value.length;
    if (value && typeof value === 'object') return Object.keys(value).length;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    return 0;
  };

  $: derivedAssistEnabled =
    form.storyteller === 'AI'
      ? true
      : form.storyteller === 'human'
        ? false
        : form.assistEnabled;

  $: if (!derivedAssistEnabled && form.assistTasks.length) {
    form.assistTasks = [];
  }

  $: showLanguageSelector = form.storyteller !== 'human';
  $: showAssistControls = form.storyteller === 'human-AI';

  $: playerBreakdown = balanceTable?.[String(form.players_expected)] ?? null;
  $: rulesetResources = resourcesTable?.[form.rulesets] ?? null;
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

  $: if (!overrideRoleLimits) {
    const next = { ...roleSelections };
    let changed = false;
    for (const role of ROLE_BREAKDOWN_ORDER) {
      const limit = roleLimits?.[role];
      if (limit != null && next[role] > limit) {
        next[role] = limit;
        changed = true;
      }
    }
    if (changed) {
      roleSelections = next;
    }
  }

  $: {
    const seedKey = `${form.players_expected}|${form.rulesets}`;
    if (!overrideRoleLimits && seedKey !== roleSeedKey) {
      roleSeedKey = seedKey;
      roleSelections = ROLE_BREAKDOWN_ORDER.reduce((acc, role) => ({
        ...acc,
        [role]: roleLimits?.[role] ?? playerBreakdown?.[role] ?? 0
      }), {});
    }
  }

  $: totalSelectedRoles = ROLE_BREAKDOWN_ORDER.reduce(
    (sum, role) => sum + (Number(roleSelections[role]) || 0),
    0
  );
  $: canShareSession = totalSelectedRoles >= clampPlayers(form.players_expected);

  function getAssistTaskLabel(task) {
    const key = ASSIST_TASK_TRANSLATIONS[task];
    if (!key) return readableTask(task);
    const lookup = $t(`configure.assist_tasks.${key}`);
    return typeof lookup === 'string' ? lookup : readableTask(task);
  }

  onMount(async () => {
    if (!sessionId) {
      loading = false;
      return;
    }

    try {
      const session = await getSessionById(sessionId);
      if (session) {
        const settings = session.settings ?? {};
        sessionStatus = session.status ?? 'draft';
        connectedCount = countEntries(session.players);
        readyCount = countEntries(
          session.players_ready ??
          session.ready_players ??
          session.ready ??
          session.playersReady ?? null
        );
        form = {
          name: session.title ?? settings.name ?? '',
          game_id: session.game_id ?? '',
          rulesets: settings.rulesets ?? form.rulesets,
          players_expected: clampPlayers(settings.players_expected ?? form.players_expected),
          storyteller: settings.storyteller ?? form.storyteller,
          language: settings.language ?? form.language,
          assistEnabled: !!settings.assist_enabled,
          assistTasks: Array.isArray(settings.assist_tasks)
            ? settings.assist_tasks.filter((task) => assistTaskOptions.includes(task))
            : []
        };
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
    } finally {
      loading = false;
    }
  });

  async function saveConfig() {
    if (!sessionId) return;
    saving = true;
    try {
      const trimmedName = form.name.trim() || 'Untitled session';
      const languageValue =
        form.storyteller === 'human' ? defaultLanguage : form.language;
      const assistEnabled = derivedAssistEnabled;

      const payload = {
        title: trimmedName,
        'settings.name': trimmedName,
        'settings.rulesets': form.rulesets,
        'settings.players_expected': clampPlayers(form.players_expected),
        'settings.storyteller': form.storyteller,
        'settings.language': languageValue,
        'settings.assist_enabled': assistEnabled,
        'settings.assist_tasks': assistEnabled ? form.assistTasks : [],
        status: 'draft'
      };

      await updateSession(sessionId, payload);
      saved = true;
      setTimeout(() => (saved = false), 2000);
    } catch (error) {
      console.error('[configure] unable to save session', error);
    } finally {
      saving = false;
    }
  }

  function goBack() {
    dispatch('back');
  }

  function openModal(name) {
    activeModal = name;
  }

  function closeModal() {
    activeModal = null;
  }

  function handlePropertiesSave(event) {
    const detail = event?.detail ?? {};
    if (!detail.value) {
      closeModal();
      return;
    }
    form = { ...form, ...detail.value };
    closeModal();
  }

  function handleSelectionSave(event) {
    const detail = event?.detail ?? {};
    if (detail.selections) {
      roleSelections = { ...detail.selections };
    }
    if (typeof detail.override === 'boolean') {
      overrideRoleLimits = detail.override;
    }
    closeModal();
  }

  function handleMatchAuto() {
    console.info('[configure] auto-assign roles requested');
  }

  function handleMatchSave() {
    closeModal();
  }

  function handleDistributionClose() {
    closeModal();
  }

  function handleShareClose() {
    closeModal();
  }

  async function handleStartOrContinue() {
    if (!sessionId) return;
    const nextStatus = sessionStatus === 'paused' ? 'in_progress' : 'waiting';
    try {
      await updateSession(sessionId, { status: nextStatus });
      sessionStatus = nextStatus;
      if (nextStatus === 'in_progress') {
        dispatch('start', { sessionId });
      }
    } catch (error) {
      console.error('[configure] unable to update session status', error);
    }
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
    on:profile={(event) => dispatch('profile', event.detail)}
    on:logout={(event) => dispatch('logout', event.detail)}
  />

  <main class="config-main">
    {#if loading}
      <div class="info-card card-glass">{$t('configure.loading')}</div>
    {:else}
      <section class="config-card card-glass">
        <header class="config-header">
          <div>
            <h2>{$t('configure.heading')}</h2>
            <label class="field title-field">
              <span class="label">{$t('configure.title_label')}</span>
              <input
                class="input"
                type="text"
                bind:value={form.name}
                placeholder={$t('configure.title_placeholder')}
                maxlength="80"
              />
            </label>
          </div>
          <div class="status-strip">
            <div>
              <span>{$t('configure.connected_label')}</span>
              <strong>{connectedCount}</strong>
            </div>
            <div>
              <span>{$t('configure.ready_label')}</span>
              <strong>{readyCount}</strong>
            </div>
          </div>
        </header>

        <div class="actions-grid">
          <button class="pill-btn" type="button" on:click={() => openModal('properties')}>
            {$t('configure.btn_properties')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('selection')}>
            {$t('configure.btn_selection')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('match')}>
            {$t('configure.btn_match')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('distribution')}>
            {$t('configure.btn_distribution')}
          </button>
          <button class="pill-btn" type="button" on:click={() => openModal('share')} disabled={!form.game_id || !canShareSession}>
            {$t('configure.btn_share')}
          </button>
        </div>

        {#if playerBreakdown}
          <section class="role-balance">
            <div class="role-balance-title-row">
              <span class="role-balance-title">{$t('configure.balance_label')}</span>
              <span class="role-balance-hint">{$t('configure.role_constraints.mix', { value: form.players_expected })}</span>
            </div>
            <div class="role-balance-grid">
              {#each ROLE_BREAKDOWN_ORDER as roleKey}
                <div class="balance-chip">
                  <span class="balance-count">{playerBreakdown[roleKey] ?? 0}</span>
                  <span class="balance-label">{$t(`configure.balance_roles.${roleKey}`)}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <section class="role-selection-preview">
          <div class="preview-header">
            <h3>{$t('configure.role_selector_label')}</h3>
            <button class="link-btn" type="button" on:click={() => openModal('selection')}>
              {$t('configure.btn_edit_selection')}
            </button>
          </div>
          <div class="role-preview-grid">
            {#each ROLE_BREAKDOWN_ORDER as roleKey}
              <div class="role-preview-card">
                <span class="label">{$t(`configure.balance_roles.${roleKey}`)}</span>
                <strong>{roleSelections[roleKey] ?? 0}</strong>
              </div>
            {/each}
          </div>
        </section>

        <footer class="actions">
          <div class="left-actions">
            <button class="btn secondary" type="button" on:click={goBack}>
              {$t('configure.back')}
            </button>
            <button class="btn secondary" type="button" on:click={() => openModal('share')} disabled={!form.game_id || !canShareSession}>
              {$t('configure.btn_share')}
            </button>
          </div>
          <div class="right-actions">
            <button class="btn secondary" type="button" on:click={saveConfig} disabled={saving}>
              {saving ? '…' : $t('configure.save')}
            </button>
            <button class="btn primary" type="button" on:click={handleStartOrContinue}>
              {sessionStatus === 'paused'
                ? $t('configure.continue_button')
                : $t('configure.start_button')}
            </button>
          </div>
          {#if saved}
            <span class="hint saved-hint">{$t('configure.saved')}</span>
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
  selections={roleSelections}
  limits={roleLimits}
  override={overrideRoleLimits}
  on:save={handleSelectionSave}
  on:cancel={closeModal}
/>

<MatchModal
  open={activeModal === 'match'}
  on:auto={handleMatchAuto}
  on:save={handleMatchSave}
  on:cancel={closeModal}
/>

<DistributionModal
  open={activeModal === 'distribution'}
  on:cancel={handleDistributionClose}
/>

<ShareModal
  open={activeModal === 'share'}
  gameId={form.game_id}
  on:cancel={handleShareClose}
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
    padding: 2rem 1rem 3rem;
  }

  .config-card {
    width: min(840px, 92vw);
    padding: clamp(1.75rem, 4vw, 2.5rem);
    display: grid;
    gap: 2rem;
  }

  .info-card {
    text-align: center;
    color: rgba(245, 245, 245, 0.85);
    font-size: 1rem;
  }

  .config-header {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .config-header h2 {
    margin: 0;
    font-family: "Merriweather", serif;
    font-size: clamp(2rem, 4vw, 2.6rem);
    color: #f4d47c;
    text-shadow:
      0 0 12px rgba(255, 220, 140, 0.5),
      0 0 32px rgba(255, 200, 80, 0.3);
  }

  .title-field {
    margin-top: 1rem;
  }

  .status-strip {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.75rem;
  }

  .status-strip span {
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.65);
  }

  .status-strip strong {
    font-size: 1.6rem;
    color: #f7f3d7;
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
    color: #f5f8fb;
    padding: 0.65rem 1rem;
    font-weight: 600;
    cursor: pointer;
  }

  .pill-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .field {
    display: grid;
    gap: 0.65rem;
  }

  .label {
    font-weight: 600;
    color: rgba(248, 248, 250, 0.85);
  }

  .hint {
    color: rgba(225, 230, 240, 0.65);
    font-size: 0.85rem;
  }

  .role-balance {
    display: grid;
    gap: 0.5rem;
  }

  .role-balance-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.9rem;
    color: rgba(245, 245, 245, 0.7);
  }

  .role-balance-title {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(248, 248, 250, 0.65);
  }

  .role-balance-hint {
    font-size: 0.85rem;
    color: rgba(245, 245, 245, 0.55);
  }

  .role-balance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 0.5rem;
  }

  .balance-chip {
    background: rgba(8, 14, 22, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.75rem;
    padding: 0.6rem 0.9rem;
    display: grid;
    justify-items: center;
    gap: 0.1rem;
  }

  .balance-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f7f3d7;
  }

  .balance-label {
    font-size: 0.85rem;
    text-transform: capitalize;
    color: rgba(245, 245, 245, 0.78);
  }

  .role-selection-preview {
    display: grid;
    gap: 0.75rem;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .link-btn {
    background: none;
    border: none;
    color: #f7d774;
    font-weight: 600;
    cursor: pointer;
  }

  .role-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.75rem;
  }

  .role-preview-card {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 1rem;
    padding: 0.85rem;
    display: grid;
    gap: 0.35rem;
    text-align: center;
  }

  .input {
    background: rgba(15, 22, 30, 0.55);
    border: 1px solid rgba(250, 252, 255, 0.18);
    border-radius: 0.8rem;
    padding: 0.65rem 0.9rem;
    color: #f7f9fc;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    padding: 0.65rem 1.6rem;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }

  .btn.primary {
    background: rgba(74, 141, 74, 0.85);
    color: #f6fff6;
    border: 1px solid rgba(74, 141, 74, 0.95);
  }

  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }

  .saved-hint {
    color: rgba(160, 255, 160, 0.8);
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

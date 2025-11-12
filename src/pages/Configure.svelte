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
  import NavActions from '../components/ui/NavActions.svelte';
  import AlertPopup from '../components/ui/AlertPopup.svelte';
  import { NAV_INTENT } from '../lib/navigation.js';
  import { t } from '../lib/i18n.js';
  import { getSessionById, updateSession } from '../lib/db.js';
  import { getGamesMetadata, getAssistTasks, getBalanceTable, getResourcesTable } from '../lib/gameMetadata.js';

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

  const ROLE_BREAKDOWN_ORDER = ['villagers', 'ambiguous', 'loners', 'werewolves'];
  const DUPLICATE_ROLE_NAMES = new Set(['common', 'villager', 'werewolf']);

  const clampPlayers = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return minPlayers;
    return Math.min(Math.max(numeric, minPlayers), maxPlayers);
  };

  const readableTask = (task) => task.replace(/_/g, ' ');

  const slugifyRole = (name) => name?.toLowerCase().replace(/\s+/g, '_') ?? '';

  function createEmptySelection() {
    return ROLE_BREAKDOWN_ORDER.reduce((acc, category) => ({
      ...acc,
      [category]: {}
    }), {});
  }

  function normalizeSelection(source) {
    const base = createEmptySelection();
    if (!source || typeof source !== 'object') return base;
    for (const category of ROLE_BREAKDOWN_ORDER) {
      const entries = source[category];
      if (!entries || typeof entries !== 'object') continue;
      base[category] = Object.entries(entries).reduce((acc, [role, count]) => {
        const numeric = Number(count) || 0;
        if (numeric > 0) acc[role] = numeric;
        return acc;
      }, {});
    }
    return base;
  }

  function categoryTotal(category, selection = selectedRoles) {
    return Object.values(selection?.[category] ?? {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }

  function buildAutoSelection() {
    if (!playerBreakdown || !rulesetRoles) return selectedRoles;
    const next = createEmptySelection();
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

  function roleImageSrc(category, role) {
    const file = slugifyRole(role);
    return `/roles/${category}/${file}.png`;
  }

  function buildDistributionTokens(selection) {
    const tokens = [];
    ROLE_BREAKDOWN_ORDER.forEach((category) => {
      const roles = selection?.[category] ?? {};
      Object.entries(roles).forEach(([roleName, count]) => {
        const slug = slugifyRole(roleName);
        for (let index = 0; index < count; index += 1) {
          tokens.push({
            id: `${category}-${slug}-${index}`,
            role: roleName,
            category,
            image: roleImageSrc(category, roleName),
            player: null
          });
        }
      });
    });
    return tokens;
  }

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

  let selectedRoles = createEmptySelection();
  let rolesCustomized = false;
  let autoSeedKey = '';
  let alertOpen = false;
  let alertMessage = '';
  let alertVariant = 'info';
  let alertTitle = '';

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
      selectedRoles = selectionAssistEnabled ? buildAutoSelection() : createEmptySelection();
      autoSeedKey = seedKey;
    } else if (!selectionAssistEnabled && hasSelectedRoles(selectedRoles)) {
      selectedRoles = createEmptySelection();
      autoSeedKey = seedKey;
    }
  }

  $: totalSelectedRoles = ROLE_BREAKDOWN_ORDER.reduce(
    (sum, category) => sum + categoryTotal(category, selectedRoles),
    0
  );
  $: canShareSession = totalSelectedRoles >= clampPlayers(form.players_expected);
  $: rolesMatchingTaskEnabled =
    Array.isArray(form.assistTasks) && form.assistTasks.includes('Roles_Matching');
  $: matchEnabled =
    form.storyteller === 'human' ||
    (form.storyteller === 'human-AI' && !rolesMatchingTaskEnabled);
  $: selectionAssistEnabled =
    form.storyteller === 'AI' ||
    (form.storyteller === 'human-AI' && Array.isArray(form.assistTasks) && form.assistTasks.includes('Roles_Selection'));
  $: distributionTokens = buildDistributionTokens(selectedRoles);
  $: if (sessionId && !loading) {
    dispatch('session-stats', {
      expected: clampPlayers(form.players_expected),
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
        if (settings.roles) {
          selectedRoles = normalizeSelection(settings.roles);
          rolesCustomized = true;
        }
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

      const nextStatus = sessionStatus === 'draft' ? 'draft' : sessionStatus;

      const payload = {
        title: trimmedName,
        'settings.rulesets': form.rulesets,
        'settings.players_expected': clampPlayers(form.players_expected),
        'settings.storyteller': form.storyteller,
        'settings.language': languageValue,
        'settings.assist_enabled': assistEnabled,
        'settings.assist_tasks': assistEnabled ? form.assistTasks : [],
        'settings.roles': selectedRoles,
        status: nextStatus
      };

      await updateSession(sessionId, payload);
      saved = true;
      setTimeout(() => (saved = false), 2000);
    } catch (error) {
      console.error('[configure] unable to save session', error);
      openAlert($t('configure.errors.save_failed'), 'error');
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

  function handleNavIntent(event) {
    const intent = event?.detail?.intent;
    if (intent === NAV_INTENT.BACK_TO_DASHBOARD) {
      goBack();
    }
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
      selectedRoles = normalizeSelection(detail.selections);
      rolesCustomized = true;
      autoSeedKey = `${form.rulesets}|${form.players_expected}`;
    }
    if (typeof detail.override === 'boolean') {
      overrideRoleLimits = detail.override;
    }
    closeModal();
  }

  function handleMatchAuto() {
    console.info('[configure] auto-assign roles requested');
    closeModal();
  }

  function handleMatchSave() {
    closeModal();
  }

  function handleDistributionClose() {
    closeModal();
  }

  function handleDistributionSave() {
    console.info('[configure] distribution save requested');
    closeModal();
  }

  function handleShareClose() {
    closeModal();
  }

  function handleShareDismiss() {
    closeModal();
  }

  async function handleStartOrContinue() {
    if (!sessionId) {
      openAlert($t('configure.errors.missing_session'), 'warning');
      return;
    }
    const nextStatus = sessionStatus === 'paused' ? 'in_progress' : 'waiting';
    try {
      await updateSession(sessionId, { status: nextStatus });
      sessionStatus = nextStatus;
      if (nextStatus === 'in_progress') {
        dispatch('start', { sessionId });
      }
    } catch (error) {
      console.error('[configure] unable to update session status', error);
      openAlert($t('configure.errors.start_failed'), 'error');
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
          <button class="pill-btn" type="button" on:click={() => openModal('distribution')}>
            {$t('configure.btn_distribution')}
          </button>
          <button class="pill-btn" type="button" on:click={shareSession} disabled={!form.game_id || !canShareSession}>
            {$t('configure.btn_share')}
          </button>
        </div>

        <section class="role-selection-preview">
          <div class="preview-header">
            <h3 class="section-label">{$t('configure.role_selector_label')}</h3>
          </div>
          <div class="role-preview-grid">
            {#each ROLE_BREAKDOWN_ORDER as category}
              <div class="role-preview-column">
                <div class="preview-column-header">
                  <span>{$t(`configure.balance_roles.${category}`)}</span>
                  {#if playerBreakdown}
                    <span>{categoryTotal(category)} / {playerBreakdown[category] ?? '—'}</span>
                  {:else}
                    <span>{categoryTotal(category)}</span>
                  {/if}
                </div>
                <div class="role-chip-grid">
                  {#if Object.keys(selectedRoles?.[category] ?? {}).length === 0}
                    <div class="role-chip empty">{$t('configure.role_preview_empty')}</div>
                  {:else}
                    {#each Object.entries(selectedRoles?.[category] ?? {}) as [roleName, count]}
                      <div class="role-chip">
                        <img src={roleImageSrc(category, roleName)} alt={roleName} />
                        <span>{roleName}</span>
                        {#if count > 1}
                          <span class="chip-badge">×{count}</span>
                        {/if}
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </section>

        <footer class="actions">
          <div class="left-actions">
            <NavActions
              intents={[NAV_INTENT.BACK_TO_DASHBOARD]}
              on:navigate={handleNavIntent}
            />
          </div>
          <div class="right-actions">
            <button class="btn primary save-btn" type="button" on:click={saveConfig} disabled={saving}>
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
  roles={rulesetRoles}
  selected={selectedRoles}
  limits={roleLimits}
  resourceLimits={resourceLimits}
  override={overrideRoleLimits}
  players={form.players_expected}
  mix={playerBreakdown}
  totalLimit={clampPlayers(form.players_expected)}
  duplicates={[...DUPLICATE_ROLE_NAMES]}
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
  tokens={distributionTokens}
  on:cancel={handleDistributionClose}
  on:save={handleDistributionSave}
/>

<ShareModal
  open={activeModal === 'share'}
  gameId={form.game_id}
  on:cancel={handleShareClose}
  on:close={handleShareDismiss}
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
    width: min(840px, 92vw);
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

  .role-selection-preview {
    display: grid;
    gap: 0.75rem;
  }

  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .role-preview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 1rem;
  }

  .role-preview-column {
    border: 1px solid var(--glass-border);
    border-radius: 1rem;
    padding: 0.85rem;
    display: grid;
    gap: 0.6rem;
  }

  .preview-column-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--color-white-muted);
  }

  .role-chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-self: flex-start;
    justify-self: flex-start;
    width: auto;
  }

  .role-chip {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 0.85rem;
    padding: 0.35rem 0.6rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.03);
  }

  .role-chip img {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--surface-chip);
    padding: 0.2rem;
  }

  .role-chip.empty {
    border-style: dashed;
    color: var(--color-white-muted);
    justify-content: center;
  }

  .chip-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: rgba(15, 15, 15, 0.8);
    border-radius: 999px;
    padding: 0.1rem 0.4rem;
    font-size: 0.75rem;
    color: var(--color-gold-info);
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
    color: var(--color-green-text);
    border: 1px solid rgba(74, 141, 74, 0.95);
  }

  .save-btn {
    min-width: 150px;
  }

  .saved-hint {
    color: var(--color-green-accent);
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

<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import Topbar from '../components/common/Topbar.svelte';
  import Footbar from '../components/common/Footbar.svelte';
  import BackgroundLayer from '../components/common/BackgroundLayer.svelte';
  import { t } from '../lib/i18n.js';
  import { getSessionById, updateSession } from '../lib/db.js';
  import { getGamesMetadata, getAssistTasks } from '../lib/gameMetadata.js';

  export let sessionId;
  export let user = null;

  const dispatch = createEventDispatcher();

  const dateOptions = Intl.DateTimeFormat().resolvedOptions();
  const tz = dateOptions.timeZone || 'UTC';
  const clockLocale = dateOptions.locale || 'en-GB';

  const metadata = getGamesMetadata();
  const assistTaskOptions = getAssistTasks();

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
  const gamePhaseOptions = metadata?.game_phase_values?.length
    ? metadata.game_phase_values
    : ['Introduction'];

  const clampPlayers = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return minPlayers;
    return Math.min(Math.max(numeric, minPlayers), maxPlayers);
  };

  const readableTask = (task) => task.replace(/_/g, ' ');

  let loading = true;
  let saving = false;
  let saved = false;
  let form = {
    name: '',
    game_id: '',
    rulesets: metadata?.defaults?.rulesets ?? availableRulesets[0],
    players_expected: metadata?.defaults?.players_expected ?? minPlayers,
    storyteller: metadata?.defaults?.storyteller ?? availableStorytellers[0],
    language: metadata?.defaults?.language ?? defaultLanguage,
    assistEnabled: metadata?.defaults?.assist_enabled ?? false,
    assistTasks: [],
    gamePhase: metadata?.defaults?.game_phase ?? gamePhaseOptions[0]
  };

  $: derivedAssistEnabled =
    form.storyteller === 'AI'
      ? true
      : form.storyteller === 'human'
        ? false
        : form.assistEnabled;

  $: directorHintKey =
    form.storyteller === 'AI'
      ? 'configure.director_hint.ai'
      : form.storyteller === 'human-AI'
        ? 'configure.director_hint.assisted'
        : 'configure.director_hint.human';

  $: if (!derivedAssistEnabled && form.assistTasks.length) {
    form.assistTasks = [];
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
        form = {
          name: session.title ?? settings.name ?? '',
          game_id: session.game_id ?? '',
          rulesets: settings.rulesets ?? form.rulesets,
          players_expected: clampPlayers(settings.players_expected ?? form.players_expected),
          storyteller: settings.storyteller ?? form.storyteller,
          language: settings.language ?? form.language,
          assistEnabled: !!settings.assist_enabled,
          assistTasks: Array.isArray(settings.assist_tasks) ? settings.assist_tasks : [],
          gamePhase: session.game_phases?.current ?? form.gamePhase
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

  function setPlayers(value) {
    form.players_expected = clampPlayers(value);
  }

  function onStorytellerChange(option) {
    form.storyteller = option;
    if (option === 'human') {
      form.language = defaultLanguage;
      form.assistEnabled = false;
      form.assistTasks = [];
    } else if (option === 'AI') {
      form.assistEnabled = true;
      if (!form.assistTasks.length && assistTaskOptions.length) {
        form.assistTasks = [...assistTaskOptions];
      }
    }
  }

  function toggleAssistTask(task) {
    if (form.assistTasks.includes(task)) {
      form.assistTasks = form.assistTasks.filter((t) => t !== task);
    } else {
      form.assistTasks = [...form.assistTasks, task];
    }
  }

  function toggleAssistEnabled() {
    if (form.storyteller !== 'human-AI') return;
    form.assistEnabled = !form.assistEnabled;
    if (!form.assistEnabled) {
      form.assistTasks = [];
    }
  }

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
        'game_phases.current': form.gamePhase,
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
            <p>{$t('configure.subheading')}</p>
          </div>
          <div class="session-meta">
            <span class="meta-item">
              <strong>{$t('configure.session_id')}:</strong>
              <code>{sessionId}</code>
            </span>
            {#if form.game_id}
              <span class="meta-item">
                <strong>{$t('configure.game_code')}:</strong>
                <code>{form.game_id}</code>
              </span>
            {/if}
          </div>
        </header>

        <div class="form-grid">
          <label class="field">
            <span class="label">{$t('configure.title_label')}</span>
            <input
              class="input"
              type="text"
              bind:value={form.name}
              placeholder={$t('configure.title_placeholder')}
              maxlength="80"
            />
            <span class="hint">{$t('configure.title_hint')}</span>
          </label>

          <label class="field">
            <span class="label">{$t('configure.ruleset_label')}</span>
            <select bind:value={form.rulesets} class="input">
              {#each availableRulesets as r}
                <option value={r}>{r}</option>
              {/each}
            </select>
            <span class="hint">{$t('configure.ruleset_hint')}</span>
          </label>

          <label class="field">
            <span class="label">{$t('configure.players_label')}</span>
            <input
              type="number"
              min={minPlayers}
              max={maxPlayers}
              class="input"
              bind:value={form.players_expected}
              on:change={(event) => setPlayers(event.currentTarget.value)}
            />
            <input
              type="range"
              min={minPlayers}
              max={maxPlayers}
              step="1"
              bind:value={form.players_expected}
              on:input={(event) => setPlayers(event.currentTarget.value)}
            />
            <span class="hint">{$t('configure.players_hint', { range: `${minPlayers}–${maxPlayers}` })}</span>
          </label>

          <label class="field">
            <span class="label">{$t('configure.phase_label')}</span>
            <select bind:value={form.gamePhase} class="input">
              {#each gamePhaseOptions as phase}
                <option value={phase}>{phase}</option>
              {/each}
            </select>
            <span class="hint">{$t('configure.phase_hint')}</span>
          </label>

          <fieldset class="field">
            <legend class="label">{$t('configure.director_label')}</legend>
            <div class="director-options">
              {#each availableStorytellers as option}
                <label class="radio-option">
                  <input
                    type="radio"
                    name="director"
                    value={option}
                    checked={form.storyteller === option}
                    on:change={() => onStorytellerChange(option)}
                  />
                  <span>{option}</span>
                </label>
              {/each}
            </div>
            <span class="hint">{$t(directorHintKey)}</span>
          </fieldset>

          <label class="field">
            <span class="label">{$t('configure.language_label')}</span>
            <select
              bind:value={form.language}
              class="input"
              disabled={form.storyteller === 'human'}
            >
              {#each availableLanguages as lang}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
            <span class="hint">{$t('configure.language_hint')}</span>
          </label>

          <div class="field assist-field">
            <span class="label">{$t('configure.assist_label')}</span>
            <label class="assist-toggle">
              <input
                type="checkbox"
                checked={derivedAssistEnabled}
                disabled={form.storyteller !== 'human-AI'}
                on:change={toggleAssistEnabled}
              />
              <span>{$t('configure.assist_toggle')}</span>
            </label>

            {#if form.storyteller !== 'human'}
              <div class="assist-tasks">
                {#if assistTaskOptions.length === 0}
                  <p class="hint">{$t('configure.assist_no_tasks')}</p>
                {:else}
                  <p class="hint assist-hint">{$t('configure.assist_tasks_hint')}</p>
                  {#each assistTaskOptions as task}
                    <label class="task-chip {form.assistTasks.includes(task) ? 'task-chip-on' : ''}">
                      <input
                        type="checkbox"
                        checked={form.assistTasks.includes(task)}
                        disabled={!derivedAssistEnabled}
                        on:change={() => toggleAssistTask(task)}
                      />
                      <span>{readableTask(task)}</span>
                    </label>
                  {/each}
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <footer class="actions">
          <button class="btn secondary" type="button" on:click={goBack}>
            {$t('configure.back')}
          </button>
          <button class="btn primary" type="button" on:click={saveConfig} disabled={saving}>
            {saving ? '…' : $t('configure.save')}
          </button>
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
    width: min(920px, 95vw);
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
    flex-wrap: wrap;
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

  .config-header p {
    margin: 0.25rem 0 0;
    color: rgba(240, 240, 245, 0.75);
  }

  .session-meta {
    display: grid;
    gap: 0.35rem;
    align-content: flex-start;
  }

  .meta-item {
    color: rgba(240, 240, 245, 0.8);
    font-size: 0.9rem;
  }

  .meta-item code {
    font-family: "Fira Code", "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.85rem;
  }

  .form-grid {
    display: grid;
    gap: 1.5rem;
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

  input[type='range'] {
    width: 100%;
    accent-color: rgba(255, 220, 140, 0.85);
    margin-top: 0.25rem;
  }

  .director-options {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .radio-option {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: rgba(245, 245, 245, 0.9);
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .radio-option input {
    accent-color: rgba(255, 232, 160, 0.85);
  }

  .radio-option:hover {
    border-color: rgba(255, 232, 160, 0.6);
    background: rgba(255, 255, 255, 0.08);
  }

  .assist-field {
    gap: 0.75rem;
  }

  .assist-toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.95rem;
    color: rgba(240, 240, 245, 0.85);
  }

  .assist-toggle input {
    accent-color: rgba(255, 232, 160, 0.85);
  }

  .assist-tasks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .assist-hint {
    width: 100%;
  }

  .task-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.18);
    transition: all 0.2s ease;
  }

  .task-chip-on {
    background: rgba(255, 232, 140, 0.2);
    border-color: rgba(255, 232, 160, 0.6);
    box-shadow: 0 6px 18px rgba(255, 232, 160, 0.22);
  }

  .task-chip input {
    display: none;
  }

  .task-chip span {
    color: rgba(248, 248, 250, 0.9);
    font-size: 0.9rem;
    text-transform: capitalize;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
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

  .btn.primary[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
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

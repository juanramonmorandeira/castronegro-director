<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  const clampPlayers = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(Math.max(numeric, min), max);
  };

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

  export let open = false;
  export let value = {
    rulesets: 'basic',
    players_expected: 5,
    storyteller: 'human',
    language: 'en',
    assistEnabled: false,
    assistTasks: []
  };
  export let options = {
    minPlayers: 5,
    maxPlayers: 15,
    availableRulesets: ['basic'],
    availableStorytellers: ['human'],
    availableLanguages: ['en'],
    assistTaskOptions: []
  };

  const dispatch = createEventDispatcher();

  let draft = { ...value };
  let prevOpen = false;

  $: if (open && !prevOpen) {
    prevOpen = true;
    draft = {
      rulesets: value.rulesets,
      players_expected: value.players_expected,
      storyteller: value.storyteller,
      language: value.language,
      assistEnabled: value.assistEnabled,
      assistTasks: Array.isArray(value.assistTasks) ? [...value.assistTasks] : []
    };
  } else if (!open && prevOpen) {
    prevOpen = false;
  }

  $: derivedAssistEnabled =
    draft.storyteller === 'AI'
      ? true
      : draft.storyteller === 'human'
        ? false
        : draft.assistEnabled;

  $: showLanguageSelector = draft.storyteller !== 'human';
  $: showAssistControls = draft.storyteller === 'human-AI';

  function setPlayers(value) {
    draft = {
      ...draft,
      players_expected: clampPlayers(
        value,
        options.minPlayers ?? 5,
        options.maxPlayers ?? 15
      )
    };
  }

  function onStorytellerChange(option) {
    if (option === draft.storyteller) return;
    if (option === 'human') {
      draft = {
        ...draft,
        storyteller: option,
        language: options.availableLanguages?.[0] ?? 'en',
        assistEnabled: false,
        assistTasks: []
      };
    } else {
      const assistTasks = draft.assistTasks?.length
        ? [...draft.assistTasks]
        : [...(options.assistTaskOptions ?? [])];
      draft = {
        ...draft,
        storyteller: option,
        assistEnabled: true,
        assistTasks
      };
    }
  }

  const readableTask = (task) => task.replace(/_/g, ' ');

  function getAssistTaskLabel(task) {
    const key = ASSIST_TASK_TRANSLATIONS[task];
    if (!key) return readableTask(task);
    const lookup = $t(`configure.assist_tasks.${key}`);
    return typeof lookup === 'string' ? lookup : readableTask(task);
  }

  function toggleAssistTask(task) {
    if (!derivedAssistEnabled) return;
    draft = draft.assistTasks.includes(task)
      ? {
          ...draft,
          assistTasks: draft.assistTasks.filter((t) => t !== task)
        }
      : {
          ...draft,
          assistTasks: [...draft.assistTasks, task]
        };
  }

  function close() {
    dispatch('cancel');
  }

  function save() {
    dispatch('save', { value: { ...draft } });
  }
</script>

{#if open}
  <div class="config-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="properties-title">
    <div class="config-modal large">
      <header class="modal-header">
        <h3 id="properties-title">{$t('configure.properties_title')}</h3>
      </header>

      <section class="modal-body">
        <label class="field">
          <span class="label">{$t('configure.ruleset_label')}</span>
          <div class="input-shell select-shell">
            <select
              class="input"
              bind:value={draft.rulesets}
            >
              {#each options.availableRulesets as ruleset}
                <option value={ruleset}>{ruleset}</option>
              {/each}
            </select>
          </div>
        </label>

        <label class="field">
          <span class="label">{$t('configure.players_label')}</span>
          <div class="numeric-shell">
            <input
              type="number"
              class="input"
              min={options.minPlayers}
              max={options.maxPlayers}
              bind:value={draft.players_expected}
              on:change={(event) => setPlayers(event.currentTarget.value)}
            />
          </div>
          <div class="range-shell">
            <input
              type="range"
              min={options.minPlayers}
              max={options.maxPlayers}
              step="1"
              bind:value={draft.players_expected}
              on:input={(event) => setPlayers(event.currentTarget.value)}
            />
          </div>
        </label>

        <fieldset class="storyteller-field">
          <legend>{$t('configure.director_label')}</legend>
          <div class="director-options">
            {#each options.availableStorytellers as option}
              <label class="radio-option">
                <input
                  type="radio"
                  name="storyteller"
                  value={option}
                  checked={draft.storyteller === option}
                  on:change={() => onStorytellerChange(option)}
                />
                <span>{option}</span>
              </label>
            {/each}
          </div>
        </fieldset>

        {#if showLanguageSelector}
          <label class="field">
            <span class="label">{$t('configure.language_label')}</span>
            <div class="input-shell select-shell">
              <select class="input" bind:value={draft.language}>
                {#each options.availableLanguages as lang}
                  <option value={lang}>{lang}</option>
                {/each}
              </select>
            </div>
          </label>
        {/if}

        {#if showAssistControls}
          <div class="field assist-field">
            <span class="label">{$t('configure.assist_label')}</span>
            {#if (options.assistTaskOptions ?? []).length === 0}
              <div class="assist-tasks empty">{$t('configure.assist_no_tasks')}</div>
            {:else}
              <div class="assist-tasks">
                {#each options.assistTaskOptions as task}
                  <button
                    type="button"
                    class={`task-chip ${draft.assistTasks.includes(task) ? 'task-chip-on' : ''}`}
                    on:click={() => toggleAssistTask(task)}
                    disabled={!derivedAssistEnabled}
                  >
                    {getAssistTaskLabel(task)}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </section>

      <footer class="modal-actions">
        <button class="btn secondary" type="button" on:click={close}>{$t('common.actions.cancel')}</button>
        <button class="btn primary" type="button" on:click={save}>{$t('common.actions.save')}</button>
      </footer>
    </div>
  </div>
{/if}

<style>
  .config-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 14, 0.8);
    display: grid;
    place-items: center;
    z-index: 1100;
    padding: 1rem;
  }
  .config-modal {
    width: min(540px, 92vw);
    background: #04070f;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: clamp(1.25rem, 3vw, 1.75rem);
    color: #f5f8fb;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
  .modal-header h3 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 600;
    color: #f4f7fb;
  }
  .modal-body {
    display: grid;
    gap: 1.4rem;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .label {
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(237, 238, 245, 0.82);
  }
  .input-shell {
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(11, 17, 26, 0.85);
    padding: 0.25rem 0.35rem;
  }
  .config-modal select {
    color-scheme: dark;
  }
  .config-modal option {
    background: #0b111a;
    color: #f5f8fb;
  }
  .input {
    width: 100%;
    background: transparent;
    border: none;
    color: #f7f9fc;
    font-size: 1rem;
    padding: 0.65rem 0.75rem;
    appearance: none;
  }
  .input:focus-visible {
    outline: none;
  }
  .select-shell {
    position: relative;
  }
  .select-shell::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 0.9rem;
    width: 0.6rem;
    height: 0.6rem;
    border-right: 2px solid rgba(255, 255, 255, 0.6);
    border-bottom: 2px solid rgba(255, 255, 255, 0.6);
    transform: translateY(-50%) rotate(45deg);
    pointer-events: none;
  }
  .numeric-shell {
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(11, 17, 26, 0.85);
  }
  .numeric-shell .input {
    text-align: left;
  }
  .range-shell {
    padding: 0 0.6rem;
  }
  input[type='range'] {
    width: 100%;
    -webkit-appearance: none;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, #f3ce74, #f0e0ae);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f3ce74;
    border: 2px solid #0b111a;
    box-shadow: 0 0 0 2px rgba(243, 206, 116, 0.3);
  }
  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f3ce74;
    border: 2px solid #0b111a;
    box-shadow: 0 0 0 2px rgba(243, 206, 116, 0.3);
  }
  .storyteller-field {
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    padding: 1rem;
    margin: 0;
    display: grid;
    gap: 0.75rem;
  }
  .storyteller-field legend {
    padding: 0 0.4rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: rgba(237, 238, 245, 0.82);
  }
  .director-options {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
  }
  .radio-option {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.95rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(11, 17, 26, 0.7);
    color: #f1f3f8;
    text-transform: lowercase;
  }
  .radio-option input {
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.5);
    display: grid;
    place-items: center;
    background: transparent;
  }
  .radio-option input::after {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: transparent;
    transition: background 0.2s ease;
  }
  .radio-option input:checked::after {
    background: #4dc0ff;
  }
  .radio-option input:checked {
    border-color: #4dc0ff;
  }
  .assist-field {
    gap: 0.75rem;
  }
  .assist-tasks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .assist-tasks.empty {
    color: rgba(245, 245, 245, 0.7);
  }
  .task-chip {
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(10, 14, 20, 0.8);
    color: #f0f3f8;
    padding: 0.35rem 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  }
  .task-chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .task-chip-on {
    background: rgba(86, 82, 45, 0.8);
    border-color: rgba(242, 210, 124, 0.7);
    color: #f8e5af;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.6rem 1.6rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: #1f6b2b;
    color: #f6fff6;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>

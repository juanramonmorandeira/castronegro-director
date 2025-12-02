<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';
  import Modal from '../ui/Modal.svelte';
  import Button from '../ui/Button.svelte';

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
  export let savedMessage = '';

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
  const modalDescription = $t('configure.intro');
</script>

<Modal
  open={open}
  title={$t('configure.properties_title')}
  description={modalDescription}
  size="lg"
  closeOnBackdrop={false}
  on:close={close}
>
  <section class="properties-body">
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
                <span class="radio-chip">{option}</span>
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
                  {#if task}
                    <label
                      class={`assist-toggle ${draft.assistTasks.includes(task) ? 'assist-toggle--on' : ''} ${derivedAssistEnabled ? '' : 'assist-toggle--disabled'}`}
                    >
                      <input
                        type="checkbox"
                        checked={draft.assistTasks.includes(task)}
                        disabled={!derivedAssistEnabled}
                        on:change={() => toggleAssistTask(task)}
                      />
                      <span class="assist-toggle__track">
                        <span class="assist-toggle__thumb" aria-hidden="true"></span>
                      </span>
                      <span class="assist-toggle__label">{getAssistTaskLabel(task)}</span>
                    </label>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/if}
  </section>

  {#if savedMessage}
    <p class="action-hint" aria-live="polite">{savedMessage}</p>
  {/if}

  <svelte:fragment slot="footer">
    <Button variant="primary" type="button" on:click={save}>{$t('common.actions.save')}</Button>
  </svelte:fragment>
</Modal>

<style>
  .properties-body {
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
    color: var(--color-white-muted);
  }
  .input-shell {
    border-radius: 16px;
    border: 1px solid var(--glass-border);
    background: rgba(11, 17, 26, 0.85);
    padding: 0.25rem 0.35rem;
  }
  .properties-body select {
    color-scheme: dark;
  }
  .properties-body option {
    background: var(--surface-panel);
    color: var(--color-white-contrast);
  }
  .input {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--color-white-contrast);
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
    border: 1px solid var(--glass-border);
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
    border: 2px solid var(--surface-panel);
    box-shadow: 0 0 0 2px rgba(243, 206, 116, 0.3);
  }
  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #f3ce74;
    border: 2px solid var(--surface-panel);
    box-shadow: 0 0 0 2px rgba(243, 206, 116, 0.3);
  }
  .storyteller-field {
    border: 1px solid var(--glass-border);
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
    color: var(--color-white-muted);
  }
.director-options {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.radio-option {
  position: relative;
  display: inline-flex;
}
.radio-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.radio-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 150px;
  padding: 0.7rem 1.1rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--glass-fill);
  color: var(--color-white-muted);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease,
    box-shadow 0.2s ease;
}
.radio-option input:checked + .radio-chip {
  background: rgba(255, 232, 140, 0.16);
  border-color: var(--color-gold-info);
  color: var(--color-white-contrast);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
}
.radio-option input:focus-visible + .radio-chip {
  outline: 2px solid rgba(255, 232, 140, 0.65);
  outline-offset: 2px;
}
  .assist-field {
    gap: 0.75rem;
  }
  .assist-tasks {
    display: grid;
    gap: 0.65rem;
  }
  .assist-tasks.empty {
    color: var(--color-white-muted);
  }
  .assist-toggle {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.35rem 0.25rem;
  }
  .assist-toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .assist-toggle__track {
    position: relative;
    width: 54px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: var(--glass-fill);
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .assist-toggle__thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-white-contrast);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.45);
    transition: transform 0.2s ease;
  }
  .assist-toggle__label {
    font-size: 0.92rem;
    color: var(--color-white-contrast);
  }
  .assist-toggle--on .assist-toggle__track {
    background: linear-gradient(
      135deg,
      var(--color-green-cta--primary),
      var(--color-green-cta-primary)
    );
    border-color: var(--color-green-cta-primary);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }
  .assist-toggle--on .assist-toggle__thumb {
    transform: translateX(24px);
  }
  .assist-toggle--disabled {
    opacity: 0.45;
  }
  .assist-toggle input:focus-visible + .assist-toggle__track,
  .assist-toggle input:focus-visible ~ .assist-toggle__label {
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 232, 140, 0.6);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
</style>

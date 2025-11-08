<script>
  import { createEventDispatcher } from 'svelte';
  import { t } from '../../lib/i18n.js';

  const clampPlayers = (value, min, max) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.min(Math.max(numeric, min), max);
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

  function toggleAssistTask(task) {
    if (!derivedAssistEnabled) return;
    if (draft.assistTasks.includes(task)) {
      draft = {
        ...draft,
        assistTasks: draft.assistTasks.filter((t) => t !== task)
      };
    } else {
      draft = {
        ...draft,
        assistTasks: [...draft.assistTasks, task]
      };
    }
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
        <button class="icon-btn" type="button" on:click={close} aria-label={$t('common.actions.cancel')}>
          ×
        </button>
      </header>

      <section class="modal-body">
        <label class="field">
          <span class="label">{$t('configure.ruleset_label')}</span>
          <select
            class="input"
            bind:value={draft.rulesets}
          >
            {#each options.availableRulesets as ruleset}
              <option value={ruleset}>{ruleset}</option>
            {/each}
          </select>
        </label>

        <label class="field">
          <span class="label">{$t('configure.players_label')}</span>
          <input
            type="number"
            class="input"
            min={options.minPlayers}
            max={options.maxPlayers}
            bind:value={draft.players_expected}
            on:change={(event) => setPlayers(event.currentTarget.value)}
          />
          <input
            type="range"
            min={options.minPlayers}
            max={options.maxPlayers}
            step="1"
            bind:value={draft.players_expected}
            on:input={(event) => setPlayers(event.currentTarget.value)}
          />
        </label>

        <fieldset class="field">
          <legend class="label">{$t('configure.director_label')}</legend>
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
            <select class="input" bind:value={draft.language}>
              {#each options.availableLanguages as lang}
                <option value={lang}>{lang}</option>
              {/each}
            </select>
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
                  <label class="task-chip {draft.assistTasks.includes(task) ? 'task-chip-on' : ''}">
                    <input
                      type="checkbox"
                      checked={draft.assistTasks.includes(task)}
                      disabled={!derivedAssistEnabled}
                      on:change={() => toggleAssistTask(task)}
                    />
                    <span>{task.replace(/_/g, ' ')}</span>
                  </label>
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
    background: rgba(3, 6, 14, 0.75);
    display: grid;
    place-items: center;
    z-index: 1100;
    padding: 1rem;
  }
  .config-modal {
    width: min(680px, 95vw);
    background: rgba(8, 14, 24, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
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
    font-size: 1.4rem;
  }
  .icon-btn {
    background: transparent;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
  }
  .modal-body {
    display: grid;
    gap: 1rem;
  }
  .field {
    display: grid;
    gap: 0.5rem;
  }
  .label {
    font-weight: 600;
  }
  .input {
    background: rgba(12, 18, 28, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 10px;
    padding: 0.6rem 0.9rem;
    color: #f7f9fc;
  }
  input[type='range'] {
    width: 100%;
    accent-color: rgba(255, 220, 140, 0.85);
  }
  .director-options {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .radio-option {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  .assist-field {
    gap: 0.75rem;
  }
  .assist-tasks {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .assist-tasks.empty {
    color: rgba(245, 245, 245, 0.7);
  }
  .task-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.7rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.05);
  }
  .task-chip-on {
    background: rgba(255, 232, 140, 0.15);
    border-color: rgba(255, 232, 140, 0.4);
  }
  .task-chip input {
    display: none;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn {
    border: none;
    border-radius: 999px;
    padding: 0.55rem 1.4rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn.primary {
    background: rgba(74, 141, 74, 0.85);
    color: #f6fff6;
  }
  .btn.secondary {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(248, 248, 250, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.18);
  }
</style>

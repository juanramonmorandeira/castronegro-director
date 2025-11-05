<!-- src/components/configure/ConfigureBasics.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // ConfigureBasics.svelte
  // Bloque “Básicos” del configurador de partida.
  //
  // Permite definir:
  //   • Idioma de la partida
  //   • Conjunto de reglas (rule set)
  //   • Tipo de narrador (humano / IA)
  //   • Activación de asistencias y tareas
  //   • Número de jugadores esperados
  //
  // Se comunica con Firestore usando las funciones del módulo db.js:
  //   - getGamesMetadata()
  //   - getBalanceTable()
  //   - updateSession()
  // ─────────────────────────────────────────────────────────────

  import { onMount } from "svelte";
  import { updateSession } from "$lib/db.js";
  import { getGamesMetadata, getBalanceTable } from "$lib/gameMetadata.js";
  import { t } from "../../lib/i18n.js";

  // Recibe desde App.svelte el ID de la sesión actual
  export let sessionId;

  // Estado del componente
  let loading = true;
  let meta = null;     // Metadata general del juego (definiciones)
  let balance = null;  // Tabla de equilibrio por número de jugadores

  // Estructura del formulario
  let form = {
    language: 'en',
    rulesets: 'basic',
    storyteller: 'human',
    assist_enabled: false,
    assist_tasks: [],
    players_expected: 5,
    game_phase: 'Introduction'
  };

  // Al montar el componente: cargar datos iniciales
  onMount(async () => {
    meta = await getGamesMetadata();
    balance = await getBalanceTable();

    // Cargar valores por defecto desde la metadata
    const d = meta?.defaults || {};
    const languages = meta?.language_values ?? ['en'];
    form.language = d.language ?? languages[0] ?? form.language;
    form.rulesets = d.rulesets ?? meta?.rulesets_values?.[0] ?? form.rulesets;
    form.storyteller = d.storyteller ?? meta?.storyteller_values?.[0] ?? form.storyteller;
    form.assist_enabled = d.assist_enabled ?? form.assist_enabled;
    form.assist_tasks = Array.isArray(d.assist_tasks) ? d.assist_tasks : [];
    form.game_phase = d.game_phase ?? meta?.game_phase_values?.[0] ?? form.game_phase;

    // Calcular mínimo número de jugadores desde la balance table
    const keys = Object.keys(balance?.distribution_table || {}).map(Number).sort((a, b) => a - b);
    const minPlayers = keys[0] ?? 5;
    form.players_expected = d.players_expected ?? minPlayers;

    loading = false;
  });

  // Alternar activación/desactivación de fases de asistencia
  function toggleTask(task) {
    if (form.assist_tasks.includes(task)) {
      form.assist_tasks = form.assist_tasks.filter((x) => x !== task);
    } else {
      form.assist_tasks = [...form.assist_tasks, task];
    }
  }

  // Guardar cambios en Firestore
  async function saveBasics() {
    const isHuman = form.storyteller === 'human';
    const language = isHuman ? (meta?.language_values ?? ['en'])[0] ?? 'en' : form.language;
    const assistEnabled = !isHuman && !!form.assist_enabled;
    const assistTasks = assistEnabled ? form.assist_tasks : [];

    await updateSession(sessionId, {
      'settings.language': language,
      'settings.rulesets': form.rulesets,
      'settings.storyteller': form.storyteller,
      'settings.players_expected': Number(form.players_expected),
      'settings.assist_enabled': assistEnabled,
      'settings.assist_tasks': assistTasks,
      'game_phases.current': form.game_phase,
      status: 'draft'
    });

    saved = true;
    setTimeout(() => (saved = false), 1200);
  }

  let saved = false;
</script>

<!-- ─────────────────────────────────────────────────────────────
     CONTENIDO PRINCIPAL DEL BLOQUE “BÁSICOS”
     ───────────────────────────────────────────────────────────── -->
{#if loading}
  <div class="info-box">{$t('configure.basics.loading')}</div>
{:else}
  <div class="basics-container">
    <h3>{$t('configure.basics.title')}</h3>

    <!-- Bloque de selección principal -->
    <div class="form-grid">
      <!-- Idioma -->
      <label>
        <div class="label">{$t('configure.basics.language')}</div>
        <select bind:value={form.language} class="input" disabled={form.storyteller === 'human'}>
          {#each meta.language_values as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </label>

      <!-- Rule set -->
      <label>
        <div class="label">{$t('configure.basics.rule_set')}</div>
        <select bind:value={form.rulesets} class="input">
          {#each meta.rulesets_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
      </label>

      <!-- Storyteller -->
      <label>
        <div class="label">{$t('configure.basics.director')}</div>
        <select bind:value={form.storyteller} class="input">
          {#each meta.storyteller_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
      </label>

      <!-- Jugadores esperados -->
      <label>
        <div class="label">{$t('configure.basics.players_expected')}</div>
        <input type="number" class="input" min="5" step="1" bind:value={form.players_expected} />
        <div class="hint">{$t('configure.basics.players_hint')}</div>
      </label>
    </div>

    <!-- Asistencias -->
    <div class="assist-block">
      <div class="label">{$t('configure.basics.assistance')}</div>
      <label class="inline">
        <input type="checkbox"
               bind:checked={form.assist_enabled}
               disabled={form.storyteller === 'human' || form.storyteller === 'AI'} />
        <span>{$t('configure.basics.enable_assistance')}</span>
      </label>

      <div class="chip-row">
        {#each meta.assist_tasks_values as task}
          <label class={"chip " + (form.assist_tasks.includes(task) ? "chip-on" : "")}>
            <input type="checkbox"
                   checked={form.assist_tasks.includes(task)}
                   on:change={() => toggleTask(task)}
                   disabled={!form.assist_enabled && form.storyteller !== 'AI'} />
            <span>{task.replace(/_/g, ' ')}</span>
          </label>
        {/each}
      </div>
    </div>

    <!-- Botón de guardado -->
    <div class="button-row">
      <button class="btn" on:click={saveBasics}>{$t('configure.basics.save')}</button>
      {#if saved}<span class="saved-msg">{$t('configure.basics.saved')}</span>{/if}
    </div>
  </div>
{/if}

<style>
  /* ─────────────────────────────────────────────────────────────
     ESTILOS LOCALES – BLOQUE “BÁSICOS”
     (Todo el CSS global vive en app.css)
     ───────────────────────────────────────────────────────────── */

  /* Contenedor principal */
  .basics-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .basics-container h3 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  /* Bloque de carga */
  .info-box {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
  }

  /* Grid principal del formulario */
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1rem;
  }

  /* Campos del formulario */
  .label {
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .hint {
    font-size: 0.75rem;
    opacity: 0.7;
    margin-top: 0.25rem;
  }

  .input {
    width: 100%;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.6);
  }

  /* Bloque de asistencias */
  .assist-block {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .inline {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    cursor: pointer;
  }

  .chip-on {
    background: rgba(173, 216, 230, 0.25);
    border-color: rgba(173, 216, 230, 0.6);
  }

  /* Botón principal */
  .button-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 0.9rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .saved-msg {
    color: #8f8;
    font-size: 0.9rem;
  }
</style>

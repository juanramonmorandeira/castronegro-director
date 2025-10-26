<!-- src/components/configure/ConfigureBasics.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // ConfigureBasics.svelte
  // Bloque “Básicos” del configurador de partida.
  //
  // Permite definir:
  //   • Idioma de la partida
  //   • Conjunto de reglas (rule set)
  //   • Tipo de director (humano / IA)
  //   • Activación de asistencias y sus fases
  //   • Número de jugadores esperados
  //
  // Se comunica con Firestore usando las funciones del módulo db.js:
  //   - getGamesMetadata()
  //   - getBalanceTable()
  //   - updateSession()
  // ─────────────────────────────────────────────────────────────

  import { onMount } from "svelte";
  import { getGamesMetadata, getBalanceTable, updateSession } from "$lib/db.js";

  // Recibe desde App.svelte el ID de la sesión actual
  export let sessionId;

  // Estado del componente
  let loading = true;
  let meta = null;     // Metadata general del juego (definiciones)
  let balance = null;  // Tabla de equilibrio por número de jugadores

  // Estructura del formulario
  let form = {
    language: "en",
    set_reglas: "basic",
    director: "human",
    assist_enabled: false,
    assist_phases: [],
    assist_rules: false,
    players_expected: 5
  };

  // Al montar el componente: cargar datos iniciales
  onMount(async () => {
    meta = await getGamesMetadata();
    balance = await getBalanceTable();

    // Cargar valores por defecto desde la metadata
    const d = meta?.defaults || {};
    form.language = d.language ?? form.language;
    form.set_reglas = d.set_reglas ?? form.set_reglas;
    form.director = d.director ?? form.director;
    form.assist_enabled = d.assist_enabled ?? form.assist_enabled;
    form.assist_phases = d.assist_phases ?? form.assist_phases;
    form.assist_rules = d.assist_rules ?? form.assist_rules;

    // Calcular mínimo número de jugadores desde la balance table
    const keys = Object.keys(balance?.distribution_table || {}).map(Number).sort((a, b) => a - b);
    const minPlayers = keys[0] ?? 5;
    form.players_expected = d.players_expected ?? minPlayers;

    loading = false;
  });

  // Alternar activación/desactivación de fases de asistencia
  function togglePhase(p) {
    if (form.assist_phases.includes(p)) {
      form.assist_phases = form.assist_phases.filter(x => x !== p);
    } else {
      form.assist_phases = [...form.assist_phases, p];
    }
  }

  // Guardar cambios en Firestore
  async function saveBasics() {
    // Si el director es humano → se desactivan asistencias
    const assist = form.director === "human"
      ? { enabled: false, phases: [], rules: false }
      : { enabled: !!form.assist_enabled, phases: form.assist_phases, rules: !!form.assist_rules };

    await updateSession(sessionId, {
      language: form.language,
      set_reglas: form.set_reglas,
      director: form.director,
      assist,
      players_expected: Number(form.players_expected),
      status: "draft" // sigue en configuración
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
  <div class="info-box">Loading basics…</div>
{:else}
  <div class="basics-container">
    <h3>Basics</h3>

    <!-- Bloque de selección principal -->
    <div class="form-grid">
      <!-- Idioma -->
      <label>
        <div class="label">Language</div>
        <select bind:value={form.language} class="input">
          {#each meta.language_values as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </label>

      <!-- Rule set -->
      <label>
        <div class="label">Rule set</div>
        <select bind:value={form.set_reglas} class="input">
          {#each meta.set_reglas_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
      </label>

      <!-- Director -->
      <label>
        <div class="label">Director</div>
        <select bind:value={form.director} class="input">
          {#each meta.director_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
        <div class="hint">
          {form.director === 'human'
            ? 'Assistance disabled'
            : form.director === 'human-AI'
              ? 'Assistance can be enabled'
              : 'Assistance forced'}
        </div>
      </label>

      <!-- Jugadores esperados -->
      <label>
        <div class="label">Players (expected)</div>
        <input type="number" class="input" min="5" step="1" bind:value={form.players_expected} />
        <div class="hint">Min/Max per balance table available.</div>
      </label>
    </div>

    <!-- Asistencias -->
    <div class="assist-block">
      <div class="label">Assistance</div>
      <label class="inline">
        <input type="checkbox"
               bind:checked={form.assist_enabled}
               disabled={form.director==='human' || form.director==='AI'} />
        <span>Enable assistance (human-AI only)</span>
      </label>

      <div class="chip-row">
        {#each meta.assist_phase_values as p}
          <label class={"chip " + (form.assist_phases.includes(p) ? "chip-on" : "")}>
            <input type="checkbox"
                   checked={form.assist_phases.includes(p)}
                   on:change={() => togglePhase(p)}
                   disabled={!form.assist_enabled && form.director!=='AI'} />
            <span>{p}</span>
          </label>
        {/each}
      </div>

      <label class="inline">
        <input type="checkbox"
               bind:checked={form.assist_rules}
               disabled={!form.assist_enabled && form.director!=='AI'} />
        <span>Rules arbitration</span>
      </label>
    </div>

    <!-- Botón de guardado -->
    <div class="button-row">
      <button class="btn" on:click={saveBasics}>Save basics</button>
      {#if saved}<span class="saved-msg">Saved ✓</span>{/if}
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
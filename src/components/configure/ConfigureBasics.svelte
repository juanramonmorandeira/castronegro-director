<!-- src/components/configure/ConfigureBasics.svelte -->
<script>
  import { onMount } from "svelte";
  import { getGamesMetadata, getBalanceTable, updateSession } from "$lib/db.js";

  export let sessionId;         // viene desde App.svelte
  let loading = true;
  let meta = null;              // games_metadata
  let balance = null;           // balance_table
  let form = {
    language: "en",
    set_reglas: "basic",
    director: "human",
    assist_enabled: false,
    assist_phases: [],
    assist_rules: false,
    players_expected: 5
  };

  onMount(async () => {
    meta = await getGamesMetadata();
    balance = await getBalanceTable();

    // defaults desde metadata
    const d = meta?.defaults || {};
    form.language = d.language ?? form.language;
    form.set_reglas = d.set_reglas ?? form.set_reglas;
    form.director = d.director ?? form.director;
    form.assist_enabled = d.assist_enabled ?? form.assist_enabled;
    form.assist_phases = d.assist_phases ?? form.assist_phases;
    form.assist_rules = d.assist_rules ?? form.assist_rules;

    // mínimo jugadores = min key de distribution_table
    const keys = Object.keys(balance?.distribution_table || {}).map(Number).sort((a,b)=>a-b);
    const minPlayers = keys[0] ?? 5;
    form.players_expected = d.players_expected ?? minPlayers;

    loading = false;
  });

  function togglePhase(p) {
    if (form.assist_phases.includes(p)) {
      form.assist_phases = form.assist_phases.filter(x => x !== p);
    } else {
      form.assist_phases = [...form.assist_phases, p];
    }
  }

  async function saveBasics() {
    // si director = human → forzar asistencias off
    const assist = form.director === "human"
      ? { enabled: false, phases: [], rules: false }
      : { enabled: !!form.assist_enabled, phases: form.assist_phases, rules: !!form.assist_rules };

    await updateSession(sessionId, {
      language: form.language,
      set_reglas: form.set_reglas,
      director: form.director,
      assist,
      players_expected: Number(form.players_expected),
      status: "draft" // aún configurando
    });
    saved = true; setTimeout(()=> saved=false, 1200);
  }

  let saved = false;
</script>

{#if loading}
  <div class="p-3 border rounded bg-gray-50">Loading basics…</div>
{:else}
  <div class="space-y-6">
    <h3 class="text-lg font-semibold">Basics</h3>

    <div class="grid gap-4 md:grid-cols-2">
      <!-- Language -->
      <label class="block">
        <div class="text-sm font-medium mb-1">Language</div>
        <select bind:value={form.language} class="input">
          {#each meta.language_values as lang}
            <option value={lang}>{lang}</option>
          {/each}
        </select>
      </label>

      <!-- Rule set -->
      <label class="block">
        <div class="text-sm font-medium mb-1">Rule set</div>
        <select bind:value={form.set_reglas} class="input">
          {#each meta.set_reglas_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
      </label>

      <!-- Director -->
      <label class="block">
        <div class="text-sm font-medium mb-1">Director</div>
        <select bind:value={form.director} class="input">
          {#each meta.director_values as v}
            <option value={v}>{v}</option>
          {/each}
        </select>
        <div class="text-xs opacity-70 mt-1">
          {form.director === 'human' ? 'Assistance disabled' :
           form.director === 'human-AI' ? 'Assistance can be enabled' : 'Assistance forced'}
        </div>
      </label>

      <!-- Players expected -->
      <label class="block">
        <div class="text-sm font-medium mb-1">Players (expected)</div>
        <input type="number" class="input" min="5" step="1" bind:value={form.players_expected} />
        <div class="text-xs opacity-70 mt-1">
          Min/Max per balance table available.
        </div>
      </label>
    </div>

    <!-- Assistance -->
    <div class="space-y-2">
      <div class="text-sm font-medium">Assistance</div>
      <label class="inline-flex items-center gap-2">
        <input type="checkbox" bind:checked={form.assist_enabled} disabled={form.director==='human' || form.director==='AI'} />
        <span>Enable assistance (human-AI only)</span>
      </label>
      <div class="flex flex-wrap gap-2">
        {#each meta.assist_phase_values as p}
          <label class={"chip " + (form.assist_phases.includes(p) ? "chip-on":"")}
            >
            <input type="checkbox"
                   checked={form.assist_phases.includes(p)}
                   on:change={() => togglePhase(p)}
                   disabled={!form.assist_enabled && form.director!=='AI'} />
            <span>{p}</span>
          </label>
        {/each}
      </div>
      <label class="inline-flex items-center gap-2">
        <input type="checkbox" bind:checked={form.assist_rules} disabled={!form.assist_enabled && form.director!=='AI'} />
        <span>Rules arbitration</span>
      </label>
    </div>

    <div class="flex gap-2">
      <button class="btn" on:click={saveBasics}>Save basics</button>
      {#if saved}<span class="text-green-600 text-sm">Saved ✓</span>{/if}
    </div>
  </div>
{/if}

<style>
  .input { padding: .5rem; border:1px solid #ddd; border-radius:.5rem; width:100%; }
  .btn { padding:.5rem .75rem; border:1px solid #ddd; border-radius:.5rem; }
  .chip { display:inline-flex; align-items:center; gap:.4rem; padding:.35rem .6rem; border:1px solid #ddd; border-radius:999px; }
  .chip-on { background:#eef; border-color:#99c; }
</style>
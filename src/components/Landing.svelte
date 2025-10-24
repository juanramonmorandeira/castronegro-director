<script>
  import { onMount } from "svelte";
  import { getCurrentSession, listSessionHistory, createSessionDraft } from "../lib/db.js";

  let loading = true;
  let current = null;
  let history = [];
  let now = new Date();
  let tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let timer;
  onMount(async () => {
    timer = setInterval(() => { now = new Date(); }, 1000);
    try {
      await refresh();
    } finally {
      loading = false;
    }
    return () => clearInterval(timer);
  });

  async function refresh() {
    current = await getCurrentSession();
    history = await listSessionHistory(20);
  }

  const pad = n => String(n).padStart(2, "0");
  function fmt(d) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  export let onCreate = () => {};
  export let onViewCurrent = () => {};

  async function createAndGo() {
    const id = await createSessionDraft({ title: "Untitled session", language: "en" });
    await refresh();
    onCreate(id);
  }

  // Colores y textos por estado
  const statusInfo = {
    draft:       { color: "bg-slate-50 border-slate-300 text-slate-700", label: "Configuring" },
    waiting:     { color: "bg-blue-50 border-blue-300 text-blue-700",   label: "Waiting for players" },
    in_progress: { color: "bg-green-50 border-green-300 text-green-700", label: "In progress" },
    paused:      { color: "bg-amber-50 border-amber-300 text-amber-700", label: "Paused" },
    finished:    { color: "bg-gray-100 border-gray-300 text-gray-700",  label: "Finished" },
    cancelled:   { color: "bg-red-50 border-red-300 text-red-700",      label: "Cancelled" }
  };

  function bannerClass(status) {
    return statusInfo[status]?.color || "bg-gray-50 border-gray-200 text-gray-600";
  }

  function statusLabel(status) {
    return statusInfo[status]?.label || "Unknown";
  }
</script>

<header class="p-4 border-b flex items-center gap-3">
  <img src="/logo.svg" alt="Logo" class="w-8 h-8" on:error={(e)=> e.target.style.display='none'} />
  <div>
    <h1 class="text-xl font-semibold">El Narrador de la Aldea</h1>
    <p class="text-sm opacity-70">Village Storyteller – Director’s Dashboard</p>
  </div>
  <div class="ml-auto text-xs opacity-75">
    {fmt(now)} ({tz})
  </div>
</header>

<main class="p-4 max-w-4xl mx-auto space-y-6">

  {#if loading}
    <div class="p-3 border rounded bg-gray-50">Loading…</div>
  {:else}
    <div class={"p-3 border rounded flex flex-col gap-1 " + (current ? bannerClass(current.status) : "bg-amber-50 border-amber-300")}>
      {#if current}
        <div>
          The session “<strong>{current.title || current.id}</strong>” is currently
          <span class="font-medium"> {statusLabel(current.status)}.</span>
        </div>
        <div class="text-xs opacity-80">
          Language: {current.language || "?"} · Director: {current.director || "?"}
        </div>
      {:else}
        No active game sessions right now.
      {/if}
    </div>
  {/if}

  <div class="flex gap-2">
    <button class="btn" on:click={createAndGo}>Create new game</button>
    <button class="btn" disabled={!current} on:click={() => onViewCurrent(current?.id)}>View current game</button>
  </div>

  <section class="space-y-2">
    <h2 class="text-lg font-medium">Past sessions</h2>
    {#if history.length === 0}
      <div class="text-sm opacity-70">No sessions yet.</div>
    {:else}
      <ul class="space-y-2">
        {#each history as s}
          <li class={"p-3 border rounded flex items-center justify-between " + bannerClass(s.status)}>
            <div>
              <div class="font-medium">{s.title || s.id}</div>
              <div class="text-sm opacity-75">
                {statusLabel(s.status)}{#if s.players_expected} · players: {s.players_expected}{/if}
              </div>
            </div>
            <div class="text-xs opacity-70">
              {s.created_at ? '' : 'no timestamp'}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  .btn { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 0.5rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
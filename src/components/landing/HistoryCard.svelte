<script>
  import { createEventDispatcher } from 'svelte';
  import { formatDateTime, statusBadgeClass, statusLabel, toEpochMillis } from '../../lib/utils.js';

  // Constants
  const DEFAULT_LABELS = {
    title: 'Title',
    numPlayers: 'Num players',
    winners: 'Winner/s',
    date: 'Date',
    status: 'Status',
    actions: 'Actions'
  };

  // Props
  export let items = [];
  export let loading = false;
  export let error = null;
  export let labels = DEFAULT_LABELS;

  // Events
  const dispatch = createEventDispatcher();
  const emitView = (id) => dispatch('view', { id });
  const emitEdit = (id) => dispatch('edit', { id });
  const emitDelete = (id) => dispatch('delete', { id });

  // State
  let sortKey = 'date';
  let sortDir = 'desc';
  let query = '';

  // Helpers
  const normalizeText = (value) => Array.isArray(value) ? value.join(', ') : (value ?? '');
  const epochValue = (value) => toEpochMillis(value) ?? 0;

  const matchesQuery = (item, q) => {
    if (!q) return true;
    return (
      normalizeText(item.title).toLowerCase().includes(q) ||
      normalizeText(item.status).toLowerCase().includes(q) ||
      normalizeText(item.winners).toLowerCase().includes(q)
    );
  };

  // Derived data
  $: normalizedQuery = query.trim().toLowerCase();
  $: filtered = items.filter((item) => matchesQuery(item, normalizedQuery));
  $: sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortKey === 'date') comparison = epochValue(a.date) - epochValue(b.date);
    else if (sortKey === 'numPlayers') comparison = (a.numPlayers ?? 0) - (b.numPlayers ?? 0);
    else comparison = normalizeText(a[sortKey]).localeCompare(normalizeText(b[sortKey]), undefined, { sensitivity: 'base' });
    return sortDir === 'asc' ? comparison : -comparison;
  });

  // Behaviour
  function toggleSort(key) {
    if (key === 'actions') return;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortKey = key;
      sortDir = key === 'date' ? 'desc' : 'asc';
    }
  }
</script>

<section class="history-card">
  <!-- Header / title arriba (ya lo tienes) -->
  <header class="card-header">
    <h2 class="history-title">History</h2>
    <div class="toolbar">
      <input class="search" type="search" placeholder="Search by title, status or winner…" bind:value={query} aria-label="Session Search" />
      {#if loading}<span class="badge info" aria-live="polite">Cargando…</span>{/if}
      {#if error}<span class="badge error" role="alert">Error: {error}</span>{/if}
    </div>
  </header>

  <div class="table-wrap" role="region" aria-label="Sessions History">
    <table class="history-table">
      <thead>
        <tr>
          <th class="sortable" on:click={() => toggleSort('title')} aria-sort={sortKey==='title'?(sortDir==='asc'?'ascending':'descending'):'none'}>{labels.title}</th>
          <th class="sortable" on:click={() => toggleSort('numPlayers')} aria-sort={sortKey==='numPlayers'?(sortDir==='asc'?'ascending':'descending'):'none'}>{labels.numPlayers}</th>
          <th class="sortable" on:click={() => toggleSort('winners')} aria-sort={sortKey==='winners'?(sortDir==='asc'?'ascending':'descending'):'none'}>{labels.winners}</th>
          <th class="sortable" on:click={() => toggleSort('date')} aria-sort={sortKey==='date'?(sortDir==='asc'?'ascending':'descending'):'none'}>{labels.date}</th>
          <th class="sortable" on:click={() => toggleSort('status')} aria-sort={sortKey==='status'?(sortDir==='asc'?'ascending':'descending'):'none'}>{labels.status}</th>
          <th>{labels.actions}</th>
        </tr>
      </thead>
      <tbody>
        {#if sorted.length === 0}
          <tr><td class="empty" colspan="6">{query ? `There are not results for “${query}”.` : 'There are no sessions recorded.'}</td></tr>
        {:else}
          {#each sorted as it}
            <tr>
              <td data-label={labels.title}>{it.title ?? '—'}</td>
              <td class="num"   data-label={labels.numPlayers}>{it.numPlayers ?? '—'}</td>
              <td data-label={labels.winners}>{normalizeText(it.winners) || '—'}</td>
              <td class="date" data-label={labels.date}>{formatDateTime(it.date)}</td>
              <td data-label={labels.status}>
                <span class="badge {statusBadgeClass(it.status)}">
                  {statusLabel(it.status)}
                </span>
              </td>
              <td class="actions" data-label={labels.actions}>
              <button class="ghost"  title="Ver"     on:click={() => emitView(it.id)}>View</button>
              <button class="ghost"  title="Editar"  on:click={() => emitEdit(it.id)}>Edit</button>
              <button class="danger" title="Eliminar"on:click={() => emitDelete(it.id)}>Delete</button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</section>

<style>
  .history-card { display: grid; gap: 0.75rem; }
  .card-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .card-header h2 { margin: 0; font-size: 1.1rem; }
  .history-title {
    font-family: var(--title-font, 'Cinzel', serif);
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-shadow: 0 0 10px rgba(255, 230, 140, 0.8), 0 0 20px rgba(255, 200, 80, 0.5);
    color: #f7d774;
    margin: 0 0 0.25rem 0;
  }
  .toolbar { display: flex; align-items: center; gap: 0.5rem; }
  .search { flex: 1; padding: 0.5rem 0.6rem; border: 1px solid #cfcfcf; border-radius: 6px; outline: none; }
  .search:focus { border-color: #888; }
  .badge { font-size: 0.85rem; padding: 0.2rem 0.5rem; border-radius: 999px; }
  .badge.info { background: #eef5ff; color: #245; border: 1px solid #cfe1ff; }
  .badge.error { background: #ffecec; color: #712; border: 1px solid #ffc9c9; }

  .table-wrap { overflow: auto; border: 1px solid #e6e6e6; border-radius: 8px; }
  .history-table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-weight: 600; font-size: 0.95rem; padding: 0.6rem 0.75rem; background: #fafafa; border-bottom: 1px solid #ececec; white-space: nowrap; user-select: none; }
  .sortable { cursor: pointer; }
  tbody td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f1f1f1; vertical-align: middle; }
  tbody tr:hover { background: #fcfcff; }
  td.empty { text-align: center; color: #777; padding: 1.25rem; }
  td.num, td.date { white-space: nowrap; }
  .actions { display: flex; gap: 0.4rem; }
  .ghost { background: transparent; border: 1px solid #ddd; padding: 0.25rem 0.5rem; border-radius: 6px; }
  .danger { background: #fff0f0; border: 1px solid #f1c4c4; padding: 0.25rem 0.5rem; border-radius: 6px; color: #a11; }

/* --- Responsive sin scroll horizontal: filas como tarjetas (mobile-first) --- */
@media (max-width: 760px) {
  .history-card { margin-inline: 0.5rem; }

  .history-table thead {
    /* Ocultamos encabezado visualmente pero lo dejamos en el DOM (accesible) */
    border: 0;
    clip: rect(0 0 0 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
  }

  .history-table, 
  .history-table tbody, 
  .history-table tr, 
  .history-table td {
    display: block;
    width: 100%;
  }

  .history-table tr {
    border: 1px solid #eee;
    border-radius: 8px;
    padding: 0.5rem 0.6rem;
    margin-block: 0.5rem;
    background: #fff;
  }

  .history-table td {
    border: 0;
    display: grid;
    grid-template-columns: 40% 60%;
    align-items: center;
    padding: 0.35rem 0.25rem;
  }

  .history-table td::before {
    content: attr(data-label);
    font-weight: 600;
    padding-right: 0.5rem;
  }

  .history-table td.actions {
    grid-template-columns: 1fr;
    gap: 0.4rem;
  }
}
</style>

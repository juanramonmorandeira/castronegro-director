<script>
  import { createEventDispatcher } from 'svelte';
  import { formatDateTime, normalizeStatus, statusBadgeClass, toEpochMillis } from '../../lib/utils.js';
  import { t } from '../../lib/i18n.js';

  export let items = [];
  export let loading = false;
  export let error = null;
  export let labels = {};
  export let dateLocale;

  const dispatch = createEventDispatcher();
  const emitView = (id) => dispatch('view', { id });
  const emitEdit = (id) => dispatch('edit', { id });
  const emitDelete = (id) => dispatch('delete', { id });

  let sortKey = 'date';
  let sortDir = 'desc';
  let query = '';

  const normalizeText = (value) => Array.isArray(value) ? value.join(', ') : (value ?? '');
  const epochValue = (value) => toEpochMillis(value) ?? 0;

  $: baseLabels = {
    title: $t('history.headers.title'),
    numPlayers: $t('history.headers.num_players'),
    winners: $t('history.headers.winners'),
    date: $t('history.headers.date'),
    status: $t('history.headers.status'),
    actions: $t('history.headers.actions'),
  };
  $: resolvedLabels = { ...baseLabels, ...labels };

  $: headerTitle = $t('landing.history.title');
  $: searchPlaceholder = $t('landing.history.search_placeholder');
  $: loadingLabel = $t('landing.history.loading');
  $: errorPrefix = $t('landing.history.error_prefix');
  $: trimmedQuery = query.trim();
  $: normalizedQuery = trimmedQuery.toLowerCase();

  $: filtered = items.filter((item) => {
    if (!normalizedQuery) return true;
    const title = normalizeText(item.title).toLowerCase();
    const statusRaw = normalizeText(item.status).toLowerCase();
    const statusLocalized = $t(`status.${normalizeStatus(item.status)}`).toLowerCase();
    const winners = normalizeText(item.winners).toLowerCase();
    return (
      title.includes(normalizedQuery) ||
      statusRaw.includes(normalizedQuery) ||
      statusLocalized.includes(normalizedQuery) ||
      winners.includes(normalizedQuery)
    );
  });

  $: sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortKey === 'date') comparison = epochValue(a.date) - epochValue(b.date);
    else if (sortKey === 'numPlayers') comparison = (a.numPlayers ?? 0) - (b.numPlayers ?? 0);
    else comparison = normalizeText(a[sortKey]).localeCompare(normalizeText(b[sortKey]), undefined, { sensitivity: 'base' });
    return sortDir === 'asc' ? comparison : -comparison;
  });

  $: emptyStateText = trimmedQuery
    ? $t('landing.history.empty_with_query', { query: trimmedQuery })
    : $t('landing.history.empty');
  $: viewLabel = $t('common.actions.view');
  $: editLabel = $t('common.actions.edit');
  $: deleteLabel = $t('common.actions.delete');

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
  <header class="card-header">
    <h2 class="history-title">{headerTitle}</h2>
    <div class="toolbar">
      <input
        class="search"
        type="search"
        placeholder={searchPlaceholder}
        bind:value={query}
        aria-label={searchPlaceholder}
      />
      {#if loading}
        <span class="badge info" aria-live="polite">{loadingLabel}</span>
      {/if}
      {#if error}
        <span class="badge error" role="alert">{errorPrefix}: {error}</span>
      {/if}
    </div>
  </header>

  <div class="table-wrap" role="region" aria-label={headerTitle}>
    <table class="history-table">
      <thead>
        <tr>
          <th class="sortable" on:click={() => toggleSort('title')} aria-sort={sortKey==='title'?(sortDir==='asc'?'ascending':'descending'):'none'}>{resolvedLabels.title}</th>
          <th class="sortable" on:click={() => toggleSort('numPlayers')} aria-sort={sortKey==='numPlayers'?(sortDir==='asc'?'ascending':'descending'):'none'}>{resolvedLabels.numPlayers}</th>
          <th class="sortable" on:click={() => toggleSort('winners')} aria-sort={sortKey==='winners'?(sortDir==='asc'?'ascending':'descending'):'none'}>{resolvedLabels.winners}</th>
          <th class="sortable" on:click={() => toggleSort('date')} aria-sort={sortKey==='date'?(sortDir==='asc'?'ascending':'descending'):'none'}>{resolvedLabels.date}</th>
          <th class="sortable" on:click={() => toggleSort('status')} aria-sort={sortKey==='status'?(sortDir==='asc'?'ascending':'descending'):'none'}>{resolvedLabels.status}</th>
          <th>{resolvedLabels.actions}</th>
        </tr>
      </thead>
      <tbody>
        {#if sorted.length === 0}
          <tr><td class="empty" colspan="6">{emptyStateText}</td></tr>
        {:else}
          {#each sorted as it}
            <tr>
              <td data-label={resolvedLabels.title}>{it.title ?? '—'}</td>
              <td class="num" data-label={resolvedLabels.numPlayers}>{it.numPlayers ?? '—'}</td>
              <td data-label={resolvedLabels.winners}>{normalizeText(it.winners) || '—'}</td>
              <td class="date" data-label={resolvedLabels.date}>{formatDateTime(it.date, dateLocale)}</td>
              <td data-label={resolvedLabels.status}>
                <span class="badge {statusBadgeClass(it.status)}">
                  {$t(`status.${normalizeStatus(it.status)}`)}
                </span>
              </td>
              <td class="actions" data-label={resolvedLabels.actions}>
                <button class="icon-btn" title={viewLabel} on:click={() => emitView(it.id)}>
                  <img src="/buttons/view.png" alt={viewLabel} />
                  <span class="sr-only">{viewLabel}</span>
                </button>
                <button class="icon-btn" title={editLabel} on:click={() => emitEdit(it.id)}>
                  <img src="/buttons/edit.png" alt={editLabel} />
                  <span class="sr-only">{editLabel}</span>
                </button>
                <button class="icon-btn danger" title={deleteLabel} on:click={() => emitDelete(it.id)}>
                  <img src="/buttons/delete.png" alt={deleteLabel} />
                  <span class="sr-only">{deleteLabel}</span>
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</section>

<style>
  .history-card {
    display: grid;
    gap: clamp(1rem, 3vw, 1.75rem);
    width: min(100%, 960px);
    margin: 0 auto;
    padding: 0 clamp(1rem, 4vw, 2rem) clamp(1.25rem, 4vw, 2rem);
    box-sizing: border-box;
  }
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
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(221, 221, 221, 0.65);
    background: rgba(255,255,255,0.08);
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease;
  }

  .icon-btn:hover { background: rgba(255,255,255,0.15); }
  .icon-btn:active { transform: scale(0.95); }

  .icon-btn img {
    width: 16px;
    height: 16px;
    object-fit: cover;
  }

  .icon-btn.danger {
    border-color: rgba(241, 196, 196, 0.9);
    background: rgba(255, 240, 240, 0.8);
  }

  .icon-btn.danger:hover { background: rgba(255, 220, 220, 0.9); }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  @media (max-width: 760px) {
    .history-card {
      margin-inline: 0.5rem;
      padding: 0 0.5rem 1rem;
    }

    .history-table thead {
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

<script>
  import { createEventDispatcher, tick } from 'svelte';
  import { formatDateTime, normalizeStatus, statusBadgeClass, toEpochMillis } from '../../lib/utils.js';
  import { t } from '../../lib/i18n.js';

  export let items = [];
  export let loading = false;
  export let error = null;
  export let labels = {};
  export let dateLocale;

  const dispatch = createEventDispatcher();
  const emitView = (id) => dispatch('view', { id });
  const emitDelete = (id) => dispatch('delete', { id });

  let pendingDelete = null;
  let deleteConfirmInput = '';
  let deleteInputEl;
  let lastFocusedDeleteBtn = null;

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
  $: subtitle = $t('landing.history.subtitle');
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
  $: deleteLabel = $t('common.actions.delete');
  $: deleteModalTitle = $t('landing.history.delete_modal_title');
  $: deleteModalMessage = $t('landing.history.delete_modal_message');
  $: deleteConfirmWordRaw = $t('landing.history.delete_modal_word') ?? 'delete';
  $: deleteModalPrompt = $t('landing.history.delete_modal_prompt', { word: deleteConfirmWordRaw });
  $: deleteModalPlaceholder = $t('landing.history.delete_modal_placeholder', { word: deleteConfirmWordRaw });
  $: deleteModalConfirmLabel = $t('landing.history.delete_modal_confirm');
  $: deleteModalCancelLabel = $t('landing.history.delete_modal_cancel');
  $: deleteConfirmWord = deleteConfirmWordRaw.trim().toLowerCase();
  $: deleteInputValid = deleteConfirmInput.trim().toLowerCase() === deleteConfirmWord;
  $: deleteModalVisible = !!pendingDelete;

  function toggleSort(key) {
    if (key === 'actions') return;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else {
      sortKey = key;
      sortDir = key === 'date' ? 'desc' : 'asc';
    }
  }

  async function openDeleteModal(item, event) {
    if (!item?.canDelete) return;
    pendingDelete = item;
    deleteConfirmInput = '';
    lastFocusedDeleteBtn = event?.currentTarget ?? null;
    await tick();
    deleteInputEl?.focus();
  }

  function closeDeleteModal() {
    pendingDelete = null;
    deleteConfirmInput = '';
    if (lastFocusedDeleteBtn && typeof lastFocusedDeleteBtn.focus === 'function') {
      lastFocusedDeleteBtn.focus();
    }
    lastFocusedDeleteBtn = null;
  }

  function confirmDeleteModal() {
    if (!pendingDelete || !deleteInputValid) return;
    const id = pendingDelete.id;
    closeDeleteModal();
    emitDelete(id);
  }

  function handleModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteModal();
    } else if (event.key === 'Enter' && deleteInputValid) {
      event.preventDefault();
      confirmDeleteModal();
    }
  }

  function handleBackdropClick(event) {
    if (event.currentTarget === event.target) closeDeleteModal();
  }

  function handleBackdropKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteModal();
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      closeDeleteModal();
    }
  }
</script>

<section class="history-card card-glass">
  <header class="card-header">
    <div class="form-header">
      <h2 class="panel-title">{headerTitle}</h2>
      <p class="panel-subtitle">{subtitle}</p>
    </div>
    <div class="header-actions">
      <div class="toolbar">
        <input
          class="search"
          type="search"
          placeholder={searchPlaceholder}
          bind:value={query}
          aria-label={searchPlaceholder}
        />
      </div>
      {#if loading}
        <span class="badge info" aria-live="polite">{loadingLabel}</span>
      {/if}
      {#if error}
        <span class="badge error" role="alert">{errorPrefix}: {error}</span>
      {/if}
    </div>
  </header>

  <div class="table-panel" role="region" aria-label={headerTitle}>
    <table class="app-table history-table">
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
                <button
                  class="icon-btn danger"
                  title={deleteLabel}
                  disabled={!it.canDelete}
                  aria-disabled={!it.canDelete}
                  on:click={(event) => openDeleteModal(it, event)}
                >
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

  {#if deleteModalVisible}
    <div
      class="delete-modal-backdrop"
      role="button"
      aria-label={deleteModalCancelLabel}
      tabindex="-1"
      on:click={handleBackdropClick}
      on:keydown={handleBackdropKeydown}
    >
      <div
        class="delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        aria-describedby="delete-modal-message"
        tabindex="-1"
        on:keydown={handleModalKeydown}
      >
        <h3 id="delete-modal-title">{deleteModalTitle}</h3>
        <p id="delete-modal-message">{deleteModalMessage}</p>
        <label class="delete-modal-label" for="delete-confirm-input">{deleteModalPrompt}</label>
        <input
          id="delete-confirm-input"
          class="delete-modal-input"
          type="text"
          placeholder={deleteModalPlaceholder}
          bind:value={deleteConfirmInput}
          bind:this={deleteInputEl}
          autocomplete="off"
        />
        <div class="delete-modal-actions">
          <button class="btn ghost" type="button" on:click={closeDeleteModal}>{deleteModalCancelLabel}</button>
          <button
            class="btn danger"
            type="button"
            disabled={!deleteInputValid}
            on:click={confirmDeleteModal}
          >
            {deleteModalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .history-card {
    display: grid;
    gap: clamp(1rem, 3vw, 1.75rem);
    width: min(100%, 960px);
    max-width: 960px;
    margin: 0 auto;
    padding: clamp(1.25rem, 3vw, 2rem);
    box-sizing: border-box;
  }
  .card-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .toolbar {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 240px;
  }
  .search {
    flex: 1;
    padding: 0.65rem 0.8rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 10px;
    outline: none;
    background: rgba(0, 0, 0, 0.35);
    color: #f5f8fb;
  }
  .search:focus { border-color: rgba(255, 232, 140, 0.6); }
  .badge { font-size: 0.85rem; padding: 0.2rem 0.5rem; border-radius: 999px; }
  .badge.info { background: #eef5ff; color: #245; border: 1px solid #cfe1ff; }
  .badge.error { background: #ffecec; color: #712; border: 1px solid #ffc9c9; }

  .history-table thead th.sortable { cursor: pointer; }
  .history-table td.empty { text-align: center; color: rgba(255,255,255,0.75); padding: 1.25rem; }
  .history-table td.num,
  .history-table td.date {
    white-space: nowrap;
  }
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
  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    background: rgba(255,255,255,0.05);
  }

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

  .delete-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(8, 12, 22, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 999;
  }
  .delete-modal {
    width: min(90vw, 420px);
    background: #081426;
    border-radius: 18px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 1.5rem;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    color: #f5f8fb;
  }
  .delete-modal h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #ffe68c;
  }
  .delete-modal p {
    margin: 0;
    line-height: 1.4;
  }
  .delete-modal-label {
    font-size: 0.9rem;
    color: rgba(245, 248, 251, 0.85);
  }
  .delete-modal-input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(0, 0, 0, 0.35);
    color: #f5f8fb;
  }
  .delete-modal-input:focus {
    outline: none;
    border-color: rgba(255, 232, 140, 0.6);
  }
  .delete-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .btn {
    padding: 0.55rem 1.2rem;
    border-radius: 999px;
    border: none;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.15s ease, opacity 0.2s ease;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn.ghost {
    background: transparent;
    color: #f5f8fb;
    border: 1px solid rgba(255, 255, 255, 0.4);
  }
  .btn.danger {
    background: linear-gradient(120deg, #ff4747, #f57c00);
    color: #fff;
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

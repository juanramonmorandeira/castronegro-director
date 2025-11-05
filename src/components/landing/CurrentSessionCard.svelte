<script>
  import { normalizeStatus, statusBadgeClass } from '../../lib/utils.js';
  import { t } from '../../lib/i18n.js';

  export let session = null;
  export let loading = false;
  export let canView = false;
  export let creating = false;
  export let createError = '';
  export let onCreateClick = () => {};
  export let onViewClick = () => {};

  $: badgeClass = statusBadgeClass(session?.status);
  $: statusText = $t(`status.${normalizeStatus(session?.status)}`);
  $: checkingLabel = $t('landing.current.checking');
  $: activePrefix = $t('landing.current.active_prefix');
  $: noSessionLabel = $t('landing.current.no_active');
  $: createLabel = $t('landing.current.create');
  $: creatingLabel = $t('landing.current.creating');
  $: viewLabel = $t('landing.current.view');
  $: untitledLabel = $t('common.untitled_session');
</script>

<section class="current-card" aria-live="polite">
  <div class="status-box" data-has-session={!!session}>
    {#if loading}
      {checkingLabel}
    {:else if session}
      <strong>{activePrefix}</strong> {session.title ?? untitledLabel}
      <span class="badge {badgeClass}" style="margin-left: 0.5rem;">
        {statusText}
      </span>
    {:else}
      {noSessionLabel}
    {/if}
  </div>

  <div class="actions">
    <button class="primary" on:click={onCreateClick} aria-label={createLabel} disabled={creating}>
      {creating ? creatingLabel : createLabel}
    </button>
    <button class="ghost" on:click={onViewClick} disabled={!session || !canView} aria-label={viewLabel}>
      {viewLabel}
    </button>
  </div>
  {#if createError}
    <p class="error-msg" role="alert">{createError}</p>
  {/if}
</section>

<style>
  .current-card {
    display: grid;
    gap: clamp(1rem, 3vw, 2rem);
    width: min(100%, 720px);
    margin: 0 auto;
    padding: 0 clamp(1rem, 4vw, 2rem);
    box-sizing: border-box;
  }

  .status-box {
    text-align: center;
    padding: 0.6rem 0.8rem;
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 10px;
    background: rgba(20, 24, 28, 0.25);
    color: #f0f3f6;
    backdrop-filter: blur(2px);
  }
  .status-box[data-has-session="true"] {
    border-color: rgba(255, 213, 120, 0.5);
    background: rgba(48, 40, 20, 0.25);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .primary {
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    border: 1px solid #3a5a3a;
    background: rgba(60, 120, 60, 0.25);
    color: #e9ffe9;
    cursor: pointer;
  }
  .ghost {
    padding: 0.5rem 0.8rem;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #e8ecf1;
    cursor: pointer;
  }
  .ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  .error-msg {
    margin: 0.5rem 0 0;
    text-align: center;
    color: #ffbdbd;
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .current-card {
      margin-inline: 0.5rem;
      padding: 0 0.5rem;
    }
  }
</style>

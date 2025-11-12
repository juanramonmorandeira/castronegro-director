<script>
  import { normalizeStatus, statusBadgeClass } from '../../lib/utils.js';
  import { t } from '../../lib/i18n.js';
  import Button from '../ui/Button.svelte';

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
  $: headingLabel = $t('landing.current.heading');
  $: subtitleLabel = $t('landing.current.subtitle');
  $: noSessionLabel = $t('landing.current.no_active');
  $: createLabel = $t('landing.current.create');
  $: creatingLabel = $t('landing.current.creating');
  $: viewLabel = $t('landing.current.view');
  $: untitledLabel = $t('common.untitled_session');
</script>

<section class="current-card card-glass" aria-live="polite">
  <header class="form-header">
    <h2 class="panel-title">{headingLabel}</h2>
    <p class="panel-subtitle">{subtitleLabel}</p>
  </header>
  <div class="status-box" data-has-session={!!session}>
    {#if loading}
      {checkingLabel}
    {:else if session}
      <div class="session-header">
        <span class="session-title">{session.title ?? untitledLabel}</span>
        <span class="badge {badgeClass}">
          {statusText}
        </span>
      </div>
    {:else}
      {noSessionLabel}
    {/if}
  </div>

  <div class="actions">
    <Button variant="primary" on:click={onCreateClick} aria-label={createLabel} disabled={creating}>
      {creating ? creatingLabel : createLabel}
    </Button>
    <Button
      variant="secondary"
      on:click={onViewClick}
      disabled={!session || !canView}
      aria-label={viewLabel}
    >
      {viewLabel}
    </Button>
  </div>
  {#if createError}
    <p class="error-msg" role="alert">{createError}</p>
  {/if}
</section>

<style>
  .current-card {
    display: grid;
    gap: clamp(1rem, 3vw, 2rem);
    width: min(100%, 960px);
    max-width: 960px;
    margin: 0 auto;
    padding: clamp(1.25rem, 3vw, 2rem);
    box-sizing: border-box;
  }
  .status-box {
    text-align: left;
    padding: 0.85rem 1rem;
    border: 1px solid rgba(255,255,255,0.35);
    border-radius: 10px;
    background: rgba(20, 24, 28, 0.25);
    color: var(--color-white-muted);
    backdrop-filter: blur(2px);
  }
  .status-box[data-has-session="true"] {
    border-color: rgba(255, 213, 120, 0.5);
    background: rgba(48, 40, 20, 0.25);
  }

  .session-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
  }

  .session-title {
    font-weight: 600;
    font-size: 1.05rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .error-msg {
    margin: 0.5rem 0 0;
    text-align: center;
    color: var(--color-error-soft);
    font-size: 0.9rem;
  }

  @media (max-width: 760px) {
    .current-card {
      margin-inline: 0.5rem;
      padding: 0 0.5rem;
    }
    .card-title { font-size: 1.4rem; }
  }
</style>

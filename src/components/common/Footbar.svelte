<script>
  import { onDestroy, onMount } from 'svelte';
  import { t } from '../../lib/i18n.js';

  // Constants
  const DEFAULT_LOCALE = 'en-GB';
  const DEFAULT_TIMEZONE = 'Europe/Budapest';

  // Props
  export let signature = '';
  export let locale = DEFAULT_LOCALE;
  export let timeZone = DEFAULT_TIMEZONE;
  export let showSeconds = true;

  // State
  let now = new Date();
  let timer;

  // Helpers
  const fmt = (date) => {
    try {
      const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: showSeconds ? '2-digit' : undefined,
        hour12: false,
        timeZone,
      };
      return `${new Intl.DateTimeFormat(locale, options).format(date)} (${timeZone})`;
    } catch (error) {
      console.warn('Footbar: formatting failed, falling back to ISO', error);
      return date.toISOString();
    }
  };

  // Lifecycle
  onMount(() => {
    timer = setInterval(() => {
      now = new Date();
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(timer);
  });

  $: signatureText = signature || $t('landing.footbar.signature');
  $: footbarLabel = $t('landing.footbar.aria_label');
</script>

<footer class="footbar app-bar app-bar--bottom" aria-label={footbarLabel}>
  <div class="footbar__content">
    <div class="footbar__actions">
      <slot name="actions" />
    </div>
    <div class="footbar__meta">
      <time class="clock" datetime={now.toISOString()}>{fmt(now)}</time>
      <span class="signature">{signatureText}</span>
    </div>
  </div>
</footer>

<style>
.footbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  z-index: 8;
  pointer-events: none;
  padding: var(--bar-padding);
  box-sizing: border-box;
  background: var(--bar-bg-bottom);
  backdrop-filter: blur(var(--bar-blur));
  -webkit-backdrop-filter: blur(var(--bar-blur));
  min-height: var(--bar-height);
}

.footbar__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bar-gap);
  min-height: var(--bar-height);
  pointer-events: auto;
}

.footbar__actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.footbar__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
}

.clock {
  color: var(--color-white-muted);
  font-weight: 500;
  font-size: var(--bar-font-size);
  text-shadow: 0 0 4px rgba(255,255,255,0.25);
}

.signature {
  color: var(--color-gold-info);
  font-weight: 600;
  font-size: calc(var(--bar-font-size) + 0.05rem);
}

@media (min-width: 1440px) {
  .footbar { padding-bottom: 0.8rem; }
}

@media (max-width: 760px) {
  .footbar {
    padding-inline: 12px;
  }
  .footbar__content {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }

  .footbar__meta {
    align-items: flex-start;
  }

  .footbar__actions {
    justify-content: flex-start;
  }
}
</style>

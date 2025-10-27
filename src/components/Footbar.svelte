<script>
  import { onDestroy, onMount } from 'svelte';

  // Constants
  const DEFAULT_SIGNATURE = '@chatgpt-juarnamon ip';
  const DEFAULT_LOCALE = 'en-GB';
  const DEFAULT_TIMEZONE = 'Europe/Budapest';

  // Props
  export let signature = DEFAULT_SIGNATURE;
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
</script>

<footer class="footbar" aria-label="Footer">
  <time class="clock" datetime={now.toISOString()}>{fmt(now)}</time>
  <span class="sep">•</span>
  <span class="signature">{signature}</span>
</footer>

<style>
.footbar {
  position: fixed;
  right: 10px;
  bottom: 8px;
  display: flex;
  flex-direction: column;     /* 👉 firma debajo de la hora */
  align-items: flex-end;
  gap: 0px;
  padding: 5px 8px;
  border-radius: 8px;
  z-index: 6;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.1);
  backdrop-filter: blur(2px);
  font-size: 12.5px;
  line-height: 1;
  pointer-events: none;
}

.clock {
  color: #ffffff;             /* 👉 hora en blanco */
  font-weight: 400;
  text-shadow: 0 0 4px rgba(255,255,255,0.25);
}

.signature {
  color: #ffcc66;             /* 👉 firma en amarillo-naranja */
  font-weight: 500;
  opacity: 0.95;
}

@media (min-width: 1440px) {
  .footbar { font-size: 13px; bottom: 10px; right: 12px; }
}

@media (max-width: 760px) {
  .footbar {
    font-size: 11px;
    bottom: 10px;
    right: 8px;
    padding: 4px 7px;
  }
}
</style>
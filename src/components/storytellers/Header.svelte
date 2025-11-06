<script>
  import { t } from '../../lib/i18n.js';

  // Constants
  const DEFAULT_TITLE = 'The Village Storyteller';
  const DEFAULT_LOGO_SRC = '/logo.svg';
  const DEFAULT_LOGO_ALT = 'Village Storyteller logo';

  // Props
  export let title = DEFAULT_TITLE;
  export let logoSrc = DEFAULT_LOGO_SRC;
  export let logoAlt = DEFAULT_LOGO_ALT;
  export let flicker = true;

  // Helpers
  const hideOnError = (event) => {
    event.target.style.display = 'none';
  };

  $: resolvedTitle = title || $t('header.title');
  $: resolvedAlt = logoAlt || $t('header.logo_alt');
</script>

<header class="landing-header" aria-label={resolvedTitle}>
  {#if logoSrc}
    <img
      src={logoSrc}
      alt={resolvedAlt}
      class="logo"
      on:error={hideOnError}
    />
  {/if}

  <div class="title-wrap">
    <h1 class:glow={flicker}>{resolvedTitle}</h1>
  </div>
</header>

<style>
  .landing-header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: clamp(0.75rem, 2vw, 1.5rem);
    max-width: min(100%, 960px);
    margin: 0 auto;
    padding: clamp(1rem, 4vw, 2rem) clamp(1.25rem, 5vw, 2.75rem) clamp(0.5rem, 2vw, 1rem);
    box-sizing: border-box;
  }

  .logo {
    width: clamp(2rem, 5vw, 3rem);
    height: clamp(2rem, 5vw, 3rem);
    flex: 0 0 auto;
  }

  .title-wrap {
    text-align: center;
  }

  h1 {
    font-size: clamp(2.2rem, 4.38vw, 3.2rem);
    color: #f4d47c;
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 22px rgba(255, 180, 40, 0.4),
      3px 3px 12px rgba(0, 0, 0, 0.9);
    font-family: "Merriweather", serif;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin: 0;
    transition: text-shadow 0.4s ease, color 0.4s ease;
  }

  .glow {
    animation: flickerGlow 6s ease-in-out infinite;
  }

  @keyframes flickerGlow {
    0%, 100% {
      text-shadow:
        0 0 8px rgba(255, 200, 60, 0.7),
        0 0 22px rgba(255, 180, 40, 0.4),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 1;
    }
    38% {
      text-shadow:
        0 0 10px rgba(255, 210, 80, 0.8),
        0 0 25px rgba(255, 190, 60, 0.5),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.97;
    }
    41% {
      text-shadow:
        0 0 5px rgba(255, 190, 40, 0.6),
        0 0 15px rgba(255, 170, 30, 0.3),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.9;
    }
    47% {
      text-shadow:
        0 0 12px rgba(255, 220, 90, 0.8),
        0 0 28px rgba(255, 200, 70, 0.5),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 1;
    }
    63% {
      text-shadow:
        0 0 7px rgba(255, 180, 40, 0.6),
        0 0 18px rgba(255, 160, 30, 0.3),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.92;
    }
    75% {
      text-shadow:
        0 0 10px rgba(255, 205, 70, 0.7),
        0 0 22px rgba(255, 185, 50, 0.4),
        3px 3px 12px rgba(0, 0, 0, 0.9);
      opacity: 0.96;
    }
  }
</style>

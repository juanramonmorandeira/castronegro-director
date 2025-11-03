<script>
  import { locale, availableLocales, t } from '../lib/i18n.js';

  const DEFAULT_FLAG_SRC = '/flags/en_UK.png';
  const FLAG_BY_LOCALE = {
    en: '/flags/en_UK.png',
    es: '/flags/es_ES.png',
    hu: '/flags/hu_HU.png'
  };

  export let title = '';
  export let titleKey = '';
  export let flagSrc = '';
  export let flagAlt = '';
  export let langCode = '';

  let hostElement;

  const emitEvent = (name, detail) => {
    hostElement?.dispatchEvent(
      new CustomEvent(name, {
        detail,
        bubbles: true,
        cancelable: true,
        composed: true
      })
    );
  };

  const handleLocaleChange = (event) => {
    const next = event.target.value;
    if (availableLocales.includes(next)) {
      locale.set(next);
      emitEvent('lang', { locale: next });
    }
  };

  $: normalizedLang = (langCode || $locale || 'en').toLowerCase();
  $: languageCodeDisplay = (langCode || $locale || 'en').toUpperCase();
  $: languageName = $t(`common.languages.${normalizedLang}`) || flagAlt || languageCodeDisplay;
  $: chipTitle = title || (titleKey ? $t(titleKey) : $t('topbar.title'));
  $: effectiveFlagAlt = flagAlt || languageName;
  $: computedFlagSrc = flagSrc || FLAG_BY_LOCALE[normalizedLang] || DEFAULT_FLAG_SRC;
  $: changeLanguageCurrentLabel = $t('topbar.change_language_current', { language: languageName });
  $: languageLabel = $t('topbar.language_label');
  $: navigationLabel = $t('topbar.navigation_label');
</script>

<nav class="topbar" aria-label={navigationLabel} bind:this={hostElement}>
  <div class="right">
    <span class="chip">{chipTitle}</span>

    <div class="lang-switch" title={changeLanguageCurrentLabel}>
      <span class="sr-only">{languageLabel}</span>
      {#if computedFlagSrc}
        <img src={computedFlagSrc} alt={effectiveFlagAlt} class="flag" />
      {:else}
        <span class="lang-code">{languageCodeDisplay}</span>
      {/if}
      <select value={$locale} aria-label={languageLabel} on:change={handleLocaleChange}>
        {#each availableLocales as code}
          <option value={code}>
            {$t(`common.languages.${code}`) || code.toUpperCase()}
          </option>
        {/each}
      </select>
    </div>
  </div>
</nav>

<style>
  .topbar {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;               /* ocupa todo el ancho para captar clics en desktop */
    height: 48px;
    z-index: 10;
    pointer-events: none;  /* evita tapar el contenido salvo en la zona derecha */
    background: linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 70%, transparent);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
  }

  .right {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;   /* <-- esquina superior derecha */
    gap: 8px;
    padding: 0 12px;
    pointer-events: auto;        /* vuelve a activar en la zona derecha */
  }

  .chip {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #f3f5f7;
    font-size: 0.9rem;
    box-shadow: 0 0 8px rgba(255, 230, 140, 0.2);
    white-space: nowrap;
  }

  .lang-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #f3f5f7;
    pointer-events: auto;
    min-height: 22px;
    min-width: 24px;
    box-shadow: 0 0 8px rgba(255, 230, 140, 0.2);
  }

  .lang-switch select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .lang-switch .flag {
    width: 22px;
    height: 16px;
    border-radius: 2px;
    object-fit: cover;
    pointer-events: none;
  }

  .lang-switch .lang-code {
    font-size: 0.75rem;
    font-weight: 600;
    pointer-events: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    border: 0;
  }

  @media (max-width: 760px) {
    .topbar { height: 44px; }
    .chip { font-size: 0.85rem; }
  }
</style>

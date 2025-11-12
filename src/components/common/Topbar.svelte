<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { locale, availableLocales, t } from '../../lib/i18n.js';

  const DEFAULT_FLAG_SRC = '/flags/en_UK.png';
  const FLAG_BY_LOCALE = {
    en: '/flags/en_UK.png',
    es: '/flags/es_ES.png',
    hu: '/flags/hu_HU.png'
  };
  const DEFAULT_AVATAR = '/avatars/Avatar_Default.png';
  const DEFAULT_BRAND_LOGO = '/backgrounds/village-storyteller-logo.png';
  const DEFAULT_BRAND_TITLE = 'The Village Storyteller';

  export let title = '';
  export let titleKey = '';
  export let flagSrc = '';
  export let flagAlt = '';
  export let langCode = '';
  export let user = null;
  export let showUserMenu = true;
  export let showBrand = true;
  export let brandTitle = '';
  export let brandTitleKey = 'header.title';
  export let brandLogoSrc = DEFAULT_BRAND_LOGO;
  export let brandLogoAlt = '';
  export let brandFlicker = true;
  export let showSessionIndicator = false;
  export let sessionIndicator = null;
  const dispatch = createEventDispatcher();
  let menuOpen = false;
  let menuElement;
  let langMenuOpen = false;
  let langMenuElement;

  $: normalizedLang = (langCode || $locale || 'en').toLowerCase();
  $: languageCodeDisplay = (langCode || $locale || 'en').toUpperCase();
  $: languageName = $t(`common.languages.${normalizedLang}`) || flagAlt || languageCodeDisplay;
  $: chipTitle = title || (titleKey ? $t(titleKey) : $t('topbar.title'));
  $: effectiveFlagAlt = flagAlt || languageName;
  $: computedFlagSrc = flagSrc || FLAG_BY_LOCALE[normalizedLang] || DEFAULT_FLAG_SRC;
  $: changeLanguageCurrentLabel = $t('topbar.change_language_current', { language: languageName });
  $: languageLabel = $t('topbar.language_label');
  $: navigationLabel = $t('topbar.navigation_label');
  $: resolvedBrandTitle = brandTitle || (brandTitleKey ? $t(brandTitleKey) : DEFAULT_BRAND_TITLE);
  $: resolvedBrandLogo = brandLogoSrc || DEFAULT_BRAND_LOGO;
  $: resolvedBrandAlt = brandLogoAlt || resolvedBrandTitle;
  $: indicatorStats = {
    expected: sessionIndicator?.expected ?? null,
    connected: sessionIndicator?.connected ?? null,
    ready: sessionIndicator?.ready ?? null
  };
  const labelLower = (value) => (typeof value === 'string' ? value.toLowerCase() : value);
  $: indicatorLabels = {
    expected: labelLower($t('configure.expected_label')),
    connected: labelLower($t('configure.connected_label')),
    ready: labelLower($t('configure.ready_label'))
  };
  $: indicatorStats = {
    expected: sessionIndicator?.expected ?? null,
    connected: sessionIndicator?.connected ?? null,
    ready: sessionIndicator?.ready ?? null
  };

  // El avatar de usuario solo depende de avatarURL (string completo o vacío).
  function resolveAvatarSource(currentUser) {
    const candidate = currentUser?.avatarURL?.trim();
    return candidate ? candidate : DEFAULT_AVATAR;
  }

  $: avatarSrc = resolveAvatarSource(user);
  $: userLabel = user?.name || user?.alias || user?.email || $t('topbar.menu.profile');

  function toggleMenu() {
    menuOpen = !menuOpen;
  }

  function closeMenu() {
    menuOpen = false;
  }

  function toggleLangMenu() {
    langMenuOpen = !langMenuOpen;
  }

  function closeLangMenu() {
    langMenuOpen = false;
  }

  function handleLocaleSelect(code) {
    if (!availableLocales.includes(code)) return;
    locale.set(code);
    dispatch('lang', { locale: code });
    closeLangMenu();
  }

  function handleProfileClick() {
    closeMenu();
    dispatch('profile', { user });
  }

  function handleLogoutClick() {
    closeMenu();
    dispatch('logout', { user });
  }

  // Cierra el menú si se hace clic fuera de la cápsula del usuario.
  function handleDocumentClick(event) {
    const target = event.target;
    if (menuOpen && menuElement && !menuElement.contains(target)) {
      closeMenu();
    }
    if (langMenuOpen && langMenuElement && !langMenuElement.contains(target)) {
      closeLangMenu();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleDocumentClick);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleDocumentClick);
  });

  // Fallback cuando la imagen personalizada falla; evita bucles de error.
  function handleAvatarError(event) {
    event.target.onerror = null;
    if (event.target?.src === DEFAULT_AVATAR) return;
    event.target.src = DEFAULT_AVATAR;
  }
</script>

<nav class="topbar" aria-label={navigationLabel}>
  {#if showBrand}
    <div class="left">
      <div class="brand" aria-label={resolvedBrandTitle}>
        {#if resolvedBrandLogo}
          <img src={resolvedBrandLogo} alt={resolvedBrandAlt} class="brand-logo" />
        {/if}
        <span class="brand-title" class:glow={brandFlicker}>{resolvedBrandTitle}</span>
      </div>
    </div>
  {/if}
  <div class="right">
    {#if showSessionIndicator && sessionIndicator}
      <div class="session-indicator" aria-label={$t('topbar.session_status_label')}>
        <div class="indicator-pill">
          <span class="indicator-label">{indicatorLabels.expected}</span>
          <strong>{indicatorStats.expected ?? '—'}</strong>
        </div>
        <div class="indicator-pill indicator-pill--connected">
          <span class="indicator-label">{indicatorLabels.connected}</span>
          <strong>{indicatorStats.connected ?? '—'}</strong>
        </div>
        <div class="indicator-pill indicator-pill--ready">
          <span class="indicator-label">{indicatorLabels.ready}</span>
          <strong>{indicatorStats.ready ?? '—'}</strong>
        </div>
      </div>
    {/if}
    <span class="chip">{chipTitle}</span>

    <div class="lang-switch" bind:this={langMenuElement}>
      <button
        class="lang-button"
        type="button"
        aria-haspopup="true"
        aria-expanded={langMenuOpen}
        aria-label={changeLanguageCurrentLabel}
        on:click|stopPropagation={toggleLangMenu}
      >
        <span class="sr-only">{languageLabel}</span>
        {#if computedFlagSrc}
          <img src={computedFlagSrc} alt={effectiveFlagAlt} class="flag" />
        {:else}
          <span class="lang-code">{languageCodeDisplay}</span>
        {/if}
      </button>
      {#if langMenuOpen}
        <ul class="menu-list" role="menu" aria-label={languageLabel}>
          {#each availableLocales as code}
            <li>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={normalizedLang === code}
                on:click={() => handleLocaleSelect(code)}
              >
                {$t(`common.languages.${code}`) || code.toUpperCase()}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if showUserMenu}
      <div class="user-switch" bind:this={menuElement}>
        <button
          class="user-button"
          type="button"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label={userLabel}
          on:click|stopPropagation={toggleMenu}
        >
          <span class="avatar-wrap">
            <img src={avatarSrc} alt={userLabel} on:error={handleAvatarError} />
          </span>
        </button>
        {#if menuOpen}
          <div class="menu-list" role="menu">
            <button type="button" role="menuitem" on:click={handleProfileClick}>
              {$t('topbar.menu.profile')}
            </button>
            <button type="button" role="menuitem" on:click={handleLogoutClick}>
              {$t('topbar.menu.logout')}
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</nav>

<style>
  .topbar {
    position: fixed;
    top: 0;
    right: 0;
    left: 0;               /* ocupa todo el ancho para captar clics en desktop */
    width: 100%;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 10;
    pointer-events: none;  /* evita tapar el contenido salvo en la zona derecha */
    background: linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.05) 70%, transparent);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
    padding: 0 clamp(12px, 3vw, 32px);
    box-sizing: border-box;
  }

  .left,
  .right {
    --topbar-item-height: 32px;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
  }

  .left { justify-content: flex-start; }
  .right { justify-content: flex-end; }

  .session-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--glass-border);
    border-radius: 999px;
    padding: 0.2rem 0.4rem;
    background: rgba(12, 18, 28, 0.7);
    margin-right: 0.5rem;
  }

  .indicator-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    background: rgba(4, 8, 15, 0.75);
  }

  .indicator-label {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    color: var(--color-white-muted);
  }

  .indicator-pill strong {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-white-contrast);
  }

  .indicator-pill--connected strong {
    color: var(--color-gold-info);
  }

  .indicator-pill--ready strong {
    color: var(--color-green-accent);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    pointer-events: none;
    padding: 0.2rem 0;
  }

  .brand-logo {
    width: clamp(28px, 3vw, 34px);
    height: clamp(28px, 3vw, 34px);
    object-fit: contain;
    filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.6));
  }

  .brand-title {
    font-family: "Merriweather", serif;
    font-size: clamp(1rem, 2vw, 1.4rem);
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-gold-brand);
    text-shadow:
      0 0 6px rgba(255, 200, 60, 0.65),
      0 0 14px rgba(255, 180, 40, 0.4);
    white-space: nowrap;
  }

  .glow {
    animation: brandGlow 6s ease-in-out infinite;
  }

  @keyframes brandGlow {
    0%, 100% {
      text-shadow:
        0 0 6px rgba(255, 200, 60, 0.65),
        0 0 14px rgba(255, 180, 40, 0.4);
    }
    40% {
      text-shadow:
        0 0 3px rgba(255, 180, 40, 0.45),
        0 0 8px rgba(255, 160, 30, 0.3);
    }
    60% {
      text-shadow:
        0 0 8px rgba(255, 220, 90, 0.75),
        0 0 18px rgba(255, 200, 70, 0.45);
    }
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: var(--topbar-item-height);
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: var(--color-white-muted);
    font-size: 0.9rem;
    box-shadow: 0 0 8px rgba(255, 230, 140, 0.2);
    white-space: nowrap;
  }

  /* Cápsulas circulares para idioma y usuario */
  .lang-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 var(--topbar-item-height);
    width: var(--topbar-item-height);
    height: var(--topbar-item-height);
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: var(--color-white-muted);
    pointer-events: auto;
    min-height: var(--topbar-item-height);
    min-width: var(--topbar-item-height);
    box-shadow: none;
  }

  .lang-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    color: inherit;
    padding: 0;
    cursor: pointer;
  }

  .lang-button:focus-visible {
    outline: none;
  }

  .lang-switch .flag {
    width: 20px;
    height: 14px;
    border-radius: 2px;
    object-fit: cover;
    pointer-events: none;
  }

  .lang-switch .lang-code {
    font-size: 0.75rem;
    font-weight: 600;
    pointer-events: none;
  }

  /* Cápsula del usuario: réplica en formato circular */
  .user-switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 var(--topbar-item-height);
    width: var(--topbar-item-height);
    height: var(--topbar-item-height);
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: var(--color-white-muted);
    pointer-events: auto;
    min-height: var(--topbar-item-height);
    min-width: var(--topbar-item-height);
    box-shadow: none;
  }

  .user-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: none;
    background: none;
    color: inherit;
    padding: 0;
    cursor: pointer;
  }

  .user-button:focus-visible {
    outline: none;
  }

  .user-button .avatar-wrap {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.2);
    box-shadow: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .user-button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .user-button:focus-visible .avatar-wrap {
    box-shadow: 0 0 0 2px rgba(255, 232, 140, 0.8);
  }

  .menu-list {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    display: grid;
    gap: 0.25rem;
    padding: 0.5rem;
    margin: 0;
    list-style: none;
    min-width: 160px;
    background: var(--surface-strong);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.6rem;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(6px);
    z-index: 20;
  }

  .menu-list button {
    background: none;
    border: none;
    color: var(--color-white-muted);
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .menu-list button:hover,
  .menu-list button:focus {
    background: var(--glass-border);
    outline: none;
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
    .topbar { height: 48px; padding-inline: 12px; }
    .brand-title { font-size: 1rem; }
    .chip { font-size: 0.85rem; }
  }
</style>

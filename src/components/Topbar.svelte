<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { locale, availableLocales, t } from '../lib/i18n.js';

  const DEFAULT_FLAG_SRC = '/flags/en_UK.png';
  const FLAG_BY_LOCALE = {
    en: '/flags/en_UK.png',
    es: '/flags/es_ES.png',
    hu: '/flags/hu_HU.png'
  };
  const DEFAULT_AVATAR = '/avatars/Avatar_Default.png';

  export let title = '';
  export let titleKey = '';
  export let flagSrc = '';
  export let flagAlt = '';
  export let langCode = '';
  export let user = null;
  export let showUserMenu = true;
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
  // Expresiones auxiliares para detectar distintos formatos de enlaces de Drive.
  const DRIVE_SHARED_FILE_REGEX = /drive\.google\.com\/file\/d\/([^/]+)/i;
  const DRIVE_OPEN_REGEX = /drive\.google\.com\/open\?(?:[^=]*=)*id=([^&]+)/i;
  const DRIVE_ID_REGEX = /^[a-zA-Z0-9_-]{16,}$/;

  function buildDrivePreviewUrl(id) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  // Extrae el ID de Drive de enlaces en diferentes formatos.
  function extractDriveId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const shared = trimmed.match(DRIVE_SHARED_FILE_REGEX)?.[1];
    if (shared) return shared;
    const open = trimmed.match(DRIVE_OPEN_REGEX)?.[1];
    if (open) return open;
    if (trimmed.startsWith('https://drive.google.com/uc?')) {
      try {
        const url = new URL(trimmed);
        const id = url.searchParams.get('id');
        if (id) return id;
      } catch {
        return '';
      }
    }
    if (DRIVE_ID_REGEX.test(trimmed)) return trimmed;
    return '';
  }

  const DATA_URI_REGEX = /^data:image\//i;
  const BLOB_URI_REGEX = /^blob:/i;
  const HTTP_REGEX = /^https?:\/\//i;
  const PROTOCOL_RELATIVE_REGEX = /^\/\//;

  // Normaliza cualquier variante de avatar hasta obtener una URL utilizable.
  function normalizeAvatarCandidate(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const driveId = extractDriveId(trimmed);
    if (driveId) return buildDrivePreviewUrl(driveId);
    if (DATA_URI_REGEX.test(trimmed) || BLOB_URI_REGEX.test(trimmed)) return trimmed;
    if (PROTOCOL_RELATIVE_REGEX.test(trimmed)) return `https:${trimmed}`;
    if (HTTP_REGEX.test(trimmed) || trimmed.startsWith('/')) return trimmed;
    const sanitized = trimmed.replace(/^(?:~\/|\.\/)/, '');
    return sanitized ? `/${sanitized}` : '';
  }

  // Recorre posibles campos del usuario y devuelve la primera imagen válida.
  function resolveAvatarSource(currentUser) {
    if (!currentUser) return DEFAULT_AVATAR;
    const driveId =
      currentUser.avatarDriveId ||
      currentUser.avatar_drive_id ||
      currentUser.avatar_driveId;
    const candidates = [
      driveId ? buildDrivePreviewUrl(driveId) : '',
      currentUser.avatarURL,
      currentUser.avatarUrl,
      currentUser.avatar_url,
      currentUser.avatar,
      currentUser.avatarPath,
      currentUser.avatar_path,
      currentUser.avatarFile,
      currentUser.avatar_file,
      currentUser.photoURL,
      currentUser.photoUrl,
      currentUser.picture
    ];
    for (const candidate of candidates) {
      const normalized = normalizeAvatarCandidate(candidate);
      if (normalized) return normalized;
    }
    return DEFAULT_AVATAR;
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
  <div class="right">
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
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    z-index: 10;
    pointer-events: none;  /* evita tapar el contenido salvo en la zona derecha */
    background: linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.05) 70%, transparent);
    -webkit-backdrop-filter: blur(2px);
    backdrop-filter: blur(2px);
  }

  .right {
    --topbar-item-height: 32px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 0 clamp(12px, 3vw, 28px);
    margin-left: auto;
    pointer-events: auto;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    height: var(--topbar-item-height);
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #f3f5f7;
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
    color: #f3f5f7;
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
    color: #f3f5f7;
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
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.6rem;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(6px);
    z-index: 20;
  }

  .menu-list button {
    background: none;
    border: none;
    color: #f3f5f7;
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .menu-list button:hover,
  .menu-list button:focus {
    background: rgba(255, 255, 255, 0.12);
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
    .topbar { height: 44px; }
    .chip { font-size: 0.85rem; }
  }
</style>

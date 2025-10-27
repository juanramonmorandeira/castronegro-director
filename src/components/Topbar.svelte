<script>
  import { createEventDispatcher } from 'svelte';

  // Constants
  const DEFAULT_TITLE = 'Storyteller Dashboard';
  const DEFAULT_FLAG_SRC = '/flags/en_UK.png';
  const DEFAULT_FLAG_ALT = 'English';

  // Props
  export let title = DEFAULT_TITLE;
  export let flagSrc = DEFAULT_FLAG_SRC;
  export let flagAlt = DEFAULT_FLAG_ALT;
  export let langCode = 'EN';

  // Events
  const dispatch = createEventDispatcher();
  const emitLang = () => dispatch('lang');

  // https://icon-icons.com/es/buscar/iconos/banderas?page=1
</script>

<nav class="topbar" aria-label="Global">
  <div class="right">
    <span class="chip">{title}</span>

    <!-- Si hay bandera, muéstrala; si no, muestra el código de idioma -->
    {#if flagSrc}
      <button class="flag-btn" on:click={emitLang} aria-label="Change language" title={flagAlt}>
        <img src={flagSrc} alt={flagAlt} aria-hidden="true" width="22" height="16"/>
      </button>
    {:else}
      <button class="lang-btn" on:click={emitLang} aria-label="Change language" title={flagAlt}>
        {langCode}
      </button>
    {/if}
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

  .flag-btn,
  .lang-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.08);
    color: #f3f5f7;
    cursor: pointer;
  }
  .flag-btn:hover,
  .lang-btn:hover { background: rgba(255,255,255,0.14); }
  .flag-btn img {
    display: block;
    width: 22px;
    height: 16px;
    object-fit: cover;
    border-radius: 2px;
  }

  @media (max-width: 760px) {
    .topbar { height: 44px; }
    .chip { font-size: 0.85rem; }
  }
</style>
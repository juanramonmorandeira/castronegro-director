<!-- src/components/Landing.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // Landing.svelte
  // Vista principal (pantalla inicial del Narrador).
  // - Muestra la sesión actual (si existe) y la lista de sesiones pasadas.
  // - Permite crear una nueva sesión o acceder a la sesión activa.
  // - Se comunica con Firestore a través de funciones en lib/db.js.
  // ─────────────────────────────────────────────────────────────

  import { onMount } from "svelte";
  import {
    getCurrentSession,
    listSessionHistory,
    createSessionDraft
  } from "../lib/db.js";

  // Estado reactivo del componente
  let loading = true;      // Cargando datos iniciales
  let current = null;      // Sesión actual (si existe)
  let history = [];        // Últimas sesiones (máx. 20)
  let now = new Date();    // Fecha/hora local en vivo
  let tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // Zona horaria local

  // Actualizador de reloj
  let timer;
  onMount(async () => {
    // Actualiza la hora cada segundo
    timer = setInterval(() => { now = new Date(); }, 1000);

    try {
      await refresh(); // Carga datos iniciales
    } finally {
      loading = false;
    }

    // Limpia el intervalo al desmontar el componente
    return () => clearInterval(timer);
  });

  /** Recarga datos desde Firestore */
  async function refresh() {
    current = await getCurrentSession();
    history = await listSessionHistory(20);
  }

  /** Formateador de fecha/hora legible */
  const pad = n => String(n).padStart(2, "0");
  function fmt(d) {
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  // Callbacks recibidos desde App.svelte
  export let onCreate = () => {};
  export let onViewCurrent = () => {};
  export let onViewSummary = id => {
    console.log("View summary for session:", id);
    alert("Resumen de partida: " + id);
  };

  // --- Filtros de sesiones terminadas / canceladas ---
  $: pastSessions = (history || [])
    .filter(s => ["finished", "cancelled"].includes(s.status))
    .sort((a, b) => new Date(b.finished_at || b.updated_at || 0) - new Date(a.finished_at || a.updated_at || 0));

  /** Crea una nueva sesión y pasa el ID a App.svelte */
  async function createAndGo() {
    const id = await createSessionDraft({
      title: "Untitled session",
      language: "en"
    });
    await refresh();  // Refresca para reflejar la nueva sesión
    onCreate(id);     // Llama al callback superior
  }

  // ─────────────────────────────────────────────────────────────
  // Tabla de estados (definiciones de color y texto)
  // Estos colores corresponden a las clases definidas en app.css
  // (por ejemplo: .badge.draft, .badge.waiting, etc.)
  // ─────────────────────────────────────────────────────────────
  const statusInfo = {
    draft:       { css: "badge draft",       label: "Configuring" },
    waiting:     { css: "badge waiting",     label: "Waiting for players" },
    in_progress: { css: "badge in-progress", label: "In progress" },
    paused:      { css: "badge paused",      label: "Paused" },
    finished:    { css: "badge finished",    label: "Finished" },
    cancelled:   { css: "badge cancelled",   label: "Cancelled" }
  };

  /** Devuelve el conjunto de clases CSS según estado */
  function bannerClass(status) {
    return statusInfo[status]?.css || "badge neutral";
  }

  /** Devuelve el texto asociado al estado */
  function statusLabel(status) {
    return statusInfo[status]?.label || "Unknown";
  }

  // Etiquetas de estado legibles
  const endedStatusLabel = (status) =>
    status === "finished" ? "Finalizada" :
    status === "cancelled" ? "Cancelada" : status ?? "—";

  // Formatea marca temporal (acepta string/Date/epoch); cae a '—' si no hay nada
  function fmtDateLike(ts) {
    try {
      if (!ts) return "—";
      const d = ts instanceof Date ? ts : new Date(ts);
      // fecha corta + hora corta, sin segundos
      return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      });
    } catch { return "—"; }
  }

  // Solo sesiones terminadas/canceladas, ordenadas de más reciente a más antigua
  $: finishedHistory =
    (history || [])
      .filter(s => s?.status === "finished" || s?.status === "cancelled")
      .sort((a, b) => {
        const ad = new Date(a.finished_at || a.updated_at || a.created_at || 0).getTime();
        const bd = new Date(b.finished_at || b.updated_at || b.created_at || 0).getTime();
        return bd - ad;
      });
</script>

<!-- ─────────────────────────────────────────────────────────────
     ENCABEZADO: Logo, título y reloj en tiempo real
     ───────────────────────────────────────────────────────────── -->
<header class="landing-header">
  <img
    src="/logo.svg"
    alt="Logo"
    class="logo"
    on:error={(e) => (e.target.style.display = 'none')}
  />
  <div>
    <h1>El Narrador de la Aldea</h1>
  </div>
</header>

<!-- ─────────────────────────────────────────────────────────────
     BARRA SUPERIOR DERECHA (idioma + dashboard tag)
     Fija, independiente del header principal
     ───────────────────────────────────────────────────────────── -->
<div class="topbar">
  <span class="util-tag">Storyteller Dashboard</span>
  <!-- Botón idioma (bandera UK). Más adelante lo conectaremos al sistema i18n -->
  <button
    class="lang-btn"
    type="button"
    aria-label="Change interface language"
    title="English (change language)"
  >
    <!-- Usamos imagen si existe; si falla, se muestra emoji como fallback -->
    <img
      src="/icons/flag-uk.png"
      alt=""
      class="flag"
      on:error={(e)=>{ e.target.replaceWith(document.createTextNode('🇬🇧')); }}
    />
    <span class="sr-only">English</span>
  </button>
</div>

<!-- ─────────────────────────────────────────────────────────────
     CONTENIDO PRINCIPAL
     - Estado actual
     - Botones de acción
     - Historial de sesiones
     ───────────────────────────────────────────────────────────── -->
<main class="landing-main">

  <!-- Estado actual o mensaje de carga -->
  {#if loading}
    <div class="info-box">Loading…</div>
  {:else}
    <div class={"info-box " + (current ? bannerClass(current.status) : "badge waiting")}>
      {#if current}
        <div>
          The session “<strong>{current.title || current.id}</strong>” is currently
          <span> {statusLabel(current.status)}.</span>
        </div>
        <div class="details">
          Language: {current.language || "?"} · Director: {current.director || "?"}
        </div>
      {:else}
        No active game sessions right now.
      {/if}
    </div>
  {/if}

  <!-- Botones principales -->
  <div class="button-row">
    <button class="btn" on:click={createAndGo}>Create new game</button>
    <button class="btn" disabled={!current} on:click={() => onViewCurrent(current?.id)}>
      View current game
    </button>
  </div>

  <!-- ─────────────────────────────────────────────────────────────
      HISTÓRICO DE SESIONES (solo finalizadas/canceladas)
      Caja unificada con cabecera + tabla responsive simple
      ───────────────────────────────────────────────────────────── -->
  <section class="history-card">
    <!-- Cabecera pegada a la caja -->
    <div class="history-card__title">History</div>

    <!-- Tabla semántica con grid (permite responsive fácil) -->
    <div class="history-table">

      <!-- Encabezados -->
      <div class="history-thead">
        <div>Title</div>
        <div>Num Players</div>
        <div>Winner/s</div>
        <div>Date</div>
        <div>Status</div>
        <div class="col-actions">Actions</div>
      </div>

      <!-- Contenido dinámico -->
      {#if pastSessions.length === 0}
        <div class="history-empty">No hay sesiones finalizadas todavía.</div>
      {:else}
        {#each pastSessions as s}
          <div class="history-row">
            <div>{s.title || s.id}</div>
            <div class="center">{s.players_expected ?? "—"}</div>
            <div class="center">{s.winner_faction ?? "—"}</div>
            <div>{fmt(s.finished_at || s.updated_at || s.created_at)}</div>
            <div>
              <span class={"pill " + (s.status === "finished" ? "ok" : "warn")}>
                {s.status === "finished" ? "Finalizada" : "Cancelada"}
              </span>
            </div>
            <div class="center">
              <button class="icon-btn" on:click={() => onViewSummary(s.id)} title="Ver resumen">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/></svg>
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </section>
</main>

<!-- ─────────────────────────────────────────────────────────────
     BLOQUE INFERIOR DERECHO (reloj + firma)
     Fijo sobre el fondo, con tono claro
     ───────────────────────────────────────────────────────────── -->
<div class="corner-info">
  <div class="clock">
    {fmt(now)} ({tz})
  </div>
  <div class="signature">@chatgpt-juanramon intellectual property</div>
</div>

<style>
  /* ─────────────────────────────────────────────────────────────
     LANDING · ESTILOS LOCALES
     (Todo lo global ya está en app.css)
     ───────────────────────────────────────────────────────────── */

  /* Encabezado */
  .landing-header {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1rem 0.5rem;
    border-bottom: none;
  }

  .landing-header .logo {
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
  }

  /* ─────────────────────────────────────────────────────────────
    TÍTULO PRINCIPAL – “El Narrador de la Aldea”
    Inspirado en la luz de la lámpara del personaje
   ───────────────────────────────────────────────────────────── */
  .landing-header h1 {
    /* Tamaño mayor para llenar el espacio visual entre el tejado y el sombrero */
    font-size: clamp(2.2rem, 43.8vw, 3.2rem);
    color: #f4d47c; /* tono cálido, inspirado en la lámpara */
    
    /* Sombra múltiple para dar volumen y sensación de luz cálida */
    text-shadow:
      0 0 8px rgba(255, 200, 60, 0.7),
      0 0 22px rgba(255, 180, 40, 0.4),
      3px 3px 12px rgba(0, 0, 0, 0.9);

    font-family: "Merriweather", serif;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-align: center;
    margin-top: 0;
    margin-bottom: 0;

    /* Transición suave para futuros efectos dinámicos (hover o fade) */
    transition: text-shadow 0.4s ease, color 0.4s ease;
  }

  /* ─────────────────────────────────────────────────────────────
   EFECTO "PARPADEO DE LUZ" · simulación de la llama de la lámpara
   - Oscilación leve e irregular de brillo
   - No intrusivo, mantiene la elegancia del título
   - Duración y aleatoriedad controlada
   ───────────────────────────────────────────────────────────── */
  .landing-header h1 {
    /* ... mantén tus estilos actuales ... */
    animation: flickerGlow 6s ease-in-out infinite;
  }

  /* Keyframes para el parpadeo de luz */
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

  /* ─────────────────────────────────────────────────────────────
    BARRA SUPERIOR DERECHA
    ───────────────────────────────────────────────────────────── */
  .topbar {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 20; /* por encima del resto de contenido */
  }

  /* Píldora "Storyteller Dashboard" */
  .util-tag {
    display: inline-block;
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    font-size: 0.8rem;
    line-height: 1;
    color: #e8eef6;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(3px);
    white-space: nowrap;
  }

  /* Botón redondo del idioma */
  .lang-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.28);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.1s ease;
    backdrop-filter: blur(3px);
  }
  .lang-btn:hover { background: rgba(255,255,255,0.16); }
  .lang-btn:active { transform: scale(0.96); }

  /* Imagen de la bandera */
  .flag {
    width: 18px;
    height: 18px;
    border-radius: 2px;
    display: block;
  }

  /* Texto solo para lectores de pantalla */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 1px, 1px);
    white-space: nowrap;
    border: 0;
  }

  .timestamp {
    margin-left: auto;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  /* Contenido principal */
  .landing-main {
    max-width: 900px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Bloque de información (estado actual o carga) */
  .info-box {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
  }

  .info-box .details {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  /* Botones */
  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 0.9rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ─────────────────────────────────────────────────────────────
     Caja unificada (cabecera + cuerpo) con ligera transparencia
     ───────────────────────────────────────────────────────────── */
  .history-card {
    max-width: 900px;
    margin: 4rem auto 2rem;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 10px;
    overflow: hidden; /* une visualmente cabecera y cuerpo */
    background: rgba(15, 20, 25, 0.35); /* leve veladura para legibilidad */
    box-shadow: 0 0 20px rgba(255,180,50,0.08);
  }

  /* Título superior de la caja */
  .history-title {
    padding: .8rem 1rem;
    font-weight: 600;
    color: #f5d57c;
    background: radial-gradient(90% 90% at 40% 0%,
                rgba(255,210,90,.10), rgba(20,20,24,.35) 70%);
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }

  /* Cabecera y filas */
  .history-header, .history-row {
    display: grid;
    grid-template-columns: 1.6fr .7fr 1fr 1.3fr 1fr .8fr;
    align-items: center;
    padding: .6rem 1rem;
  }

  .history-header {
    background: rgba(255,255,255,0.08);
    font-size: .85rem;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
    border-bottom: 1px solid rgba(255,255,255,0.15);
  }

  .history-row {
    color: #f1f1f1;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .history-row:last-child { border-bottom: none; }

  .center { text-align: center; }

  .history-empty {
    text-align: center;
    padding: 1rem;
    color: rgba(255,255,255,0.75);
  }

  /* Píldoras de estado */
  .pill {
    display: inline-block;
    padding: .2rem .5rem;
    border-radius: 999px;
    font-size: .8rem;
    border: 1px solid transparent;
  }
  .pill.ok {
    color: #cfead1;
    background: rgba(74, 222, 128, .15);
    border-color: rgba(74, 222, 128, .35);
  }
  .pill.warn {
    color: #ffe0e0;
    background: rgba(252, 88, 88, .15);
    border-color: rgba(252, 88, 88, .35);
  }

  /* Botón de acción (icono ojo) */
  .icon-btn {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.25);
    background: rgba(255,255,255,0.06);
    color: #f5f5f5;
    border-radius: 8px;
    padding: .35rem .45rem;
    cursor: pointer;
    transition: transform .05s ease, background .2s ease, border-color .2s ease;
  }
  .icon-btn:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.45);
  }
  .icon-btn:active { transform: scale(0.97); }

  /* Responsive: en < 760px apilamos mejor */
  @media (max-width: 760px) {
    .history-thead,
    .history-row {
      grid-template-columns: 1.6fr 0.6fr 0.9fr 1.2fr 1fr 0.8fr;
      column-gap: .5rem;
    }
    .history-card { margin-left: .5rem; margin-right: .5rem; }
  }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .session-item .details {
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .timestamp.small {
    font-size: 0.7rem;
    opacity: 0.6;
  }

  /* ─────────────────────────────────────────────────────────────
   BLOQUE INFERIOR DERECHO
   ───────────────────────────────────────────────────────────── */
  .corner-info {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    text-align: right;
    z-index: 20;
    user-select: none;
  }

  /* Reloj — tono claro (casi blanco) */
  .clock {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
  }

  /* Firma — tono cálido (amarillo/anaranjado) */
  .signature {
    font-size: 0.7rem;
    color: #ffcc66; /* tono ámbar cálido */
    opacity: 0.9;
    margin-top: 0.15rem;
    text-shadow: 0 0 4px rgba(0, 0, 0, 0.4);
    font-family: 'Courier New', monospace; /* da un toque “sello digital” */
  }
</style>
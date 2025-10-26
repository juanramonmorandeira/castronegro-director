<!-- src/components/LandingBackgroundLayer.svelte -->
<script>
  // ─────────────────────────────────────────────────────────────
  // LandingBackgroundLayer.svelte
  // Capa visual de fondo global:
  // - Muestra la imagen base del pueblo (backgroundUrl)
  // - Superpone dos capas animadas de niebla (fogUrl)
  // - Añade una viñeta oscura para aumentar el contraste del contenido
  //
  // Este componente:
  //   • Está siempre detrás del resto de vistas (z-index negativo)
  //   • No captura clics ni eventos (pointer-events: none)
  //   • Se optimiza para tablets en horizontal (10") pero es responsive
  // ─────────────────────────────────────────────────────────────

  export let backgroundUrl = '/images/background-village.png';
  export let fogUrl = '/images/fog-texture.png';
</script>

<!--
  Se utilizan variables CSS (--bg-url y --fog-url)
  para poder pasar las imágenes dinámicamente desde App.svelte
  sin tener que tocar las hojas de estilo.
-->

<!-- Capa base: fondo principal del pueblo -->
<div class="bg" style={`--bg-url: url('${backgroundUrl}')`}></div>

<!-- Capas de niebla animada -->
<div class="fogA" style={`--fog-url: url('${fogUrl}')`}></div>
<div class="fogB" style={`--fog-url: url('${fogUrl}')`}></div>

<!-- Viñeta: oscurece bordes para mejorar legibilidad -->
<div class="vignette"></div>

<style>
  /* ─────────────────────────────────────────────────────────────
     ESTRUCTURA DE CAPAS Y ANIMACIONES
     ───────────────────────────────────────────────────────────── */

  /* Capa base: imagen fija del fondo */
  .bg {
    position: fixed;
    inset: 0;
    z-index: -5;
    pointer-events: none;
    background-image: var(--bg-url);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transform: translateZ(0); /* Mejora rendimiento (composición GPU) */
  }

  /* Capas de niebla: se superponen sobre el fondo */
  .fogA,
  .fogB {
    position: fixed;
    top: -5vh;         /* sube un poco para evitar huecos en bordes */
    left: -20vw;
    width: 140vw;      /* más grande que el viewport para cubrir todo */
    height: 120vh;
    pointer-events: none;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.14),
                      rgba(255, 255, 255, 0.06) 40%,
                      transparent 75%),
      var(--fog-url);
    background-repeat: no-repeat, no-repeat;
    background-size: 1200px auto, cover;
    opacity: 0.25;
    will-change: transform, opacity;
    transform: translateZ(0);
  }

  /* Niebla capa A: movimiento visible y ritmo medio */
  .fogA {
    z-index: -4;
    animation: fogDriftA 60s ease-in-out infinite;
  }

  /* Niebla capa B: más lenta y sutil para efecto de parallax */
  .fogB {
    z-index: -3;
    opacity: 0.18;
    animation: fogDriftB 110s ease-in-out infinite;
  }

  /* ─────────────────────────────────────────────────────────────
     ANIMACIONES DE MOVIMIENTO (suaves, en bucle)
     ───────────────────────────────────────────────────────────── */
  @keyframes fogDriftA {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(-8vw, -1vh); }
    50%  { transform: translate(-16vw, 0); }
    75%  { transform: translate(-8vw, 1vh); }
    100% { transform: translate(0, 0); }
  }

  @keyframes fogDriftB {
    0%   { transform: translate(0, 0); }
    50%  { transform: translate(-10vw, 1.5vh) scale(1.02); }
    100% { transform: translate(0, 0); }
  }

  /* ─────────────────────────────────────────────────────────────
     VIÑETA: mejora el contraste y centra la atención
     ───────────────────────────────────────────────────────────── */
  .vignette {
    position: fixed;
    inset: 0;
    z-index: -2;
    pointer-events: none;
    background: radial-gradient(
      ellipse at center,
      rgba(0, 0, 0, 0.10) 0%,
      rgba(0, 0, 0, 0.25) 70%,
      rgba(0, 0, 0, 0.45) 100%
    );
  }

  /* ─────────────────────────────────────────────────────────────
     RESPONSIVIDAD Y ACCESIBILIDAD
     ───────────────────────────────────────────────────────────── */

  /* En pantallas más pequeñas (tablets/móviles):
     aumenta opacidad para mantener visibilidad
     y acelera la animación para que se perciba movimiento */
  @media (max-width: 900px) {
    .fogA { opacity: 0.35; animation-duration: 45s; }
    .fogB { opacity: 0.22; animation-duration: 80s; }
  }

  /* Reduce el movimiento si el usuario lo solicita */
  @media (prefers-reduced-motion: reduce) {
    .fogA,
    .fogB {
      animation: none;
    }
  }
</style>
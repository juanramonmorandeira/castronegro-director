<script>
  export let backgroundUrl = '/images/background-village.png';
  export let fogUrl = '/images/fog-texture.png';
</script>

<style>
  /* Capa base: imagen fija */
  .bg {
    position: fixed;
    inset: 0;
    z-index: -5;
    pointer-events: none;
    background-image: var(--bg-url);
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    transform: translateZ(0);
  }

  /* Niebla 1: movimiento horizontal + leve deriva vertical */
  .fogA, .fogB {
    position: fixed;
    top: -5vh; /* sube un poco para que no aparezcan bordes en la parte baja */
    left: -20vw;
    width: 140vw;   /* más grande que el viewport para evitar bandas */
    height: 120vh;  /* cubre de sobra el alto */
    z-index: -4;
    pointer-events: none;
    background-image:
      radial-gradient(rgba(255,255,255,.14), rgba(255,255,255,.06) 40%, transparent 75%),
      var(--fog-url);
    background-repeat: no-repeat, no-repeat;  /* <-- importante */
    background-size: 1200px auto, cover;      /* textura amplia + cover para no repetir */
    opacity: .25;
    will-change: transform, opacity;
    transform: translateZ(0);
  }

  /* Capa A: movimiento más evidente */
  .fogA {
    animation: fogDriftA 60s ease-in-out infinite;
  }

  /* Capa B: más lenta y tenue para parallax */
  .fogB {
    z-index: -3;
    opacity: .18;
    animation: fogDriftB 110s ease-in-out infinite;
  }

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

  /* Viñeta para legibilidad */
  .vignette {
    position: fixed;
    inset: 0;
    z-index: -2;
    pointer-events: none;
    background: radial-gradient(ellipse at center,
      rgba(0,0,0,0.10) 0%,
      rgba(0,0,0,0.25) 70%,
      rgba(0,0,0,0.45) 100%);
  }

  /* Tablet/móvil: baja opacidad y acelera un poco para que se note */
  @media (max-width: 900px) {
    .fogA { opacity: .35; animation-duration: 45s; }
    .fogB { opacity: .22; animation-duration: 80s; }
  }

  /* Accesibilidad */
  @media (prefers-reduced-motion: reduce) {
    .fogA, .fogB { animation: none; }
  }
</style>

<!-- Usamos CSS variables para poder pasar URLs sin ensuciar el CSS -->
<div class="bg" style={`--bg-url: url('${backgroundUrl}')`}></div>
<div class="fogA" style={`--fog-url: url('${fogUrl}')`}></div>
<div class="fogB" style={`--fog-url: url('${fogUrl}')`}></div>
<div class="vignette"></div>
<script>
  // Constants
  const DEFAULT_BACKGROUND_URL = '/backgrounds/background-village.png';
  const DEFAULT_FOG_URL = '/backgrounds/fog-texture.png';

  // Props
  export let backgroundUrl = DEFAULT_BACKGROUND_URL;
  export let fogUrl = DEFAULT_FOG_URL;
</script>

<div class="bg" style={`--bg-url: url('${backgroundUrl}')`}></div>
<div class="fog fogA" style={`--fog-url: url('${fogUrl}')`}></div>
<div class="fog fogB" style={`--fog-url: url('${fogUrl}')`}></div>
<div class="vignette"></div>

<style>
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

  .fog {
    position: fixed;
    top: -5vh;
    left: -20vw;
    width: 140vw;
    height: 120vh;
    pointer-events: none;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.14),
                      rgba(255, 255, 255, 0.06) 40%,
                      transparent 75%),
      var(--fog-url);
    background-repeat: no-repeat, no-repeat;
    background-size: 1200px auto, cover;
    will-change: transform, opacity;
    transform: translateZ(0);
  }

  .fogA {
    z-index: -4;
    opacity: 0.25;
    animation: fogDriftA 60s ease-in-out infinite;
  }

  .fogB {
    z-index: -3;
    opacity: 0.18;
    animation: fogDriftB 110s ease-in-out infinite;
  }

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

  @media (max-width: 900px) {
    .fogA { opacity: 0.35; animation-duration: 45s; }
    .fogB { opacity: 0.22; animation-duration: 80s; }
  }

  @media (prefers-reduced-motion: reduce) {
    .fog { animation: none; }
  }
</style>

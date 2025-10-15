<script>
  import "./firebase.js";
  import Jugadores from "./components/Jugadores.svelte";
</script>

<main>
  <h1>Castronegro Director 🐺</h1>
  <Jugadores />
</main>

<style>
  main {
    text-align: center;
    padding: 2rem;
    font-family: system-ui, sans-serif;
  }
</style>
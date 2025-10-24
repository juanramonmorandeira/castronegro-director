<script>
  import Landing from "./components/Landing.svelte";
  let view = "landing";
  let currentSessionId = null;

  function goConfigure(sessionId) {
    currentSessionId = sessionId;
    view = "configure"; // placeholder por ahora
  }
  function goSession(sessionId) {
    currentSessionId = sessionId;
    view = "session";   // placeholder por ahora
  }
</script>

{#if view === "landing"}
  <Landing onCreate={goConfigure} onViewCurrent={goSession}/>
{:else if view === "configure"}
  <div class="p-4">
    <h2 class="text-lg font-semibold">Configure session</h2>
    <p class="opacity-70">Session ID: {currentSessionId}</p>
    <!-- Aquí caerá el configurador en el siguiente paso -->
  </div>
{:else if view === "session"}
  <div class="p-4">
    <h2 class="text-lg font-semibold">Current session</h2>
    <p class="opacity-70">Session ID: {currentSessionId}</p>
    <!-- Aquí caerá la vista de sesión -->
  </div>
{/if}
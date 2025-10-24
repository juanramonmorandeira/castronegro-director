<script>
  import { onMount } from "svelte";
  import { db } from "../src/lib/firebase.js";
  import {
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc
  } from "firebase/firestore";

  // Datos reactivos
  let jugadores = [];
  let nuevoJugador = "";

  // Referencia a la colección 'jugadores'
  const jugadoresRef = collection(db, "jugadores");

  // Al montar el componente, escuchar cambios en Firestore en tiempo real
  onMount(() => {
    const unsubscribe = onSnapshot(jugadoresRef, (snapshot) => {
      jugadores = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    });

    return () => unsubscribe();
  });

  // Función para añadir un nuevo jugador
  async function agregarJugador() {
    if (nuevoJugador.trim() === "") return;
    await addDoc(jugadoresRef, {
      nombre: nuevoJugador,
      rol: "sin asignar",
      estado: "vivo",
    });
    nuevoJugador = "";
  }

  // Función para eliminar jugador
  async function eliminarJugador(id) {
    await deleteDoc(doc(db, "jugadores", id));
  }
</script>

<style>
  .contenedor {
    max-width: 500px;
    margin: 2rem auto;
    padding: 1rem;
    background-color: #1e1e1e;
    color: #fafafa;
    border-radius: 8px;
  }

  input {
    padding: 0.5rem;
    margin-right: 0.5rem;
    width: 60%;
  }

  button {
    padding: 0.5rem 1rem;
    margin: 0.25rem;
    cursor: pointer;
  }

  ul {
    list-style: none;
    padding: 0;
  }

  li {
    margin: 0.5rem 0;
    display: flex;
    justify-content: space-between;
  }

  .nombre {
    font-weight: bold;
  }
</style>

<div class="contenedor">
  <h2>👥 Jugadores</h2>

  <div>
    <input
      bind:value={nuevoJugador}
      placeholder="Nombre del jugador"
      on:keydown={(e) => e.key === 'Enter' && agregarJugador()}
    />
    <button on:click={agregarJugador}>Añadir</button>
  </div>

  {#if jugadores.length > 0}
    <ul>
      {#each jugadores as jugador}
        <li>
          <span class="nombre">{jugador.nombre}</span>
          <button on:click={() => eliminarJugador(jugador.id)}>❌</button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>No hay jugadores registrados todavía.</p>
  {/if}
</div>

// sessionModel.js
// -----------------------------------------------------------------------------
// Este archivo define las piezas basicas del "motor" del juego.
//
// Importante:
// - No sabe nada de Svelte.
// - No sabe nada de Firebase.
// - No sabe nada de traducciones/i18n.
// - No sabe nada de imagenes o CSS.
//
// Su trabajo es guardar vocabulario compartido de sesion y consultas basicas
// sobre el estado vivo de la partida. Los constructores de objetos viven en
// sus archivos Definition correspondientes.
// -----------------------------------------------------------------------------

// Estados de sesion alineados con el flujo actual de la aplicacion.
// Estos nombres son los que ya aparecen en la app o en la documentacion.
export const SESSION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SHARED: 'shared',
  WAITING: 'waiting',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  FINISHED: 'finished',
  CANCELLED: 'cancelled'
});

// Tipos de jugador.
// HUMAN: jugador real.
// OFFLINE: jugador creado manualmente para pruebas o partidas presenciales.
// SYSTEM: jugador controlado por el motor.
//
// SYSTEM no se usa todavia. Lo dejamos abierto para un futuro donde el motor
// pueda controlar roles automaticos y reducir el numero minimo de humanos.
export const PLAYER_TYPES = Object.freeze({
  HUMAN: 'human',
  OFFLINE: 'offline',
  SYSTEM: 'system'
});

// Estados posibles de una stage.
// ENABLED: debe ejecutarse.
// DISABLED: no aplica en este momento.
// DONE: ya se ejecuto y el cursor puede seguir.
//
// Antes habia un estado BLOCKED, pero lo quitamos por ahora porque todavia no
// tenemos un caso real implementado. Si mas adelante necesitamos "esta stage no
// puede avanzar hasta que el usuario elija algo", lo recuperaremos con un caso
// concreto.
export const STAGE_STATUSES = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DONE: 'done',
  FINISHED: 'finished'
});

export const CURRENT_STAGE_SOURCES = Object.freeze({
  POOL: 'pool',
  SPECIAL_STAGES: 'specialStages'
});

// Pools mecanicos del flujo.
//
// CONCEALED: acciones de informacion privada u oculta.
// EXPOSED: acciones publicas o visibles para el grupo.
export const POOL_KEYS = Object.freeze({
  POOL_CONCEALED: 'poolConcealed',
  POOL_EXPOSED: 'poolExposed'
});

// Orden por defecto de los grupos de stages.
// Un "pool" es un bloque de stages relacionados.
export const DEFAULT_POOL_ORDER = Object.freeze([
  POOL_KEYS.POOL_CONCEALED,
  POOL_KEYS.POOL_EXPOSED
]);

// Convierte cualquier texto en un identificador estable.
//
// Ejemplos:
// "The Seer" -> "the_seer"
// "White Werewolf" -> "white_werewolf"
// "  Player 1  " -> "player_1"
//
// Lo usamos para que la logica no dependa de mayusculas, espacios o textos
// escritos de formas distintas.
export function normalizeId(value = '') {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

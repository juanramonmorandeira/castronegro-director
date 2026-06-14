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

// Estados posibles de una step.
// ENABLED: debe ejecutarse.
// DISABLED: no aplica en este momento.
// DONE: ya se ejecuto y el cursor puede seguir.
//
// Antes habia un estado BLOCKED, pero lo quitamos por ahora porque todavia no
// tenemos un caso real implementado. Si mas adelante necesitamos "esta step no
// puede avanzar hasta que el usuario elija algo", lo recuperaremos con un caso
// concreto.
export const STEP_STATUSES = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DONE: 'done'
});

// Pools mecanicos del flujo.
//
// DEPLOYMENT: configuracion jugable inicial. Debe ejecutarse antes de que
// acciones recurrentes puedan modificar estados, alignments o grupos.
// CONCEALED: acciones de informacion privada u oculta.
// EXPOSED: acciones publicas o visibles para el grupo.
// SPECIAL: interrupciones o resoluciones excepcionales.
export const POOL_KEYS = Object.freeze({
  POOL_DEPLOYMENT: 'poolDeployment',
  POOL_CONCEALED: 'poolConcealed',
  POOL_EXPOSED: 'poolExposed',
  POOL_SPECIAL: 'poolSpecial'
});

// Orden por defecto de los grupos de steps.
// Un "pool" es un bloque de steps relacionados.
export const DEFAULT_POOL_ORDER = Object.freeze([
  POOL_KEYS.POOL_DEPLOYMENT,
  POOL_KEYS.POOL_CONCEALED,
  POOL_KEYS.POOL_EXPOSED,
  POOL_KEYS.POOL_SPECIAL
]);

// Prioridades internas de steps especiales.
//
// poolSpecial funciona como cola FIFO, salvo que exista conclusion de la parte
// jugable: ese step debe resolverse antes que otros eventos pendientes porque ya
// existe un playOutcome concluyente.
export const SPECIAL_STEP_PRIORITIES = Object.freeze({
  CONCLUDE_PLAY: 'conclude_play'
});

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

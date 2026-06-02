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
// Su trabajo es construir objetos de datos coherentes: jugadores, roles en
// partida, tokens de accion, fases y sesiones.
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

// Estados posibles de una fase.
// ENABLED: debe ejecutarse.
// DISABLED: no aplica en este momento.
// DONE: ya se ejecuto y el cursor puede seguir.
//
// Antes habia un estado BLOCKED, pero lo quitamos por ahora porque todavia no
// tenemos un caso real implementado. Si mas adelante necesitamos "esta fase no
// puede avanzar hasta que el usuario elija algo", lo recuperaremos con un caso
// concreto.
export const PHASE_STATUSES = Object.freeze({
  ENABLED: 'enabled',
  DISABLED: 'disabled',
  DONE: 'done'
});

// Orden por defecto de los grupos de fases.
// Un "pool" es un bloque de fases relacionadas.
//
// Ejemplo:
// - poolPreparation: preparar personajes, edificios, roles especiales.
// - poolFirstNight: primera noche.
// - poolEachDay: ciclo de dia.
// - poolEachNight: ciclo de noche.
// - poolSpecialEvents: interrupciones como cazador, sheriff, victoria, etc.
export const DEFAULT_POOL_ORDER = Object.freeze([
  'poolPreparation',
  'poolFirstNight',
  'poolEachDay',
  'poolEachNight',
  'poolSpecialEvents'
]);

// Tipos de relaciones entre instancias de rol.
//
// LINKED representa un vinculo mecanico entre dos o mas roles.
// No lo llamamos "inLove" porque eso pertenece a una skin concreta.
export const RELATION_TYPES = Object.freeze({
  LINKED: 'linked'
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

// Crea un jugador en formato normalizado.
//
// "metadata" es un cajon opcional para informacion extra que no pertenece al
// nucleo. Por ejemplo, mas adelante podria guardar avatar, email, color, etc.
// Si algo es esencial para las reglas, no debe vivir en metadata.
export function createPlayer({
  id,
  displayName,
  type = PLAYER_TYPES.HUMAN,
  connected = false,
  ready = false,
  metadata = {}
} = {}) {
  const normalizedId = id || normalizeId(displayName);
  return {
    id: normalizedId,
    displayName: displayName || normalizedId,
    type,
    connected: !!connected,
    ready: !!ready,
    metadata: { ...metadata }
  };
}

// Crea un token de accion.
//
// Un token de accion representa "algo que un rol puede usar".
// Ejemplos futuros:
// - una inspeccion;
// - un ataque;
// - un bloqueo;
// - una pocion.
//
// ownerRoleInstanceId indica quien puede usarlo.
// targetRoleInstanceIds indica sobre quien se ha usado.
export function createActionToken({
  id,
  actionId,
  ownerRoleInstanceId = null,
  targetRoleInstanceIds = [],
  consumed = false,
  metadata = {}
} = {}) {
  const tokenActionId = normalizeId(actionId);
  return {
    id: id || `${tokenActionId || 'action'}-token`,
    actionId: tokenActionId,
    ownerRoleInstanceId,
    targetRoleInstanceIds: [...targetRoleInstanceIds],
    consumed: !!consumed,
    metadata: { ...metadata }
  };
}

// Crea una instancia de rol.
//
// Diferencia importante:
// - "roleId" es el tipo de rol: seer, wolf, witch, observer...
// - "id" es esta carta concreta dentro de esta partida: seer-0, wolf-1...
//
// Esto permite tener roles repetidos sin confundirlos.
export function createRoleInstance({
  id,
  roleId,
  factionId = null,
  playerId = null,
  seat = null,
  inPlay = true,
  revealed = false,
  actionTokens = [],
  flags = {},
  counters = {},
  metadata = {}
} = {}) {
  const normalizedRoleId = normalizeId(roleId);
  return {
    id: id || `${normalizedRoleId || 'role'}-0`,
    roleId: normalizedRoleId,
    factionId: factionId ? normalizeId(factionId) : null,
    playerId,
    seat,
    inPlay: !!inPlay,
    revealed: !!revealed,
    actionTokens: actionTokens.map(createActionToken),
    flags: { ...flags },
    counters: { ...counters },
    metadata: { ...metadata }
  };
}

// Crea una relacion entre instancias de rol.
//
// Una relacion no pertenece a un unico rol. Vive en la sesion porque describe
// un hecho compartido entre varios roleInstances.
//
// Ejemplo:
//
// {
//   type: 'linked',
//   roleInstanceIds: ['role_a-0', 'role_b-0']
// }
//
// Eso permite responder de forma limpia:
// - role_a esta linked?
// - con quien?
// - sigue activa la relacion?
export function createRelation({
  id,
  type,
  roleInstanceIds = [],
  active = true,
  createdCycleId = null,
  sourceActionId = null,
  metadata = {}
} = {}) {
  const normalizedType = normalizeId(type);
  const normalizedRoleInstanceIds = [...new Set((roleInstanceIds ?? []).filter(Boolean))];

  return {
    id: id || `${normalizedType || 'relation'}-${normalizedRoleInstanceIds.join('-')}`,
    type: normalizedType,
    roleInstanceIds: normalizedRoleInstanceIds,
    active: !!active,
    createdCycleId,
    sourceActionId,
    metadata: { ...metadata }
  };
}

// Devuelve las relaciones activas de un tipo concreto para una instancia.
//
// Si no se pasa type, devuelve cualquier relacion activa de esa instancia.
export function findRelationsForRole(session, roleInstanceId, type = null) {
  const normalizedType = type ? normalizeId(type) : null;

  return (session?.relations ?? []).filter((relation) => {
    if (!relation?.active) return false;
    if (normalizedType && relation.type !== normalizedType) return false;
    return (relation.roleInstanceIds ?? []).includes(roleInstanceId);
  });
}

// Devuelve true si una instancia participa en una relacion activa.
export function hasRelation(session, roleInstanceId, type) {
  return findRelationsForRole(session, roleInstanceId, type).length > 0;
}

// Devuelve los companeros de relacion de una instancia.
//
// Para linked entre A y B:
// getRelatedRoleInstanceIds(session, 'A', 'linked') -> ['B']
export function getRelatedRoleInstanceIds(session, roleInstanceId, type = null) {
  return [
    ...new Set(
      findRelationsForRole(session, roleInstanceId, type)
        .flatMap((relation) => relation.roleInstanceIds ?? [])
        .filter((id) => id && id !== roleInstanceId)
    )
  ];
}

// Crea un paso de fase.
//
// Un paso de fase es una unidad ejecutable dentro de un pool.
// Ejemplo:
// - poolFirstNight / step_01
// - poolEachDay / step_05
//
// No contiene textos visibles. Solo IDs estables.
// actorScope define quien puede actuar; actions define que puede hacer.
//
// actions es la forma recomendada: un step puede ofrecer 0, 1 o varias recetas
// de accion. action se mantiene como compatibilidad temporal y se convierte en
// un array de una sola accion.
export function createPhaseStep({
  key,
  status = PHASE_STATUSES.DISABLED,
  actorScope = null,
  action = null,
  actions = null,
  order = null,
  metadata = {}
} = {}) {
  const normalizedActions = Array.isArray(actions)
    ? actions.map((entry) => ({ ...entry }))
    : action
      ? [{ ...action }]
      : [];

  return {
    key: normalizeId(key),
    status,
    actorScope: actorScope ? { ...actorScope } : null,
    actions: normalizedActions,
    action: action ? { ...action } : null,
    order: Number.isFinite(order) ? order : null,
    metadata: { ...metadata }
  };
}

// Crea la estructura completa de pools de fases.
//
// Esta funcion no decide que fases se activan. Solo crea el contenedor:
// - orden de pools;
// - pool actual;
// - indice de fase actual;
// - lista de pasos dentro de cada pool.
//
// El orden de ejecucion es declarativo:
// - primero manda poolOrder;
// - dentro de cada pool manda el orden del array.
//
// No usamos pesos/prioridades todavia porque introducen empates y reglas
// invisibles. Si una skin necesita otro orden, debe declarar otro array.
export function createPhasePools({
  poolOrder = DEFAULT_POOL_ORDER,
  poolCurrent = poolOrder[0],
  poolPrevious = null,
  poolNext = poolOrder[1] ?? null,
  poolCurrentPhaseIndex = 0,
  pools = {}
} = {}) {
  const normalizedOrder = poolOrder.map(String);
  const normalizedPools = normalizedOrder.reduce((acc, poolKey) => {
    acc[poolKey] = (pools[poolKey] ?? []).map(createPhaseStep);
    return acc;
  }, {});

  return {
    poolOrder: normalizedOrder,
    poolCurrent,
    poolPrevious,
    poolNext,
    poolCurrentPhaseIndex,
    pools: normalizedPools
  };
}

// Crea una sesion de juego completa en memoria.
//
// Por ahora esto solo agrupa datos. No guarda en disco, no toca Firebase y no
// cambia la UI. Es el equivalente limpio de "estado de partida".
//
// actionHistory guarda hechos ocurridos en esta partida. No es estado temporal:
// es memoria de sesion. Por ejemplo, nos permite saber si un actor ya
// previno al mismo objetivo en el ciclo anterior.
export function createGameSession({
  id,
  definitionId = null,
  status = SESSION_STATUSES.DRAFT,
  settings = {},
  players = [],
  roleInstances = [],
  relations = [],
  phasePools = createPhasePools(),
  actionHistory = [],
  log = [],
  metadata = {}
} = {}) {
  return {
    id: id || `session-${Date.now()}`,
    definitionId: definitionId ? normalizeId(definitionId) : null,
    status,
    settings: { ...settings },
    players: players.map(createPlayer),
    roleInstances: roleInstances.map(createRoleInstance),
    relations: relations.map(createRelation),
    phasePools,
    actionHistory: [...actionHistory],
    log: [...log],
    metadata: { ...metadata }
  };
}

// Construye roleInstances a partir de asientos/Match.
//
// Esta funcion es importante porque conecta el mundo de "Match" con el motor:
// si Match dice que player-1 esta sentado en seat 0 con rol Observer, aqui se
// convierte en una instancia jugable:
//
// {
//   id: 'observer-0',
//   roleId: 'observer',
//   playerId: 'player-1',
//   seat: 0
// }
export function buildRoleInstancesFromSeats(seats = [], roleDefinitions = {}) {
  const counters = new Map();

  return (seats ?? []).map((seatEntry = {}, index) => {
    const roleId = normalizeId(seatEntry.roleId ?? seatEntry.role ?? seatEntry.name);
    const count = counters.get(roleId) ?? 0;
    if (roleId) counters.set(roleId, count + 1);

    const roleInstanceId = seatEntry.id || (roleId ? `${roleId}-${count}` : `empty-${index}`);
    const definition = roleDefinitions[roleId] ?? {};
    const actionTokens = (definition.actionTokens ?? []).map((token, tokenIndex) => ({
      ...token,
      id: token.id || `${roleInstanceId}-${normalizeId(token.actionId)}-${tokenIndex}`,
      ownerRoleInstanceId: token.ownerRoleInstanceId ?? roleInstanceId
    }));

    return createRoleInstance({
      id: roleInstanceId,
      roleId,
      factionId: seatEntry.factionId ?? definition.factionId ?? null,
      playerId: seatEntry.playerId ?? seatEntry.player_id ?? null,
      seat: Number.isFinite(seatEntry.seat) ? seatEntry.seat : index,
      actionTokens,
      flags: definition.defaultFlags ?? {},
      counters: definition.defaultCounters ?? {},
      metadata: {
        source: 'seating',
        label: seatEntry.label ?? definition.label ?? null
      }
    });
  });
}

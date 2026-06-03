// stepDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones de step.
//
// Este archivo describe "que es un step":
// - que slot ocupa;
// - que actorScope puede actuar;
// - que acciones ofrece;
// - que metadatos de definicion arrastra.
//
// No decide en que pool vive ni en que posicion se ejecuta. Esa organizacion
// pertenece a phaseDefinition.js.
// -----------------------------------------------------------------------------

import { PHASE_STATUSES, normalizeId } from './sessionModel.js';
import {
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY
} from './stepModel.js';

export const ACTOR_SCOPE_TYPES = Object.freeze({
  ROLE: 'role',
  ROLE_GROUP: 'role_group',
  ALL_ROLES: 'all_roles',
  LINKED_ROLES: 'linked_roles'
});

export const STEP_SOURCE_TYPES = Object.freeze({
  ROLE_INSTANCE: 'role_instance',
  GROUP_INSTANCE: 'group_instance',
  SYSTEM: 'system',
  SKIN: 'skin',
  EVENT: 'event'
});

export function createStepSource({ type = null, id = null, metadata = {} } = {}) {
  return {
    type: type ? normalizeId(type) : null,
    id: id ? normalizeId(id) : null,
    metadata: { ...metadata }
  };
}

// Crea una definicion normalizada de actorScope.
//
// La unidad mecanica sigue siendo roleInstance. Un scope solo acota que
// roleInstances pueden actuar en este step.
export function createActorScope({
  type = ACTOR_SCOPE_TYPES.ROLE,
  roleInstanceId = null,
  groupId = null,
  relationType = null,
  metadata = {}
} = {}) {
  return {
    type: normalizeId(type),
    roleInstanceId,
    groupId: groupId ? normalizeId(groupId) : null,
    relationType: relationType ? normalizeId(relationType) : null,
    metadata: { ...metadata }
  };
}

// Crea una receta de accion dentro de un step.
//
// action.id puede ser generico, por ejemplo set_in_play.
// action.key distingue la receta concreta dentro del step.
// optional=true significa que el step puede cerrarse aunque esta receta no se
// haya ejecutado. Si se intenta ejecutar, conserva filtros y restricciones.
export function createStepActionDefinition(action = {}) {
  const actionKey = normalizeId(action.key ?? action.actionKey ?? action.id);

  return {
    ...action,
    key: actionKey,
    optional: action.optional !== false
  };
}

export function createStepCompletionDefinition({
  mode = STEP_COMPLETION_MODES.MANUAL,
  allowedRequesters = Object.values(STEP_COMPLETION_REQUESTED_BY)
} = {}) {
  const normalizedMode = Object.values(STEP_COMPLETION_MODES).includes(mode)
    ? mode
    : STEP_COMPLETION_MODES.MANUAL;
  const normalizedRequesters = (allowedRequesters ?? []).filter((requester) =>
    Object.values(STEP_COMPLETION_REQUESTED_BY).includes(requester)
  );

  return {
    mode: normalizedMode,
    allowedRequesters:
      normalizedRequesters.length > 0
        ? [...new Set(normalizedRequesters)]
        : Object.values(STEP_COMPLETION_REQUESTED_BY)
  };
}

// Crea una definicion de step lista para que phaseDefinition la organice.
//
// order es declarativo: sirve para construir arrays antes de crear la sesion.
// phaseModel no lo usa durante la ejecucion.
export function createStep({
  key,
  poolKey = null,
  status = PHASE_STATUSES.DISABLED,
  actorScope = {},
  completion = {},
  actions = [],
  order = null,
  source = null,
  metadata = {}
} = {}) {
  const normalizedSource = source ? createStepSource(source) : null;

  return {
    key: normalizeId(key),
    poolKey: poolKey ?? null,
    status,
    actorScope: createActorScope(actorScope),
    completion: createStepCompletionDefinition(completion),
    actions: (actions ?? []).map(createStepActionDefinition),
    order: Number.isFinite(order) ? order : null,
    metadata: {
      ...metadata,
      ...(normalizedSource ? { source: normalizedSource } : {})
    }
  };
}

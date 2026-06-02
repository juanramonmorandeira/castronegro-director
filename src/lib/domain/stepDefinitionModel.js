// stepDefinitionModel.js
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
// pertenece a phaseDefinitionModel.js.
// -----------------------------------------------------------------------------

import { PHASE_STATUSES, normalizeId } from './sessionModel.js';

export const ACTOR_SCOPE_TYPES = Object.freeze({
  ROLE: 'role',
  ROLE_GROUP: 'role_group',
  ALL_ROLES: 'all_roles',
  LINKED_ROLES: 'linked_roles'
});

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
export function createStepActionDefinition(action = {}) {
  const actionKey = normalizeId(action.key ?? action.actionKey ?? action.id);

  return {
    ...action,
    key: actionKey
  };
}

// Crea una definicion de step lista para que phaseDefinitionModel la organice.
//
// order es declarativo: sirve para construir arrays antes de crear la sesion.
// phaseModel no lo usa durante la ejecucion.
export function createStepDefinition({
  key,
  status = PHASE_STATUSES.DISABLED,
  actorScope = {},
  actions = [],
  order = null,
  metadata = {}
} = {}) {
  return {
    key: normalizeId(key),
    status,
    actorScope: createActorScope(actorScope),
    actions: (actions ?? []).map(createStepActionDefinition),
    order: Number.isFinite(order) ? order : null,
    metadata: { ...metadata }
  };
}

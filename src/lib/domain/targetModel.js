// targetModel.js
// -----------------------------------------------------------------------------
// Resolucion y validacion de actores/targets mecanicos.
//
// Este modelo no ejecuta actions. Solo responde si los roles seleccionados
// cumplen el contrato de target declarado por una action/recipe.
// -----------------------------------------------------------------------------

import { getCurrentCycleId } from './effectModel.js';
import {
  HISTORY_EVENTS,
  getRecipeHistory
} from './historyModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  TARGET_FILTER_TYPES,
  isTargetFilterType
} from './domainTypes.js';

// Busca un rol de sesion por id.
//
// Un rol de sesion es una carta/personaje concreto en la partida:
// role_inspector-0, hidden_role-0, enemy-0, etc.
export function findRole(session, roleId) {
  return (session?.roles ?? []).find((role) => role.id === roleId) ?? null;
}

export function getActionActors(session, actorIds = []) {
  return (actorIds ?? []).map((actorId) => findRole(session, actorId));
}

// Devuelve true si una accion puede resolverse sin actor individual.
//
// Ejemplo: una seleccion all_roles puede derivar un set_in_play(false). Esa
// accion no tiene un unico actorId. Es valida mientras la propia accion no
// necesite comparar target contra actor, como ocurre con not_self.
export function canResolveWithoutActor(action) {
  const filters = action?.target?.filters ?? [];
  const needsIndividualActor =
    filters.includes(TARGET_FILTER_TYPES.NOT_SELF) ||
    filters.includes(TARGET_FILTER_TYPES.SAME_ALIGNMENT) ||
    filters.includes(TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT);

  return !needsIndividualActor;
}

function wasTargetRecentlyOutOfPlay(session = {}, target = {}) {
  const currentCycleId = getCurrentCycleId(session);

  return getRecipeHistory(session).some((entry) =>
    entry.event === HISTORY_EVENTS.FINISHED &&
    entry.metadata?.context?.cycleId === currentCycleId &&
    (entry.payload?.finalEffects ?? []).some((effect) =>
      effect.targetType === MECHANICAL_ENTITY_TYPES.ROLE &&
      effect.targetId === target?.id &&
      effect.property === 'inPlay' &&
      effect.value === false
    )
  );
}

// Comprueba si un objetivo cumple un filtro.
export function targetMatchesFilter({ filter, actor, target, session }) {
  if (filter === TARGET_FILTER_TYPES.IN_PLAY) return target?.inPlay === true;
  if (filter === TARGET_FILTER_TYPES.NOT_IN_PLAY) return target?.inPlay === false;
  if (filter === TARGET_FILTER_TYPES.ASSUMABLE) {
    return (
      (session?.assumableRoles ?? []).includes(target?.id) &&
      !target?.playerId &&
      target?.seat === null
    );
  }
  if (filter === TARGET_FILTER_TYPES.NOT_SELF) return actor?.id !== target?.id;
  if (filter === TARGET_FILTER_TYPES.SAME_ALIGNMENT) {
    return !!actor?.alignmentId && actor.alignmentId === target?.alignmentId;
  }
  if (filter === TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT) {
    return actor?.alignmentId !== target?.alignmentId;
  }
  if (filter === TARGET_FILTER_TYPES.RECENTLY_OUT_OF_PLAY) {
    return target?.inPlay === false && wasTargetRecentlyOutOfPlay(session, target);
  }
  if (filter === TARGET_FILTER_TYPES.DISTINCT) return true;
  return false;
}

// Valida si una lista de objetivos sirve para una action.
export function validateActionTargets({
  session,
  action,
  actor,
  targets
}) {
  const errors = [];
  const expectedCount = action?.target?.count ?? 0;
  const filters = action?.target?.filters ?? [];
  const unknownFilters = filters.filter((filter) => !isTargetFilterType(filter));

  unknownFilters.forEach((filter) => {
    errors.push({
      code: 'target/unknown-filter',
      message: `unknown target filter "${filter}"`,
      filter
    });
  });

  if (!actor && !canResolveWithoutActor(action)) {
    errors.push({
      code: 'action/missing-actor',
      message: 'action has no actor role'
    });
  }

  if (!Array.isArray(targets) || targets.length !== expectedCount) {
    errors.push({
      code: 'action/invalid-target-count',
      message: `action expected ${expectedCount} target(s), received ${targets?.length ?? 0}`,
      expectedCount,
      receivedCount: targets?.length ?? 0
    });
  }

  if (filters.includes(TARGET_FILTER_TYPES.DISTINCT)) {
    const targetIds = (targets ?? []).filter(Boolean).map((target) => target.id);
    if (new Set(targetIds).size !== targetIds.length) {
      errors.push({
        code: 'target/filter-distinct',
        message: 'action targets must be distinct',
        targetIds
      });
    }
  }

  (targets ?? []).forEach((target, index) => {
    if (!target) {
      errors.push({
        code: 'action/missing-target',
        message: `target at index ${index} does not exist`,
        index
      });
      return;
    }

    filters.filter(isTargetFilterType).forEach((filter) => {
      if (!targetMatchesFilter({ filter, actor, target, session })) {
        errors.push({
          code: `target/filter-${filter}`,
          message: `target "${target.id}" does not match filter "${filter}"`,
          targetId: target.id,
          filter,
          index
        });
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

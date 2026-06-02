import { getCurrentCycleId } from './effectModel.js';
import {
  findAppliedSetPropertyHistory,
  getActionHistory,
  getActionHistorySignature
} from './historyModel.js';

// constraintModel.js
// -----------------------------------------------------------------------------
// Este archivo evalua restricciones de recetas.
//
// Diferencia importante:
// - Un filtro decide si un target basico es valido: in_play, not_self, etc.
// - Una restriccion decide si una receta puede usarse en este contexto.
//
// Ejemplo:
// prevent_repeat_target no significa que el target sea intrinsecamente invalido.
// Significa que esta receta concreta no puede repetirse sobre el mismo target
// dentro de la ventana indicada.
//
// Una receta puede ser una accion generica mas restricciones:
// restore_recent_out_of_play = set_in_play(true) + require_recent_set_property.
// -----------------------------------------------------------------------------

export const CONSTRAINT_TYPES = Object.freeze({
  PREVENT_REPEAT_TARGET: 'prevent_repeat_target',
  REQUIRE_RECENT_SET_PROPERTY: 'require_recent_set_property',
  LIMITED_USES: 'limited_uses'
});

export const CONSTRAINT_WINDOWS = Object.freeze({
  CURRENT_CYCLE: 'current_cycle',
  PREVIOUS_CYCLE: 'previous_cycle',
  CURRENT_OR_PREVIOUS_CYCLE: 'current_or_previous_cycle',
  SESSION: 'session'
});

export const LIMITED_USE_SCOPES = Object.freeze({
  ACTOR_RECIPE: 'actor_recipe',
  ACTOR: 'actor',
  RECIPE: 'recipe'
});

// Indica si una entrada de historial cae dentro de la ventana de la restriccion.
export function isEntryInsideConstraintWindow(entry, currentCycleId, window) {
  if (window === CONSTRAINT_WINDOWS.CURRENT_CYCLE) {
    return entry.cycleId === currentCycleId;
  }
  if (window === CONSTRAINT_WINDOWS.PREVIOUS_CYCLE) {
    return entry.cycleId === currentCycleId - 1;
  }
  return entry.cycleId === currentCycleId || entry.cycleId === currentCycleId - 1;
}

// Evalua la restriccion prevent_repeat_target.
//
// Regla:
// si la misma firma de accion, del mismo actor, ya se aplico sobre el mismo
// target dentro de la ventana indicada, este intento queda rechazado.
export function evaluatePreventRepeatTargetConstraint({
  session,
  action,
  actor,
  targets,
  constraint
}) {
  const currentCycleId = getCurrentCycleId(session);
  const window = constraint.window ?? CONSTRAINT_WINDOWS.CURRENT_OR_PREVIOUS_CYCLE;
  const actionSignature = getActionHistorySignature(action);

  return (targets ?? []).flatMap((target, index) => {
    if (!actor || !target) return [];

    const repeated = getActionHistory(session).some((entry) => {
      const sameActor = entry.actorRoleInstanceId === actor.id;
      const sameTarget = (entry.targetRoleInstanceIds ?? []).includes(target.id);
      const sameAction = entry.actionSignature === actionSignature;
      const successful = entry.result === 'applied';
      const insideWindow = isEntryInsideConstraintWindow(entry, currentCycleId, window);

      return sameActor && sameTarget && sameAction && successful && insideWindow;
    });

    if (!repeated) return [];

    return [
      {
        code: 'constraint/prevent_repeat_target',
        message: `action "${action.id}" cannot repeat target "${target.id}" in window "${window}"`,
        constraint: constraint.type,
        targetId: target.id,
        index,
        window
      }
    ];
  });
}

// Evalua la restriccion require_recent_set_property.
//
// Regla:
// el target solo es valido si en el historial ya existe un set_property aplicado
// sobre ese mismo target dentro de la ventana indicada.
//
// Esto permite construir recetas como restore_recent_out_of_play:
// - la accion sigue siendo set_in_play(true);
// - la restriccion exige que antes, en este ciclo, el target recibiera
//   inPlay=false por una receta concreta como set_out_of_play.
export function evaluateRequireRecentSetPropertyConstraint({ session, targets, constraint }) {
  const currentCycleId = getCurrentCycleId(session);
  const window = constraint.window ?? CONSTRAINT_WINDOWS.CURRENT_CYCLE;
  const cycleIds =
    window === CONSTRAINT_WINDOWS.PREVIOUS_CYCLE
      ? [currentCycleId - 1]
      : window === CONSTRAINT_WINDOWS.CURRENT_OR_PREVIOUS_CYCLE
        ? [currentCycleId, currentCycleId - 1]
        : [currentCycleId];

  return (targets ?? []).flatMap((target, index) => {
    if (!target) return [];

    const hasRequiredHistory = cycleIds.some((cycleId) => {
      return (
        findAppliedSetPropertyHistory(session, {
          cycleId,
          property: constraint.property,
          value: constraint.value,
          targetId: target.id,
          stepKey: constraint.stepKey ?? null,
          actionKey: constraint.actionKey ?? null
        }).length > 0
      );
    });

    if (hasRequiredHistory) return [];

    return [
      {
        code: 'constraint/require_recent_set_property',
        message: `target "${target.id}" has no required recent set_property history`,
        constraint: constraint.type,
        targetId: target.id,
        index,
        property: constraint.property,
        value: constraint.value,
        actionKey: constraint.actionKey ?? null,
        stepKey: constraint.stepKey ?? null,
        window
      }
    ];
  });
}

// Indica si una entrada de historial cae dentro de la ventana de limited_uses.
//
// limited_uses usa las mismas ventanas que el resto de restricciones. Esto evita
// que una definicion acepte, por ejemplo, previous_cycle pero el motor la trate
// silenciosamente como current_cycle.
export function isEntryInsideLimitedUseWindow(entry, currentCycleId, window) {
  if (window === CONSTRAINT_WINDOWS.SESSION) return true;
  if (window === CONSTRAINT_WINDOWS.PREVIOUS_CYCLE) return entry.cycleId === currentCycleId - 1;
  if (window === CONSTRAINT_WINDOWS.CURRENT_OR_PREVIOUS_CYCLE) {
    return entry.cycleId === currentCycleId || entry.cycleId === currentCycleId - 1;
  }
  return entry.cycleId === currentCycleId;
}

// Indica si una entrada de historial pertenece al scope de limited_uses.
export function isEntryInsideLimitedUseScope(entry, { actor, recipe, scope }) {
  const actionKey = recipe?.key ?? recipe?.actionKey ?? recipe?.id ?? null;

  if (scope === LIMITED_USE_SCOPES.ACTOR) {
    return !!actor && entry.actorRoleInstanceId === actor.id;
  }

  if (scope === LIMITED_USE_SCOPES.RECIPE) {
    return !!actionKey && entry.actionKey === actionKey;
  }

  return (
    !!actor &&
    !!actionKey &&
    entry.actorRoleInstanceId === actor.id &&
    entry.actionKey === actionKey
  );
}

// Evalua limited_uses.
//
// Regla:
// una receta no puede ejecutarse si el historial ya contiene tantos usos como
// el limite configurado para el scope y ventana indicados.
export function evaluateLimitedUsesConstraint({ session, recipe, actor, constraint }) {
  const currentCycleId = getCurrentCycleId(session);
  const limit = Number.isInteger(constraint.limit) && constraint.limit > 0 ? constraint.limit : 1;
  const window = constraint.window ?? CONSTRAINT_WINDOWS.SESSION;
  const scope = constraint.scope ?? LIMITED_USE_SCOPES.ACTOR_RECIPE;
  const uses = getActionHistory(session).filter((entry) => {
    if (!isEntryInsideLimitedUseWindow(entry, currentCycleId, window)) return false;
    return isEntryInsideLimitedUseScope(entry, { actor, recipe, scope });
  });

  if (uses.length < limit) return [];

  return [
    {
      code: 'constraint/limited_uses',
      message: `recipe "${recipe?.key ?? recipe?.id ?? 'unknown'}" reached usage limit`,
      constraint: constraint.type,
      limit,
      used: uses.length,
      window,
      scope,
      actorRoleInstanceId: actor?.id ?? null,
      actionKey: recipe?.key ?? recipe?.actionKey ?? recipe?.id ?? null
    }
  ];
}

// Evalua todas las restricciones de una receta.
//
// Restricciones desconocidas se ignoran por ahora para permitir que una definicion
// futura viaje por el sistema sin romperlo. Cuando una restriccion tenga reglas
// reales, se conecta aqui y se cubre con tests.
export function evaluateRecipeConstraints({ session, recipe, actor, targets }) {
  const constraints = Array.isArray(recipe?.constraints) ? recipe.constraints : [];

  return constraints.flatMap((constraint) => {
    if (constraint?.type === CONSTRAINT_TYPES.PREVENT_REPEAT_TARGET) {
      return evaluatePreventRepeatTargetConstraint({
        session,
        action: recipe,
        actor,
        targets,
        constraint
      });
    }
    if (constraint?.type === CONSTRAINT_TYPES.REQUIRE_RECENT_SET_PROPERTY) {
      return evaluateRequireRecentSetPropertyConstraint({
        session,
        targets,
        constraint
      });
    }
    if (constraint?.type === CONSTRAINT_TYPES.LIMITED_USES) {
      return evaluateLimitedUsesConstraint({
        session,
        recipe,
        actor,
        constraint
      });
    }

    return [];
  });
}

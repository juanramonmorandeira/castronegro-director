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
// no_repeat_target no significa que el target sea intrinsecamente invalido.
// Significa que esta receta concreta no puede repetirse sobre el mismo target
// dentro de la ventana indicada.
//
// Una receta puede ser una accion generica mas restricciones:
// restore_recent_out_of_play = set_in_play(true) + require_recent_set_property.
// -----------------------------------------------------------------------------

export const CONSTRAINT_TYPES = Object.freeze({
  NO_REPEAT_TARGET: 'no_repeat_target',
  REQUIRE_RECENT_SET_PROPERTY: 'require_recent_set_property',
  REQUIRE_ACTOR_IN_PLAY: 'require_actor_in_play',
  REQUIRE_SELF_TARGET_WHEN_ACTOR_OUT: 'require_self_target_when_actor_out',
  LIMITED_USES: 'limited_uses'
});

export const CONSTRAINT_WINDOWS = Object.freeze({
  STAGE: 'stage',
  POOL: 'pool',
  CYCLE: 'cycle',
  CURRENT_CYCLE: 'current_cycle',
  NEXT_CYCLE: 'next_cycle',
  CURRENT_OR_NEXT_CYCLE: 'current_or_next_cycle',
  SESSION: 'session'
});

// Crea una restriccion mecanica normalizada.
//
// Una restriccion no ejecuta acciones. Solo declara una regla que recipeModel
// debe comprobar antes de entregar una accion pura a actionModel.
export function createConstraint({ type, metadata = {}, ...params } = {}) {
  return {
    type,
    ...params,
    metadata: { ...metadata }
  };
}

// Indica si una entrada de historial cae dentro de la ventana de la restriccion.
//
// Importante sobre "next_cycle":
// el historial siempre mira hacia atras desde el ciclo actual. Por eso
// next_cycle significa: "esta entrada ocurrio en el ciclo anterior y, por tanto,
// el ciclo actual es el siguiente ciclo donde la repeticion queda prohibida".
export function isEntryInsideConstraintWindow(entry, currentCycleId, window) {
  if (window === CONSTRAINT_WINDOWS.SESSION) {
    return true;
  }
  if (window === CONSTRAINT_WINDOWS.CURRENT_CYCLE) {
    return entry.cycleId === currentCycleId;
  }
  if (window === CONSTRAINT_WINDOWS.NEXT_CYCLE) {
    return entry.cycleId === currentCycleId - 1;
  }
  return entry.cycleId === currentCycleId || entry.cycleId === currentCycleId - 1;
}

// Evalua la restriccion no_repeat_target.
//
// Regla:
// si la misma firma de accion, del mismo actor, ya se aplico sobre el mismo
// target dentro de la ventana indicada, este intento queda rechazado.
//
// Ejemplos:
// - window=current_cycle: no repetir target dentro del mismo ciclo.
// - window=next_cycle: no repetir en el ciclo inmediatamente posterior.
// - window=current_or_next_cycle: combina las dos anteriores.
// - window=session: no repetir ese target nunca durante esta partida.
export function evaluateNoRepeatTargetConstraint({
  session,
  action,
  actor,
  targets,
  constraint
}) {
  const currentCycleId = getCurrentCycleId(session);
  const window = constraint.window ?? CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE;
  const actionSignature = getActionHistorySignature(action);

  return (targets ?? []).flatMap((target, index) => {
    if (!actor || !target) return [];

    const repeated = getActionHistory(session).some((entry) => {
      const sameActor = (entry.actorIds ?? []).includes(actor.id);
      const sameTarget = (entry.targetIds ?? []).includes(target.id);
      const sameAction = entry.actionSignature === actionSignature;
      const successful = entry.result === 'applied';
      const insideWindow = isEntryInsideConstraintWindow(entry, currentCycleId, window);

      return sameActor && sameTarget && sameAction && successful && insideWindow;
    });

    if (!repeated) return [];

    return [
      {
        code: 'constraint/no_repeat_target',
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
    window === CONSTRAINT_WINDOWS.NEXT_CYCLE
      ? [currentCycleId - 1]
      : window === CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
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
          stageKey: constraint.stageKey ?? null,
          stageCatalogId: constraint.stageCatalogId ?? null,
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
        stageKey: constraint.stageKey ?? null,
        stageCatalogId: constraint.stageCatalogId ?? null,
        window
      }
    ];
  });
}

export function evaluateRequireActorInPlayConstraint({ actor, constraint }) {
  if (actor?.inPlay === true) return [];

  return [
    {
      code: 'constraint/require_actor_in_play',
      message: `actor "${actor?.id ?? 'missing'}" must be inPlay=true`,
      constraint: constraint.type,
      actorIds: actor?.id ? [actor.id] : []
    }
  ];
}

export function evaluateRequireSelfTargetWhenActorOutConstraint({ actor, targets, constraint }) {
  if (!actor || actor.inPlay === true) return [];

  return (targets ?? []).flatMap((target, index) => {
    if (target?.id === actor.id) return [];

    return [
      {
        code: 'constraint/require_self_target_when_actor_out',
        message: `actor "${actor.id}" can only target self while inPlay=false`,
        constraint: constraint.type,
        actorIds: [actor.id],
        targetId: target?.id ?? null,
        index
      }
    ];
  });
}

// Indica si una entrada de historial cae dentro de la ventana de limited_uses.
//
// limited_uses usa las mismas ventanas que el resto de restricciones.
//
// En esta funcion, next_cycle tiene la misma lectura que en no_repeat_target:
// una entrada del ciclo anterior bloquea un uso en el ciclo actual porque este
// es el ciclo siguiente al uso registrado.
export function isEntryInsideLimitedUseWindow(entry, currentCycleId, window, context = {}) {
  if (window === CONSTRAINT_WINDOWS.SESSION) return true;
  if (window === CONSTRAINT_WINDOWS.STAGE) {
    return (
      entry.cycleId === currentCycleId &&
      entry.poolKey === (context.poolKey ?? null) &&
      entry.stageId === (context.stageId ?? null)
    );
  }
  if (window === CONSTRAINT_WINDOWS.POOL) {
    return (
      entry.cycleId === currentCycleId &&
      entry.poolKey === (context.poolKey ?? null)
    );
  }
  if (window === CONSTRAINT_WINDOWS.CYCLE) return entry.cycleId === currentCycleId;
  if (window === CONSTRAINT_WINDOWS.NEXT_CYCLE) return entry.cycleId === currentCycleId - 1;
  if (window === CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE) {
    return entry.cycleId === currentCycleId || entry.cycleId === currentCycleId - 1;
  }
  return entry.cycleId === currentCycleId;
}

// Indica si una entrada de historial pertenece al contador de limited_uses.
//
// Decision actual:
// limited_uses siempre se cuenta por actor + receta. En datos eso significa:
// - actorIds: que roles usaron la receta;
// - actionKey: que receta concreta dentro del stage se uso.
//
// No exponemos un campo "scope" en las recetas normales porque todavia no
// tenemos una regla real que necesite contar por actor global o por receta
// global. Si aparece, lo anadiremos con un caso de uso concreto.
export function isEntryInsideLimitedUseCounter(entry, { actor, recipe }) {
  const actionKey = recipe?.key ?? recipe?.actionKey ?? recipe?.id ?? null;

  return (
    !!actor &&
    !!actionKey &&
    (entry.actorIds ?? []).includes(actor.id) &&
    entry.actionKey === actionKey
  );
}

// Evalua limited_uses.
//
// Regla:
// una receta no puede ejecutarse si el historial ya contiene tantos usos como
// el limite configurado para ese actor + receta dentro de la ventana indicada.
export function evaluateLimitedUsesConstraint({ session, recipe, actor, constraint, context = {} }) {
  const currentCycleId = getCurrentCycleId(session);
  const limit = Number.isInteger(constraint.limit) && constraint.limit > 0 ? constraint.limit : 1;
  const window = constraint.window ?? CONSTRAINT_WINDOWS.SESSION;
  if (window === CONSTRAINT_WINDOWS.POOL && !context.poolKey) {
    return [
      {
        code: 'constraint/invalid-limited-uses-window',
        message: 'pool usage window requires a pool context',
        constraint: constraint.type,
        window,
        actionKey: recipe?.key ?? recipe?.actionKey ?? recipe?.id ?? null
      }
    ];
  }
  const uses = getActionHistory(session).filter((entry) => {
    if (!isEntryInsideLimitedUseWindow(entry, currentCycleId, window, context)) return false;
    return isEntryInsideLimitedUseCounter(entry, { actor, recipe });
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
      actorIds: actor ? [actor.id] : [],
      actionKey: recipe?.key ?? recipe?.actionKey ?? recipe?.id ?? null
    }
  ];
}

// Evalua todas las restricciones de una receta.
//
// Restricciones desconocidas se ignoran por ahora para permitir que una definicion
// futura viaje por el sistema sin romperlo. Cuando una restriccion tenga reglas
// reales, se conecta aqui y se cubre con tests.
export function evaluateRecipeConstraints({ session, recipe, actor, targets, context = {} }) {
  const constraints = Array.isArray(recipe?.constraints) ? recipe.constraints : [];

  return constraints.flatMap((constraint) => {
    if (constraint?.type === CONSTRAINT_TYPES.NO_REPEAT_TARGET) {
      return evaluateNoRepeatTargetConstraint({
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
    if (constraint?.type === CONSTRAINT_TYPES.REQUIRE_ACTOR_IN_PLAY) {
      return evaluateRequireActorInPlayConstraint({
        actor,
        constraint
      });
    }
    if (constraint?.type === CONSTRAINT_TYPES.REQUIRE_SELF_TARGET_WHEN_ACTOR_OUT) {
      return evaluateRequireSelfTargetWhenActorOutConstraint({
        actor,
        targets,
        constraint
      });
    }
    if (constraint?.type === CONSTRAINT_TYPES.LIMITED_USES) {
      return evaluateLimitedUsesConstraint({
        session,
        recipe,
        actor,
        constraint,
        context
      });
    }

    return [];
  });
}

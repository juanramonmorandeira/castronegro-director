// eventModel.js
// -----------------------------------------------------------------------------
// Gestiona eventos mecanicos derivados de cambios ya ocurridos en la sesion.
//
// Semantica:
// - event: algo que ha ocurrido, por ejemplo role_x.inPlay paso de true a false.
// - trigger: condicion declarada por un rol para escuchar ese evento.
// - reaction: respuesta definida por ese rol cuando el trigger encaja.
//
// Este archivo no ejecuta la receta del step especial. Solo crea el step que
// podra ejecutarse mas tarde por stepModel, respetando el cierre manual.
// -----------------------------------------------------------------------------

import { createStep } from './stepDefinition.js';
import { EFFECT_TYPES } from './effectModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import { POOL_KEYS, STEP_STATUSES, normalizeId } from './sessionModel.js';

export const EVENT_TYPES = Object.freeze({
  PROPERTY_CHANGED: 'property_changed'
});

export const EVENT_TRIGGER_TARGETS = Object.freeze({
  SELF: 'self'
});

export const EVENT_RESPONSE_TYPES = Object.freeze({
  CREATE_STEP: 'create_step'
});

export const SPECIAL_STEP_PRIORITIES = Object.freeze({
  FINISH_SESSION: 'finish_session'
});

function findRole(session = {}, roleId = null) {
  return (session?.roles ?? []).find((role) => role.id === roleId) ?? null;
}

function getPropertyChangeEvent({ previousSession, effect, source = {} }) {
  if (
    effect?.type !== EFFECT_TYPES.SET_PROPERTY ||
    effect?.targetType !== 'role' ||
    !effect?.targetId ||
    !effect?.property
  ) {
    return null;
  }

  const previousRole = findRole(previousSession, effect.targetId);
  const from = previousRole?.[effect.property];
  const to = effect.value;

  // Si el valor no cambia, no consideramos que haya ocurrido un evento nuevo.
  if (from === to) return null;

  return {
    type: EVENT_TYPES.PROPERTY_CHANGED,
    targetType: 'role',
    roleId: effect.targetId,
    property: effect.property,
    from,
    to,
    source: {
      actionId: source.actionId ?? null,
      actionKey: source.actionKey ?? null,
      poolKey: source.poolKey ?? null,
      stepKey: source.stepKey ?? null,
      effect
    }
  };
}

// Convierte efectos finales ya aplicados en eventos mecanicos.
//
// Usamos finalEffects, no proposedEffects, porque una accion bloqueada no debe
// disparar una reaccion: no produjo cambio real de estado.
export function getEventsFromActionResult({
  previousSession,
  actionResult = {},
  context = {}
} = {}) {
  const source = {
    actionId: actionResult?.actionId ?? null,
    actionKey: context.actionKey ?? null,
    poolKey: context.poolKey ?? null,
    stepKey: context.stepKey ?? null
  };

  return (actionResult?.finalEffects ?? [])
    .map((effect) => getPropertyChangeEvent({ previousSession, effect, source }))
    .filter(Boolean);
}

function eventMatchesTrigger({ event, role, trigger = {} }) {
  if (trigger.eventType && trigger.eventType !== event.type) return false;
  if (trigger.targetType && trigger.targetType !== event.targetType) return false;
  if (trigger.property && trigger.property !== event.property) return false;
  if (Object.hasOwn(trigger, 'from') && trigger.from !== event.from) return false;
  if (Object.hasOwn(trigger, 'to') && trigger.to !== event.to) return false;

  if (trigger.target === EVENT_TRIGGER_TARGETS.SELF) {
    return event.roleId === role.id;
  }

  return true;
}

export function getTriggeredReactions({ session = {}, events = [] } = {}) {
  return (session.roles ?? []).flatMap((role) =>
    (role.reactions ?? []).flatMap((reaction) =>
      events
        .filter((event) => eventMatchesTrigger({ event, role, trigger: reaction.trigger }))
        .map((event) => ({
          role,
          reaction,
          event
        }))
    )
  );
}

function getUniqueStepKey(stepPools, poolKey, baseKey) {
  const existingKeys = new Set((stepPools?.pools?.[poolKey] ?? []).map((step) => step.key));
  const normalizedBaseKey = normalizeId(baseKey || 'event_step');

  if (!existingKeys.has(normalizedBaseKey)) return normalizedBaseKey;

  let index = 1;
  let nextKey = `${normalizedBaseKey}_${index}`;
  while (existingKeys.has(nextKey)) {
    index += 1;
    nextKey = `${normalizedBaseKey}_${index}`;
  }
  return nextKey;
}

function createStepFromReactionResponse({ session, triggeredReaction }) {
  const response = triggeredReaction.reaction.response ?? {};
  const poolKey = response.poolKey ?? response.step?.poolKey ?? POOL_KEYS.POOL_SPECIAL;
  const step = createStep({
    ...(response.step ?? {}),
    key: getUniqueStepKey(session.stepPools, poolKey, response.step?.key),
    poolKey,
    status: response.step?.status ?? STEP_STATUSES.ENABLED,
    actorIds: [triggeredReaction.role.id],
    metadata: {
      ...(response.step?.metadata ?? {}),
      source: {
        type: 'event',
        id: triggeredReaction.event.type,
        metadata: {
          reactionKey: triggeredReaction.reaction.key ?? null,
          roleId: triggeredReaction.role.id,
          event: triggeredReaction.event
        }
      }
    }
  });

  return {
    type: EVENT_RESPONSE_TYPES.CREATE_STEP,
    poolKey,
    step
  };
}

export function resolveEventResponses({ session = {}, triggeredReactions = [] } = {}) {
  return triggeredReactions
    .filter((entry) => entry.reaction?.response?.type === EVENT_RESPONSE_TYPES.CREATE_STEP)
    .map((triggeredReaction) =>
      createStepFromReactionResponse({
        session,
        triggeredReaction
      })
    );
}

export function applyEventResponses({ session = {}, responses = [] } = {}) {
  if (!responses.length) return session;

  return responses.reduce((currentSession, response) => {
    if (response.type !== EVENT_RESPONSE_TYPES.CREATE_STEP) return currentSession;

    const poolKey = response.poolKey ?? POOL_KEYS.POOL_SPECIAL;
    const pools = currentSession.stepPools?.pools ?? {};

    return {
      ...currentSession,
      stepPools: {
        ...currentSession.stepPools,
        pools: {
          ...pools,
          [poolKey]: [...(pools[poolKey] ?? []), response.step]
        }
      }
    };
  }, session);
}

// Punto de entrada para stepModel.
//
// Recibe el resultado de una accion/receta ya resuelta, crea eventos desde sus
// efectos finales, activa reacciones compatibles y devuelve la sesion con los
// steps especiales anadidos.
export function processActionResultEvents({
  previousSession,
  session,
  actionResult = {},
  context = {}
} = {}) {
  const events = getEventsFromActionResult({
    previousSession,
    actionResult,
    context
  });
  const triggeredReactions = getTriggeredReactions({ session, events });
  const responses = resolveEventResponses({ session, triggeredReactions });

  return {
    session: applyEventResponses({ session, responses }),
    events,
    triggeredReactions,
    responses
  };
}

export function createFinishSessionStep({ session = {}, victory = null } = {}) {
  const poolKey = POOL_KEYS.POOL_SPECIAL;

  return createStep({
    key: getUniqueStepKey(session.stepPools, poolKey, 'step_08'),
    poolKey,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    actions: [
      getCatalogRecipe(RECIPE_KEYS.FINISH_SESSION, {
        effect: {
          type: EFFECT_TYPES.FINISH_SESSION,
          victory
        }
      })
    ],
    metadata: {
      source: {
        type: 'event',
        id: 'victory_finished',
        metadata: {
          victory
        }
      },
      specialPriority: SPECIAL_STEP_PRIORITIES.FINISH_SESSION
    }
  });
}

export function appendFinishSessionEventResponse({ session = {}, victory = null } = {}) {
  const response = {
    type: EVENT_RESPONSE_TYPES.CREATE_STEP,
    poolKey: POOL_KEYS.POOL_SPECIAL,
    step: createFinishSessionStep({ session, victory }),
    reason: 'victory_finished'
  };

  return {
    session: applyEventResponses({ session, responses: [response] }),
    response
  };
}

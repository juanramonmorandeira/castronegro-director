// eventModel.js
// -----------------------------------------------------------------------------
// Gestiona eventos mecanicos derivados de cambios ya ocurridos en la sesion.
//
// Semantica:
// - event: algo que ha ocurrido, por ejemplo role_x.inPlay paso de true a false.
// - trigger: condicion declarada por un rol para escuchar ese evento.
// - reaction: respuesta definida por ese rol cuando el trigger encaja.
//
// Este archivo no ejecuta la receta del stage especial. Solo crea el stage que
// podra ejecutarse mas tarde por stageModel, respetando el cierre manual.
// -----------------------------------------------------------------------------

import { createStage } from './stageDefinition.js';
import { EFFECT_TYPES } from './effectModel.js';
import { STAGE_STATUSES, normalizeId } from './sessionModel.js';
import { appendSpecialStage } from './specialStagesModel.js';

export const EVENT_TYPES = Object.freeze({
  PROPERTY_CHANGED: 'property_changed'
});

export const EVENT_TRIGGER_TARGETS = Object.freeze({
  SELF: 'self'
});

export const EVENT_RESPONSE_TYPES = Object.freeze({
  CREATE_STAGE: 'create_stage'
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
      stageId: source.stageId ?? null,
      stageKey: source.stageKey ?? null,
      effect
    }
  };
}

// Convierte efectos finales ya aplicados en eventos mecanicos.
//
// Usamos finalEffects, no proposedEffects, porque un cambio impedido no debe
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
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null
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

function createStageFromReactionResponse({ session, triggeredReaction }) {
  const response = triggeredReaction.reaction.response ?? {};
  const stage = createStage({
    ...(response.stage ?? {}),
    key: normalizeId(response.stage?.key || 'event_stage'),
    poolKey: null,
    special: true,
    status: response.stage?.status ?? STAGE_STATUSES.ENABLED,
    actorIds: [triggeredReaction.role.id],
    metadata: {
      ...(response.stage?.metadata ?? {}),
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
    type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
    stage
  };
}

export function resolveEventResponses({ session = {}, triggeredReactions = [] } = {}) {
  return triggeredReactions
    .filter((entry) => entry.reaction?.response?.type === EVENT_RESPONSE_TYPES.CREATE_STAGE)
    .map((triggeredReaction) =>
      createStageFromReactionResponse({
        session,
        triggeredReaction
      })
    );
}

export function applyEventResponses({ session = {}, responses = [] } = {}) {
  if (!responses.length) return session;

  return responses.reduce((currentSession, response) => {
    if (response.type !== EVENT_RESPONSE_TYPES.CREATE_STAGE) return currentSession;

    return appendSpecialStage(currentSession, response.stage, {
      source: 'event_response'
    });
  }, session);
}

// Punto de entrada para stageModel.
//
// Recibe el resultado de una accion/receta ya resuelta, crea eventos desde sus
// efectos finales, activa reacciones compatibles y devuelve la sesion con los
// stages especiales anadidos.
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

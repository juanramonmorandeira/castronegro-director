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
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECTION_ABSTAIN_RULES,
  SELECTION_REQUIRED_RULES,
  SELECTION_TIE_RULES,
  SELECTION_UNANIMOUS_RULES,
  createSelectionRules
} from './selectionModel.js';
import { appendSpecialStage, removeSpecialStages } from './specialStagesModel.js';
import { STAGE_COMPLETION_REQUESTED_BY } from './stageTypes.js';

const DOUBLE_SELECTOR_RULE_KEY = 'selection_counts_double';
const PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY = 'pick_next_double_selector';

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

function isSelectionCountsDoubleEnabled(session = {}) {
  return (session.settings?.selectedRuleKeys ?? []).includes(DOUBLE_SELECTOR_RULE_KEY);
}

function getInPlayCandidateIds(session = {}, excludedRoleIds = []) {
  const excluded = new Set(excludedRoleIds);
  return (session.roles ?? [])
    .filter((role) => role.inPlay === true && !excluded.has(role.id))
    .map((role) => role.id);
}

function hasPendingPickNextDoubleSelectorStage(session = {}, holderRoleId = null) {
  return (session.specialStages ?? []).some(
    (stage) =>
      stage.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY &&
      stage.metadata?.requestKey === PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY &&
      stage.metadata?.holderRoleId === holderRoleId
  );
}

function createPickNextDoubleSelectorStage({ holderRoleId, candidateIds }) {
  return createStage({
    key: PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY,
    status: STAGE_STATUSES.ENABLED,
    actorIds: holderRoleId ? [holderRoleId] : [],
    completion: {
      mode: 'manual',
      allowedRequesters: [
        STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
        STAGE_COMPLETION_REQUESTED_BY.SYSTEM
      ]
    },
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.NULL_ON_TIE,
      candidateIds,
      selectorEligibility: {
        requireInPlay: false
      }
    }),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      ruleKey: DOUBLE_SELECTOR_RULE_KEY,
      requestKey: PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY,
      holderRoleId
    }
  });
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
    targetType: MECHANICAL_ENTITY_TYPES.ROLE,
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

function createStageFromReactionResponse({ triggeredReaction }) {
  const response = triggeredReaction.reaction.response ?? {};
  const stage = createStage({
    ...(response.stage ?? {}),
    key: normalizeId(response.stage?.key || 'event_stage'),
    poolKey: null,
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

export function resolveEventResponses({ triggeredReactions = [] } = {}) {
  return triggeredReactions
    .filter((entry) => entry.reaction?.response?.type === EVENT_RESPONSE_TYPES.CREATE_STAGE)
    .map((triggeredReaction) =>
      createStageFromReactionResponse({
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

function getDoubleSelectorEventResponses({ session = {}, events = [] } = {}) {
  if (!isSelectionCountsDoubleEnabled(session)) return [];

  return (events ?? []).flatMap((event) => {
    if (
      event.type !== EVENT_TYPES.PROPERTY_CHANGED ||
      event.targetType !== 'role' ||
      event.property !== 'inPlay'
    ) {
      return [];
    }

    const role = findRole(session, event.roleId);
    if (role?.doubleSelector !== true) return [];

    if (event.to === false) {
      if (hasPendingPickNextDoubleSelectorStage(session, event.roleId)) return [];

      const candidateIds = getInPlayCandidateIds(session, [event.roleId]);
      if (candidateIds.length === 0) return [];

      return [
        {
          type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
          stage: createPickNextDoubleSelectorStage({
            holderRoleId: event.roleId,
            candidateIds
          }),
          metadata: {
            ruleKey: DOUBLE_SELECTOR_RULE_KEY,
            requestKey: PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY,
            holderRoleId: event.roleId
          }
        }
      ];
    }

    if (event.to === true) {
      return [
        {
          type: 'cancel_stage',
          metadata: {
            ruleKey: DOUBLE_SELECTOR_RULE_KEY,
            requestKey: PICK_NEXT_DOUBLE_SELECTOR_STAGE_KEY,
            holderRoleId: event.roleId,
            reason: 'holder_returned_in_play'
          }
        }
      ];
    }

    return [];
  });
}

function applyDoubleSelectorEventResponses({ session = {}, responses = [] } = {}) {
  return (responses ?? []).reduce((currentSession, response) => {
    if (
      response.type === EVENT_RESPONSE_TYPES.CREATE_STAGE &&
      response.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY
    ) {
      return appendSpecialStage(currentSession, response.stage, {
        source: 'event_response',
        ...response.metadata
      });
    }

    if (
      response.type === 'cancel_stage' &&
      response.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY
    ) {
      return removeSpecialStages(
        currentSession,
        (stage) =>
          stage.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY &&
          stage.metadata?.requestKey === response.metadata.requestKey &&
          stage.metadata?.holderRoleId === response.metadata.holderRoleId,
        {
          source: 'event_response',
          ...response.metadata
        }
      ).session;
    }

    return currentSession;
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
  const sessionWithRoleResponses = applyEventResponses({ session, responses });
  const doubleSelectorResponses = getDoubleSelectorEventResponses({
    session: sessionWithRoleResponses,
    events
  });

  return {
    session: applyDoubleSelectorEventResponses({
      session: sessionWithRoleResponses,
      responses: doubleSelectorResponses
    }),
    events,
    triggeredReactions,
    responses: [...responses, ...doubleSelectorResponses]
  };
}

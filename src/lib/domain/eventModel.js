// eventModel.js
// -----------------------------------------------------------------------------
// Gestiona eventos mecanicos derivados de cambios ya ocurridos en la sesion.
//
// Semantica:
// - event: algo que ha ocurrido, por ejemplo role_x.inPlay paso de true a false.
// - trigger: condicion declarada por un rol para escuchar ese evento.
// - reaction: respuesta definida por ese rol cuando el trigger encaja.
//
// Este archivo crea stages de interPoolQueue derivados y resuelve los stages de interPoolQueue
// cuyo comportamiento pertenece al evento que los genero.
// -----------------------------------------------------------------------------

import { createStage } from './stageDefinition.js';
import { EFFECT_TYPES } from './effectDefinition.js';
import { STAGE_STATUSES, normalizeId } from './sessionModel.js';
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { GROUP_TYPES } from './groupDefinition.js';
import {
  EVENT_RESPONSE_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_TYPES
} from './eventDefinition.js';
import {
  EVENT_RULE_KEYS,
  EVENT_WINDOW_BY_SOURCE_STAGE_CATALOG_ID,
  getCatalogEventRule,
  getEventResponseWindow
} from './eventCatalog.js';
import {
  appendInterPoolStage,
  removeInterPoolStages
} from './interPoolQueueModel.js';
import { INTER_POOL_QUEUE_EVENT_WINDOWS } from './interPoolQueueDefinition.js';
import {
  STAGE_CATALOG_IDS,
  getCatalogStage
} from './stageCatalog.js';
import { RECIPE_KEYS } from './recipeCatalog.js';
import { findRole } from './targetModel.js';
import { getDoubleSelectorEventResponses } from './doubleSelectorModel.js';

// -----------------------------------------------------------------------------
// Helpers generales
// -----------------------------------------------------------------------------

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
      recipeKey: source.recipeKey ?? null,
      poolKey: source.poolKey ?? null,
      stageId: source.stageId ?? null,
      stageKey: source.stageKey ?? null,
      stageCatalogId: source.stageCatalogId ?? null,
      eventWindow: source.eventWindow ?? null,
      effect
    }
  };
}

function getEventWindowForSourceStage(stageCatalogId = null) {
  return EVENT_WINDOW_BY_SOURCE_STAGE_CATALOG_ID[stageCatalogId] ?? null;
}

function getRevealEventWindow(event = {}) {
  return getEventResponseWindow(event);
}

function getLinkedEventWindow(context = {}) {
  if (context.eventWindow) return context.eventWindow;
  if (context.poolKey === 'poolConcealed') return INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED;
  if (context.poolKey === 'poolExposed') return INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED;
  return null;
}

function sameRoleIdSet(left = [], right = []) {
  const leftIds = [...new Set(left ?? [])].sort();
  const rightIds = [...new Set(right ?? [])].sort();
  return leftIds.length === rightIds.length && leftIds.every((roleId, index) => roleId === rightIds[index]);
}

function findGroupCreatedBySetGroupEffect(session = {}, effect = {}) {
  const roleIds = effect.roleIds ?? [];
  const groupType = effect.groupType ?? null;

  return (session.groups ?? []).find((group) =>
    group.type === groupType &&
    sameRoleIdSet(group.roleIds ?? [], roleIds)
  ) ?? null;
}

function appendCreateStageResponses(session = {}, responses = [], metadata = {}) {
  return applyCatalogEventResponses(session, responses, { metadata });
}

function getResponseStageCatalogId(rule = {}, metadata = {}) {
  return rule.response?.stageCatalogId ?? metadata.catalogId ?? null;
}

export function createStageResponseFromRule(rule = {}, payload = {}) {
  const response = rule.response ?? {};
  const metadataTemplate = response.metadataTemplate ?? {};
  const eventWindow = payload.eventWindow ?? payload.metadata?.eventWindow ?? null;
  const metadata = {
    ...metadataTemplate,
    ...(eventWindow ? { eventWindow } : {}),
    ...(payload.metadata ?? {})
  };
  const stageCatalogId = getResponseStageCatalogId(rule, metadata);
  const stage =
    payload.stage ??
    createStage({
      key: payload.stageKey ?? response.stageKey ?? stageCatalogId ?? rule.key,
      status: payload.status ?? STAGE_STATUSES.ENABLED,
      actorIds: [...(payload.actorIds ?? [])],
      completion: payload.completion ?? response.completion,
      selectionRules: payload.selectionRules ?? null,
      recipes: [...(payload.recipes ?? [])],
      metadata
    });

  return {
    type: response.type ?? EVENT_RESPONSE_TYPES.CREATE_STAGE,
    stage,
    metadata: {
      ...(stageCatalogId ? { catalogId: stageCatalogId } : {}),
      ...(eventWindow ? { eventWindow } : {}),
      ...(payload.responseMetadata ?? {})
    }
  };
}

export function createCancelStageResponseFromRule(rule = {}, payload = {}) {
  const response = rule.response ?? {};
  const metadataTemplate = response.metadataTemplate ?? {};
  const metadata = {
    ...metadataTemplate,
    ...(payload.metadata ?? {})
  };
  const stageCatalogId = getResponseStageCatalogId(rule, metadata);

  return {
    type: EVENT_RESPONSE_TYPES.CANCEL_STAGE,
    metadata: {
      ...(stageCatalogId ? { catalogId: stageCatalogId } : {}),
      ...metadata
    },
    ...(typeof payload.cancelPredicate === 'function'
      ? { cancelPredicate: payload.cancelPredicate }
      : {})
  };
}

export function applyCatalogEventResponses(session = {}, responses = [], { metadata = {} } = {}) {
  return (responses ?? []).reduce((currentSession, response) => {
    if (response.type === EVENT_RESPONSE_TYPES.CREATE_STAGE) {
      return appendInterPoolStage(currentSession, response.stage, {
        source: 'event_response',
        ...metadata,
        ...(response.metadata ?? {})
      });
    }

    if (response.type === EVENT_RESPONSE_TYPES.CANCEL_STAGE) {
      const cancelPredicate =
        response.cancelPredicate ??
        ((stage) =>
          !!response.metadata?.catalogId &&
          stage.metadata?.catalogId === response.metadata.catalogId);

      return removeInterPoolStages(currentSession, cancelPredicate, {
        source: 'event_response',
        ...metadata,
        ...(response.metadata ?? {})
      }).session;
    }

    return currentSession;
  }, session);
}

function eventMatchesRuleTrigger(event = {}, trigger = {}) {
  if (trigger.eventType && trigger.eventType !== event.type) return false;
  if (trigger.targetType && trigger.targetType !== event.targetType) return false;
  if (trigger.property && trigger.property !== event.property) return false;
  if (Object.hasOwn(trigger, 'from') && trigger.from !== event.from) return false;
  if (Object.hasOwn(trigger, 'to') && trigger.to !== event.to) return false;
  if (
    Array.isArray(trigger.stageCatalogIds) &&
    trigger.stageCatalogIds.length > 0 &&
    !trigger.stageCatalogIds.includes(event.source?.stageCatalogId ?? null)
  ) {
    return false;
  }

  return true;
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
    recipeKey: context.recipeKey ?? null,
    poolKey: context.poolKey ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    stageCatalogId: context.stageCatalogId ?? null,
    eventWindow: context.eventWindow ?? null
  };

  return (actionResult?.finalEffects ?? [])
    .map((effect) => getPropertyChangeEvent({ previousSession, effect, source }))
    .filter(Boolean);
}

// -----------------------------------------------------------------------------
// role_state_revealed
// -----------------------------------------------------------------------------

function createRoleStateRevealedStage({ session = {}, event = {} } = {}) {
  const rule = getCatalogEventRule(EVENT_RULE_KEYS.ROLE_STATE_REVEALED);
  const role = findRole(session, event.roleId);
  const eventWindow = getRevealEventWindow(event);

  if (!role || !eventWindow) return null;

  return createStage({
    ...getCatalogStage(STAGE_CATALOG_IDS.ROLE_STATE_REVEALED),
    poolKey: null,
    status: STAGE_STATUSES.ENABLED,
    metadata: {
      ...(rule?.response?.metadataTemplate ?? {}),
      eventWindow,
      reveal: {
        playerId: role.playerId ?? null,
        roleId: role.id,
        roleKey: role.roleKey ?? role.key ?? null,
        property: event.property,
        value: event.to,
        causedBy: event.source?.effect?.causedBy ?? null,
        sourceActionId: event.source?.actionId ?? null,
        sourceRecipeKey: event.source?.recipeKey ?? null,
        sourceStageId: event.source?.stageId ?? null,
        sourceStageKey: event.source?.stageKey ?? null,
        sourceStageCatalogId: event.source?.stageCatalogId ?? null
      },
      source: {
        type: 'event',
        id: event.type,
        metadata: {
          event
        }
      }
    }
  });
}

function getRoleStateRevealEventResponses({ session = {}, events = [] } = {}) {
  const rule = getCatalogEventRule(EVENT_RULE_KEYS.ROLE_STATE_REVEALED);
  if (!rule?.enabled) return [];

  return (events ?? []).flatMap((event) => {
    if (!eventMatchesRuleTrigger(event, rule.trigger)) return [];

    if (event.to === true) {
      return [
        createCancelStageResponseFromRule(rule, {
          metadata: {
            roleId: event.roleId,
            reason: 'role_returned_in_play'
          },
          cancelPredicate: (stage) =>
            stage.metadata?.catalogId === rule.response?.stageCatalogId &&
            stage.metadata?.reveal?.roleId === event.roleId
        })
      ];
    }

    if (event.to !== false) return [];

    const stage = createRoleStateRevealedStage({ session, event });
    if (!stage) return [];

    return [
      createStageResponseFromRule(rule, {
        stage,
        eventWindow: stage.metadata.eventWindow,
        responseMetadata: {
          roleId: event.roleId
        }
      })
    ];
  });
}

function applyRoleStateRevealEventResponses({ session = {}, responses = [] } = {}) {
  return applyCatalogEventResponses(session, responses);
}

// -----------------------------------------------------------------------------
// role reactions
// -----------------------------------------------------------------------------

function eventMatchesTrigger({ event, role, trigger = {} }) {
  if (!eventMatchesRuleTrigger(event, trigger)) return false;

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
  const eventWindow = getEventWindowForSourceStage(
    triggeredReaction.event.source?.stageCatalogId
  );
  const stage = createStage({
    ...(response.stage ?? {}),
    key: normalizeId(response.stage?.key || 'event_stage'),
    poolKey: null,
    status: response.stage?.status ?? STAGE_STATUSES.ENABLED,
    actorIds: [triggeredReaction.role.id],
    metadata: {
      ...(response.stage?.metadata ?? {}),
      ...(eventWindow ? { eventWindow } : {}),
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

  return createStageResponseFromRule(triggeredReaction.reaction, {
    stage,
    eventWindow
  });
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
  return appendCreateStageResponses(session, responses);
}

// -----------------------------------------------------------------------------
// linked
// -----------------------------------------------------------------------------

function getLinkedPropagatedEffectResponses({
  session = {},
  linkedPropagatedEffects = [],
  context = {}
} = {}) {
  const rule = getCatalogEventRule(EVENT_RULE_KEYS.LINKED_PROPAGATED_EFFECT);
  const eventWindow = getLinkedEventWindow(context);
  if (!eventWindow) return [];

  return (linkedPropagatedEffects ?? []).map((effect, index) =>
    createStageResponseFromRule(rule, {
      stage: createStage({
        ...getCatalogStage(STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT),
        status: STAGE_STATUSES.ENABLED,
        metadata: {
          ...(rule?.response?.metadataTemplate ?? {}),
          eventWindow,
          propagatedEffect: effect,
          sourceContext: {
            cycleId: context.cycleId ?? session.cycle?.id ?? 0,
            poolKey: context.poolKey ?? null,
            stageId: context.stageId ?? null,
            stageKey: context.stageKey ?? null,
            stageCatalogId: context.stageCatalogId ?? null,
            recipeKey: context.recipeKey ?? null
          }
        }
      }),
      eventWindow,
      responseMetadata: {
        reason: RECIPE_KEYS.LINKED_PROPAGATED_EFFECT,
        index,
        causedBy: effect.causedBy ?? null,
        derivedFrom: effect.derivedFrom ?? null,
        causalCondition: effect.causalCondition ?? null,
        targetId: effect.targetId ?? null
      }
    })
  );
}

function getLinkedTargetRecognitionResponses({
  session = {},
  actionResult = {},
  context = {}
} = {}) {
  const rule = getCatalogEventRule(EVENT_RULE_KEYS.LINKED_TARGET_RECOGNITION);
  const eventWindow = getLinkedEventWindow(context);
  if (!eventWindow) return [];

  return (actionResult.finalEffects ?? [])
    .filter((effect) => effect?.type === EFFECT_TYPES.SET_GROUP && effect.groupType === GROUP_TYPES.LINKED)
    .map((effect) => findGroupCreatedBySetGroupEffect(session, effect))
    .filter((group) => group && (group.roleIds ?? []).length > 0)
    .map((group) => {
      const memberRoleIds = [...(group.roleIds ?? [])];

      return createStageResponseFromRule(rule, {
        stage: createStage({
          ...getCatalogStage(STAGE_CATALOG_IDS.LINKED_TARGET_RECOGNITION, {
            actorIds: memberRoleIds
          }),
          status: STAGE_STATUSES.ENABLED,
          metadata: {
            ...(rule?.response?.metadataTemplate ?? {}),
            eventWindow,
            audienceRoleIds: memberRoleIds,
            causedBy: {
              recipeKey: context.recipeKey ?? null,
              actionId: actionResult.actionId ?? null,
              actorIds: [...(actionResult.actorIds ?? [])],
              groupId: group.id
            },
            derivedFrom: {
              type: MECHANICAL_ENTITY_TYPES.GROUP,
              id: group.id,
              groupType: group.type ?? null,
              sourceActionId: group.sourceActionId ?? null
            },
            reveals: {
              groupId: group.id,
              memberRoleIds
            }
          }
        }),
        eventWindow,
        responseMetadata: {
          eventWindow,
          groupId: group.id,
          audienceRoleIds: memberRoleIds
        }
      });
    });
}

function applyLinkedEventResponses({ session = {}, responses = [] } = {}) {
  return applyCatalogEventResponses(session, responses);
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

// Punto de entrada para stageModel.
//
// Recibe el resultado de una accion/receta ya resuelta, crea eventos desde sus
// efectos finales, activa reacciones compatibles y devuelve la sesion con los
// stages de interPoolQueue anadidos.
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
  const revealResponses = getRoleStateRevealEventResponses({ session, events });
  const sessionWithRevealResponses = applyRoleStateRevealEventResponses({
    session,
    responses: revealResponses
  });
  const triggeredReactions = getTriggeredReactions({ session, events });
  const responses = resolveEventResponses({ session, triggeredReactions });
  const sessionWithRoleResponses = applyEventResponses({
    session: sessionWithRevealResponses,
    responses
  });
  const linkedResponses = [
    ...getLinkedPropagatedEffectResponses({
      session: sessionWithRoleResponses,
      linkedPropagatedEffects: actionResult.linkedPropagatedEffects ?? [],
      context
    }),
    ...getLinkedTargetRecognitionResponses({
      session: sessionWithRoleResponses,
      actionResult,
      context
    })
  ];
  const sessionWithLinkedResponses = applyLinkedEventResponses({
    session: sessionWithRoleResponses,
    responses: linkedResponses
  });
  const doubleSelectorResponses = getDoubleSelectorEventResponses({
    session: sessionWithLinkedResponses,
    events
  });

  return {
    session: applyCatalogEventResponses(sessionWithLinkedResponses, doubleSelectorResponses),
    events,
    triggeredReactions,
    responses: [...revealResponses, ...responses, ...linkedResponses, ...doubleSelectorResponses]
  };
}

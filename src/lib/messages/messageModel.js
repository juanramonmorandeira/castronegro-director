import {
  MESSAGE_AUDIENCE_TYPES,
  MESSAGE_ENTITY_TYPES,
  MESSAGE_SEVERITIES,
  MESSAGE_TYPES,
  createEntityReference,
  createMessage
} from './messageDefinition.js';
import { MESSAGE_KEYS } from './messageCatalog.js';

function getDiagnosticKey(error = {}) {
  if (error.code === 'group/missing-role' || error.code === 'group/missing-key') {
    return MESSAGE_KEYS.MISSING_GROUP;
  }
  if (String(error.code ?? '').startsWith('stage/')) return MESSAGE_KEYS.INVALID_STAGE;
  if (error.code === 'action/unsupported') return MESSAGE_KEYS.UNKNOWN_ACTION;
  return MESSAGE_KEYS.DOMAIN_OPERATION_FAILED;
}

function getMessageContext(session = {}, context = {}) {
  return {
    sessionId: session.id ?? null,
    cycleId: context.cycleId ?? session.cycle?.id ?? null,
    poolKey: context.poolKey ?? session.cycle?.poolCurrent ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    recipeKey: context.actionKey ?? null,
    actionId: context.actionId ?? null,
    phase: context.phase ?? null
  };
}

export function createMessageFromEngineError({ session = {}, error = {}, context = {} } = {}) {
  const messageContext = getMessageContext(session, context);

  if (error.code === 'constraint/limited_uses') {
    const actorId = error.actorIds?.[0] ?? null;
    const resourceKey = error.actionKey ?? 'unknown_resource';

    return createMessage({
      type: MESSAGE_TYPES.GAMEPLAY,
      key: MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED,
      severity: MESSAGE_SEVERITIES.WARNING,
      audience: {
        type: MESSAGE_AUDIENCE_TYPES.ROLE,
        ids: actorId ? [actorId] : []
      },
      params: {
        actor: createEntityReference(MESSAGE_ENTITY_TYPES.ROLE, actorId ?? 'unknown_role'),
        resource: createEntityReference(MESSAGE_ENTITY_TYPES.RESOURCE, resourceKey),
        limit: error.limit,
        used: error.used,
        window: error.window
      },
      context: messageContext,
      metadata: {
        engineCode: error.code
      }
    });
  }

  const key = getDiagnosticKey(error);
  return createMessage({
    type: MESSAGE_TYPES.DIAGNOSTIC,
    key,
    severity: error.severity ?? MESSAGE_SEVERITIES.ERROR,
    audience: {
      type: MESSAGE_AUDIENCE_TYPES.SYSTEM,
      ids: []
    },
    params: {
      code: error.code ?? 'unknown',
      technicalMessage: error.message ?? null,
      groupId: error.groupId ?? error.groupKey ?? null,
      actionId: error.actionId ?? context.actionId ?? null
    },
    context: messageContext,
    metadata: {
      engineError: { ...error }
    }
  });
}

export function createMessagesFromEngineErrors({ session = {}, errors = [], context = {} } = {}) {
  return (errors ?? []).map((error) =>
    createMessageFromEngineError({ session, error, context })
  );
}

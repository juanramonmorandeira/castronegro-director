// queueModel.js
// -----------------------------------------------------------------------------
// Administra la cola FIFO de stages dinamicos que se ejecutan entre pools.
//
// No es un pool:
// - no se prepara;
// - no se ordena;
// - no tiene onEnter/onExit de pool;
// - el stage completado se elimina de la cola.
// -----------------------------------------------------------------------------

import {
  HISTORY_COLLECTIONS,
  appendEntry,
  getHistoryCollection
} from './historyModel.js';
import { assignUniqueStageIds, createStage } from './stageDefinition.js';
import { CURRENT_STAGE_SOURCES } from './sessionModel.js';
import {
  QUEUE_ERRORS,
  QUEUE_HISTORY_OPERATIONS
} from './queueDefinition.js';
import { DEFAULT_QUEUE_ORDER, isValidQueueKey } from './queueCatalog.js';

export {
  QUEUE_ERRORS,
  QUEUE_HISTORY_OPERATIONS
} from './queueDefinition.js';
export { QUEUE_KEYS, isValidQueueKey } from './queueCatalog.js';

export function getQueues(session = {}) {
  const sourceQueues = session?.queues ?? {};

  return [...new Set([...DEFAULT_QUEUE_ORDER, ...Object.keys(sourceQueues)])].reduce((queues, queueKey) => {
    queues[queueKey] = Array.isArray(sourceQueues?.[queueKey])
      ? [...sourceQueues[queueKey]]
      : [];
    return queues;
  }, {});
}

export function getQueue(session = {}, queueKey = null) {
  const queues = getQueues(session);
  if (queueKey) return queues[queueKey] ?? [];
  return Object.values(queues).flatMap((stages) => stages ?? []);
}

export function hasPendingQueueStages(session = {}) {
  return getQueue(session).length > 0;
}

export function getQueueStages(session = {}, queueKey = null) {
  if (!isValidQueueKey(queueKey)) return [];
  return getQueue(session, queueKey);
}

export function getCurrentQueueStage(session = {}) {
  if (session?.currentQueueKey) {
    return getCurrentQueueStageByKey(session, session.currentQueueKey);
  }

  return getQueue(session)[0] ?? null;
}

export function getCurrentQueueStageByKey(session = {}, queueKey = null) {
  return getQueueStages(session, queueKey)[0] ?? null;
}

function getInvalidQueueErrors(session = {}) {
  return getQueue(session).flatMap((stage) => {
    const queueKey = stage.metadata?.queueKey ?? null;

    if (!queueKey) {
      return [
        {
          code: QUEUE_ERRORS.MISSING_QUEUE_KEY,
          message: 'queueStage is missing queueKey',
          stageId: stage.id ?? null,
          stageKey: stage.key ?? null
        }
      ];
    }

    if (!isValidQueueKey(queueKey)) {
      return [
        {
          code: QUEUE_ERRORS.INVALID_QUEUE_KEY,
          message: 'queueStage has invalid queueKey',
          stageId: stage.id ?? null,
          stageKey: stage.key ?? null,
          queueKey
        }
      ];
    }

    return [];
  });
}

function appendQueueValidationFailures(session = {}, errors = []) {
  return (errors ?? []).reduce(
    (currentSession, error) =>
      appendQueueHistory(currentSession, {
        stageId: error.stageId ?? null,
        stageKey: error.stageKey ?? null,
        operation: QUEUE_HISTORY_OPERATIONS.FAILED,
        metadata: {
          error
        }
      }),
    session
  );
}

export function appendQueueHistory(session, entry = {}) {
  const normalizedEntry = {
    cycleId: entry.cycleId ?? session?.cycle?.id ?? 0,
    queueKey: entry.metadata?.queueKey ?? entry.queueKey ?? null,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    event: entry.operation ?? entry.event ?? null,
    payload: {
      stageId: entry.stageId ?? null,
      stageKey: entry.stageKey ?? null,
      operation: entry.operation ?? entry.event ?? null
    },
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, HISTORY_COLLECTIONS.QUEUE, normalizedEntry, {
    getId: (item, history) =>
      `queue-${item.payload.stageKey ?? 'stage'}-${item.event ?? 'event'}-${history.length}`
  });
}

export function appendQueueStage(session, stage, metadata = {}) {
  const queueKey = metadata.queueKey ?? stage?.metadata?.queueKey ?? null;
  const historicalStageIds = getHistoryCollection(session, HISTORY_COLLECTIONS.QUEUE)
    .map((entry) => entry.metadata?.context?.stageId ?? entry.payload?.stageId)
    .filter(Boolean)
    .map((id) => ({ id }));
  const normalizedStage = assignUniqueStageIds([
    ...historicalStageIds,
    ...getQueue(session),
    createStage({
      ...stage,
      metadata: {
        ...(stage?.metadata ?? {}),
        ...(queueKey ? { queueKey } : {})
      }
    })
  ]).at(-1);
  const queues = getQueues(session);
  const nextSession = {
    ...session,
    queues: {
      ...queues,
      [queueKey]: [...(queues[queueKey] ?? []), normalizedStage]
    }
  };

  return appendQueueHistory(nextSession, {
    stageId: normalizedStage?.id ?? null,
    stageKey: normalizedStage?.key ?? null,
    operation: QUEUE_HISTORY_OPERATIONS.QUEUED,
    metadata
  });
}

const QUEUE_LIFECYCLE_OPERATIONS = Object.freeze({
  START: 'start',
  FINISH: 'finish'
});

function createQueueState({
  session = {},
  operation,
  queueKey = null,
  metadata = {},
  requireQueueKey = false
} = {}) {
  return {
    session,
    operation,
    queueKey,
    metadata,
    requireQueueKey,
    errors: [],
    stage: null,
    nextStage: null
  };
}

function getQueueKeyErrors({ session = {}, queueKey = null, operation }) {
  const messagePrefix = operation === QUEUE_LIFECYCLE_OPERATIONS.FINISH
    ? 'cannot complete queueStage'
    : 'cannot start queue';
  const queueKeyError = isValidQueueKey(queueKey)
    ? null
    : {
        code: QUEUE_ERRORS.INVALID_QUEUE_KEY,
        message: `${messagePrefix} for an invalid queueKey`,
        queueKey
      };

  return queueKeyError ? [queueKeyError] : getInvalidQueueErrors(session);
}

function evaluateQueue(state = {}) {
  if (state.requireQueueKey) {
    const errors = getQueueKeyErrors(state);
    if (errors.length > 0) {
      return {
        ...state,
        errors
      };
    }
  }

  const stage = state.requireQueueKey
    ? getCurrentQueueStageByKey(state.session, state.queueKey)
    : getCurrentQueueStage(state.session);

  return {
    ...state,
    stage
  };
}

function resolveQueueStart(state = {}) {
  if (!state.stage) return state;
  if (
    state.session?.currentStageSource === CURRENT_STAGE_SOURCES.QUEUE &&
    (!state.requireQueueKey || state.session?.currentQueueKey === state.queueKey)
  ) {
    return state;
  }

  const nextSession = {
    ...state.session,
    currentStageSource: CURRENT_STAGE_SOURCES.QUEUE,
    currentQueueKey: state.requireQueueKey ? state.queueKey : null
  };

  return {
    ...state,
    session: appendQueueHistory(nextSession, {
      stageId: state.stage?.id ?? null,
      stageKey: state.stage?.key ?? null,
      operation: QUEUE_HISTORY_OPERATIONS.STARTED,
      metadata: state.requireQueueKey ? { queueKey: state.queueKey } : {}
    })
  };
}

function resolveQueueFinish(state = {}) {
  if (!state.stage) {
    return {
      ...state,
      session: {
        ...state.session,
        currentStageSource: CURRENT_STAGE_SOURCES.POOL,
        currentQueueKey: null
      }
    };
  }

  const queues = getQueues(state.session);
  const activeQueueKey = state.requireQueueKey
    ? state.queueKey
    : state.stage.metadata?.queueKey ?? null;
  const remainingQueueStages = (queues[activeQueueKey] ?? []).filter((stage) => stage.id !== state.stage.id);
  const nextQueues = {
    ...queues,
    [activeQueueKey]: remainingQueueStages
  };
  const nextStage = state.requireQueueKey
    ? remainingQueueStages[0] ?? null
    : DEFAULT_QUEUE_ORDER.flatMap((queueKey) => nextQueues[queueKey] ?? [])[0] ?? null;
  const nextSession = {
    ...state.session,
    queues: nextQueues,
    currentStageSource: nextStage
      ? CURRENT_STAGE_SOURCES.QUEUE
      : CURRENT_STAGE_SOURCES.POOL,
    currentQueueKey: nextStage && state.requireQueueKey ? state.queueKey : null
  };
  const completedSession = appendQueueHistory(nextSession, {
    stageId: state.stage.id,
    stageKey: state.stage.key,
    operation: QUEUE_HISTORY_OPERATIONS.COMPLETED,
    metadata: {
      ...state.metadata,
      ...(state.requireQueueKey ? { queueKey: state.queueKey } : {})
    }
  });
  const sessionWithNextStarted = nextStage
    ? appendQueueHistory(completedSession, {
        stageId: nextStage.id,
        stageKey: nextStage.key,
        operation: QUEUE_HISTORY_OPERATIONS.STARTED,
        metadata: state.requireQueueKey ? { queueKey: state.queueKey } : {}
      })
    : completedSession;

  return {
    session: sessionWithNextStarted,
    stage: state.stage,
    nextStage
  };
}

function resolveQueue(state = {}) {
  if ((state.errors ?? []).length > 0) return state;
  if (state.operation === QUEUE_LIFECYCLE_OPERATIONS.START) {
    return resolveQueueStart(state);
  }
  if (state.operation === QUEUE_LIFECYCLE_OPERATIONS.FINISH) {
    return resolveQueueFinish(state);
  }
  return state;
}

function validateQueueOutcome(state = {}) {
  const errors = state.errors ?? [];
  return {
    ...state,
    ok: errors.length === 0,
    session: errors.length > 0
      ? appendQueueValidationFailures(state.session, errors)
      : state.session
  };
}

function finishQueue(state = {}) {
  return {
    ok: state.ok ?? false,
    errors: state.errors ?? [],
    session: state.session,
    stage: state.stage ?? null,
    nextStage: state.nextStage ?? null
  };
}

function runQueueLifecycle(options = {}) {
  return finishQueue(
    validateQueueOutcome(
      resolveQueue(
        evaluateQueue(
          createQueueState(options)
        )
      )
    )
  );
}

export function startQueue(session) {
  if (!hasPendingQueueStages(session)) return session;
  return runQueueLifecycle({
    session,
    operation: QUEUE_LIFECYCLE_OPERATIONS.START
  }).session;
}

export function startQueueByKey(session = {}, queueKey = null) {
  const result = runQueueLifecycle({
    session,
    operation: QUEUE_LIFECYCLE_OPERATIONS.START,
    queueKey,
    requireQueueKey: true
  });

  return {
    ok: result.ok,
    errors: result.errors,
    session: result.session,
    stage: result.stage
  };
}

export function completeQueueStage(session, metadata = {}) {
  return runQueueLifecycle({
    session,
    operation: QUEUE_LIFECYCLE_OPERATIONS.FINISH,
    queueKey: session?.currentQueueKey ?? null,
    metadata,
    requireQueueKey: Boolean(session?.currentQueueKey)
  }).session;
}

export function completeQueueStageByKey(session = {}, queueKey = null, metadata = {}) {
  return runQueueLifecycle({
    session,
    operation: QUEUE_LIFECYCLE_OPERATIONS.FINISH,
    queueKey,
    metadata,
    requireQueueKey: true
  });
}

export function removeQueueStages(session = {}, predicate = () => false, metadata = {}) {
  const removedStages = getQueue(session).filter(predicate);
  if (removedStages.length === 0) {
    return {
      session,
      removedStages
    };
  }

  const queues = getQueues(session);
  const nextQueues = Object.fromEntries(
    Object.entries(queues).map(([queueKey, stages]) => [
      queueKey,
      stages.filter((stage) => !predicate(stage))
    ])
  );
  const nextSession = {
    ...session,
    queues: nextQueues,
    currentStageSource:
      session.currentStageSource === CURRENT_STAGE_SOURCES.QUEUE && getQueue({ queues: nextQueues }).length === 0
        ? CURRENT_STAGE_SOURCES.POOL
        : session.currentStageSource
  };

  return {
    session: removedStages.reduce(
      (currentSession, stage) =>
        appendQueueHistory(currentSession, {
          stageId: stage.id,
          stageKey: stage.key,
          operation: QUEUE_HISTORY_OPERATIONS.CANCELED,
          metadata
        }),
      nextSession
    ),
    removedStages
  };
}

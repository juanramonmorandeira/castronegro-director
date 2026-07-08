// interPoolQueueModel.js
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
  INTER_POOL_QUEUE_ERRORS,
  INTER_POOL_QUEUE_HISTORY_OPERATIONS,
  isValidInterPoolQueueEventWindow
} from './interPoolQueueDefinition.js';

export {
  INTER_POOL_QUEUE_ERRORS,
  INTER_POOL_QUEUE_EVENT_WINDOWS,
  INTER_POOL_QUEUE_HISTORY_OPERATIONS,
  isValidInterPoolQueueEventWindow
} from './interPoolQueueDefinition.js';

export function getInterPoolQueue(session = {}) {
  return Array.isArray(session?.interPoolQueue) ? session.interPoolQueue : [];
}

export function hasPendingInterPoolStages(session = {}) {
  return getInterPoolQueue(session).length > 0;
}

export function getInterPoolStagesForWindow(session = {}, eventWindow = null) {
  if (!isValidInterPoolQueueEventWindow(eventWindow)) return [];
  return getInterPoolQueue(session).filter((stage) => stage.metadata?.eventWindow === eventWindow);
}

export function getCurrentInterPoolStage(session = {}) {
  if (session?.currentInterPoolWindow) {
    return getCurrentInterPoolStageForWindow(session, session.currentInterPoolWindow);
  }

  return getInterPoolQueue(session)[0] ?? null;
}

export function getCurrentInterPoolStageForWindow(session = {}, eventWindow = null) {
  return getInterPoolStagesForWindow(session, eventWindow)[0] ?? null;
}

function getInvalidWindowErrors(session = {}) {
  return getInterPoolQueue(session).flatMap((stage) => {
    const eventWindow = stage.metadata?.eventWindow ?? null;

    if (!eventWindow) {
      return [
        {
          code: INTER_POOL_QUEUE_ERRORS.MISSING_EVENT_WINDOW,
          message: 'interPoolStage is missing eventWindow',
          stageId: stage.id ?? null,
          stageKey: stage.key ?? null
        }
      ];
    }

    if (!isValidInterPoolQueueEventWindow(eventWindow)) {
      return [
        {
          code: INTER_POOL_QUEUE_ERRORS.INVALID_EVENT_WINDOW,
          message: 'interPoolStage has invalid eventWindow',
          stageId: stage.id ?? null,
          stageKey: stage.key ?? null,
          eventWindow
        }
      ];
    }

    return [];
  });
}

function appendWindowValidationFailures(session = {}, errors = []) {
  return (errors ?? []).reduce(
    (currentSession, error) =>
      appendInterPoolQueueHistory(currentSession, {
        stageId: error.stageId ?? null,
        stageKey: error.stageKey ?? null,
        operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.FAILED,
        metadata: {
          error
        }
      }),
    session
  );
}

export function appendInterPoolQueueHistory(session, entry = {}) {
  const normalizedEntry = {
    cycleId: entry.cycleId ?? session?.cycle?.id ?? 0,
    eventWindow: entry.metadata?.eventWindow ?? entry.eventWindow ?? null,
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

  return appendEntry(session, HISTORY_COLLECTIONS.INTER_POOL_QUEUE, normalizedEntry, {
    getId: (item, history) =>
      `inter-pool-queue-${item.payload.stageKey ?? 'stage'}-${item.event ?? 'event'}-${history.length}`
  });
}

export function appendInterPoolStage(session, stage, metadata = {}) {
  const historicalStageIds = getHistoryCollection(session, HISTORY_COLLECTIONS.INTER_POOL_QUEUE)
    .map((entry) => entry.metadata?.context?.stageId ?? entry.payload?.stageId)
    .filter(Boolean)
    .map((id) => ({ id }));
  const normalizedStage = assignUniqueStageIds([
    ...historicalStageIds,
    ...getInterPoolQueue(session),
    createStage(stage)
  ]).at(-1);
  const nextSession = {
    ...session,
    interPoolQueue: [...getInterPoolQueue(session), normalizedStage]
  };

  return appendInterPoolQueueHistory(nextSession, {
    stageId: normalizedStage?.id ?? null,
    stageKey: normalizedStage?.key ?? null,
    operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.QUEUED,
    metadata
  });
}

const INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS = Object.freeze({
  START: 'start',
  FINISH: 'finish'
});

function startQueue({
  session = {},
  operation,
  eventWindow = null,
  metadata = {},
  requireEventWindow = false
} = {}) {
  return {
    session,
    operation,
    eventWindow,
    metadata,
    requireEventWindow,
    errors: [],
    stage: null,
    nextStage: null
  };
}

function getInterPoolQueueWindowErrors({ session = {}, eventWindow = null, operation }) {
  const messagePrefix = operation === INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.FINISH
    ? 'cannot complete interPoolStage'
    : 'cannot start interPoolQueue';
  const eventWindowError = isValidInterPoolQueueEventWindow(eventWindow)
    ? null
    : {
        code: INTER_POOL_QUEUE_ERRORS.INVALID_EVENT_WINDOW,
        message: `${messagePrefix} for an invalid eventWindow`,
        eventWindow
      };

  return eventWindowError ? [eventWindowError] : getInvalidWindowErrors(session);
}

function evaluateQueue(state = {}) {
  if (state.requireEventWindow) {
    const errors = getInterPoolQueueWindowErrors(state);
    if (errors.length > 0) {
      return {
        ...state,
        errors
      };
    }
  }

  const stage = state.requireEventWindow
    ? getCurrentInterPoolStageForWindow(state.session, state.eventWindow)
    : getCurrentInterPoolStage(state.session);

  return {
    ...state,
    stage
  };
}

function resolveQueueStart(state = {}) {
  if (!state.stage) return state;
  if (
    state.session?.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE &&
    (!state.requireEventWindow || state.session?.currentInterPoolWindow === state.eventWindow)
  ) {
    return state;
  }

  const nextSession = {
    ...state.session,
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    currentInterPoolWindow: state.requireEventWindow ? state.eventWindow : null
  };

  return {
    ...state,
    session: appendInterPoolQueueHistory(nextSession, {
      stageId: state.stage?.id ?? null,
      stageKey: state.stage?.key ?? null,
      operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED,
      metadata: state.requireEventWindow ? { eventWindow: state.eventWindow } : {}
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
        currentInterPoolWindow: null
      }
    };
  }

  const remainingStages = getInterPoolQueue(state.session).filter((stage) => stage.id !== state.stage.id);
  const nextStage = state.requireEventWindow
    ? remainingStages.find((stage) => stage.metadata?.eventWindow === state.eventWindow) ?? null
    : remainingStages[0] ?? null;
  const nextSession = {
    ...state.session,
    interPoolQueue: remainingStages,
    currentStageSource: nextStage
      ? CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      : CURRENT_STAGE_SOURCES.POOL,
    currentInterPoolWindow: nextStage && state.requireEventWindow ? state.eventWindow : null
  };
  const completedSession = appendInterPoolQueueHistory(nextSession, {
    stageId: state.stage.id,
    stageKey: state.stage.key,
    operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.COMPLETED,
    metadata: {
      ...state.metadata,
      ...(state.requireEventWindow ? { eventWindow: state.eventWindow } : {})
    }
  });
  const sessionWithNextStarted = nextStage
    ? appendInterPoolQueueHistory(completedSession, {
        stageId: nextStage.id,
        stageKey: nextStage.key,
        operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED,
        metadata: state.requireEventWindow ? { eventWindow: state.eventWindow } : {}
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
  if (state.operation === INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.START) {
    return resolveQueueStart(state);
  }
  if (state.operation === INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.FINISH) {
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
      ? appendWindowValidationFailures(state.session, errors)
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
          startQueue(options)
        )
      )
    )
  );
}

export function startInterPoolQueue(session) {
  if (!hasPendingInterPoolStages(session)) return session;
  return runQueueLifecycle({
    session,
    operation: INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.START
  }).session;
}

export function startInterPoolQueueForWindow(session = {}, eventWindow = null) {
  const result = runQueueLifecycle({
    session,
    operation: INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.START,
    eventWindow,
    requireEventWindow: true
  });

  return {
    ok: result.ok,
    errors: result.errors,
    session: result.session,
    stage: result.stage
  };
}

export function completeInterPoolStage(session, metadata = {}) {
  return runQueueLifecycle({
    session,
    operation: INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.FINISH,
    eventWindow: session?.currentInterPoolWindow ?? null,
    metadata,
    requireEventWindow: Boolean(session?.currentInterPoolWindow)
  }).session;
}

export function completeInterPoolStageForWindow(session = {}, eventWindow = null, metadata = {}) {
  return runQueueLifecycle({
    session,
    operation: INTER_POOL_QUEUE_LIFECYCLE_OPERATIONS.FINISH,
    eventWindow,
    metadata,
    requireEventWindow: true
  });
}

export function removeInterPoolStages(session = {}, predicate = () => false, metadata = {}) {
  const removedStages = getInterPoolQueue(session).filter(predicate);
  if (removedStages.length === 0) {
    return {
      session,
      removedStages
    };
  }

  const remainingStages = getInterPoolQueue(session).filter((stage) => !predicate(stage));
  const nextSession = {
    ...session,
    interPoolQueue: remainingStages,
    currentStageSource:
      session.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE && remainingStages.length === 0
        ? CURRENT_STAGE_SOURCES.POOL
        : session.currentStageSource
  };

  return {
    session: removedStages.reduce(
      (currentSession, stage) =>
        appendInterPoolQueueHistory(currentSession, {
          stageId: stage.id,
          stageKey: stage.key,
          operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.CANCELED,
          metadata
        }),
      nextSession
    ),
    removedStages
  };
}

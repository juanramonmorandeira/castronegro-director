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

export function startInterPoolQueue(session) {
  if (!hasPendingInterPoolStages(session)) return session;
  if (session?.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) return session;
  const nextSession = {
    ...session,
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
  };
  const stage = getCurrentInterPoolStage(nextSession);
  return appendInterPoolQueueHistory(nextSession, {
    stageId: stage?.id ?? null,
    stageKey: stage?.key ?? null,
    operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED
  });
}

export function startInterPoolQueueForWindow(session = {}, eventWindow = null) {
  const eventWindowError = isValidInterPoolQueueEventWindow(eventWindow)
    ? null
    : {
        code: INTER_POOL_QUEUE_ERRORS.INVALID_EVENT_WINDOW,
        message: 'cannot start interPoolQueue for an invalid eventWindow',
        eventWindow
      };
  const windowErrors = eventWindowError ? [eventWindowError] : getInvalidWindowErrors(session);

  if (windowErrors.length > 0) {
    return {
      ok: false,
      errors: windowErrors,
      session: appendWindowValidationFailures(session, windowErrors),
      stage: null
    };
  }

  const stage = getCurrentInterPoolStageForWindow(session, eventWindow);
  if (!stage) {
    return {
      ok: true,
      errors: [],
      session,
      stage: null
    };
  }

  if (
    session?.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE &&
    session?.currentInterPoolWindow === eventWindow
  ) {
    return {
      ok: true,
      errors: [],
      session,
      stage
    };
  }

  const nextSession = {
    ...session,
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    currentInterPoolWindow: eventWindow
  };

  return {
    ok: true,
    errors: [],
    session: appendInterPoolQueueHistory(nextSession, {
      stageId: stage?.id ?? null,
      stageKey: stage?.key ?? null,
      operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED,
      metadata: { eventWindow }
    }),
    stage
  };
}

export function completeInterPoolStage(session, metadata = {}) {
  if (session?.currentInterPoolWindow) {
    return completeInterPoolStageForWindow(session, session.currentInterPoolWindow, metadata).session;
  }

  const currentStage = getCurrentInterPoolStage(session);
  if (!currentStage) return session;

  const nextSession = {
    ...session,
    interPoolQueue: getInterPoolQueue(session).slice(1),
    currentStageSource:
      getInterPoolQueue(session).length > 1
        ? CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
        : CURRENT_STAGE_SOURCES.POOL
  };

  const completedSession = appendInterPoolQueueHistory(nextSession, {
    stageId: currentStage.id,
    stageKey: currentStage.key,
    operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.COMPLETED,
    metadata
  });
  const nextStage = getCurrentInterPoolStage(completedSession);

  return nextStage
    ? appendInterPoolQueueHistory(completedSession, {
        stageId: nextStage.id,
        stageKey: nextStage.key,
        operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED
      })
    : completedSession;
}

export function completeInterPoolStageForWindow(session = {}, eventWindow = null, metadata = {}) {
  const eventWindowError = isValidInterPoolQueueEventWindow(eventWindow)
    ? null
    : {
        code: INTER_POOL_QUEUE_ERRORS.INVALID_EVENT_WINDOW,
        message: 'cannot complete interPoolStage for an invalid eventWindow',
        eventWindow
      };
  const windowErrors = eventWindowError ? [eventWindowError] : getInvalidWindowErrors(session);

  if (windowErrors.length > 0) {
    return {
      ok: false,
      errors: windowErrors,
      session: appendWindowValidationFailures(session, windowErrors),
      stage: null,
      nextStage: null
    };
  }

  const currentStage = getCurrentInterPoolStageForWindow(session, eventWindow);
  if (!currentStage) {
    return {
      ok: true,
      errors: [],
      session: {
        ...session,
        currentStageSource: CURRENT_STAGE_SOURCES.POOL,
        currentInterPoolWindow: null
      },
      stage: null,
      nextStage: null
    };
  }

  const remainingStages = getInterPoolQueue(session).filter((stage) => stage.id !== currentStage.id);
  const nextStage = remainingStages.find((stage) => stage.metadata?.eventWindow === eventWindow) ?? null;
  const nextSession = {
    ...session,
    interPoolQueue: remainingStages,
    currentStageSource: nextStage
      ? CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      : CURRENT_STAGE_SOURCES.POOL,
    currentInterPoolWindow: nextStage ? eventWindow : null
  };
  const completedSession = appendInterPoolQueueHistory(nextSession, {
    stageId: currentStage.id,
    stageKey: currentStage.key,
    operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.COMPLETED,
    metadata: {
      ...metadata,
      eventWindow
    }
  });
  const sessionWithNextStarted = nextStage
    ? appendInterPoolQueueHistory(completedSession, {
        stageId: nextStage.id,
        stageKey: nextStage.key,
        operation: INTER_POOL_QUEUE_HISTORY_OPERATIONS.STARTED,
        metadata: { eventWindow }
      })
    : completedSession;

  return {
    ok: true,
    errors: [],
    session: sessionWithNextStarted,
    stage: currentStage,
    nextStage
  };
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

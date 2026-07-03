// specialStagesModel.js
// -----------------------------------------------------------------------------
// Administra la cola FIFO de stages dinamicos que se ejecutan entre pools.
//
// No es un pool:
// - no se prepara;
// - no se ordena;
// - no tiene onEnter/onExit de pool;
// - el stage completado se elimina de la cola.
// -----------------------------------------------------------------------------

import { appendEntry } from './historyModel.js';
import { assignUniqueStageIds, createStage } from './stageDefinition.js';
import { CURRENT_STAGE_SOURCES } from './sessionModel.js';

export const SPECIAL_STAGE_HISTORY_OPERATIONS = Object.freeze({
  QUEUED: 'queued',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  FAILED: 'failed'
});

export const SPECIAL_STAGE_EVENT_WINDOWS = Object.freeze({
  BEFORE_CONCEALED: 'before_concealed',
  AFTER_CONCEALED: 'after_concealed',
  BEFORE_EXPOSED: 'before_exposed',
  AFTER_EXPOSED: 'after_exposed'
});

export function getSpecialStages(session = {}) {
  return Array.isArray(session?.specialStages) ? session.specialStages : [];
}

export function hasPendingSpecialStages(session = {}) {
  return getSpecialStages(session).length > 0;
}

export function getCurrentSpecialStage(session = {}) {
  return getSpecialStages(session)[0] ?? null;
}

export function appendSpecialStagesHistory(session, entry = {}) {
  const normalizedEntry = {
    cycleId: entry.cycleId ?? session?.cycle?.id ?? 0,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    operation: entry.operation ?? null,
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'specialStagesHistory', normalizedEntry, {
    getId: (item, history) =>
      `special-stage-${item.stageKey ?? 'stage'}-${item.operation ?? 'event'}-${history.length}`
  });
}

export function appendSpecialStage(session, stage, metadata = {}) {
  const historicalStageIds = (session?.specialStagesHistory ?? [])
    .map((entry) => entry.stageId)
    .filter(Boolean)
    .map((id) => ({ id }));
  const normalizedStage = assignUniqueStageIds([
    ...historicalStageIds,
    ...getSpecialStages(session),
    createStage(stage)
  ]).at(-1);
  const nextSession = {
    ...session,
    specialStages: [...getSpecialStages(session), normalizedStage]
  };

  return appendSpecialStagesHistory(nextSession, {
    stageId: normalizedStage?.id ?? null,
    stageKey: normalizedStage?.key ?? null,
    operation: SPECIAL_STAGE_HISTORY_OPERATIONS.QUEUED,
    metadata
  });
}

export function startSpecialStages(session) {
  if (!hasPendingSpecialStages(session)) return session;
  if (session?.currentStageSource === CURRENT_STAGE_SOURCES.SPECIAL_STAGES) return session;
  const nextSession = {
    ...session,
    currentStageSource: CURRENT_STAGE_SOURCES.SPECIAL_STAGES
  };
  const stage = getCurrentSpecialStage(nextSession);
  return appendSpecialStagesHistory(nextSession, {
    stageId: stage?.id ?? null,
    stageKey: stage?.key ?? null,
    operation: SPECIAL_STAGE_HISTORY_OPERATIONS.STARTED
  });
}

export function completeSpecialStage(session, metadata = {}) {
  const currentStage = getCurrentSpecialStage(session);
  if (!currentStage) return session;

  const nextSession = {
    ...session,
    specialStages: getSpecialStages(session).slice(1),
    currentStageSource:
      getSpecialStages(session).length > 1
        ? CURRENT_STAGE_SOURCES.SPECIAL_STAGES
        : CURRENT_STAGE_SOURCES.POOL
  };

  const completedSession = appendSpecialStagesHistory(nextSession, {
    stageId: currentStage.id,
    stageKey: currentStage.key,
    operation: SPECIAL_STAGE_HISTORY_OPERATIONS.COMPLETED,
    metadata
  });
  const nextStage = getCurrentSpecialStage(completedSession);

  return nextStage
    ? appendSpecialStagesHistory(completedSession, {
        stageId: nextStage.id,
        stageKey: nextStage.key,
        operation: SPECIAL_STAGE_HISTORY_OPERATIONS.STARTED
      })
    : completedSession;
}

export function removeSpecialStages(session = {}, predicate = () => false, metadata = {}) {
  const removedStages = getSpecialStages(session).filter(predicate);
  if (removedStages.length === 0) {
    return {
      session,
      removedStages
    };
  }

  const remainingStages = getSpecialStages(session).filter((stage) => !predicate(stage));
  const nextSession = {
    ...session,
    specialStages: remainingStages,
    currentStageSource:
      session.currentStageSource === CURRENT_STAGE_SOURCES.SPECIAL_STAGES && remainingStages.length === 0
        ? CURRENT_STAGE_SOURCES.POOL
        : session.currentStageSource
  };

  return {
    session: removedStages.reduce(
      (currentSession, stage) =>
        appendSpecialStagesHistory(currentSession, {
          stageId: stage.id,
          stageKey: stage.key,
          operation: SPECIAL_STAGE_HISTORY_OPERATIONS.CANCELED,
          metadata
        }),
      nextSession
    ),
    removedStages
  };
}

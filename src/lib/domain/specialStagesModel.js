// specialStagesModel.js
// -----------------------------------------------------------------------------
// Administra la cola FIFO de stages dinamicos que se ejecutan entre pools.
//
// No es un pool:
// - no se prepara;
// - no se ordena;
// - no tiene automaticStages;
// - el stage completado se elimina de la cola.
// -----------------------------------------------------------------------------

import { appendEntry } from './historyModel.js';

export const SPECIAL_STAGE_HISTORY_OPERATIONS = Object.freeze({
  QUEUED: 'queued',
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed'
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
    cycleId: entry.cycleId ?? session?.cycle?.id ?? session?.metadata?.currentCycleId ?? 0,
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
  const nextSession = {
    ...session,
    specialStages: [...getSpecialStages(session), stage]
  };

  return appendSpecialStagesHistory(nextSession, {
    stageKey: stage?.key ?? null,
    operation: SPECIAL_STAGE_HISTORY_OPERATIONS.QUEUED,
    metadata
  });
}

export function activateSpecialStages(session) {
  if (!hasPendingSpecialStages(session)) return session;
  if (session?.specialStagesActive) return session;
  const nextSession = {
    ...session,
    specialStagesActive: true
  };
  const stage = getCurrentSpecialStage(nextSession);
  return appendSpecialStagesHistory(nextSession, {
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
    specialStagesActive: getSpecialStages(session).length > 1
  };

  const completedSession = appendSpecialStagesHistory(nextSession, {
    stageKey: currentStage.key,
    operation: SPECIAL_STAGE_HISTORY_OPERATIONS.COMPLETED,
    metadata
  });
  const nextStage = getCurrentSpecialStage(completedSession);

  return nextStage
    ? appendSpecialStagesHistory(completedSession, {
        stageKey: nextStage.key,
        operation: SPECIAL_STAGE_HISTORY_OPERATIONS.STARTED
      })
    : completedSession;
}

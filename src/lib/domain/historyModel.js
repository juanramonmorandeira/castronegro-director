// historyModel.js
// -----------------------------------------------------------------------------

import { STAGE_COMPLETION_REQUESTED_BY } from './stageTypes.js';
// Este archivo centraliza la memoria mecanica de la sesion.
//
// recipeHistory vive dentro de la sesion porque cada partida tiene su propia
// historia. Este modelo no guarda nada fuera: solo crea, anade y consulta
// entradas de historial de forma consistente.
//
// Objetivo:
// - actionModel resuelve acciones;
// - historyModel registra que ocurrio;
// - otros modelos pueden consultar la sesion sin saber como se construyen las
//   entradas.
// -----------------------------------------------------------------------------

export const HISTORY_RESULTS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED: 'blocked',
  PARTIAL: 'partial',
  NO_EFFECT: 'no_effect',
  FAILED: 'failed'
});

export const HISTORY_COLLECTIONS = Object.freeze({
  CYCLE: 'cycleHistory',
  POOL: 'poolHistory',
  STAGE: 'stageHistory',
  QUEUE: 'queueHistory',
  RECIPE: 'recipeHistory'
});

const HISTORY_COLLECTION_NAMES = Object.freeze(Object.values(HISTORY_COLLECTIONS));

export const HISTORY_EVENTS = Object.freeze({
  STARTED: 'started',
  FINISHED: 'finished',
  RUNNING_ACTION: 'running_action'
});

export function createHistoryActor(actor = null) {
  if (actor?.authority) return { ...actor };
  return { authority: 'system' };
}

export function createSessionHistory(history = {}) {
  return HISTORY_COLLECTION_NAMES.reduce(
    (nextHistory, collectionName) => ({
      ...nextHistory,
      [collectionName]: Array.isArray(history?.[collectionName])
        ? [...history[collectionName]]
        : []
    }),
    {}
  );
}

export function getSessionHistory(session = {}) {
  return createSessionHistory(session?.history ?? {});
}

export function getHistoryCollection(session = {}, collectionName = null) {
  if (!HISTORY_COLLECTION_NAMES.includes(collectionName)) return [];
  const history = getSessionHistory(session);
  return history[collectionName];
}

function getNextHistorySequence(history = {}) {
  return HISTORY_COLLECTION_NAMES.flatMap((collectionName) =>
    Array.isArray(history?.[collectionName]) ? history[collectionName] : []
  ).reduce((maxSequence, entry) => {
    const sequence = Number.isInteger(entry?.sequence) ? entry.sequence : -1;
    return Math.max(maxSequence, sequence);
  }, -1) + 1;
}

function createHistoryContext(entry = {}) {
  return {
    cycleId: entry.cycleId ?? entry.metadata?.context?.cycleId ?? 0,
    poolKey: entry.poolKey ?? entry.metadata?.context?.poolKey ?? null,
    stageId: entry.stageId ?? entry.metadata?.context?.stageId ?? null,
    stageKey: entry.stageKey ?? entry.metadata?.context?.stageKey ?? null,
    stageCatalogId: entry.stageCatalogId ?? entry.metadata?.context?.stageCatalogId ?? null,
    queueKey: entry.queueKey ?? entry.metadata?.context?.queueKey ?? null
  };
}

// Devuelve las recipes registradas en la sesion.
//
// No se limpia al iniciar ciclo. Es memoria de partida, no estado temporal.
export function getRecipeHistory(session) {
  return getHistoryCollection(session, HISTORY_COLLECTIONS.RECIPE);
}

// Construye una firma estable para comparar la action pura ejecutada por una recipe.
//
export function getRecipeHistorySignature(action = {}) {
  const blockedPropertyChange = action?.effect?.blockedPropertyChange;
  if (blockedPropertyChange?.property) {
    return [
      action.id ?? 'unknown',
      blockedPropertyChange.property,
      String(blockedPropertyChange.value)
    ].join('|');
  }

  return action.id ?? 'unknown';
}

// Anade una entrada a una coleccion de historial dentro de la sesion.
//
// Esta es la mecanica comun de escritura. Los modelos concretos siguen
// preparando sus entradas antes de llamar aqui, porque recipeHistory y
// stageHistory no guardan el mismo tipo de hecho.
export function appendEntry(session, collectionName, entry, { getId } = {}) {
  if (!HISTORY_COLLECTION_NAMES.includes(collectionName)) {
    const collection = Array.isArray(session?.[collectionName]) ? session[collectionName] : [];
    const normalizedEntry = { ...entry };

    return {
      ...session,
      [collectionName]: [
        ...collection,
        {
          ...normalizedEntry,
          id:
            normalizedEntry.id ??
            (typeof getId === 'function'
              ? getId(normalizedEntry, collection)
              : `${collectionName}-${collection.length}`)
        }
      ]
    };
  }

  const currentHistory = getSessionHistory(session);
  const collection = getHistoryCollection(session, collectionName);
  const sequence = Number.isInteger(entry.sequence)
    ? entry.sequence
    : getNextHistorySequence(currentHistory);
  const normalizedEntry = {
    id: entry.id ?? null,
    sequence,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    event: entry.event ?? entry.operation ?? null,
    actor: createHistoryActor(entry.actor),
    payload: { ...(entry.payload ?? {}) },
    metadata: {
      ...(entry.metadata ?? {}),
      context: {
        ...createHistoryContext(entry),
        ...(entry.metadata?.context ?? {})
      }
    }
  };

  return {
    ...session,
    history: {
      ...currentHistory,
      [collectionName]: [
        ...collection,
      {
        ...normalizedEntry,
        id:
          normalizedEntry.id ??
          (typeof getId === 'function'
            ? getId(normalizedEntry, collection)
            : `${collectionName}-${collection.length}`)
      }
      ]
    }
  };
}

// Anade una entrada al historial de recipes de la sesion.
//
// La entrada guarda datos mecanicos, no textos visibles. Esto permite que una
// regla futura pregunte cosas como:
// - quien fue afectado en este ciclo?
// - que stage lo produjo?
// - hubo efectos finales o la recipe no produjo efecto?
export function appendRecipeHistory(session, entry = {}) {
  const history = getRecipeHistory(session);
  const baseEntry = {
    id: entry.id ?? null,
    cycleId: entry.cycleId ?? 0,
    poolKey: entry.poolKey ?? null,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    stageCatalogId: entry.stageCatalogId ?? null,
    recipeKey: entry.recipeKey ?? null,
    actionSignature: entry.actionSignature ?? null,
    actor: entry.actor ? { ...entry.actor } : null,
    metadata: { ...(entry.metadata ?? {}) }
  };
  const actorIds = [...(entry.actorIds ?? [])];
  const targetIds = [...(entry.targetIds ?? [])];
  const startedEntry = {
    ...baseEntry,
    event: HISTORY_EVENTS.STARTED,
    payload: {
      recipeKey: entry.recipeKey ?? null,
      actorIds,
      targetIds,
      actorContract: entry.actorContract ? { ...entry.actorContract } : null,
      targetContract: entry.targetContract ? { ...entry.targetContract } : null,
      stageId: entry.stageId ?? null,
      stageKey: entry.stageKey ?? null,
      stageCatalogId: entry.stageCatalogId ?? null
    }
  };
  const sessionWithStarted = appendEntry(session, HISTORY_COLLECTIONS.RECIPE, startedEntry, {
    getId: (item) =>
      item.id ?? `${item.payload.recipeKey ?? 'recipe'}-${item.metadata.context.cycleId}-${history.length}`
  });
  const recipeHistoryId = getRecipeHistory(sessionWithStarted).at(-1)?.id ?? null;
  const actionId = entry.actionId ?? null;
  const sessionWithRunningAction = actionId
    ? appendEntry(
        sessionWithStarted,
        HISTORY_COLLECTIONS.RECIPE,
        {
          ...baseEntry,
          event: HISTORY_EVENTS.RUNNING_ACTION,
          payload: {
            recipeKey: entry.recipeKey ?? null,
            actionId,
            recipeHistoryId
          },
          metadata: {
            ...baseEntry.metadata,
            recipeHistoryId
          }
        },
        {
          getId: (item, currentHistory) =>
            `${item.payload.actionId ?? 'action'}-${item.metadata.context.cycleId}-${currentHistory.length}`
        }
      )
    : sessionWithStarted;

  return appendEntry(
    sessionWithRunningAction,
    HISTORY_COLLECTIONS.RECIPE,
    {
      ...baseEntry,
      event: HISTORY_EVENTS.FINISHED,
      payload: {
        recipeKey: entry.recipeKey ?? null,
        result: entry.result ?? HISTORY_RESULTS.NO_EFFECT,
        actorIds,
        selectorIds: [...(entry.selectorIds ?? [])],
        targetIds,
        actorContract: entry.actorContract ? { ...entry.actorContract } : null,
        targetContract: entry.targetContract ? { ...entry.targetContract } : null,
        proposedEffects: [...(entry.proposedEffects ?? [])],
        finalEffects: [...(entry.finalEffects ?? [])],
        preventedPropertyChanges: [...(entry.preventedPropertyChanges ?? [])],
        blockedEffects: [...(entry.blockedEffects ?? [])]
      },
      metadata: {
        ...baseEntry.metadata,
        recipeHistoryId,
        actionSignature: entry.actionSignature ?? null
      }
    },
    {
      getId: (item, currentHistory) =>
        `${item.payload.recipeKey ?? 'recipe'}-finished-${item.metadata.context.cycleId}-${currentHistory.length}`
    }
  );
}

function isValidStageCompletionRequester(requestedBy) {
  return Object.values(STAGE_COMPLETION_REQUESTED_BY).includes(requestedBy);
}

// Anade una entrada al historial de stages.
//
// Cerrar un stage no es una accion de juego. Por eso no se registra en
// recipeHistory: stageHistory conserva la decision de pasar al siguiente stage
// y por que.
export function appendStageHistory(session, entry = {}) {
  const requestedBy = isValidStageCompletionRequester(entry.requestedBy)
    ? entry.requestedBy
    : STAGE_COMPLETION_REQUESTED_BY.DIRECTOR;
  const normalizedEntry = {
    poolKey: entry.poolKey ?? null,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    requestedBy,
    event: HISTORY_EVENTS.FINISHED,
    payload: {
      stageId: entry.stageId ?? null,
      stageKey: entry.stageKey ?? null,
      requestedBy,
      actorIds: [...(entry.actorIds ?? [])],
      recipeKey: entry.recipeKey ?? null,
      reason: entry.reason ?? 'manual_completion'
    },
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, HISTORY_COLLECTIONS.STAGE, normalizedEntry, {
    getId: (item, history) =>
      `stage-completion-${item.payload.stageId ?? item.payload.stageKey ?? 'stage'}-${history.length}`
  });
}

// Devuelve entradas que aplicaron un cambio concreto de propiedad en un ciclo.
//
// Esto sera util para mecanicas como restaurar solo a quien recibio
// inPlay=false durante el ciclo actual.
export function findAppliedSetPropertyHistory(
  session,
  {
    cycleId,
    property,
    value,
    targetId = null,
    stageKey = null,
    stageCatalogId = null,
    recipeKey = null
  } = {}
) {
  return getRecipeHistory(session).filter((entry) => {
    const context = entry.metadata?.context ?? {};
    const payload = entry.payload ?? {};
    if (entry.event !== HISTORY_EVENTS.FINISHED) return false;
    if (cycleId !== undefined && context.cycleId !== cycleId) return false;
    if (stageKey && context.stageKey !== stageKey) return false;
    if (stageCatalogId && context.stageCatalogId !== stageCatalogId) return false;
    if (recipeKey && payload.recipeKey !== recipeKey) return false;
    if (payload.result !== HISTORY_RESULTS.APPLIED && payload.result !== HISTORY_RESULTS.PARTIAL) {
      return false;
    }

    return (payload.finalEffects ?? []).some((effect) => {
      if (effect?.type !== 'set_property') return false;
      if (effect.property !== property) return false;
      if (effect.value !== value) return false;
      if (targetId && effect.targetId !== targetId) return false;
      return true;
    });
  });
}

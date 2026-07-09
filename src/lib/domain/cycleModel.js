// cycleModel.js
// -----------------------------------------------------------------------------
// Administra el ciclo runtime, la navegacion entre pools y las transiciones
// entre queues.
// Cada pool conserva su propio cursor de stages; cycle decide que bloque del
// flujo corresponde ejecutar despues.
// -----------------------------------------------------------------------------

import { CURRENT_STAGE_SOURCES, normalizeId } from './sessionModel.js';
import { DEFAULT_POOL_ORDER, POOL_KEYS, getCatalogPool } from './poolCatalog.js';
import { createPool, POOL_LIFECYCLE_OPERATION_TYPES } from './poolDefinition.js';
import {
  createQueueOrder,
  getAfterQueueKey,
  getBeforeQueueKey,
  isValidQueueKey
} from './queueCatalog.js';
import {
  advanceStageCursor,
  findNextRunnableIndex,
  getCurrentStageCursor,
  hasRunnableStage
} from './poolCursorModel.js';
import {
  HISTORY_COLLECTIONS,
  appendEntry
} from './historyModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import { resolveRecipe } from './recipeModel.js';
import {
  OBJECTIVE_EVALUATION_STATUSES,
  checkObjectives,
  getPendingObjectiveInfluenceStages
} from './objectiveModel.js';
import {
  POOL_HISTORY_OPERATIONS,
  createPoolHistoryEntry,
  preparePool,
  validatePool
} from './poolModel.js';
import { reviewPropertyBlocks } from './roleModel.js';
import {
  startQueue,
  startQueueByKey,
  getCurrentQueueStage,
  hasPendingQueueStages
} from './queueModel.js';
import {
  createSurfaceTransitionResult,
  getSurfaceTransitionAfterQueue
} from './surfaceModel.js';
import { createMessagesFromEngineErrors } from '../messages/messageModel.js';
import { routeMessages } from '../messages/messageLogModel.js';

export const CYCLE_ERRORS = Object.freeze({
  NO_RUNNABLE_STAGES: 'cycle/no-runnable-stages'
});

const CYCLE_LIFECYCLE_KEYS = Object.freeze({
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

function appendEngineErrors(session, errors, context = {}) {
  const messages = createMessagesFromEngineErrors({
    session,
    errors,
    context
  });

  return {
    session: routeMessages({ session }, messages).session,
    messages
  };
}

function getEntryId(entry = {}) {
  return entry?.type && entry?.key ? `${entry.type}:${entry.key}` : null;
}

function getEntryByTypeAndKey(entries = [], type = null, key = null) {
  return (entries ?? []).find((entry) => entry.type === type && entry.key === key) ?? null;
}

function getNextEntry(entries = [], currentEntry = null) {
  if (!entries.length) return null;
  const currentId = getEntryId(currentEntry);
  const currentIndex = entries.findIndex((entry) => getEntryId(entry) === currentId);
  if (currentIndex < 0) return entries[0] ?? null;
  return entries[(currentIndex + 1) % entries.length] ?? null;
}

function getPoolSurfacePhase(pool = {}, poolKey = null) {
  return pool?.surfacePhase ?? getCatalogPool(poolKey)?.surfacePhase ?? null;
}

function createCycleEntries({ poolOrder = [], pools = {} } = {}) {
  return (poolOrder ?? []).flatMap((poolKey) => {
    const surfacePhase = getPoolSurfacePhase(pools?.[poolKey], poolKey);
    return [
      {
        type: CURRENT_STAGE_SOURCES.QUEUE,
        key: getBeforeQueueKey(poolKey),
        poolKey,
        timing: 'before',
        surfacePhase
      },
      {
        type: CURRENT_STAGE_SOURCES.POOL,
        key: poolKey,
        poolKey,
        timing: 'during',
        surfacePhase
      },
      {
        type: CURRENT_STAGE_SOURCES.QUEUE,
        key: getAfterQueueKey(poolKey),
        poolKey,
        timing: 'after',
        surfacePhase
      }
    ];
  });
}

export function createCycle({
  id = 0,
  pools = {},
  queues = {},
  poolOrder = DEFAULT_POOL_ORDER,
  queueOrder = null,
  poolCurrent = poolOrder[0] ?? null,
  poolPrevious = null,
  poolNext = poolOrder[1] ?? poolOrder[0] ?? null
} = {}) {
  const normalizedOrder = (poolOrder ?? []).map(String);
  const normalizedQueueOrder = queueOrder ?? createQueueOrder(normalizedOrder);
  const current = normalizedOrder.includes(poolCurrent) ? poolCurrent : normalizedOrder[0] ?? null;
  const normalizedPools = normalizedOrder.reduce((result, poolKey) => {
    const pool = pools?.[poolKey];
    result[poolKey] = Array.isArray(pool)
      ? createPool({ key: poolKey, stages: pool })
      : createPool({ key: poolKey, ...(pool ?? {}) });
    return result;
  }, {});
  const normalizedQueues = normalizedQueueOrder.reduce((result, queueKey) => {
    result[queueKey] = Array.isArray(queues?.[queueKey]) ? [...queues[queueKey]] : [];
    return result;
  }, {});
  const entries = createCycleEntries({ poolOrder: normalizedOrder, pools: normalizedPools });
  const entryCurrent =
    getEntryByTypeAndKey(entries, CURRENT_STAGE_SOURCES.QUEUE, getBeforeQueueKey(current)) ??
    getEntryByTypeAndKey(entries, CURRENT_STAGE_SOURCES.POOL, current) ??
    entries[0] ??
    null;

  return {
    id: Number.isInteger(id) && id >= 0 ? id : 0,
    pools: normalizedPools,
    queues: normalizedQueues,
    poolOrder: normalizedOrder,
    queueOrder: normalizedQueueOrder,
    entries,
    entryPrevious: null,
    entryCurrent,
    entryNext: getNextEntry(entries, entryCurrent),
    poolCurrent: current,
    poolPrevious,
    poolNext: poolNext ?? normalizedOrder[1] ?? normalizedOrder[0] ?? null
  };
}

export function startCycle(cycle = {}) {
  const nextCycle = {
    ...cycle,
    id: (Number.isInteger(cycle.id) ? cycle.id : 0) + 1
  };

  return {
    ok: true,
    cycle: nextCycle,
    changes: [{ property: 'id', from: cycle.id ?? 0, to: nextCycle.id }],
    errors: []
  };
}

export function getCurrentPool(cycle = {}) {
  return cycle.pools?.[cycle.poolCurrent] ?? null;
}

export function getNextPoolKey(cycle = {}, fromPoolKey = cycle.poolCurrent) {
  const order = cycle.poolOrder ?? [];
  if (!order.length) return null;

  const currentIndex = order.indexOf(fromPoolKey);
  if (currentIndex < 0) return order[0] ?? null;
  return order[(currentIndex + 1) % order.length] ?? null;
}

export function getCurrentCycleStage(cycle = {}) {
  const pool = getCurrentPool(cycle);
  const cursor = getCurrentStageCursor(pool);
  return cursor ? { ...cursor, poolKey: cycle.poolCurrent } : null;
}

function getCurrentSessionStage(session = {}) {
  if (session.currentStageSource === CURRENT_STAGE_SOURCES.QUEUE) {
    const stage = getCurrentQueueStage(session);
    if (!stage) return null;
    return {
      poolKey: null,
      stageId: stage.id,
      stageKey: stage.key,
      status: stage.status,
      index: 0,
      source: CURRENT_STAGE_SOURCES.QUEUE,
      stage
    };
  }

  const cycleStage = getCurrentCycleStage(session.cycle);
  return cycleStage
    ? {
        ...cycleStage,
        source: CURRENT_STAGE_SOURCES.POOL
      }
    : null;
}

export function createQueueStageAdvance({
  session = {},
  stage = null,
  reason = 'queue-before-next-pool'
} = {}) {
  return stage
    ? {
        ok: true,
        errors: [],
        reason,
        cycle: session.cycle,
        next: {
          poolKey: null,
          stageId: stage.id,
          stageKey: stage.key,
          status: stage.status,
          index: 0,
          source: CURRENT_STAGE_SOURCES.QUEUE,
          stage
        }
      }
    : {
        ok: true,
        errors: [],
        reason,
        cycle: session.cycle,
        next: null
      };
}

export function updateCyclePool(cycle = {}, pool = null) {
  if (!pool?.key) return cycle;
  return {
    ...cycle,
    pools: {
      ...(cycle.pools ?? {}),
      [pool.key]: pool
    }
  };
}

export function enterNextPool(cycle = {}, nextPoolKey = cycle.poolNext) {
  const pool = cycle.pools?.[nextPoolKey] ?? null;
  if (!nextPoolKey || !pool || !hasRunnableStage(pool)) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: CYCLE_ERRORS.NO_RUNNABLE_STAGES,
          poolKey: nextPoolKey,
          message: `pool "${nextPoolKey ?? 'unknown'}" has no runnable stages`
        }
      ],
      cycle,
      next: null,
      reason: 'next-pool-not-runnable'
    };
  }

  const enteredPool = {
    ...pool,
    currentStageIndex: findNextRunnableIndex(pool.stages, 0) ?? 0
  };
  const entryCurrent =
    getEntryByTypeAndKey(cycle.entries ?? [], CURRENT_STAGE_SOURCES.POOL, nextPoolKey) ??
    getEntryByTypeAndKey(cycle.entries ?? [], CURRENT_STAGE_SOURCES.POOL, enteredPool.key);
  const nextCycle = {
    ...cycle,
    pools: {
      ...cycle.pools,
      [nextPoolKey]: enteredPool
    },
    entryPrevious: cycle.entryCurrent ?? null,
    entryCurrent,
    entryNext: getNextEntry(cycle.entries ?? [], entryCurrent),
    poolPrevious: cycle.poolCurrent,
    poolCurrent: nextPoolKey,
    poolNext: getNextPoolKey(cycle, nextPoolKey)
  };

  return {
    ok: true,
    errors: [],
    cycle: nextCycle,
    next: getCurrentCycleStage(nextCycle),
    reason: 'next-pool'
  };
}

function getLifecycleOperations(cycle = {}, poolKey = null, timing = 'onExit') {
  if (!poolKey) return [];
  return cycle?.pools?.[poolKey]?.[timing] ?? [];
}

export function createLifecycleOperationResult({
  key,
  ok = true,
  result = null,
  errors = [],
  metadata = {}
}) {
  return {
    key,
    ok,
    result,
    errors,
    metadata: { ...metadata }
  };
}

export function continueAfterQueue({ session = {}, queueKey = null } = {}) {
  const transition = getSurfaceTransitionAfterQueue(queueKey);

  if (!transition) {
    return {
      ok: true,
      errors: [],
      session,
      stage: null,
      lifecycleResults: []
    };
  }

  const transitionResult = createSurfaceTransitionResult(transition);
  if (!isValidQueueKey(transition.to, session?.cycle?.queueOrder)) {
    return {
      ok: true,
      errors: [],
      session,
      stage: null,
      lifecycleResults: [transitionResult]
    };
  }

  const nextQueueStart = startQueueByKey(session, transition.to);

  return {
    ...nextQueueStart,
    lifecycleResults: [transitionResult]
  };
}

function applyConcludePlayLifecycleOperationIfNeeded({ session, objectiveEvaluation }) {
  if (
    objectiveEvaluation?.status !== OBJECTIVE_EVALUATION_STATUSES.FULFILLED ||
    !objectiveEvaluation?.playOutcome?.conclusive
  ) {
    return {
      session,
      lifecycleResults: [],
      objectiveEvaluation
    };
  }

  if (session?.playOutcome) {
    return {
      session,
      lifecycleResults: [],
      objectiveEvaluation
    };
  }

  const pendingObjectiveInfluenceStages = getPendingObjectiveInfluenceStages({
    session,
    objectiveRules: objectiveEvaluation.fulfilledRules
  });

  if (pendingObjectiveInfluenceStages.length > 0) {
    return {
      session,
      lifecycleResults: [],
      objectiveEvaluation: {
        ...objectiveEvaluation,
        reason: 'play_outcome_unstable',
        playOutcomeCandidate: objectiveEvaluation.playOutcome,
        playOutcome: null,
        pendingObjectiveInfluenceStageKeys: pendingObjectiveInfluenceStages.map((stage) => stage.key)
      }
    };
  }

  const concluded = resolveRecipe(
    session,
    getCatalogRecipe(RECIPE_KEYS.CONCLUDE_PLAY),
    {
      playOutcome: objectiveEvaluation.playOutcome
    },
    {
      recipeKey: RECIPE_KEYS.CONCLUDE_PLAY
    }
  );

  if (!concluded.ok) {
    return {
      session,
      lifecycleResults: [
        {
          key: CYCLE_LIFECYCLE_KEYS.CONCLUDE_PLAY,
          ok: false,
          errors: concluded.errors
        }
      ],
      objectiveEvaluation
    };
  }

  return {
    session: concluded.session,
    lifecycleResults: [
      {
        key: CYCLE_LIFECYCLE_KEYS.CONCLUDE_PLAY,
        ok: true,
        result: concluded.result
      }
    ],
    objectiveEvaluation: {
      ...objectiveEvaluation,
      playOutcome: concluded.session.playOutcome
    }
  };
}

export function runCheckObjectivesLifecycleOperation(session = {}, lifecycleOperation = {}) {
  const objectiveEvaluation = checkObjectives(session);
  const concludePlayState = applyConcludePlayLifecycleOperationIfNeeded({
    session,
    objectiveEvaluation
  });

  return {
    session: concludePlayState.session,
    objectiveEvaluation: concludePlayState.objectiveEvaluation,
    playOutcome: concludePlayState.objectiveEvaluation?.playOutcome ?? null,
    lifecycleResults: [
      createLifecycleOperationResult({
        key: CYCLE_LIFECYCLE_KEYS.CHECK_OBJECTIVES,
        result: concludePlayState.objectiveEvaluation,
        metadata: lifecycleOperation.metadata
      }),
      ...concludePlayState.lifecycleResults
    ]
  };
}

function runReviewPropertyBlocksLifecycleOperation(session = {}, lifecycleOperation = {}) {
  const reviewed = reviewPropertyBlocks(session, {
    type: 'pool_boundary',
    cycleId: session.cycle?.id ?? 0,
    poolKey: session.cycle?.poolCurrent ?? null,
    boundary: lifecycleOperation.metadata?.boundary ?? 'after'
  });

  return {
    session: reviewed.session,
    objectiveEvaluation: null,
    playOutcome: null,
    lifecycleResults: [
      createLifecycleOperationResult({
        key: POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS,
        result: { removedBlockIds: reviewed.removedBlockIds },
        metadata: lifecycleOperation.metadata
      })
    ]
  };
}

function runLifecycleOperation(session = {}, lifecycleOperation = {}) {
  const key = normalizeId(lifecycleOperation.type);

  if (key === POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS) {
    return runReviewPropertyBlocksLifecycleOperation(session, lifecycleOperation);
  }

  if (key === CYCLE_LIFECYCLE_KEYS.CHECK_OBJECTIVES) {
    return runCheckObjectivesLifecycleOperation(session, lifecycleOperation);
  }

  return {
    session,
    objectiveEvaluation: null,
    playOutcome: null,
    lifecycleResults: [
      createLifecycleOperationResult({
        key,
        ok: false,
        errors: [
          {
            code: 'lifecycle-operation/unsupported',
            message: `unsupported lifecycleOperation "${key}"`
          }
        ],
        metadata: lifecycleOperation.metadata
      })
    ]
  };
}

export function runLifecycleOperations(session = {}, lifecycleOperations = []) {
  return (lifecycleOperations ?? []).reduce(
    (state, lifecycleOperation) => {
      if (state.session?.playOutcome) return state;

      const resolved = runLifecycleOperation(state.session, lifecycleOperation);

      return {
        session: resolved.session,
        objectiveEvaluation: resolved.objectiveEvaluation ?? state.objectiveEvaluation,
        playOutcome: resolved.playOutcome ?? state.playOutcome,
        lifecycleResults: [
          ...state.lifecycleResults,
          ...resolved.lifecycleResults
        ]
      };
    },
    {
      session,
      objectiveEvaluation: null,
      playOutcome: null,
      lifecycleResults: []
    }
  );
}

export function runLifecycleOperationsOnExit({ session = {}, poolKey = null } = {}) {
  return runLifecycleOperations(
    session,
    getLifecycleOperations(session.cycle, poolKey, 'onExit')
  );
}

export function runLifecycleOperationsOnEnter({ session = {}, poolKey = null } = {}) {
  return runLifecycleOperations(
    session,
    getLifecycleOperations(session.cycle, poolKey, 'onEnter')
  );
}

export function startCycleBeforePoolEntry(session = {}, poolKey = null) {
  if (poolKey !== POOL_KEYS.POOL_CONCEALED) return session;
  const currentCycleId = session.cycle?.id ?? 0;
  const afterCurrentCycle = reviewPropertyBlocks(session, {
    type: 'cycle_boundary',
    cycleId: currentCycleId,
    boundary: 'after'
  }).session;
  const beforeNextCycle = reviewPropertyBlocks(afterCurrentCycle, {
    type: 'cycle_boundary',
    cycleId: currentCycleId + 1,
    boundary: 'before'
  }).session;
  const started = startCycle(beforeNextCycle.cycle);
  return appendEntry(
    {
      ...beforeNextCycle,
      cycle: started.cycle
    },
    HISTORY_COLLECTIONS.CYCLE,
    {
      cycleId: started.cycle.id,
      event: 'started',
      payload: {
        cycleId: started.cycle.id,
        poolKey
      },
      metadata: {}
    }
  );
}

function appendPoolHistory(session = {}, entry = {}) {
  return appendEntry(session, HISTORY_COLLECTIONS.POOL, createPoolHistoryEntry(entry));
}

export function prepareAndValidatePoolEntry(session = {}, poolKey = null) {
  const sessionAfterBoundaryReview = reviewPropertyBlocks(session, {
    type: 'pool_boundary',
    cycleId: session.cycle?.id ?? 0,
    poolKey,
    boundary: 'before'
  }).session;
  const pool = sessionAfterBoundaryReview.cycle?.pools?.[poolKey] ?? null;
  const context = {
    cycleId: sessionAfterBoundaryReview.cycle?.id ?? 0,
    poolKey,
    roleStates: sessionAfterBoundaryReview.roles ?? [],
    session: sessionAfterBoundaryReview
  };
  const prepared = preparePool(pool, context);

  if (!prepared.ok) {
    const failedSession = appendPoolHistory(sessionAfterBoundaryReview, {
      cycleId: context.cycleId,
      poolKey,
      operation: POOL_HISTORY_OPERATIONS.FAILED,
      stageIndex: pool?.currentStageIndex ?? 0,
      metadata: { phase: 'prepare' }
    });
    const messageState = appendEngineErrors(failedSession, prepared.errors, {
      ...context,
      phase: 'prepare'
    });

    return {
      ok: false,
      errors: prepared.errors,
      messages: messageState.messages,
      session: messageState.session
    };
  }

  let nextSession = {
    ...sessionAfterBoundaryReview,
    cycle: updateCyclePool(sessionAfterBoundaryReview.cycle, prepared.pool)
  };
  nextSession = appendPoolHistory(nextSession, {
    cycleId: context.cycleId,
    poolKey,
    operation: POOL_HISTORY_OPERATIONS.PREPARED,
    stageIndex: prepared.pool.currentStageIndex,
    metadata: { changes: prepared.changes }
  });
  const validation = validatePool(
    prepared.pool,
    Object.values(POOL_LIFECYCLE_OPERATION_TYPES)
  );

  if (!validation.ok) {
    const failedSession = appendPoolHistory(nextSession, {
      cycleId: context.cycleId,
      poolKey,
      operation: POOL_HISTORY_OPERATIONS.FAILED,
      stageIndex: prepared.pool.currentStageIndex,
      metadata: { phase: 'validate' }
    });
    const messageState = appendEngineErrors(failedSession, validation.errors, {
      ...context,
      phase: 'validate'
    });

    return {
      ok: false,
      errors: validation.errors,
      messages: messageState.messages,
      session: messageState.session
    };
  }

  return {
    ok: true,
    errors: [],
    session: appendPoolHistory(nextSession, {
      cycleId: context.cycleId,
      poolKey,
      operation: POOL_HISTORY_OPERATIONS.VALIDATED,
      stageIndex: prepared.pool.currentStageIndex
    })
  };
}

export function resolvePoolEntry({ session = {}, poolEntry = {} } = {}) {
  const shouldEnterPool =
    poolEntry.ok &&
    poolEntry.reason === 'next-pool' &&
    poolEntry.next?.poolKey;
  const startedSession = shouldEnterPool
    ? startCycleBeforePoolEntry(session, poolEntry.next.poolKey)
    : session;
  const preparedEntry = shouldEnterPool
    ? prepareAndValidatePoolEntry(startedSession, poolEntry.next.poolKey)
    : { ok: true, errors: [], session: startedSession };

  if (!preparedEntry.ok) {
    return {
      ok: false,
      errors: preparedEntry.errors,
      session: preparedEntry.session,
      poolEntry: {
        ...poolEntry,
        ok: false,
        errors: preparedEntry.errors,
        reason: 'pool-entry-failed',
        cycle: preparedEntry.session.cycle,
        next: null
      },
      objectiveEvaluation: null,
      playOutcome: null,
      lifecycleResults: []
    };
  }

  const enterState = shouldEnterPool
    ? runLifecycleOperationsOnEnter({
        session: preparedEntry.session,
        poolKey: poolEntry.next.poolKey
      })
    : {
        session: preparedEntry.session,
        objectiveEvaluation: null,
        playOutcome: null,
        lifecycleResults: []
      };

  return {
    ok: poolEntry.ok && preparedEntry.ok,
    errors: [...(poolEntry.errors ?? []), ...(preparedEntry.errors ?? [])],
    session: enterState.session,
    poolEntry: {
      ...poolEntry,
      cycle: enterState.session.cycle,
      next: enterState.session.playOutcome
        ? null
        : getCurrentSessionStage(enterState.session)
    },
    objectiveEvaluation: enterState.objectiveEvaluation,
    playOutcome: enterState.playOutcome,
    lifecycleResults: enterState.lifecycleResults ?? []
  };
}

export function startQueueAfterPoolExit({ session = {}, poolKey = null } = {}) {
  const queueKey = poolKey ? getAfterQueueKey(poolKey) : null;

  if (queueKey) {
    const queueStart = startQueueByKey(session, queueKey);
    if (!queueStart.ok || queueStart.stage) {
      return {
        ...queueStart,
        lifecycleResults: []
      };
    }

    return continueAfterQueue({
      session: queueStart.session,
      queueKey
    });
  }

  return {
    ok: true,
    errors: [],
    session: hasPendingQueueStages(session) ? startQueue(session) : session,
    stage: null,
    lifecycleResults: []
  };
}

function shouldRunLifecycleOperationsAfterStageFinish(stageAdvance) {
  return ['pool-completed', 'no-runnable-stage'].includes(stageAdvance?.reason);
}

export function getPostStageFinishLifecycleState({ session, stageAdvance }) {
  if (!shouldRunLifecycleOperationsAfterStageFinish(stageAdvance)) {
    return {
      session,
      stageAdvance,
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      lifecycleResults: []
    };
  }

  const exitState = runLifecycleOperationsOnExit({
    session,
    poolKey: stageAdvance.current?.poolKey
  });
  const afterPoolQueueStageStart = exitState.session.playOutcome
    ? { ok: true, errors: [], session: exitState.session, stage: null, lifecycleResults: [] }
    : startQueueAfterPoolExit({
        session: exitState.session,
        poolKey: stageAdvance.current?.poolKey
      });
  if (!afterPoolQueueStageStart.ok) {
    return {
      session: afterPoolQueueStageStart.session,
      stageAdvance: {
        ...stageAdvance,
        ok: false,
        errors: afterPoolQueueStageStart.errors,
        reason: 'queue-key-failed',
        cycle: afterPoolQueueStageStart.session.cycle,
        next: null
      },
      objectiveEvaluation: exitState.objectiveEvaluation,
      playOutcome: exitState.playOutcome,
      eventResponses: [],
      lifecycleResults: [
        ...exitState.lifecycleResults,
        ...(afterPoolQueueStageStart.lifecycleResults ?? [])
      ]
    };
  }
  const sessionBeforePoolEntry = afterPoolQueueStageStart.session;
  const queueStage = getCurrentQueueStage(sessionBeforePoolEntry);
  const poolEntry = exitState.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: stageAdvance.reason,
        cycle: exitState.session.cycle,
        next: null
      }
    : queueStage
      ? createQueueStageAdvance({
          session: sessionBeforePoolEntry,
          stage: queueStage,
          reason: 'queue-before-next-pool',
        })
      : enterNextPool(
          sessionBeforePoolEntry.cycle,
          stageAdvance.cycle.poolNext
        );
  const sessionAfterPoolEntry = {
    ...sessionBeforePoolEntry,
    cycle: poolEntry.cycle
  };
  const stageAdvanceAfterExit = {
    ...stageAdvance,
    ok: poolEntry.ok,
    errors: poolEntry.errors,
    reason: poolEntry.reason,
    cycle: poolEntry.cycle,
    next: exitState.session.playOutcome
      ? null
      : poolEntry.next
  };
  const poolEntryState = resolvePoolEntry({
    session: sessionAfterPoolEntry,
    poolEntry: stageAdvanceAfterExit
  });
  if (!poolEntryState.ok) {
    return {
      session: poolEntryState.session,
      stageAdvance: poolEntryState.poolEntry,
      objectiveEvaluation: exitState.objectiveEvaluation,
      playOutcome: exitState.playOutcome,
      eventResponses: [],
      lifecycleResults: [
        ...exitState.lifecycleResults,
        ...(afterPoolQueueStageStart.lifecycleResults ?? [])
      ]
    };
  }
  const finalStageAdvance = {
    ...poolEntryState.poolEntry
  };

  return {
    session: poolEntryState.session,
    stageAdvance: finalStageAdvance,
    objectiveEvaluation: poolEntryState.objectiveEvaluation ?? exitState.objectiveEvaluation,
    playOutcome: poolEntryState.playOutcome ?? exitState.playOutcome,
    eventResponses: [],
    lifecycleResults: [
      ...exitState.lifecycleResults,
      ...(afterPoolQueueStageStart.lifecycleResults ?? []),
      ...poolEntryState.lifecycleResults
    ]
  };
}

export function resolveCycleAfterStageFinished({ session = {}, currentStage = {} } = {}) {
  return finishTransition(
    validateTransitionOutcome(
      resolveTransition(
        evaluateTransition(
          startTransition({ session, currentStage })
        )
      )
    )
  );
}

function startTransition({ session = {}, currentStage = {} } = {}) {
  return {
    session,
    currentStage,
    errors: []
  };
}

function evaluateTransition(state = {}) {
  const sessionAfterStageBoundary = reviewPropertyBlocks(state.session, {
    type: 'stage_boundary',
    cycleId: state.session.cycle?.id ?? 0,
    poolKey: state.currentStage.poolKey,
    stageId: state.currentStage.stageId,
    boundary: 'after'
  }).session;

  return {
    ...state,
    session: sessionAfterStageBoundary,
    currentPool: getCurrentPool(sessionAfterStageBoundary.cycle)
  };
}

function resolveTransition(state = {}) {
  const poolAdvance = advanceStageCursor(state.currentPool);
  const nextCycle = updateCyclePool(state.session.cycle, poolAdvance.pool);
  const stageAdvance = {
    ...poolAdvance,
    cycle: nextCycle,
    current: poolAdvance.current
      ? { ...poolAdvance.current, poolKey: state.session.cycle.poolCurrent }
      : null,
    next: poolAdvance.next
      ? { ...poolAdvance.next, poolKey: state.session.cycle.poolCurrent }
      : null
  };

  return {
    ...state,
    session: {
      ...state.session,
      cycle: stageAdvance.cycle
    },
    stageAdvance
  };
}

function validateTransitionOutcome(state = {}) {
  return {
    ...state,
    ok: (state.errors ?? []).length === 0
  };
}

function finishTransition(state = {}) {
  if (!state.ok) {
    return {
      session: state.session,
      stageAdvance: {
        ...(state.stageAdvance ?? {}),
        ok: false,
        errors: state.errors ?? []
      },
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      lifecycleResults: []
    };
  }

  return getPostStageFinishLifecycleState({
    session: state.session,
    stageAdvance: state.stageAdvance
  });
}

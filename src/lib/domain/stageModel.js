// stageModel.js
// -----------------------------------------------------------------------------
// Este archivo conecta poolCursorModel con actionModel.
//
// Responsabilidad:
// - leer el stage actual de poolCursorModel;
// - comprobar que ese stage es ejecutable;
// - extraer la action declarada por el stage;
// - pedir a actionModel que la resuelva;
// - cerrar explicitamente el stage cuando player/director/sistema lo pidan.
//
// No decide reglas de juego complejas. Si empieza a hacerlo, se estaria
// convirtiendo en una segunda actionModel. Su trabajo es coordinar, no resolver.
// -----------------------------------------------------------------------------

import {
  advanceStageCursor,
  isStageRunnable
} from './poolCursorModel.js';
import {
  enterNextPool,
  getCurrentCycleStage,
  getCurrentPool,
  startCycle,
  updateCyclePool
} from './cycleModel.js';
import { appendEntry } from './historyModel.js';
import { resolveRecipe } from './recipeModel.js';
import { ACTION_IDS, VISIBILITY, resolveAction } from './actionModel.js';
import { processActionResultEvents } from './eventModel.js';
import { CURRENT_STAGE_SOURCES, normalizeId } from './sessionModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  POOL_HISTORY_OPERATIONS,
  createPoolHistoryEntry,
  preparePool,
  validatePool
} from './poolModel.js';
import { POOL_LIFECYCLE_OPERATION_TYPES } from './poolDefinition.js';
import {
  OBJECTIVE_EVALUATION_STATUSES,
  checkObjectives,
  getPendingObjectiveInfluenceStages
} from './objectiveModel.js';
import { SELECTION_OUTCOME_TYPES } from './selectionModel.js';
import {
  startSpecialStages,
  completeSpecialStage,
  getCurrentSpecialStage,
  hasPendingSpecialStages
} from './specialStagesModel.js';
import { reviewPropertyBlocks } from './roleModel.js';
import { createMessagesFromEngineErrors } from '../messages/messageModel.js';
import { routeMessages } from '../messages/messageLogModel.js';

export const STAGE_ERRORS = Object.freeze({
  MISSING_SESSION: 'stage/missing-session',
  MISSING_STAGE_POOLS: 'stage/missing-stage-pools',
  MISSING_CURRENT_STAGE: 'stage/missing-current-stage',
  STAGE_NOT_RUNNABLE: 'stage/not-runnable',
  MISSING_ACTION: 'stage/missing-action',
  MISSING_ACTION_KEY: 'stage/missing-action-key',
  ACTION_NOT_FOUND: 'stage/action-not-found',
  COMPLETION_NOT_ALLOWED: 'stage/completion-not-allowed'
});

export const STAGE_COMPLETION_MODES = Object.freeze({
  MANUAL: 'manual',
  AUTOMATIC: 'automatic'
});

export const STAGE_COMPLETION_REQUESTED_BY = Object.freeze({
  PLAYER: 'player',
  DIRECTOR: 'director',
  SYSTEM: 'system'
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

// IDs anonimos recomendados para slots de ejecucion.
//
// El stage no describe que accion ejecuta. Describe donde ocurre dentro del
// flujo. La accion concreta vive en stage.actions.
export const STAGE_KEYS = Object.freeze({
  STAGE_01: 'stage_01',
  STAGE_02: 'stage_02',
  STAGE_03: 'stage_03',
  STAGE_04: 'stage_04',
  STAGE_05: 'stage_05',
  STAGE_06: 'stage_06',
  STAGE_07: 'stage_07',
  STAGE_08: 'stage_08'
});

// Claves de receta dentro de un stage.
//
// actionId puede ser generico, por ejemplo set_in_play. actionKey permite
// distinguir recetas que usan esa misma accion generica con parametros distintos.
export const STAGE_ACTION_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  ONE_SHOT_SET_OUT_OF_PLAY: 'one_shot_set_out_of_play',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

// Devuelve el stage actual con su contexto de pool.
//
// Devuelve el stage apuntado por el cursor de pools.
export function getCurrentStage(session) {
  if (session?.currentStageSource === CURRENT_STAGE_SOURCES.SPECIAL_STAGES) {
    const stage = getCurrentSpecialStage(session);
    if (!stage) return null;
    return {
      poolKey: null,
      stageId: stage.id,
      stageKey: stage.key,
      status: stage.status,
      index: 0,
      source: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
      stage
    };
  }
  return getCurrentCycleStage(session?.cycle);
}

// Devuelve la clave mecanica de una receta de accion.
export function getStageActionKey(action) {
  return normalizeId(action?.key ?? action?.actionKey ?? action?.id);
}

// Elige que accion del stage se va a ejecutar.
//
// Si solo hay una accion, no exigimos actionKey. Si hay varias, el input debe
// indicar actionKey para evitar que el motor elija por posicion sin querer.
export function selectStageAction(actions = [], requestedActionKey = null) {
  if (!actions.length) {
    return {
      ok: false,
      action: null,
      actionKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_ACTION,
        message: 'current stage has no actions'
      }
    };
  }

  const normalizedRequestedKey = requestedActionKey ? normalizeId(requestedActionKey) : null;

  if (!normalizedRequestedKey && actions.length > 1) {
    return {
      ok: false,
      action: null,
      actionKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_ACTION_KEY,
        message: 'current stage has multiple actions and requires actionKey'
      }
    };
  }

  const selectedAction = normalizedRequestedKey
    ? actions.find((action) => getStageActionKey(action) === normalizedRequestedKey)
    : actions[0];

  if (!selectedAction) {
    return {
      ok: false,
      action: null,
      actionKey: normalizedRequestedKey,
      error: {
        code: STAGE_ERRORS.ACTION_NOT_FOUND,
        message: `current stage has no action "${normalizedRequestedKey}"`,
        actionKey: normalizedRequestedKey
      }
    };
  }

  const actionKey = getStageActionKey(selectedAction);

  return {
    ok: true,
    action: {
      ...selectedAction,
      key: selectedAction.key ?? actionKey
    },
    actionKey,
    error: null
  };
}

// Valida que el stage actual pueda ejecutarse.
//
// Esta validacion no revisa targets, filtros ni efectos. Eso pertenece a
// actionModel. Aqui solo comprobamos que existe un stage ejecutable con una
// accion declarada.
export function validateCurrentStage(session, { actionKey = null } = {}) {
  const errors = [];

  if (!session) {
    errors.push({
      code: STAGE_ERRORS.MISSING_SESSION,
      message: 'cannot resolve a stage without session'
    });
    return {
      ok: false,
      currentStage: null,
      action: null,
      actionKey: null,
      errors
    };
  }

  if (!session.cycle && session.currentStageSource !== CURRENT_STAGE_SOURCES.SPECIAL_STAGES) {
    errors.push({
      code: STAGE_ERRORS.MISSING_STAGE_POOLS,
      message: 'session has no cycle'
    });
  }

  const currentStage = getCurrentStage(session);

  if (!currentStage) {
    errors.push({
      code: STAGE_ERRORS.MISSING_CURRENT_STAGE,
      message: 'session has no current stage'
    });
    return {
      ok: false,
      currentStage: null,
      action: null,
      actionKey: null,
      errors
    };
  }

  if (!isStageRunnable(currentStage.stage)) {
    errors.push({
      code: STAGE_ERRORS.STAGE_NOT_RUNNABLE,
      message: `current stage "${currentStage.stageKey}" is not runnable`,
      poolKey: currentStage.poolKey,
      stageId: currentStage.stageId,
      stageKey: currentStage.stageKey,
      status: currentStage.status
    });
  }

  const actions = (currentStage.stage?.actions ?? []).map((action) => ({ ...action }));
  const selectedAction = selectStageAction(actions, actionKey);

  if (!selectedAction.ok) {
    errors.push({
      ...selectedAction.error,
      message: `${selectedAction.error.message} in stage "${currentStage.stageKey}"`,
      poolKey: currentStage.poolKey,
      stageId: currentStage.stageId,
      stageKey: currentStage.stageKey
    });
  }

  return {
    ok: errors.length === 0,
    currentStage,
    action: selectedAction.action,
    actionKey: selectedAction.actionKey,
    errors
  };
}

// Devuelve true si un valor representa un origen valido de cierre de stage.
export function isValidStageCompletionRequester(requestedBy) {
  return Object.values(STAGE_COMPLETION_REQUESTED_BY).includes(requestedBy);
}

export function getStageCompletionDefinition(stage = {}) {
  const completion = stage?.completion ?? {};
  const mode = Object.values(STAGE_COMPLETION_MODES).includes(completion.mode)
    ? completion.mode
    : STAGE_COMPLETION_MODES.MANUAL;
  const allowedRequesters = Array.isArray(completion.allowedRequesters)
    ? completion.allowedRequesters.filter(isValidStageCompletionRequester)
    : Object.values(STAGE_COMPLETION_REQUESTED_BY);

  return {
    mode,
    allowedRequesters:
      allowedRequesters.length > 0 ? allowedRequesters : Object.values(STAGE_COMPLETION_REQUESTED_BY)
  };
}

export function canRequesterCompleteStage(stage, requestedBy) {
  const completion = getStageCompletionDefinition(stage);
  return completion.allowedRequesters.includes(requestedBy);
}

function getStageSelectionRules(stage = {}) {
  return stage?.selectionRules ?? null;
}

function hasStageSelectionRules(stage = {}) {
  return !!getStageSelectionRules(stage);
}

function getSelectionInputForStage(stage = {}, input = {}) {
  const selectionRules = getStageSelectionRules(stage) ?? {};

  return {
    selectorIds: input.selectorIds ?? input.actorIds ?? stage.actorIds ?? [],
    selections: input.selections ?? [],
    selectionRules: {
      ...selectionRules,
      candidateIds: input.candidateIds ?? selectionRules.candidateIds ?? null
    },
    roundType: input.roundType,
    roundIndex: input.roundIndex ?? 0
  };
}

function getRecipeInputFromSelection({ stage = {}, input = {}, chosenId = null }) {
  return {
    ...input,
    actorIds: input.actorIds ?? stage.actorIds ?? [],
    targetIds: chosenId ? [chosenId] : []
  };
}

function mergeSelectionAndRecipeResult({ selectionResult = null, recipeResult = null } = {}) {
  return {
    ...(recipeResult ?? {}),
    selection: selectionResult?.selection ?? null,
    selectionActionId: selectionResult?.actionId ?? null,
    proposedEffects: recipeResult?.proposedEffects ?? [],
    finalEffects: recipeResult?.finalEffects ?? [],
    preventedPropertyChanges: recipeResult?.preventedPropertyChanges ?? [],
    blockedEffects: recipeResult?.blockedEffects ?? []
  };
}

function resolveSelectionStageRecipe(session, stage, recipe, input = {}, context = {}) {
  const selectionResolution = resolveAction(
    session,
    {
      id: ACTION_IDS.SELECT,
      visibility: recipe?.visibility ?? VISIBILITY.ALL
    },
    getSelectionInputForStage(stage, input),
    context
  );

  if (!selectionResolution.ok) return selectionResolution;

  const chosenId = selectionResolution.result?.selection?.chosenId ?? null;
  if (selectionResolution.result?.selection?.type !== SELECTION_OUTCOME_TYPES.CHOSEN || !chosenId) {
    return selectionResolution;
  }

  const recipeResolution = resolveRecipe(
    selectionResolution.session,
    recipe,
    getRecipeInputFromSelection({ stage, input, chosenId }),
    context
  );

  if (!recipeResolution.ok) {
    return {
      ...recipeResolution,
      result: {
        ...(recipeResolution.result ?? {}),
        selection: selectionResolution.result?.selection ?? null
      }
    };
  }

  return {
    ...recipeResolution,
    result: mergeSelectionAndRecipeResult({
      selectionResult: selectionResolution.result,
      recipeResult: recipeResolution.result
    })
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

  const concluded = resolveAction(session, getCatalogRecipe(RECIPE_KEYS.CONCLUDE_PLAY), {
    playOutcome: objectiveEvaluation.playOutcome
  });

  if (!concluded.ok) {
    return {
      session,
      lifecycleResults: [
        {
          key: STAGE_ACTION_KEYS.CONCLUDE_PLAY,
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
        key: STAGE_ACTION_KEYS.CONCLUDE_PLAY,
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

function getLifecycleOperations(cycle = {}, poolKey = null, timing = 'onExit') {
  if (!poolKey) return [];
  return cycle?.pools?.[poolKey]?.[timing] ?? [];
}

function createLifecycleOperationResult({ key, ok = true, result = null, errors = [], metadata = {} }) {
  return {
    key,
    ok,
    result,
    errors,
    metadata: { ...metadata }
  };
}

function runCheckObjectivesLifecycleOperation(session = {}, lifecycleOperation = {}) {
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
        key: STAGE_ACTION_KEYS.CHECK_OBJECTIVES,
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

  if (key === STAGE_ACTION_KEYS.CHECK_OBJECTIVES) {
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

function runLifecycleOperations(session = {}, lifecycleOperations = []) {
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

function runLifecycleOperationsOnExit({ session = {}, poolKey = null } = {}) {
  return runLifecycleOperations(
    session,
    getLifecycleOperations(session.cycle, poolKey, 'onExit')
  );
}

function runLifecycleOperationsOnEnter({ session = {}, poolKey = null } = {}) {
  return runLifecycleOperations(
    session,
    getLifecycleOperations(session.cycle, poolKey, 'onEnter')
  );
}

function startCycleBeforePoolEntry(session = {}, poolKey = null) {
  if (poolKey !== 'poolConcealed') return session;
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
    'cycleHistory',
    {
      cycleId: started.cycle.id,
      operation: 'started',
      metadata: {}
    }
  );
}

function appendPoolHistory(session = {}, entry = {}) {
  return appendEntry(session, 'poolHistory', createPoolHistoryEntry(entry));
}

function prepareAndValidatePoolEntry(session = {}, poolKey = null) {
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
    roleStates: sessionAfterBoundaryReview.roles ?? []
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

function getPostCompletionLifecycleOperationState({ session, stageAdvance }) {
  if (!shouldRunLifecycleOperationsAfterStageCompletion(stageAdvance)) {
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
  const sessionBeforePoolEntry = hasPendingSpecialStages(exitState.session)
    ? startSpecialStages(exitState.session)
    : exitState.session;
  const specialStage = getCurrentSpecialStage(sessionBeforePoolEntry);
  const poolEntry = exitState.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: stageAdvance.reason,
        cycle: exitState.session.cycle,
        next: null
      }
    : specialStage
      ? {
          ok: true,
          errors: [],
          reason: 'special-stages-before-next-pool',
          cycle: sessionBeforePoolEntry.cycle,
          next: {
            poolKey: null,
            stageId: specialStage.id,
            stageKey: specialStage.key,
            status: specialStage.status,
            index: 0,
            source: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
            stage: specialStage
          }
        }
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
  const shouldRunOnEnter =
    !exitState.session.playOutcome &&
    poolEntry.ok &&
    poolEntry.reason === 'next-pool' &&
    stageAdvanceAfterExit.next?.poolKey;
  const startedSession = shouldRunOnEnter
    ? startCycleBeforePoolEntry(sessionAfterPoolEntry, stageAdvanceAfterExit.next.poolKey)
    : sessionAfterPoolEntry;
  const preparedEntry = shouldRunOnEnter
    ? prepareAndValidatePoolEntry(startedSession, stageAdvanceAfterExit.next.poolKey)
    : { ok: true, errors: [], session: startedSession };
  if (!preparedEntry.ok) {
    return {
      session: preparedEntry.session,
      stageAdvance: {
        ...stageAdvanceAfterExit,
        ok: false,
        errors: preparedEntry.errors,
        reason: 'pool-entry-failed',
        cycle: preparedEntry.session.cycle,
        next: null
      },
      objectiveEvaluation: exitState.objectiveEvaluation,
      playOutcome: exitState.playOutcome,
      eventResponses: [],
      lifecycleResults: exitState.lifecycleResults
    };
  }
  const enterState = shouldRunOnEnter
    ? runLifecycleOperationsOnEnter({
        session: preparedEntry.session,
        poolKey: stageAdvanceAfterExit.next.poolKey
      })
    : {
        session: preparedEntry.session,
        objectiveEvaluation: null,
        playOutcome: null,
        lifecycleResults: []
      };
  const finalStageAdvance = {
    ...stageAdvanceAfterExit,
    cycle: enterState.session.cycle,
    next: enterState.session.playOutcome
      ? null
      : getCurrentStage(enterState.session)
  };

  return {
    session: enterState.session,
    stageAdvance: finalStageAdvance,
    objectiveEvaluation: enterState.objectiveEvaluation ?? exitState.objectiveEvaluation,
    playOutcome: enterState.playOutcome ?? exitState.playOutcome,
    eventResponses: [],
    lifecycleResults: [
      ...exitState.lifecycleResults,
      ...enterState.lifecycleResults
    ]
  };
}

function shouldRunLifecycleOperationsAfterStageCompletion(stageAdvance) {
  return ['pool-completed', 'no-runnable-stage'].includes(stageAdvance?.reason);
}

function completeCurrentSpecialStage(session, currentStage, input, requestedBy) {
  const sessionWithoutStage = completeSpecialStage(session, {
    requestedBy,
    reason: input.reason ?? 'manual_completion'
  });
  const sessionWithCompletion = appendStageHistory(sessionWithoutStage, {
    poolKey: null,
    stageId: currentStage.stageId,
    stageKey: currentStage.stageKey,
    requestedBy,
    actorIds: [...(input.actorIds ?? [])],
    actionKey: input.actionKey ?? null,
    reason: input.reason ?? 'manual_completion',
    metadata: {
      ...(input.metadata ?? {}),
      source: CURRENT_STAGE_SOURCES.SPECIAL_STAGES
    }
  });
  const nextSpecialStage = getCurrentSpecialStage(sessionWithCompletion);

  if (nextSpecialStage) {
    return {
      ok: true,
      errors: [],
      session: sessionWithCompletion,
      stage: currentStage,
      stageAdvance: {
        ok: true,
        errors: [],
        reason: 'next-special-stage',
        next: {
          poolKey: null,
          stageId: nextSpecialStage.id,
          stageKey: nextSpecialStage.key,
          status: nextSpecialStage.status,
          index: 0,
          source: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
          stage: nextSpecialStage
        }
      },
      completion: sessionWithCompletion.stageHistory.at(-1),
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      lifecycleResults: []
    };
  }

  const objectiveState = runCheckObjectivesLifecycleOperation(sessionWithCompletion, {
    key: STAGE_ACTION_KEYS.CHECK_OBJECTIVES,
    metadata: { reason: 'special_stages_empty' }
  });
  const poolEntry = objectiveState.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: 'play-concluded',
        cycle: objectiveState.session.cycle,
        next: null
      }
    : enterNextPool(
        objectiveState.session.cycle,
        objectiveState.session.cycle?.poolNext
      );
  const sessionAfterPoolEntry = {
    ...objectiveState.session,
    cycle: poolEntry.cycle
  };
  const startedSession =
    poolEntry.ok && poolEntry.reason === 'next-pool' && poolEntry.next?.poolKey
      ? startCycleBeforePoolEntry(sessionAfterPoolEntry, poolEntry.next.poolKey)
      : sessionAfterPoolEntry;
  const preparedEntry =
    poolEntry.ok && poolEntry.reason === 'next-pool' && poolEntry.next?.poolKey
      ? prepareAndValidatePoolEntry(startedSession, poolEntry.next.poolKey)
      : { ok: true, errors: [], session: startedSession };
  const enterState =
    preparedEntry.ok &&
    poolEntry.ok &&
    poolEntry.reason === 'next-pool' &&
    poolEntry.next?.poolKey
      ? runLifecycleOperationsOnEnter({
          session: preparedEntry.session,
          poolKey: poolEntry.next.poolKey
        })
      : {
          session: preparedEntry.session,
          lifecycleResults: []
        };
  const nextSession = enterState.session;

  return {
    ok: poolEntry.ok && preparedEntry.ok,
    errors: [...(poolEntry.errors ?? []), ...(preparedEntry.errors ?? [])],
    session: nextSession,
    stage: currentStage,
    stageAdvance: poolEntry,
    completion: nextSession.stageHistory.at(-1),
    objectiveEvaluation: objectiveState.objectiveEvaluation,
    playOutcome: objectiveState.playOutcome,
    eventResponses: [],
    lifecycleResults: [
      ...objectiveState.lifecycleResults,
      ...(enterState.lifecycleResults ?? [])
    ]
  };
}

function getPostActionEventState({
  previousSession,
  actionResolution,
  context
}) {
  if (!actionResolution.ok) {
    return {
      session: actionResolution.session,
      events: [],
      eventResponses: []
    };
  }

  const eventProcessing = processActionResultEvents({
    previousSession,
    session: actionResolution.session,
    actionResult: actionResolution.result,
    context
  });

  return {
    session: eventProcessing.session,
    events: eventProcessing.events,
    eventResponses: eventProcessing.responses
  };
}

// Anade una entrada al historial de stages.
//
// Cerrar un stage no es una accion de juego. Por eso no se registra en
// actionHistory: vive en stageHistory para poder reconstruir quien decidio pasar
// al siguiente stage y por que.
export function appendStageHistory(session, entry = {}) {
  const requestedBy = isValidStageCompletionRequester(entry.requestedBy)
    ? entry.requestedBy
    : STAGE_COMPLETION_REQUESTED_BY.DIRECTOR;
  const normalizedEntry = {
    poolKey: entry.poolKey ?? null,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    requestedBy,
    actorIds: [...(entry.actorIds ?? [])],
    actionKey: entry.actionKey ?? null,
    reason: entry.reason ?? 'manual_completion',
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'stageHistory', normalizedEntry, {
    getId: (item, history) =>
      `stage-completion-${item.stageId ?? item.stageKey ?? 'stage'}-${history.length}`
  });
}

// Cierra el stage actual y avanza el cursor.
//
// Esta es la puerta normal para pasar al siguiente stage. La puede invocar:
// - el actor, cuando termina sus decisiones;
// - el director/narrador, cuando decide que el ritmo debe avanzar;
// - una receta, si en el futuro una regla concreta pide cierre automatico;
// - el sistema, para automatizaciones controladas.
export function completeCurrentStage(session, input = {}) {
  const currentStage = getCurrentStage(session);

  if (!session) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_SESSION,
          message: 'cannot complete a stage without session'
        }
      ],
      session,
      stage: null,
      stageAdvance: null
    };
  }

  if (!session.cycle && session.currentStageSource !== CURRENT_STAGE_SOURCES.SPECIAL_STAGES) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_STAGE_POOLS,
          message: 'session has no cycle'
        }
      ],
      session,
      stage: null,
      stageAdvance: null
    };
  }

  if (!currentStage) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_CURRENT_STAGE,
          message: 'session has no current stage'
        }
      ],
      session,
      stage: null,
      stageAdvance: null
    };
  }

  if (!isStageRunnable(currentStage.stage)) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.STAGE_NOT_RUNNABLE,
          message: `current stage "${currentStage.stageKey}" is not runnable`,
          poolKey: currentStage.poolKey,
          stageId: currentStage.stageId,
          stageKey: currentStage.stageKey,
          status: currentStage.status
        }
      ],
      session,
      stage: currentStage,
      stageAdvance: null
    };
  }

  const requestedBy = isValidStageCompletionRequester(input.requestedBy)
    ? input.requestedBy
    : STAGE_COMPLETION_REQUESTED_BY.DIRECTOR;

  if (!canRequesterCompleteStage(currentStage.stage, requestedBy)) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.COMPLETION_NOT_ALLOWED,
          message: `requester "${requestedBy}" cannot complete stage "${currentStage.stageKey}"`,
          poolKey: currentStage.poolKey,
          stageId: currentStage.stageId,
          stageKey: currentStage.stageKey,
          requestedBy,
          allowedRequesters: getStageCompletionDefinition(currentStage.stage).allowedRequesters
        }
      ],
      session,
      stage: currentStage,
      stageAdvance: null
    };
  }

  if (currentStage.source === CURRENT_STAGE_SOURCES.SPECIAL_STAGES) {
    return completeCurrentSpecialStage(session, currentStage, input, requestedBy);
  }

  const sessionWithCompletion = appendStageHistory(session, {
    poolKey: currentStage.poolKey,
    stageId: currentStage.stageId,
    stageKey: currentStage.stageKey,
    requestedBy,
    actorIds: [...(input.actorIds ?? [])],
    actionKey: input.actionKey ?? null,
    reason: input.reason ?? 'manual_completion',
    metadata: input.metadata ?? {}
  });
  const sessionAfterStageBoundary = reviewPropertyBlocks(sessionWithCompletion, {
    type: 'stage_boundary',
    cycleId: session.cycle?.id ?? 0,
    poolKey: currentStage.poolKey,
    stageId: currentStage.stageId,
    boundary: 'after'
  }).session;
  const currentPool = getCurrentPool(sessionAfterStageBoundary.cycle);
  const poolAdvance = advanceStageCursor(currentPool);
  const nextCycle = updateCyclePool(sessionAfterStageBoundary.cycle, poolAdvance.pool);
  const stageAdvance = {
    ...poolAdvance,
    cycle: nextCycle,
    current: poolAdvance.current
      ? { ...poolAdvance.current, poolKey: sessionAfterStageBoundary.cycle.poolCurrent }
      : null,
    next: poolAdvance.next
      ? { ...poolAdvance.next, poolKey: sessionAfterStageBoundary.cycle.poolCurrent }
      : null
  };
  const objectiveState = getPostCompletionLifecycleOperationState({
    session: {
      ...sessionAfterStageBoundary,
      cycle: stageAdvance.cycle
    },
    stageAdvance
  });

  return {
    ok: objectiveState.stageAdvance?.ok !== false,
    errors: objectiveState.stageAdvance?.errors ?? [],
    session: objectiveState.session,
    stage: currentStage,
    stageAdvance: objectiveState.stageAdvance,
    completion: objectiveState.session.stageHistory.at(-1),
    objectiveEvaluation: objectiveState.objectiveEvaluation,
    playOutcome: objectiveState.playOutcome,
    eventResponses: objectiveState.eventResponses,
    lifecycleResults: objectiveState.lifecycleResults
  };
}

// Ejecuta una receta del stage actual.
//
// Flujo:
// 1. Valida que existe un stage enabled con action.
// 2. Ejecuta esa action con actionModel.
// 3. Si la action falla, conserva la sesion y no avanza.
// 4. Si la action termina bien, el stage sigue abierto.
//
// Pasar al siguiente stage es responsabilidad de completeCurrentStage.
export function resolveCurrentStage(session, input = {}) {
  const currentStageBeforeReview = getCurrentStage(session);
  const workingSession =
    currentStageBeforeReview &&
    currentStageBeforeReview.source !== CURRENT_STAGE_SOURCES.SPECIAL_STAGES
      ? reviewPropertyBlocks(session, {
          type: 'stage_boundary',
          cycleId: session.cycle?.id ?? 0,
          poolKey: currentStageBeforeReview.poolKey,
          stageId: currentStageBeforeReview.stageId,
          boundary: 'before'
        }).session
      : session;
  const stageValidation = validateCurrentStage(workingSession, {
    actionKey: input.actionKey ?? null
  });

  if (!stageValidation.ok) {
    const messageState = appendEngineErrors(workingSession, stageValidation.errors, {
      cycleId: workingSession?.cycle?.id ?? null,
      poolKey: stageValidation.currentStage?.poolKey ?? workingSession?.cycle?.poolCurrent ?? null,
      stageId: stageValidation.currentStage?.stageId ?? null,
      stageKey: stageValidation.currentStage?.stageKey ?? null,
      actionKey: input.actionKey ?? null
    });

    return {
      ok: false,
      actionId: stageValidation.action?.id ?? null,
      actionKey: stageValidation.actionKey,
      errors: stageValidation.errors,
      messages: messageState.messages,
      session: messageState.session,
      result: null,
      stage: stageValidation.currentStage,
      stageAdvance: null
    };
  }

  const recipeInput = {
    ...input,
    actorIds: input.actorIds ?? stageValidation.currentStage.stage?.actorIds ?? []
  };
  const resolutionContext = {
    poolKey: stageValidation.currentStage.poolKey,
    stageId: stageValidation.currentStage.stageId,
    stageKey: stageValidation.currentStage.stageKey,
    causedBy: stageValidation.currentStage.stage?.metadata?.source?.id
      ? {
          type: stageValidation.currentStage.stage.metadata.source.type ?? 'role',
          id: stageValidation.currentStage.stage.metadata.source.id
        }
      : null,
    actionKey: stageValidation.actionKey
  };
  const actionResolution = hasStageSelectionRules(stageValidation.currentStage.stage)
    ? resolveSelectionStageRecipe(
        workingSession,
        stageValidation.currentStage.stage,
        stageValidation.action,
        recipeInput,
        resolutionContext
      )
    : resolveRecipe(
        workingSession,
        stageValidation.action,
        recipeInput,
        resolutionContext
      );
  const postActionState = getPostActionEventState({
    previousSession: workingSession,
    actionResolution,
    context: resolutionContext
  });
  const resolutionWithEvents = actionResolution.ok
    ? {
        ...actionResolution,
        session: postActionState.session,
        result: {
          ...(actionResolution.result ?? {}),
          events: postActionState.events,
          eventResponses: postActionState.eventResponses
        }
      }
    : actionResolution;

  return {
    ...resolutionWithEvents,
    stage: stageValidation.currentStage,
    stageAdvance: null
  };
}

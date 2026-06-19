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
  enterNextPool,
  getCurrentStageCursor,
  isStageRunnable
} from './poolCursorModel.js';
import { appendEntry } from './historyModel.js';
import { resolveRecipe } from './recipeModel.js';
import { ACTION_IDS, VISIBILITY, resolveAction } from './actionModel.js';
import { processActionResultEvents } from './eventModel.js';
import { normalizeId } from './sessionModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  OBJECTIVE_EVALUATION_STATUSES,
  checkObjectives,
  getPendingObjectiveInfluenceStages
} from './objectiveModel.js';
import { SELECTION_OUTCOME_TYPES } from './selectionModel.js';
import {
  activateSpecialStages,
  completeSpecialStage,
  getCurrentSpecialStage,
  hasPendingSpecialStages
} from './specialStagesModel.js';

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
  START_CYCLE: 'start_cycle',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

// Devuelve el stage actual con su contexto de pool.
//
// Devuelve el stage apuntado por el cursor de pools.
export function getCurrentStage(session) {
  if (session?.specialStagesActive) {
    const stage = getCurrentSpecialStage(session);
    if (!stage) return null;
    return {
      poolKey: null,
      stageKey: stage.key,
      status: stage.status,
      index: 0,
      special: true,
      stage
    };
  }
  return getCurrentStageCursor(session?.stagePools);
}

// Extrae las acciones declaradas por un stage.
//
// Soportamos dos ubicaciones:
// - stage.actions: formato recomendado;
// - stage.action: compatibilidad temporal;
// - stage.metadata.action: compatibilidad con definiciones antiguas.
export function getStageActions(stage) {
  if (Array.isArray(stage?.actions) && stage.actions.length > 0) {
    return stage.actions.map((action) => ({ ...action }));
  }
  if (stage?.action) return [{ ...stage.action }];
  if (stage?.metadata?.action) return [{ ...stage.metadata.action }];
  return [];
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

  if (!session.stagePools && !session.specialStagesActive) {
    errors.push({
      code: STAGE_ERRORS.MISSING_STAGE_POOLS,
      message: 'session has no stagePools'
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
      stageKey: currentStage.stageKey,
      status: currentStage.status
    });
  }

  const actions = getStageActions(currentStage.stage);
  const selectedAction = selectStageAction(actions, actionKey);

  if (!selectedAction.ok) {
    errors.push({
      ...selectedAction.error,
      message: `${selectedAction.error.message} in stage "${currentStage.stageKey}"`,
      poolKey: currentStage.poolKey,
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
    blockedActions: recipeResult?.blockedActions ?? [],
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

function applyConcludePlayAutomaticStageIfNeeded({ session, objectiveEvaluation }) {
  if (
    objectiveEvaluation?.status !== OBJECTIVE_EVALUATION_STATUSES.FULFILLED ||
    !objectiveEvaluation?.playOutcome?.conclusive
  ) {
    return {
      session,
      automaticStageResults: [],
      objectiveEvaluation
    };
  }

  if (session?.playOutcome) {
    return {
      session,
      automaticStageResults: [],
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
      automaticStageResults: [],
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
      automaticStageResults: [
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
    automaticStageResults: [
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

function getAutomaticStages(stagePools = {}, poolKey = null, timing = 'onExit') {
  if (!poolKey) return [];
  return stagePools?.automaticStages?.[poolKey]?.[timing] ?? [];
}

function createAutomaticStageResult({ key, ok = true, result = null, errors = [], metadata = {} }) {
  return {
    key,
    ok,
    result,
    errors,
    metadata: { ...metadata }
  };
}

function runCheckObjectivesAutomaticStage(session = {}, automaticStage = {}) {
  const objectiveEvaluation = checkObjectives(session);
  const concludePlayState = applyConcludePlayAutomaticStageIfNeeded({
    session,
    objectiveEvaluation
  });

  return {
    session: concludePlayState.session,
    objectiveEvaluation: concludePlayState.objectiveEvaluation,
    playOutcome: concludePlayState.objectiveEvaluation?.playOutcome ?? null,
    automaticStageResults: [
      createAutomaticStageResult({
        key: STAGE_ACTION_KEYS.CHECK_OBJECTIVES,
        result: concludePlayState.objectiveEvaluation,
        metadata: automaticStage.metadata
      }),
      ...concludePlayState.automaticStageResults
    ]
  };
}

function runStartCycleAutomaticStage(session = {}, automaticStage = {}) {
  const started = resolveAction(session, getCatalogRecipe(RECIPE_KEYS.START_CYCLE));

  return {
    session: started.ok ? started.session : session,
    objectiveEvaluation: null,
    playOutcome: null,
    automaticStageResults: [
      createAutomaticStageResult({
        key: STAGE_ACTION_KEYS.START_CYCLE,
        ok: started.ok,
        result: started.result,
        errors: started.errors,
        metadata: automaticStage.metadata
      })
    ]
  };
}

function runAutomaticStage(session = {}, automaticStage = {}) {
  const key = normalizeId(automaticStage.key);

  if (key === STAGE_ACTION_KEYS.CHECK_OBJECTIVES) {
    return runCheckObjectivesAutomaticStage(session, automaticStage);
  }

  if (key === STAGE_ACTION_KEYS.START_CYCLE) {
    return runStartCycleAutomaticStage(session, automaticStage);
  }

  return {
    session,
    objectiveEvaluation: null,
    playOutcome: null,
    automaticStageResults: [
      createAutomaticStageResult({
        key,
        ok: false,
        errors: [
          {
            code: 'automatic-stage/unsupported',
            message: `unsupported automaticStage "${key}"`
          }
        ],
        metadata: automaticStage.metadata
      })
    ]
  };
}

function runAutomaticStages(session = {}, automaticStages = []) {
  return (automaticStages ?? []).reduce(
    (state, automaticStage) => {
      if (state.session?.playOutcome) return state;

      const resolved = runAutomaticStage(state.session, automaticStage);

      return {
        session: resolved.session,
        objectiveEvaluation: resolved.objectiveEvaluation ?? state.objectiveEvaluation,
        playOutcome: resolved.playOutcome ?? state.playOutcome,
        automaticStageResults: [
          ...state.automaticStageResults,
          ...resolved.automaticStageResults
        ]
      };
    },
    {
      session,
      objectiveEvaluation: null,
      playOutcome: null,
      automaticStageResults: []
    }
  );
}

function runAutomaticStagesOnExit({ session = {}, poolKey = null } = {}) {
  return runAutomaticStages(
    session,
    getAutomaticStages(session.stagePools, poolKey, 'onExit')
  );
}

function runAutomaticStagesOnEnter({ session = {}, poolKey = null } = {}) {
  return runAutomaticStages(
    session,
    getAutomaticStages(session.stagePools, poolKey, 'onEnter')
  );
}

function getPostCompletionAutomaticStageState({ session, stageAdvance }) {
  if (!shouldRunAutomaticStagesAfterStageCompletion(stageAdvance)) {
    return {
      session,
      stageAdvance,
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      automaticStageResults: []
    };
  }

  const exitState = runAutomaticStagesOnExit({
    session,
    poolKey: stageAdvance.current?.poolKey
  });
  const sessionBeforePoolEntry = hasPendingSpecialStages(exitState.session)
    ? activateSpecialStages(exitState.session)
    : exitState.session;
  const specialStage = getCurrentSpecialStage(sessionBeforePoolEntry);
  const poolEntry = exitState.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: stageAdvance.reason,
        stagePools: exitState.session.stagePools,
        next: null
      }
    : specialStage
      ? {
          ok: true,
          errors: [],
          reason: 'special-stages-before-next-pool',
          stagePools: sessionBeforePoolEntry.stagePools,
          next: {
            poolKey: null,
            stageKey: specialStage.key,
            status: specialStage.status,
            index: 0,
            special: true,
            stage: specialStage
          }
        }
      : enterNextPool(
          sessionBeforePoolEntry.stagePools,
          stageAdvance.stagePools.poolNext
        );
  const sessionAfterPoolEntry = {
    ...sessionBeforePoolEntry,
    stagePools: poolEntry.stagePools
  };
  const stageAdvanceAfterExit = {
    ...stageAdvance,
    ok: poolEntry.ok,
    errors: poolEntry.errors,
    reason: poolEntry.reason,
    stagePools: poolEntry.stagePools,
    next: exitState.session.playOutcome
      ? null
      : poolEntry.next
  };
  const shouldRunOnEnter =
    !exitState.session.playOutcome &&
    poolEntry.ok &&
    poolEntry.reason === 'next-pool' &&
    stageAdvanceAfterExit.next?.poolKey;
  const enterState = shouldRunOnEnter
    ? runAutomaticStagesOnEnter({
        session: sessionAfterPoolEntry,
        poolKey: stageAdvanceAfterExit.next.poolKey
      })
    : {
        session: sessionAfterPoolEntry,
        objectiveEvaluation: null,
        playOutcome: null,
        automaticStageResults: []
      };
  const finalStageAdvance = {
    ...stageAdvanceAfterExit,
    stagePools: enterState.session.stagePools,
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
    automaticStageResults: [
      ...exitState.automaticStageResults,
      ...enterState.automaticStageResults
    ]
  };
}

function shouldRunAutomaticStagesAfterStageCompletion(stageAdvance) {
  return ['pool-completed', 'no-runnable-stage'].includes(stageAdvance?.reason);
}

function completeCurrentSpecialStage(session, currentStage, input, requestedBy) {
  const sessionWithoutStage = completeSpecialStage(session, {
    requestedBy,
    reason: input.reason ?? 'manual_completion'
  });
  const sessionWithCompletion = appendStageHistory(sessionWithoutStage, {
    poolKey: null,
    stageKey: currentStage.stageKey,
    requestedBy,
    actorIds: [...(input.actorIds ?? [])],
    actionKey: input.actionKey ?? null,
    reason: input.reason ?? 'manual_completion',
    metadata: {
      ...(input.metadata ?? {}),
      special: true
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
          stageKey: nextSpecialStage.key,
          status: nextSpecialStage.status,
          index: 0,
          special: true,
          stage: nextSpecialStage
        }
      },
      completion: sessionWithCompletion.stageHistory.at(-1),
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      automaticStageResults: []
    };
  }

  const objectiveState = runCheckObjectivesAutomaticStage(sessionWithCompletion, {
    key: STAGE_ACTION_KEYS.CHECK_OBJECTIVES,
    metadata: { reason: 'special_stages_empty' }
  });
  const poolEntry = objectiveState.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: 'play-concluded',
        stagePools: objectiveState.session.stagePools,
        next: null
      }
    : enterNextPool(
        objectiveState.session.stagePools,
        objectiveState.session.stagePools?.poolNext
      );
  const sessionAfterPoolEntry = {
    ...objectiveState.session,
    specialStagesActive: false,
    stagePools: poolEntry.stagePools
  };
  const enterState =
    poolEntry.ok && poolEntry.reason === 'next-pool' && poolEntry.next?.poolKey
      ? runAutomaticStagesOnEnter({
          session: sessionAfterPoolEntry,
          poolKey: poolEntry.next.poolKey
        })
      : {
          session: sessionAfterPoolEntry,
          automaticStageResults: []
        };
  const nextSession = enterState.session;

  return {
    ok: poolEntry.ok,
    errors: poolEntry.errors,
    session: nextSession,
    stage: currentStage,
    stageAdvance: poolEntry,
    completion: nextSession.stageHistory.at(-1),
    objectiveEvaluation: objectiveState.objectiveEvaluation,
    playOutcome: objectiveState.playOutcome,
    eventResponses: [],
    automaticStageResults: [
      ...objectiveState.automaticStageResults,
      ...(enterState.automaticStageResults ?? [])
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
    stageKey: entry.stageKey ?? null,
    requestedBy,
    actorIds: [...(entry.actorIds ?? [])],
    actionKey: entry.actionKey ?? null,
    reason: entry.reason ?? 'manual_completion',
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'stageHistory', normalizedEntry, {
    getId: (item, history) => `stage-completion-${item.stageKey ?? 'stage'}-${history.length}`
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

  if (!session.stagePools && !session.specialStagesActive) {
    return {
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_STAGE_POOLS,
          message: 'session has no stagePools'
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

  if (currentStage.special) {
    return completeCurrentSpecialStage(session, currentStage, input, requestedBy);
  }

  const stageAdvance = advanceStageCursor(session.stagePools);
  const sessionWithCompletion = appendStageHistory(
    {
      ...session,
      stagePools: stageAdvance.stagePools
    },
    {
      poolKey: currentStage.poolKey,
      stageKey: currentStage.stageKey,
      requestedBy,
      actorIds: [...(input.actorIds ?? [])],
      actionKey: input.actionKey ?? null,
      reason: input.reason ?? 'manual_completion',
      metadata: input.metadata ?? {}
    }
  );
  const objectiveState = getPostCompletionAutomaticStageState({
    session: sessionWithCompletion,
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
    automaticStageResults: objectiveState.automaticStageResults
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
// Pasar al siguiente stage es responsabilidad de completeCurrentStage. La opcion
// advanceOnSuccess queda solo como compatibilidad para pruebas o automatizaciones
// explicitamente pedidas.
export function resolveCurrentStage(session, input = {}, options = {}) {
  const advanceOnSuccess = options.advanceOnSuccess ?? false;
  const stageValidation = validateCurrentStage(session, {
    actionKey: input.actionKey ?? options.actionKey ?? null
  });

  if (!stageValidation.ok) {
    return {
      ok: false,
      actionId: stageValidation.action?.id ?? null,
      actionKey: stageValidation.actionKey,
      errors: stageValidation.errors,
      session,
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
    stageKey: stageValidation.currentStage.stageKey,
    actionKey: stageValidation.actionKey
  };
  const actionResolution = hasStageSelectionRules(stageValidation.currentStage.stage)
    ? resolveSelectionStageRecipe(
        session,
        stageValidation.currentStage.stage,
        stageValidation.action,
        recipeInput,
        resolutionContext
      )
    : resolveRecipe(session, stageValidation.action, recipeInput, resolutionContext);
  const postActionState = getPostActionEventState({
    previousSession: session,
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

  if (!resolutionWithEvents.ok || !advanceOnSuccess) {
    return {
      ...resolutionWithEvents,
      stage: stageValidation.currentStage,
      stageAdvance: null
    };
  }

  const completion = completeCurrentStage(resolutionWithEvents.session, {
    requestedBy: options.requestedBy ?? STAGE_COMPLETION_REQUESTED_BY.SYSTEM,
    actorIds: [...(input.actorIds ?? [])],
    actionKey: stageValidation.actionKey,
    reason: options.completionReason ?? 'auto_advance_on_success'
  });

  if (!completion.ok) {
    return {
      ...resolutionWithEvents,
      stage: stageValidation.currentStage,
      stageAdvance: null,
      completion
    };
  }

  return {
    ...resolutionWithEvents,
    session: completion.session,
    stage: stageValidation.currentStage,
    stageAdvance: completion.stageAdvance,
    completion: completion.completion
  };
}

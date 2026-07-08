// stageModel.js
// -----------------------------------------------------------------------------
// Este archivo conecta poolCursorModel con actionModel.
//
// Responsabilidad:
// - leer el stage actual de poolCursorModel;
// - comprobar que ese stage es ejecutable;
// - extraer la recipe declarada por el stage;
// - pedir a actionModel que la resuelva;
// - cerrar explicitamente el stage cuando player/director/sistema lo pidan.
//
// No decide reglas de juego complejas. Si empieza a hacerlo, se estaria
// convirtiendo en una segunda actionModel. Su trabajo es coordinar, no resolver.
// -----------------------------------------------------------------------------

import { isStageRunnable } from './poolCursorModel.js';
import {
  STAGE_ERRORS,
  STAGE_RECIPE_KEYS,
  STAGE_RULE_TYPES,
  PEEK_RECIPE_KEYS,
  PEEK_WARNING_TIMINGS,
  PEEK_WARNING_CONFIRMATION_RULES,
  getStageRecipeKey,
  selectStageRecipe,
  isValidStageCompletionRequester,
  getStageCompletionDefinition,
  canRequesterCompleteStage
} from './stageDefinition.js';
import {
  enterNextPool,
  continueAfterWindow,
  getCurrentCycleStage,
  prepareAndValidatePoolEntry,
  resolveCycleAfterStageFinished,
  runCheckObjectivesLifecycleOperation,
  runLifecycleOperationsOnEnter,
  startCycleBeforePoolEntry,
} from './cycleModel.js';
import {
  HISTORY_COLLECTIONS,
  appendStageHistory,
  getHistoryCollection
} from './historyModel.js';
import {
  appendRecipeNoEffectHistory,
  resolveRecipe
} from './recipeModel.js';
import {
  ACTION_IDS,
  SELECT_OUTCOME_TYPES,
  buildSelectActionInput,
  resolveAction
} from './actionModel.js';
import { VISIBILITY } from './surfaceModel.js';
import {
  processActionResultEvents,
  resolveEventStageOnCompletion
} from './eventModel.js';
import { CURRENT_STAGE_SOURCES, normalizeId } from './sessionModel.js';
import { RECIPE_ACTOR_TYPES } from './domainTypes.js';
import {
  completeInterPoolStage,
  getCurrentInterPoolStage
} from './interPoolQueueModel.js';
import { reviewPropertyBlocks } from './roleModel.js';
import {
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY
} from './stageTypes.js';
import { createMessagesFromEngineErrors } from '../messages/messageModel.js';
import { routeMessages } from '../messages/messageLogModel.js';

export { STAGE_COMPLETION_MODES, STAGE_COMPLETION_REQUESTED_BY };

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

// Devuelve el stage actual con su contexto de pool.
//
// Devuelve el stage apuntado por el cursor de pools.
export function getCurrentStage(session) {
  if (session?.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
    const stage = getCurrentInterPoolStage(session);
    if (!stage) return null;
    return {
      poolKey: null,
      stageId: stage.id,
      stageKey: stage.key,
      status: stage.status,
      index: 0,
      source: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
      stage
    };
  }
  return getCurrentCycleStage(session?.cycle);
}

// Valida que el stage actual pueda ejecutarse.
//
// Esta validacion no revisa targets, filtros ni efectos. Eso pertenece a
// actionModel. Aqui solo comprobamos que existe un stage ejecutable con una
// recipe declarada.
export function validateCurrentStage(session, { recipeKey = null } = {}) {
  const errors = [];

  if (!session) {
    errors.push({
      code: STAGE_ERRORS.MISSING_SESSION,
      message: 'cannot resolve a stage without session'
    });
    return {
      ok: false,
      currentStage: null,
      recipe: null,
      recipeKey: null,
      errors
    };
  }

  if (!session.cycle && session.currentStageSource !== CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
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
      recipe: null,
      recipeKey: null,
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

  const recipes = (currentStage.stage?.recipes ?? []).map((recipe) => ({ ...recipe }));
  const selectedRecipe = selectStageRecipe(recipes, recipeKey);

  if (!selectedRecipe.ok) {
    errors.push({
      ...selectedRecipe.error,
      message: `${selectedRecipe.error.message} in stage "${currentStage.stageKey}"`,
      poolKey: currentStage.poolKey,
      stageId: currentStage.stageId,
      stageKey: currentStage.stageKey
    });
  }

  return {
    ok: errors.length === 0,
    currentStage,
    recipe: selectedRecipe.recipe,
    recipeKey: selectedRecipe.recipeKey,
    errors
  };
}

function getStageSelectionRules(stage = {}) {
  return stage?.selectionRules ?? null;
}

function hasStageSelectionRules(stage = {}) {
  return !!getStageSelectionRules(stage);
}

function getRecipeInputFromSelection({ stage = {}, input = {}, chosenId = null }) {
  const { recipeActorType = null, ...recipeInput } = input;

  return {
    ...recipeInput,
    actorIds:
      recipeActorType === RECIPE_ACTOR_TYPES.ROLE
        ? recipeInput.actorIds ?? stage.actorIds ?? []
        : recipeInput.actorIds ?? [],
    targetIds: chosenId ? [chosenId] : []
  };
}

function getStageMatchKeys(stage = {}) {
  return [
    stage.key,
    stage.metadata?.catalogId
  ].map(normalizeId).filter(Boolean);
}

function stageRuleMatchesStage(rule = {}, stage = {}, recipeKey = null) {
  const observedStageKey = normalizeId(rule.observedStageKey);
  const stageKeys = getStageMatchKeys(stage);
  const poolKeys = (rule.poolKeys ?? []).map(normalizeId);
  const recipeKeys = (rule.recipeKeys ?? []).map(normalizeId);

  if (!observedStageKey || !stageKeys.includes(observedStageKey)) return false;
  if (poolKeys.length > 0 && !poolKeys.includes(normalizeId(stage.poolKey))) return false;
  if (recipeKeys.length > 0 && !recipeKeys.includes(normalizeId(recipeKey))) return false;

  return true;
}

function collectActiveStageRules(session = {}, stage = {}, recipeKey = null, type = null) {
  const normalizedType = normalizeId(type);

  return (session.roles ?? []).flatMap((role) =>
    (role.stageRules ?? [])
      .filter((rule) => {
        if (normalizedType && normalizeId(rule.type) !== normalizedType) return false;
        if (rule.requireInPlay !== false && role.inPlay !== true) return false;
        return stageRuleMatchesStage(rule, stage, recipeKey);
      })
      .map((rule) => ({ role, rule }))
  );
}

function appendPeekAttemptHistoryIfNeeded({ session, input = {}, stage = {}, context = {}, stageRules = [] }) {
  if (!input.peekAttempt || stageRules.length === 0) return session;

  const requestedRoleId = typeof input.peekAttempt === 'object'
    ? input.peekAttempt.roleId ?? input.peekAttempt.actorId ?? null
    : null;
  const activeRule = requestedRoleId
    ? stageRules.find((entry) => entry.role.id === requestedRoleId)
    : stageRules[0];

  if (!activeRule) return session;

  return appendRecipeNoEffectHistory(session, {
    cycleId: session?.cycle?.id ?? 0,
    poolKey: context.poolKey ?? stage.poolKey ?? null,
    stageId: context.stageId ?? stage.id ?? null,
    stageKey: context.stageKey ?? stage.key ?? null,
    stageCatalogId: context.stageCatalogId ?? stage.metadata?.catalogId ?? null,
    recipeKey: PEEK_RECIPE_KEYS.PEEK_ATTEMPT,
    actionId: PEEK_RECIPE_KEYS.PEEK_ATTEMPT,
    actionSignature: PEEK_RECIPE_KEYS.PEEK_ATTEMPT,
    actorIds: [activeRule.role.id],
    targetIds: [],
    metadata: {
      visibility: 'private',
      stageRuleKey: activeRule.rule.key ?? null,
      stageRuleType: activeRule.rule.type ?? null,
      observedStageKey: activeRule.rule.observedStageKey ?? null,
      count: input.peekAttempt.count ?? null,
      startedAt: input.peekAttempt.startedAt ?? null,
      endedAt: input.peekAttempt.endedAt ?? null,
      durationMs: input.peekAttempt.durationMs ?? null,
      timestamps: [...(input.peekAttempt.timestamps ?? [])],
      revealedRoleIds: [...(input.peekAttempt.revealedRoleIds ?? [])]
    }
  });
}

function getPeekWarningTargetRoleId(warning = {}) {
  return warning.targetRoleId ?? warning.roleId ?? null;
}

function getPeekWarningIssuerRoleId(warning = {}) {
  return warning.issuerRoleId ?? warning.actorId ?? null;
}

function getStageActorIds(stage = {}, input = {}) {
  return [...new Set([...(input.actorIds ?? []), ...(stage.actorIds ?? [])].filter(Boolean))];
}

function getPeekWarningConfirmingRoleIds(warning = {}) {
  const issuerRoleId = getPeekWarningIssuerRoleId(warning);
  return [
    ...new Set([
      issuerRoleId,
      ...(warning.confirmingRoleIds ?? []),
      ...(warning.confirmations ?? [])
    ].filter(Boolean))
  ];
}

function getPeekWarningConfirmationRule(warning = {}, matchingRule = null) {
  const type =
    warning.confirmationRule?.type ??
    warning.confirmationRule ??
    matchingRule?.rule?.confirmationRule?.type ??
    matchingRule?.rule?.confirmationRule ??
    PEEK_WARNING_CONFIRMATION_RULES.UNANIMITY;

  return Object.values(PEEK_WARNING_CONFIRMATION_RULES).includes(type)
    ? type
    : PEEK_WARNING_CONFIRMATION_RULES.UNANIMITY;
}

function isPeekWarningConfirmed({ warning = {}, matchingRule = null, stage = {}, input = {} } = {}) {
  if (warning.confirmed === true || warning.directorOverride === true) return true;

  const actorIds = getStageActorIds(stage, input);
  if (actorIds.length === 0) return false;

  const confirmingRoleIds = getPeekWarningConfirmingRoleIds(warning);
  const actorConfirmations = actorIds.filter((roleId) => confirmingRoleIds.includes(roleId));
  const confirmationRule = getPeekWarningConfirmationRule(warning, matchingRule);

  if (confirmationRule === PEEK_WARNING_CONFIRMATION_RULES.SIMPLE_MAJORITY) {
    return actorConfirmations.length > actorIds.length / 2;
  }

  return actorConfirmations.length === actorIds.length;
}

function isPeekWarningEligible({ session = {}, warning = {}, stage = {}, input = {} } = {}) {
  const issuerRoleId = getPeekWarningIssuerRoleId(warning);
  const targetRoleId = getPeekWarningTargetRoleId(warning);
  const actorIds = getStageActorIds(stage, input);

  if (!issuerRoleId || !targetRoleId) return false;
  if (!actorIds.includes(issuerRoleId)) return false;
  if (actorIds.includes(targetRoleId)) return false;

  const targetRole = (session.roles ?? []).find((role) => role.id === targetRoleId);
  return targetRole?.inPlay === true;
}

function getConfirmedPeekWarningOverride({
  session = {},
  input = {},
  stage = {},
  recipeKey = null,
  normalChosenId = null,
  selectionType = null
} = {}) {
  const warning = input.peekWarning ?? null;
  const targetRoleId = getPeekWarningTargetRoleId(warning ?? {});
  if (!warning || !targetRoleId) return null;
  if (!isPeekWarningEligible({ session, warning, stage, input })) return null;

  const matchingRule = collectActiveStageRules(
    session,
    stage,
    recipeKey,
    STAGE_RULE_TYPES.PEEK_WARNING_OVERRIDE
  )[0] ?? null;
  if (!matchingRule) return null;
  if (!isPeekWarningConfirmed({ warning, matchingRule, stage, input })) return null;

  const timing = warning.timing ?? (normalChosenId
    ? PEEK_WARNING_TIMINGS.AFTER_SELECTION
    : PEEK_WARNING_TIMINGS.SELECTION_NULL);

  return {
    candidateRoleId: targetRoleId,
    previousCandidateRoleId: normalChosenId,
    timing,
    selectionType,
    causedBy: {
      type: PEEK_RECIPE_KEYS.PEEK_WARNING,
      id: warning.id ?? `${PEEK_RECIPE_KEYS.PEEK_WARNING}-${session?.cycle?.id ?? 0}`
    },
    metadata: {
      targetRoleId,
      confirmingRoleIds: getPeekWarningConfirmingRoleIds(warning),
      confirmationRule: getPeekWarningConfirmationRule(warning, matchingRule),
      stageRuleKey: matchingRule.rule.key ?? null,
      stageRuleType: matchingRule.rule.type ?? null,
      overrideRecipeKey:
        matchingRule.rule.overrideRecipeKey ?? PEEK_RECIPE_KEYS.OVERRIDE_SELECTED_CANDIDATE
    }
  };
}

function mergeSelectionAndRecipeResult({ selectionResult = null, recipeResult = null } = {}) {
  return {
    ...(recipeResult ?? {}),
    selection: selectionResult?.selection ?? null,
    selectedCandidateOverride: recipeResult?.selectedCandidateOverride ?? null,
    selectionActionId: selectionResult?.actionId ?? null,
    proposedEffects: recipeResult?.proposedEffects ?? [],
    finalEffects: recipeResult?.finalEffects ?? [],
    preventedPropertyChanges: recipeResult?.preventedPropertyChanges ?? [],
    blockedEffects: recipeResult?.blockedEffects ?? []
  };
}

function resolveStageSelectActionAndRecipe(session, stage, recipe, input = {}, context = {}) {
  const activePeekStageRules = collectActiveStageRules(
    session,
    stage,
    context.recipeKey ?? getStageRecipeKey(recipe),
    STAGE_RULE_TYPES.PEEK_WARNING_OVERRIDE
  );
  const sessionWithPeekAttempt = appendPeekAttemptHistoryIfNeeded({
    session,
    input,
    stage,
    context,
    stageRules: activePeekStageRules
  });
  const earlyPeekOverride = getConfirmedPeekWarningOverride({
    session: sessionWithPeekAttempt,
    input,
    stage,
    recipeKey: context.recipeKey ?? getStageRecipeKey(recipe),
    normalChosenId: null,
    selectionType: null
  });

  if (earlyPeekOverride?.timing === PEEK_WARNING_TIMINGS.BEFORE_SELECTION) {
    const recipeResolution = resolveRecipe(
      sessionWithPeekAttempt,
      recipe,
      getRecipeInputFromSelection({
        stage,
        input: {
          ...input,
          recipeActorType: recipe.actor?.type ?? null
        },
        chosenId: earlyPeekOverride.candidateRoleId
      }),
      {
        ...context,
        causedBy: earlyPeekOverride.causedBy
      }
    );

    return {
      ...recipeResolution,
      result: {
        ...(recipeResolution.result ?? {}),
        selection: null,
        selectedCandidateOverride: earlyPeekOverride
      }
    };
  }

  const selectionResolution = resolveAction(
    sessionWithPeekAttempt,
    {
      id: ACTION_IDS.SELECT,
      visibility: recipe?.visibility ?? VISIBILITY.ALL
    },
    buildSelectActionInput({
      session,
      selectionSource: stage,
      recipeKey: context.recipeKey ?? getStageRecipeKey(recipe),
      input
    }),
    context
  );

  if (!selectionResolution.ok) return selectionResolution;

  const chosenId = selectionResolution.result?.selection?.chosenId ?? null;
  const peekOverride = getConfirmedPeekWarningOverride({
    session: selectionResolution.session,
    input,
    stage,
    recipeKey: context.recipeKey ?? getStageRecipeKey(recipe),
    normalChosenId: chosenId,
    selectionType: selectionResolution.result?.selection?.type ?? null
  });
  const targetId = peekOverride?.candidateRoleId ?? chosenId;

  if (selectionResolution.result?.selection?.type !== SELECT_OUTCOME_TYPES.CHOSEN || !chosenId) {
    if (!peekOverride?.candidateRoleId) return selectionResolution;
  }

  const recipeResolution = resolveRecipe(
    selectionResolution.session,
    recipe,
    getRecipeInputFromSelection({
      stage,
      input: {
        ...input,
        recipeActorType: recipe.actor?.type ?? null
      },
      chosenId: targetId
    }),
    peekOverride
      ? {
          ...context,
          causedBy: peekOverride.causedBy
        }
      : context
  );

  if (!recipeResolution.ok) {
    return {
      ...recipeResolution,
      result: {
        ...(recipeResolution.result ?? {}),
        selection: selectionResolution.result?.selection ?? null,
        selectedCandidateOverride: peekOverride
      }
    };
  }

  return {
    ...recipeResolution,
    result: mergeSelectionAndRecipeResult({
      selectionResult: selectionResolution.result,
      recipeResult: {
        ...recipeResolution.result,
        selectedCandidateOverride: peekOverride
      }
    })
  };
}

function completeCurrentInterPoolStage(session, currentStage, input, requestedBy) {
  const completedEventWindow = currentStage.stage?.metadata?.eventWindow ?? null;
  const sessionAfterInterPoolStageEffect = resolveEventStageOnCompletion(
    session,
    currentStage
  );
  const sessionWithoutStage = completeInterPoolStage(sessionAfterInterPoolStageEffect, {
    requestedBy,
    reason: input.reason ?? 'manual_completion'
  });
  const sessionWithStageHistory = appendStageHistory(sessionWithoutStage, {
    poolKey: null,
    stageId: currentStage.stageId,
    stageKey: currentStage.stageKey,
    requestedBy,
    actorIds: [...(input.actorIds ?? [])],
    recipeKey: input.recipeKey ?? null,
    reason: input.reason ?? 'manual_completion',
    metadata: {
      ...(input.metadata ?? {}),
      source: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
    }
  });
  const nextInterPoolStage =
    sessionWithStageHistory.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      ? getCurrentInterPoolStage(sessionWithStageHistory)
      : null;

  if (nextInterPoolStage) {
    return {
      ok: true,
      errors: [],
      session: sessionWithStageHistory,
      stage: currentStage,
      stageAdvance: {
        ok: true,
        errors: [],
        reason: 'next-inter-pool-stage',
        next: {
          poolKey: null,
          stageId: nextInterPoolStage.id,
          stageKey: nextInterPoolStage.key,
          status: nextInterPoolStage.status,
          index: 0,
          source: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
          stage: nextInterPoolStage
        }
      },
      completion: getHistoryCollection(sessionWithStageHistory, HISTORY_COLLECTIONS.STAGE).at(-1),
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      lifecycleResults: []
    };
  }

  const objectiveState = runCheckObjectivesLifecycleOperation(sessionWithStageHistory, {
    key: STAGE_RECIPE_KEYS.CHECK_OBJECTIVES,
    metadata: { reason: 'inter_pool_queue_empty' }
  });
  const nextWindowStart = !objectiveState.session.playOutcome
    ? continueAfterWindow({
        session: objectiveState.session,
        eventWindow: completedEventWindow
      })
    : { ok: true, errors: [], session: objectiveState.session, stage: null, lifecycleResults: [] };
  if (!nextWindowStart.ok) {
    return {
      ok: false,
      errors: nextWindowStart.errors,
      session: nextWindowStart.session,
      stage: currentStage,
      stageAdvance: {
        ok: false,
        errors: nextWindowStart.errors,
        reason: 'inter-pool-queue-window-failed',
        cycle: nextWindowStart.session.cycle,
        next: null
      },
      completion: getHistoryCollection(nextWindowStart.session, HISTORY_COLLECTIONS.STAGE).at(-1),
      objectiveEvaluation: objectiveState.objectiveEvaluation,
      playOutcome: objectiveState.playOutcome,
      eventResponses: [],
      lifecycleResults: [
        ...objectiveState.lifecycleResults,
        ...(nextWindowStart.lifecycleResults ?? [])
      ]
    };
  }
  if (nextWindowStart.stage) {
    return {
      ok: true,
      errors: [],
      session: nextWindowStart.session,
      stage: currentStage,
      stageAdvance: {
        ok: true,
        errors: [],
        reason: 'inter-pool-queue-before-next-pool',
        cycle: nextWindowStart.session.cycle,
        next: {
          poolKey: null,
          stageId: nextWindowStart.stage.id,
          stageKey: nextWindowStart.stage.key,
          status: nextWindowStart.stage.status,
          index: 0,
          source: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
          stage: nextWindowStart.stage
        }
      },
      completion: getHistoryCollection(nextWindowStart.session, HISTORY_COLLECTIONS.STAGE).at(-1),
      objectiveEvaluation: objectiveState.objectiveEvaluation,
      playOutcome: objectiveState.playOutcome,
      eventResponses: [],
      lifecycleResults: [
        ...objectiveState.lifecycleResults,
        ...(nextWindowStart.lifecycleResults ?? [])
      ]
    };
  }
  const poolEntry = nextWindowStart.session.playOutcome
    ? {
        ok: true,
        errors: [],
        reason: 'play-concluded',
        cycle: nextWindowStart.session.cycle,
        next: null
      }
    : enterNextPool(
        nextWindowStart.session.cycle,
        nextWindowStart.session.cycle?.poolNext
      );
  const sessionAfterPoolEntry = {
    ...nextWindowStart.session,
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
    completion: getHistoryCollection(nextSession, HISTORY_COLLECTIONS.STAGE).at(-1),
    objectiveEvaluation: objectiveState.objectiveEvaluation,
    playOutcome: objectiveState.playOutcome,
    eventResponses: [],
    lifecycleResults: [
      ...objectiveState.lifecycleResults,
      ...(nextWindowStart.lifecycleResults ?? []),
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

const STAGE_RUNTIME_OPERATIONS = Object.freeze({
  RESOLVE: 'resolve',
  FINISH: 'finish'
});

function startStage({ session, input = {}, operation } = {}) {
  return {
    ok: true,
    session,
    workingSession: session,
    input,
    operation,
    currentStage: getCurrentStage(session),
    stageValidation: null,
    recipeInput: null,
    resolutionContext: null,
    requestedBy: null,
    actionResolution: null,
    errors: [],
    result: null
  };
}

function evaluateStageActionContext(state) {
  const workingSession =
    state.currentStage &&
    state.currentStage.source !== CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      ? reviewPropertyBlocks(state.session, {
          type: 'stage_boundary',
          cycleId: state.session.cycle?.id ?? 0,
          poolKey: state.currentStage.poolKey,
          stageId: state.currentStage.stageId,
          boundary: 'before'
        }).session
      : state.session;
  const stageValidation = validateCurrentStage(workingSession, {
    recipeKey: state.input.recipeKey ?? null
  });

  if (!stageValidation.ok) {
    return {
      ...state,
      ok: false,
      workingSession,
      stageValidation,
      errors: stageValidation.errors
    };
  }

  const recipeInput = {
    ...state.input,
    actorIds: state.input.actorIds ?? stageValidation.currentStage.stage?.actorIds ?? []
  };
  const resolutionContext = {
    poolKey: stageValidation.currentStage.poolKey,
    stageId: stageValidation.currentStage.stageId,
    stageKey: stageValidation.currentStage.stageKey,
    stageCatalogId: stageValidation.currentStage.stage?.metadata?.catalogId ?? null,
    eventWindow: stageValidation.currentStage.stage?.metadata?.eventWindow ?? null,
    causedBy: stageValidation.currentStage.stage?.metadata?.source?.id
      ? {
          type: stageValidation.currentStage.stage.metadata.source.type ?? 'role',
          id: stageValidation.currentStage.stage.metadata.source.id
        }
      : null,
    recipeKey: stageValidation.recipeKey
  };

  return {
    ...state,
    workingSession,
    stageValidation,
    recipeInput,
    resolutionContext
  };
}

function evaluateStageFinishRequest(state) {
  if (!state.session) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_SESSION,
          message: 'cannot complete a stage without session'
        }
      ]
    };
  }

  if (!state.session.cycle && state.session.currentStageSource !== CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_STAGE_POOLS,
          message: 'session has no cycle'
        }
      ]
    };
  }

  if (!state.currentStage) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.MISSING_CURRENT_STAGE,
          message: 'session has no current stage'
        }
      ]
    };
  }

  if (!isStageRunnable(state.currentStage.stage)) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.STAGE_NOT_RUNNABLE,
          message: `current stage "${state.currentStage.stageKey}" is not runnable`,
          poolKey: state.currentStage.poolKey,
          stageId: state.currentStage.stageId,
          stageKey: state.currentStage.stageKey,
          status: state.currentStage.status
        }
      ]
    };
  }

  const requestedBy = isValidStageCompletionRequester(state.input.requestedBy)
    ? state.input.requestedBy
    : STAGE_COMPLETION_REQUESTED_BY.DIRECTOR;

  if (!canRequesterCompleteStage(state.currentStage.stage, requestedBy)) {
    return {
      ...state,
      requestedBy,
      ok: false,
      errors: [
        {
          code: STAGE_ERRORS.COMPLETION_NOT_ALLOWED,
          message: `requester "${requestedBy}" cannot complete stage "${state.currentStage.stageKey}"`,
          poolKey: state.currentStage.poolKey,
          stageId: state.currentStage.stageId,
          stageKey: state.currentStage.stageKey,
          requestedBy,
          allowedRequesters: getStageCompletionDefinition(state.currentStage.stage).allowedRequesters
        }
      ]
    };
  }

  return {
    ...state,
    requestedBy
  };
}

function evaluateStage(state) {
  if (state.operation === STAGE_RUNTIME_OPERATIONS.FINISH) {
    return evaluateStageFinishRequest(state);
  }

  return evaluateStageActionContext(state);
}

function resolveStageAction(state) {
  if (!state.ok) return state;

  const stage = state.stageValidation.currentStage.stage;
  const actionResolution = hasStageSelectionRules(stage)
    ? resolveStageSelectActionAndRecipe(
        state.workingSession,
        stage,
        state.stageValidation.recipe,
        state.recipeInput,
        state.resolutionContext
      )
    : resolveRecipe(
        state.workingSession,
        state.stageValidation.recipe,
        state.recipeInput,
        state.resolutionContext
      );

  return {
    ...state,
    ok: actionResolution.ok,
    actionResolution,
    errors: actionResolution.errors ?? []
  };
}

function resolveStageFinishOperation(state) {
  if (!state.ok) return state;

  if (state.currentStage.source === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
    return {
      ...state,
      result: completeCurrentInterPoolStage(
        state.session,
        state.currentStage,
        state.input,
        state.requestedBy
      )
    };
  }

  const sessionWithStageHistory = appendStageHistory(state.session, {
    poolKey: state.currentStage.poolKey,
    stageId: state.currentStage.stageId,
    stageKey: state.currentStage.stageKey,
    requestedBy: state.requestedBy,
    actorIds: [...(state.input.actorIds ?? [])],
    recipeKey: state.input.recipeKey ?? null,
    reason: state.input.reason ?? 'manual_completion',
    metadata: state.input.metadata ?? {}
  });
  const cycleState = resolveCycleAfterStageFinished({
    session: sessionWithStageHistory,
    currentStage: state.currentStage
  });

  return {
    ...state,
    result: {
      ok: cycleState.stageAdvance?.ok !== false,
      errors: cycleState.stageAdvance?.errors ?? [],
      session: cycleState.session,
      stage: state.currentStage,
      stageAdvance: cycleState.stageAdvance,
      completion: getHistoryCollection(cycleState.session, HISTORY_COLLECTIONS.STAGE).at(-1),
      objectiveEvaluation: cycleState.objectiveEvaluation,
      playOutcome: cycleState.playOutcome,
      eventResponses: cycleState.eventResponses,
      lifecycleResults: cycleState.lifecycleResults
    }
  };
}

function resolveStage(state) {
  if (state.operation === STAGE_RUNTIME_OPERATIONS.FINISH) {
    return resolveStageFinishOperation(state);
  }

  return resolveStageAction(state);
}

function validateStageActionOutcome(state) {
  if (!state.ok) return state;
  if (!state.actionResolution?.ok) return state;

  if (!state.actionResolution.result) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: 'stage/missing-result',
          message: `stage "${state.stageValidation.currentStage.stageKey}" finished without result`,
          stageId: state.stageValidation.currentStage.stageId,
          stageKey: state.stageValidation.currentStage.stageKey
        }
      ]
    };
  }

  return state;
}

function validateStageFinishOutcome(state) {
  if (!state.ok) return state;
  if (!state.result) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: 'stage/finish-missing-result',
          message: `stage "${state.currentStage?.stageKey ?? 'unknown'}" finish ended without result`
        }
      ]
    };
  }

  return state;
}

function validateStageOutcome(state) {
  if (state.operation === STAGE_RUNTIME_OPERATIONS.FINISH) {
    return validateStageFinishOutcome(state);
  }

  return validateStageActionOutcome(state);
}

function finishStageActionResult(state) {
  if (!state.stageValidation?.ok) {
    const messageState = appendEngineErrors(state.workingSession, state.errors, {
      cycleId: state.workingSession?.cycle?.id ?? null,
      poolKey: state.stageValidation?.currentStage?.poolKey ?? state.workingSession?.cycle?.poolCurrent ?? null,
      stageId: state.stageValidation?.currentStage?.stageId ?? null,
      stageKey: state.stageValidation?.currentStage?.stageKey ?? null,
      recipeKey: state.input.recipeKey ?? null
    });

    return {
      ok: false,
      actionId: state.stageValidation?.recipe?.id ?? null,
      recipeKey: state.stageValidation?.recipeKey,
      errors: state.errors,
      messages: messageState.messages,
      session: messageState.session,
      result: null,
      stage: state.stageValidation?.currentStage ?? null,
      stageAdvance: null
    };
  }

  if (!state.actionResolution?.ok) {
    return {
      ...state.actionResolution,
      stage: state.stageValidation.currentStage,
      stageAdvance: null
    };
  }

  if (!state.ok) {
    const messageState = appendEngineErrors(state.actionResolution.session, state.errors, {
      ...state.resolutionContext
    });

    return {
      ok: false,
      actionId: state.actionResolution.result?.actionId ?? null,
      recipeKey: state.stageValidation.recipeKey,
      errors: state.errors,
      messages: messageState.messages,
      session: messageState.session,
      result: null,
      stage: state.stageValidation.currentStage,
      stageAdvance: null
    };
  }

  const postActionState = getPostActionEventState({
    previousSession: state.workingSession,
    actionResolution: state.actionResolution,
    context: state.resolutionContext
  });
  const resolutionWithEvents = {
    ...state.actionResolution,
    session: postActionState.session,
    result: {
      ...(state.actionResolution.result ?? {}),
      events: postActionState.events,
      eventResponses: postActionState.eventResponses
    }
  };

  return {
    ...resolutionWithEvents,
    stage: state.stageValidation.currentStage,
    stageAdvance: null
  };
}

function finishStage(state) {
  if (state.operation === STAGE_RUNTIME_OPERATIONS.RESOLVE) {
    return finishStageActionResult(state);
  }

  if (!state.ok) {
    return {
      ok: false,
      errors: state.errors,
      session: state.session,
      stage: state.currentStage ?? null,
      stageAdvance: null
    };
  }

  return state.result;
}

function runStageLifecycle({ session, input = {}, operation } = {}) {
  return finishStage(
    validateStageOutcome(
      resolveStage(
        evaluateStage(
          startStage({ session, input, operation })
        )
      )
    )
  );
}

// Cierra el stage actual y avanza el cursor.
//
// Esta es la puerta normal para pasar al siguiente stage. La puede invocar:
// - el actor, cuando termina sus decisiones;
// - el director/narrador, cuando decide que el ritmo debe avanzar;
// - una receta, si en el futuro una regla concreta pide cierre automatico;
// - el sistema, para automatizaciones controladas.
export function completeCurrentStage(session, input = {}) {
  return runStageLifecycle({
    session,
    input,
    operation: STAGE_RUNTIME_OPERATIONS.FINISH
  });
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
  return runStageLifecycle({
    session,
    input,
    operation: STAGE_RUNTIME_OPERATIONS.RESOLVE
  });
}

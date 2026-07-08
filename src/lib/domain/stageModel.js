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

import {
  advanceStageCursor,
  isStageRunnable
} from './poolCursorModel.js';
import {
  enterNextPool,
  continueAfterWindow,
  getCurrentCycleStage,
  getCurrentPool,
  getPostCompletionLifecycleOperationState,
  prepareAndValidatePoolEntry,
  runCheckObjectivesLifecycleOperation,
  runLifecycleOperationsOnEnter,
  startCycleBeforePoolEntry,
  updateCyclePool
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
  SELECTION_OUTCOME_TYPES,
  VISIBILITY,
  buildStageSelectionInput,
  resolveAction
} from './actionModel.js';
import { processActionResultEvents } from './eventModel.js';
import { CURRENT_STAGE_SOURCES, normalizeId } from './sessionModel.js';
import { RECIPE_ACTOR_TYPES } from './domainTypes.js';
import { RECIPE_KEYS } from './recipeCatalog.js';
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

export const STAGE_ERRORS = Object.freeze({
  MISSING_SESSION: 'stage/missing-session',
  MISSING_STAGE_POOLS: 'stage/missing-stage-pools',
  MISSING_CURRENT_STAGE: 'stage/missing-current-stage',
  STAGE_NOT_RUNNABLE: 'stage/not-runnable',
  MISSING_RECIPE: 'stage/missing-recipe',
  MISSING_RECIPE_KEY: 'stage/missing-recipe-key',
  RECIPE_NOT_FOUND: 'stage/recipe-not-found',
  COMPLETION_NOT_ALLOWED: 'stage/completion-not-allowed'
});

export const PEEK_RECIPE_KEYS = Object.freeze({
  PEEK_ATTEMPT: 'peekAttempt',
  PEEK_WARNING: 'peek_warning',
  OVERRIDE_SELECTED_CANDIDATE: 'override_selected_candidate'
});

export const PEEK_WARNING_TIMINGS = Object.freeze({
  BEFORE_SELECTION: 'before_selection',
  AFTER_SELECTION: 'after_selection',
  SELECTION_NULL: 'selection_null'
});

export const PEEK_WARNING_CONFIRMATION_RULES = Object.freeze({
  UNANIMITY: 'unanimity',
  SIMPLE_MAJORITY: 'simple_majority'
});

export const STAGE_RULE_TYPES = Object.freeze({
  PEEK_WARNING_OVERRIDE: 'peek_warning_override'
});

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

// IDs anonimos recomendados para slots de ejecucion.
//
// El stage no describe que accion ejecuta. Describe donde ocurre dentro del
// flujo. Las recipes concretas viven en stage.recipes.
export const STAGE_KEYS = Object.freeze({
  STAGE_01: 'stage_01',
  STAGE_02: 'stage_02',
  STAGE_03: 'stage_03',
  STAGE_04: 'stage_04',
  STAGE_05: 'stage_05',
  DELIBERATION: 'stage_deliberation',
  ROLE_STATE_REVEALED: 'stage_role_state_revealed',
  ROLE_REACTIVE_RESPONSE: 'stage_role_reactive_response',
  LINKED_PROPAGATED_EFFECT: 'stage_linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'stage_linked_target_recognition',
  SELECT_DOUBLE_SELECTOR: 'select_double_selector',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector',
  STAGE_08: 'stage_08',
  STAGE_09: 'stage_09'
});

// Claves de receta dentro de un stage.
//
// actionId puede ser generico, por ejemplo set_in_play. recipeKey permite
// distinguir recetas que usan esa misma accion generica con parametros distintos.
export const STAGE_RECIPE_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  ASSUME_ROLE: 'assume_role',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  LINKED_PROPAGATED_EFFECT: 'linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'linked_target_recognition',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

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

// Devuelve la clave mecanica de una recipe dentro del stage.
export function getStageRecipeKey(recipe) {
  return normalizeId(recipe?.key ?? recipe?.recipeKey ?? recipe?.id);
}

// Elige que recipe del stage se va a ejecutar.
//
// Si solo hay una recipe, no exigimos recipeKey. Si hay varias, el input debe
// indicar recipeKey para evitar que el motor elija por posicion sin querer.
export function selectStageRecipe(recipes = [], requestedRecipeKey = null) {
  if (!recipes.length) {
    return {
      ok: false,
      recipe: null,
      recipeKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_RECIPE,
        message: 'current stage has no recipes'
      }
    };
  }

  const normalizedRequestedKey = requestedRecipeKey ? normalizeId(requestedRecipeKey) : null;

  if (!normalizedRequestedKey && recipes.length > 1) {
    return {
      ok: false,
      recipe: null,
      recipeKey: null,
      error: {
        code: STAGE_ERRORS.MISSING_RECIPE_KEY,
        message: 'current stage has multiple recipes and requires recipeKey'
      }
    };
  }

  const selectedRecipe = normalizedRequestedKey
    ? recipes.find((recipe) => getStageRecipeKey(recipe) === normalizedRequestedKey)
    : recipes[0];

  if (!selectedRecipe) {
    return {
      ok: false,
      recipe: null,
      recipeKey: normalizedRequestedKey,
      error: {
        code: STAGE_ERRORS.RECIPE_NOT_FOUND,
        message: `current stage has no recipe "${normalizedRequestedKey}"`,
        recipeKey: normalizedRequestedKey
      }
    };
  }

  const recipeKey = getStageRecipeKey(selectedRecipe);

  return {
    ok: true,
    recipe: {
      ...selectedRecipe,
      key: selectedRecipe.key ?? recipeKey
    },
    recipeKey,
    error: null
  };
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

function getRoleProperty(session = {}, roleId = null, property = null) {
  return (session.roles ?? []).find((role) => role.id === roleId)?.[property];
}

function causalConditionIsMet(session = {}, condition = {}) {
  if (!condition?.targetId || !condition?.property) return false;
  return getRoleProperty(session, condition.targetId, condition.property) === condition.value;
}

function resolveSelectionStageRecipe(session, stage, recipe, input = {}, context = {}) {
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
    buildStageSelectionInput({
      session,
      stage,
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

  if (selectionResolution.result?.selection?.type !== SELECTION_OUTCOME_TYPES.CHOSEN || !chosenId) {
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

function resolveLinkedPropagatedEffectStageOnCompletion(session = {}, currentStage = {}) {
  const stage = currentStage.stage ?? {};
  if (stage.metadata?.catalogId !== 'linked_propagated_effect') return session;

  const effect = stage.metadata?.propagatedEffect ?? null;
  const recipe = (stage.recipes ?? []).find(
    (stageRecipe) => stageRecipe.key === RECIPE_KEYS.LINKED_PROPAGATED_EFFECT
  );
  const action = recipe?.actions?.[0] ?? null;
  const actionId = action?.id ?? ACTION_IDS.SET_PROPERTY;
  const cycleId = session.cycle?.id ?? 0;
  const context = {
    poolKey: null,
    stageId: currentStage.stageId,
    stageKey: currentStage.stageKey,
    stageCatalogId: stage.metadata?.catalogId ?? null,
    eventWindow: stage.metadata?.eventWindow ?? null,
    recipeKey: RECIPE_KEYS.LINKED_PROPAGATED_EFFECT,
    causedBy: effect?.causedBy ?? null
  };

  if (!effect || !recipe || !causalConditionIsMet(session, effect.causalCondition ?? null)) {
    return appendRecipeNoEffectHistory(session, {
      cycleId,
      poolKey: null,
      stageId: currentStage.stageId,
      stageKey: currentStage.stageKey,
      stageCatalogId: stage.metadata?.catalogId ?? null,
      recipeKey: RECIPE_KEYS.LINKED_PROPAGATED_EFFECT,
      actionId,
      actionSignature: actionId,
      actorIds: [],
      targetIds: effect?.targetId ? [effect.targetId] : [],
      proposedEffects: effect ? [effect] : [],
      finalEffects: [],
      blockedEffects: [],
      metadata: {
        reason: 'causal_condition_not_met',
        causalCondition: effect?.causalCondition ?? null
      }
    });
  }

  const previousSession = session;
  const recipeResolution = resolveRecipe(
    session,
    {
      ...recipe,
      actions: [
        {
          ...action,
          effect: {
            type: effect.type,
            targetType: effect.targetType,
            property: effect.property,
            value: effect.value,
            derivedFrom: effect.derivedFrom ?? null
          }
        }
      ]
    },
    { targetIds: [effect.targetId] },
    context
  );

  if (!recipeResolution.ok) return recipeResolution.session;

  return processActionResultEvents({
    previousSession,
    session: recipeResolution.session,
    actionResult: recipeResolution.result,
    context
  }).session;
}

function completeCurrentInterPoolStage(session, currentStage, input, requestedBy) {
  const completedEventWindow = currentStage.stage?.metadata?.eventWindow ?? null;
  const sessionAfterInterPoolStageEffect = resolveLinkedPropagatedEffectStageOnCompletion(
    session,
    currentStage
  );
  const sessionWithoutStage = completeInterPoolStage(sessionAfterInterPoolStageEffect, {
    requestedBy,
    reason: input.reason ?? 'manual_completion'
  });
  const sessionWithCompletion = appendStageHistory(sessionWithoutStage, {
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
    sessionWithCompletion.currentStageSource === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      ? getCurrentInterPoolStage(sessionWithCompletion)
      : null;

  if (nextInterPoolStage) {
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
          stageId: nextInterPoolStage.id,
          stageKey: nextInterPoolStage.key,
          status: nextInterPoolStage.status,
          index: 0,
          source: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
          stage: nextInterPoolStage
        }
      },
      completion: getHistoryCollection(sessionWithCompletion, HISTORY_COLLECTIONS.STAGE).at(-1),
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: [],
      lifecycleResults: []
    };
  }

  const objectiveState = runCheckObjectivesLifecycleOperation(sessionWithCompletion, {
    key: STAGE_RECIPE_KEYS.CHECK_OBJECTIVES,
    metadata: { reason: 'special_stages_empty' }
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
        reason: 'special-stages-before-next-pool',
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

  if (!session.cycle && session.currentStageSource !== CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
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

  if (currentStage.source === CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE) {
    return completeCurrentInterPoolStage(session, currentStage, input, requestedBy);
  }

  const sessionWithCompletion = appendStageHistory(session, {
    poolKey: currentStage.poolKey,
    stageId: currentStage.stageId,
    stageKey: currentStage.stageKey,
    requestedBy,
    actorIds: [...(input.actorIds ?? [])],
    recipeKey: input.recipeKey ?? null,
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
    completion: getHistoryCollection(objectiveState.session, HISTORY_COLLECTIONS.STAGE).at(-1),
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
    currentStageBeforeReview.source !== CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE
      ? reviewPropertyBlocks(session, {
          type: 'stage_boundary',
          cycleId: session.cycle?.id ?? 0,
          poolKey: currentStageBeforeReview.poolKey,
          stageId: currentStageBeforeReview.stageId,
          boundary: 'before'
        }).session
      : session;
  const stageValidation = validateCurrentStage(workingSession, {
    recipeKey: input.recipeKey ?? null
  });

  if (!stageValidation.ok) {
    const messageState = appendEngineErrors(workingSession, stageValidation.errors, {
      cycleId: workingSession?.cycle?.id ?? null,
      poolKey: stageValidation.currentStage?.poolKey ?? workingSession?.cycle?.poolCurrent ?? null,
      stageId: stageValidation.currentStage?.stageId ?? null,
      stageKey: stageValidation.currentStage?.stageKey ?? null,
      recipeKey: input.recipeKey ?? null
    });

    return {
      ok: false,
      actionId: stageValidation.recipe?.id ?? null,
      recipeKey: stageValidation.recipeKey,
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
  const actionResolution = hasStageSelectionRules(stageValidation.currentStage.stage)
    ? resolveSelectionStageRecipe(
        workingSession,
        stageValidation.currentStage.stage,
        stageValidation.recipe,
        recipeInput,
        resolutionContext
      )
    : resolveRecipe(
        workingSession,
        stageValidation.recipe,
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

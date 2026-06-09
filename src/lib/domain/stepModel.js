// stepModel.js
// -----------------------------------------------------------------------------
// Este archivo conecta poolCursorModel con actionModel.
//
// Responsabilidad:
// - leer el step actual de poolCursorModel;
// - comprobar que ese step es ejecutable;
// - extraer la action declarada por el step;
// - pedir a actionModel que la resuelva;
// - cerrar explicitamente el step cuando player/director/sistema lo pidan.
//
// No decide reglas de juego complejas. Si empieza a hacerlo, se estaria
// convirtiendo en una segunda actionModel. Su trabajo es coordinar, no resolver.
// -----------------------------------------------------------------------------

import { advanceStepCursor, getCurrentStepCursor, isStepRunnable } from './poolCursorModel.js';
import { appendEntry } from './historyModel.js';
import { resolveRecipe } from './recipeModel.js';
import { ACTION_IDS, VISIBILITY, resolveAction } from './actionModel.js';
import { appendConcludePlayEventResponse, processActionResultEvents } from './eventModel.js';
import { SPECIAL_STEP_PRIORITIES, normalizeId } from './sessionModel.js';
import { OBJECTIVE_EVALUATION_STATUSES, checkObjectives } from './objectiveModel.js';
import { VOTE_OUTCOME_TYPES } from './voteModel.js';

export const STEP_ERRORS = Object.freeze({
  MISSING_SESSION: 'step/missing-session',
  MISSING_STEP_POOLS: 'step/missing-step-pools',
  MISSING_CURRENT_STEP: 'step/missing-current-step',
  STEP_NOT_RUNNABLE: 'step/not-runnable',
  MISSING_ACTION: 'step/missing-action',
  MISSING_ACTION_KEY: 'step/missing-action-key',
  ACTION_NOT_FOUND: 'step/action-not-found',
  COMPLETION_NOT_ALLOWED: 'step/completion-not-allowed'
});

export const STEP_COMPLETION_MODES = Object.freeze({
  MANUAL: 'manual',
  AUTOMATIC: 'automatic'
});

export const STEP_COMPLETION_REQUESTED_BY = Object.freeze({
  PLAYER: 'player',
  DIRECTOR: 'director',
  SYSTEM: 'system'
});

// IDs anonimos recomendados para slots de ejecucion.
//
// El step no describe que accion ejecuta. Describe donde ocurre dentro del
// flujo. La accion concreta vive en step.actions.
export const STEP_KEYS = Object.freeze({
  STEP_01: 'step_01',
  STEP_02: 'step_02',
  STEP_03: 'step_03',
  STEP_04: 'step_04',
  STEP_05: 'step_05',
  STEP_06: 'step_06',
  STEP_07: 'step_07',
  STEP_08: 'step_08'
});

// Claves de receta dentro de un step.
//
// actionId puede ser generico, por ejemplo set_in_play. actionKey permite
// distinguir recetas que usan esa misma accion generica con parametros distintos.
export const STEP_ACTION_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  ONE_SHOT_SET_OUT_OF_PLAY: 'one_shot_set_out_of_play',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  CLOSE_CYCLE: 'close_cycle',
  CONCLUDE_PLAY: 'conclude_play'
});

// Devuelve el step actual con su contexto de pool.
//
// Devuelve el step apuntado por el cursor de pools.
export function getCurrentStep(session) {
  return getCurrentStepCursor(session?.stepPools);
}

// Extrae las acciones declaradas por un step.
//
// Soportamos dos ubicaciones:
// - step.actions: formato recomendado;
// - step.action: compatibilidad temporal;
// - step.metadata.action: compatibilidad con definiciones antiguas.
export function getStepActions(step) {
  if (Array.isArray(step?.actions) && step.actions.length > 0) {
    return step.actions.map((action) => ({ ...action }));
  }
  if (step?.action) return [{ ...step.action }];
  if (step?.metadata?.action) return [{ ...step.metadata.action }];
  return [];
}

// Devuelve la clave mecanica de una receta de accion.
export function getStepActionKey(action) {
  return normalizeId(action?.key ?? action?.actionKey ?? action?.id);
}

// Elige que accion del step se va a ejecutar.
//
// Si solo hay una accion, no exigimos actionKey. Si hay varias, el input debe
// indicar actionKey para evitar que el motor elija por posicion sin querer.
export function selectStepAction(actions = [], requestedActionKey = null) {
  if (!actions.length) {
    return {
      ok: false,
      action: null,
      actionKey: null,
      error: {
        code: STEP_ERRORS.MISSING_ACTION,
        message: 'current step has no actions'
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
        code: STEP_ERRORS.MISSING_ACTION_KEY,
        message: 'current step has multiple actions and requires actionKey'
      }
    };
  }

  const selectedAction = normalizedRequestedKey
    ? actions.find((action) => getStepActionKey(action) === normalizedRequestedKey)
    : actions[0];

  if (!selectedAction) {
    return {
      ok: false,
      action: null,
      actionKey: normalizedRequestedKey,
      error: {
        code: STEP_ERRORS.ACTION_NOT_FOUND,
        message: `current step has no action "${normalizedRequestedKey}"`,
        actionKey: normalizedRequestedKey
      }
    };
  }

  const actionKey = getStepActionKey(selectedAction);

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

// Valida que el step actual pueda ejecutarse.
//
// Esta validacion no revisa targets, filtros ni efectos. Eso pertenece a
// actionModel. Aqui solo comprobamos que existe un step ejecutable con una
// accion declarada.
export function validateCurrentStep(session, { actionKey = null } = {}) {
  const errors = [];

  if (!session) {
    errors.push({
      code: STEP_ERRORS.MISSING_SESSION,
      message: 'cannot resolve a step without session'
    });
    return {
      ok: false,
      currentStep: null,
      action: null,
      actionKey: null,
      errors
    };
  }

  if (!session.stepPools) {
    errors.push({
      code: STEP_ERRORS.MISSING_STEP_POOLS,
      message: 'session has no stepPools'
    });
  }

  const currentStep = getCurrentStep(session);

  if (!currentStep) {
    errors.push({
      code: STEP_ERRORS.MISSING_CURRENT_STEP,
      message: 'session has no current step'
    });
    return {
      ok: false,
      currentStep: null,
      action: null,
      actionKey: null,
      errors
    };
  }

  if (!isStepRunnable(currentStep.step)) {
    errors.push({
      code: STEP_ERRORS.STEP_NOT_RUNNABLE,
      message: `current step "${currentStep.stepKey}" is not runnable`,
      poolKey: currentStep.poolKey,
      stepKey: currentStep.stepKey,
      status: currentStep.status
    });
  }

  const actions = getStepActions(currentStep.step);
  const selectedAction = selectStepAction(actions, actionKey);

  if (!selectedAction.ok) {
    errors.push({
      ...selectedAction.error,
      message: `${selectedAction.error.message} in step "${currentStep.stepKey}"`,
      poolKey: currentStep.poolKey,
      stepKey: currentStep.stepKey
    });
  }

  return {
    ok: errors.length === 0,
    currentStep,
    action: selectedAction.action,
    actionKey: selectedAction.actionKey,
    errors
  };
}

// Devuelve true si un valor representa un origen valido de cierre de step.
export function isValidStepCompletionRequester(requestedBy) {
  return Object.values(STEP_COMPLETION_REQUESTED_BY).includes(requestedBy);
}

export function getStepCompletionDefinition(step = {}) {
  const completion = step?.completion ?? {};
  const mode = Object.values(STEP_COMPLETION_MODES).includes(completion.mode)
    ? completion.mode
    : STEP_COMPLETION_MODES.MANUAL;
  const allowedRequesters = Array.isArray(completion.allowedRequesters)
    ? completion.allowedRequesters.filter(isValidStepCompletionRequester)
    : Object.values(STEP_COMPLETION_REQUESTED_BY);

  return {
    mode,
    allowedRequesters:
      allowedRequesters.length > 0 ? allowedRequesters : Object.values(STEP_COMPLETION_REQUESTED_BY)
  };
}

export function canRequesterCompleteStep(step, requestedBy) {
  const completion = getStepCompletionDefinition(step);
  return completion.allowedRequesters.includes(requestedBy);
}

function getStepVoteRules(step = {}) {
  return step?.voteRules ?? null;
}

function hasStepVoteRules(step = {}) {
  return !!getStepVoteRules(step);
}

function getVoteInputForStep(step = {}, input = {}) {
  const voteRules = getStepVoteRules(step) ?? {};

  return {
    actorIds: input.actorIds ?? step.actorIds ?? [],
    votes: input.votes ?? [],
    voteRules: {
      ...voteRules,
      candidateIds: input.candidateIds ?? voteRules.candidateIds ?? null
    },
    roundType: input.roundType,
    roundIndex: input.roundIndex ?? 0
  };
}

function getRecipeInputFromVote({ step = {}, input = {}, chosenId = null }) {
  return {
    ...input,
    actorIds: input.actorIds ?? step.actorIds ?? [],
    targetIds: chosenId ? [chosenId] : []
  };
}

function mergeVoteAndRecipeResult({ voteResult = null, recipeResult = null } = {}) {
  return {
    ...(recipeResult ?? {}),
    vote: voteResult?.vote ?? null,
    voteActionId: voteResult?.actionId ?? null,
    proposedEffects: recipeResult?.proposedEffects ?? [],
    finalEffects: recipeResult?.finalEffects ?? [],
    blockedActions: recipeResult?.blockedActions ?? [],
    blockedEffects: recipeResult?.blockedEffects ?? []
  };
}

function resolveVoteStepRecipe(session, step, recipe, input = {}, context = {}) {
  const voteResolution = resolveAction(
    session,
    {
      id: ACTION_IDS.VOTE,
      visibility: recipe?.visibility ?? VISIBILITY.ALL
    },
    getVoteInputForStep(step, input),
    context
  );

  if (!voteResolution.ok) return voteResolution;

  const chosenId = voteResolution.result?.vote?.chosenId ?? null;
  if (voteResolution.result?.vote?.type !== VOTE_OUTCOME_TYPES.CHOSEN || !chosenId) {
    return voteResolution;
  }

  const recipeResolution = resolveRecipe(
    voteResolution.session,
    recipe,
    getRecipeInputFromVote({ step, input, chosenId }),
    context
  );

  if (!recipeResolution.ok) {
    return {
      ...recipeResolution,
      result: {
        ...(recipeResolution.result ?? {}),
        vote: voteResolution.result?.vote ?? null
      }
    };
  }

  return {
    ...recipeResolution,
    result: mergeVoteAndRecipeResult({
      voteResult: voteResolution.result,
      recipeResult: recipeResolution.result
    })
  };
}

function appendConcludePlaySpecialStepIfNeeded({ session, objectiveEvaluation }) {
  if (
    objectiveEvaluation?.status !== OBJECTIVE_EVALUATION_STATUSES.FULFILLED ||
    !objectiveEvaluation?.playOutcome?.conclusive
  ) {
    return {
      session,
      concludePlayResponse: null
    };
  }

  if (session?.playOutcome) {
    return {
      session,
      concludePlayResponse: null
    };
  }

  const hasConcludePlayStep = Object.values(session?.stepPools?.pools ?? {}).some((steps) =>
    (steps ?? []).some((step) => step?.metadata?.specialPriority === SPECIAL_STEP_PRIORITIES.CONCLUDE_PLAY)
  );

  if (hasConcludePlayStep) {
    return {
      session,
      concludePlayResponse: null
    };
  }

  const appended = appendConcludePlayEventResponse({
    session,
    playOutcome: objectiveEvaluation.playOutcome
  });

  return {
    session: appended.session,
    concludePlayResponse: appended.response
  };
}

function shouldCheckObjectivesAfterStepCompletion(stepAdvance) {
  return ['next-pool', 'no-runnable-step'].includes(stepAdvance?.reason);
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

function getPostCompletionObjectiveState({ session, stepAdvance }) {
  if (!shouldCheckObjectivesAfterStepCompletion(stepAdvance)) {
    return {
      session,
      stepAdvance,
      objectiveEvaluation: null,
      playOutcome: null,
      eventResponses: []
    };
  }

  const objectiveEvaluation = checkObjectives(session);
  const specialStepState = appendConcludePlaySpecialStepIfNeeded({
    session,
    objectiveEvaluation
  });
  const finalStepAdvance = {
    ...stepAdvance,
    stepPools: specialStepState.session.stepPools,
    next: getCurrentStepCursor(specialStepState.session.stepPools)
  };

  return {
    session: specialStepState.session,
    stepAdvance: finalStepAdvance,
    objectiveEvaluation,
    playOutcome: objectiveEvaluation?.playOutcome ?? null,
    eventResponses: specialStepState.concludePlayResponse ? [specialStepState.concludePlayResponse] : []
  };
}

// Anade una entrada al historial de steps.
//
// Cerrar un step no es una accion de juego. Por eso no se registra en
// actionHistory: vive en stepHistory para poder reconstruir quien decidio pasar
// al siguiente step y por que.
export function appendStepHistory(session, entry = {}) {
  const requestedBy = isValidStepCompletionRequester(entry.requestedBy)
    ? entry.requestedBy
    : STEP_COMPLETION_REQUESTED_BY.DIRECTOR;
  const normalizedEntry = {
    poolKey: entry.poolKey ?? null,
    stepKey: entry.stepKey ?? null,
    requestedBy,
    actorIds: [...(entry.actorIds ?? [])],
    actionKey: entry.actionKey ?? null,
    reason: entry.reason ?? 'manual_completion',
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'stepHistory', normalizedEntry, {
    getId: (item, history) => `step-completion-${item.stepKey ?? 'step'}-${history.length}`
  });
}

// Cierra el step actual y avanza el cursor.
//
// Esta es la puerta normal para pasar al siguiente step. La puede invocar:
// - el actor, cuando termina sus decisiones;
// - el director/narrador, cuando decide que el ritmo debe avanzar;
// - una receta, si en el futuro una regla concreta pide cierre automatico;
// - el sistema, para automatizaciones controladas.
export function completeCurrentStep(session, input = {}) {
  const currentStep = getCurrentStep(session);

  if (!session) {
    return {
      ok: false,
      errors: [
        {
          code: STEP_ERRORS.MISSING_SESSION,
          message: 'cannot complete a step without session'
        }
      ],
      session,
      step: null,
      stepAdvance: null
    };
  }

  if (!session.stepPools) {
    return {
      ok: false,
      errors: [
        {
          code: STEP_ERRORS.MISSING_STEP_POOLS,
          message: 'session has no stepPools'
        }
      ],
      session,
      step: null,
      stepAdvance: null
    };
  }

  if (!currentStep) {
    return {
      ok: false,
      errors: [
        {
          code: STEP_ERRORS.MISSING_CURRENT_STEP,
          message: 'session has no current step'
        }
      ],
      session,
      step: null,
      stepAdvance: null
    };
  }

  if (!isStepRunnable(currentStep.step)) {
    return {
      ok: false,
      errors: [
        {
          code: STEP_ERRORS.STEP_NOT_RUNNABLE,
          message: `current step "${currentStep.stepKey}" is not runnable`,
          poolKey: currentStep.poolKey,
          stepKey: currentStep.stepKey,
          status: currentStep.status
        }
      ],
      session,
      step: currentStep,
      stepAdvance: null
    };
  }

  const requestedBy = isValidStepCompletionRequester(input.requestedBy)
    ? input.requestedBy
    : STEP_COMPLETION_REQUESTED_BY.DIRECTOR;

  if (!canRequesterCompleteStep(currentStep.step, requestedBy)) {
    return {
      ok: false,
      errors: [
        {
          code: STEP_ERRORS.COMPLETION_NOT_ALLOWED,
          message: `requester "${requestedBy}" cannot complete step "${currentStep.stepKey}"`,
          poolKey: currentStep.poolKey,
          stepKey: currentStep.stepKey,
          requestedBy,
          allowedRequesters: getStepCompletionDefinition(currentStep.step).allowedRequesters
        }
      ],
      session,
      step: currentStep,
      stepAdvance: null
    };
  }

  const stepAdvance = advanceStepCursor(session.stepPools);
  const sessionWithCompletion = appendStepHistory(
    {
      ...session,
      stepPools: stepAdvance.stepPools
    },
    {
      poolKey: currentStep.poolKey,
      stepKey: currentStep.stepKey,
      requestedBy,
      actorIds: [...(input.actorIds ?? [])],
      actionKey: input.actionKey ?? null,
      reason: input.reason ?? 'manual_completion',
      metadata: input.metadata ?? {}
    }
  );
  const objectiveState = getPostCompletionObjectiveState({
    session: sessionWithCompletion,
    stepAdvance
  });

  return {
    ok: true,
    errors: [],
    session: objectiveState.session,
    step: currentStep,
    stepAdvance: objectiveState.stepAdvance,
    completion: objectiveState.session.stepHistory.at(-1),
    objectiveEvaluation: objectiveState.objectiveEvaluation,
    playOutcome: objectiveState.playOutcome,
    eventResponses: objectiveState.eventResponses
  };
}

// Ejecuta una receta del step actual.
//
// Flujo:
// 1. Valida que existe un step enabled con action.
// 2. Ejecuta esa action con actionModel.
// 3. Si la action falla, conserva la sesion y no avanza.
// 4. Si la action termina bien, el step sigue abierto.
//
// Pasar al siguiente step es responsabilidad de completeCurrentStep. La opcion
// advanceOnSuccess queda solo como compatibilidad para pruebas o automatizaciones
// explicitamente pedidas.
export function resolveCurrentStep(session, input = {}, options = {}) {
  const advanceOnSuccess = options.advanceOnSuccess ?? false;
  const stepValidation = validateCurrentStep(session, {
    actionKey: input.actionKey ?? options.actionKey ?? null
  });

  if (!stepValidation.ok) {
    return {
      ok: false,
      actionId: stepValidation.action?.id ?? null,
      actionKey: stepValidation.actionKey,
      errors: stepValidation.errors,
      session,
      result: null,
      step: stepValidation.currentStep,
      stepAdvance: null
    };
  }

  const recipeInput = {
    ...input,
    actorIds: input.actorIds ?? stepValidation.currentStep.step?.actorIds ?? []
  };
  const resolutionContext = {
    poolKey: stepValidation.currentStep.poolKey,
    stepKey: stepValidation.currentStep.stepKey,
    actionKey: stepValidation.actionKey
  };
  const actionResolution = hasStepVoteRules(stepValidation.currentStep.step)
    ? resolveVoteStepRecipe(
        session,
        stepValidation.currentStep.step,
        stepValidation.action,
        recipeInput,
        resolutionContext
      )
    : resolveRecipe(session, stepValidation.action, recipeInput, resolutionContext);
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
      step: stepValidation.currentStep,
      stepAdvance: null
    };
  }

  const completion = completeCurrentStep(resolutionWithEvents.session, {
    requestedBy: options.requestedBy ?? STEP_COMPLETION_REQUESTED_BY.SYSTEM,
    actorIds: [...(input.actorIds ?? [])],
    actionKey: stepValidation.actionKey,
    reason: options.completionReason ?? 'auto_advance_on_success'
  });

  if (!completion.ok) {
    return {
      ...resolutionWithEvents,
      step: stepValidation.currentStep,
      stepAdvance: null,
      completion
    };
  }

  return {
    ...resolutionWithEvents,
    session: completion.session,
    step: stepValidation.currentStep,
    stepAdvance: completion.stepAdvance,
    completion: completion.completion
  };
}

// stepModel.js
// -----------------------------------------------------------------------------
// Este archivo conecta phaseModel con actionModel.
//
// Responsabilidad:
// - leer el step actual de phaseModel;
// - comprobar que ese step es ejecutable;
// - extraer la action declarada por el step;
// - pedir a actionModel que la resuelva;
// - si la accion termina bien, avanzar el cursor de fases.
//
// No decide reglas de juego complejas. Si empieza a hacerlo, se estaria
// convirtiendo en una segunda actionModel. Su trabajo es coordinar, no resolver.
// -----------------------------------------------------------------------------

import { advancePhaseCursor, getCurrentPhase, isPhaseRunnable } from './phaseModel.js';
import { resolveRecipe } from './recipeModel.js';
import { normalizeId } from './sessionModel.js';

export const STEP_ERRORS = Object.freeze({
  MISSING_SESSION: 'step/missing-session',
  MISSING_PHASE_POOLS: 'step/missing-phase-pools',
  MISSING_CURRENT_STEP: 'step/missing-current-step',
  STEP_NOT_RUNNABLE: 'step/not-runnable',
  MISSING_ACTION: 'step/missing-action',
  MISSING_ACTION_KEY: 'step/missing-action-key',
  ACTION_NOT_FOUND: 'step/action-not-found'
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
  STEP_05: 'step_05'
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
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  VOTE_OUT_OF_PLAY: 'vote_out_of_play'
});

// Devuelve el step actual con su contexto de pool.
//
// phaseModel lo llama "current phase" por compatibilidad historica, pero en el
// modelo nuevo esa unidad se entiende como step ejecutable.
export function getCurrentStep(session) {
  return getCurrentPhase(session?.phasePools);
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

  if (!session.phasePools) {
    errors.push({
      code: STEP_ERRORS.MISSING_PHASE_POOLS,
      message: 'session has no phasePools'
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

  if (!isPhaseRunnable(currentStep.step)) {
    errors.push({
      code: STEP_ERRORS.STEP_NOT_RUNNABLE,
      message: `current step "${currentStep.phaseKey}" is not runnable`,
      poolKey: currentStep.poolKey,
      stepKey: currentStep.phaseKey,
      status: currentStep.status
    });
  }

  const actions = getStepActions(currentStep.step);
  const selectedAction = selectStepAction(actions, actionKey);

  if (!selectedAction.ok) {
    errors.push({
      ...selectedAction.error,
      message: `${selectedAction.error.message} in step "${currentStep.phaseKey}"`,
      poolKey: currentStep.poolKey,
      stepKey: currentStep.phaseKey
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

// Ejecuta el step actual.
//
// Flujo:
// 1. Valida que existe un step enabled con action.
// 2. Ejecuta esa action con actionModel.
// 3. Si la action falla, conserva la sesion y no avanza.
// 4. Si la action termina bien, marca el step como done y avanza el cursor.
export function resolveCurrentStep(session, input = {}, options = {}) {
  const advanceOnSuccess = options.advanceOnSuccess ?? true;
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
      phaseAdvance: null
    };
  }

  const actionResolution = resolveRecipe(session, stepValidation.action, input, {
    poolKey: stepValidation.currentStep.poolKey,
    stepKey: stepValidation.currentStep.phaseKey,
    actionKey: stepValidation.actionKey,
    actorScope: stepValidation.currentStep.step?.actorScope ?? null
  });

  if (!actionResolution.ok || !advanceOnSuccess) {
    return {
      ...actionResolution,
      step: stepValidation.currentStep,
      phaseAdvance: null
    };
  }

  const phaseAdvance = advancePhaseCursor(actionResolution.session.phasePools);

  return {
    ...actionResolution,
    session: {
      ...actionResolution.session,
      phasePools: phaseAdvance.phasePools
    },
    step: stepValidation.currentStep,
    phaseAdvance
  };
}

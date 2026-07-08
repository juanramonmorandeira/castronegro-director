// recipeModel.js
// -----------------------------------------------------------------------------
// Gestiona recetas mecanicas.
//
// Una receta NO es una accion nueva. Es:
// - recipeKey: nombre mecanico de la receta dentro de un stage;
// - actions: lista de acciones genericas que se ejecutaran;
// - restricciones que limitan cuando puede usarse.
//
// La implementacion actual ejecuta una unica action por recipe, pero el
// contrato ya usa lista para permitir recipes multi-action futuras.
// -----------------------------------------------------------------------------

import { resolveAction } from './actionModel.js';
import { createAction } from './actionDefinition.js';
import {
  getRecipeKey,
  getPrimaryActionFromRecipe,
  getActionFromRecipe,
  getRecipeConstraints,
  validateRecipe
} from './recipeDefinition.js';
import { resolveRecipeActor } from './actorModel.js';
import { findRole } from './targetModel.js';
import {
  evaluateRecipeConstraints
} from './constraintModel.js';
import { materializePropertyBlockExpiration } from './roleModel.js';
import {
  HISTORY_RESULTS,
  appendRecipeHistory,
  getRecipeHistorySignature
} from './historyModel.js';
import { createMessagesFromEngineErrors } from '../messages/messageModel.js';
import { routeMessages } from '../messages/messageLogModel.js';

export function getRecipeActorAndTargets(session, input = {}, recipe = {}, stage = {}) {
  const actorContext = resolveRecipeActor({ session, recipe, input, stage });
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));

  return {
    actor: actorContext.primaryActor,
    actors: actorContext.actors,
    actorContext,
    targets
  };
}

function resolveBlockedForActorIds(session = {}, blockedFor = {}) {
  const explicitActorIds = blockedFor.actorIds ?? [];
  const groupActorIds = (blockedFor.groupIds ?? []).flatMap((groupId) => {
    const group = (session.groups ?? []).find(
      (entry) => entry.id === groupId || entry.key === groupId
    );
    return group?.id ? [group.id] : [];
  });
  const alignmentActorIds = (session.roles ?? [])
    .filter((role) => (blockedFor.alignmentIds ?? []).includes(role.alignmentId))
    .map((role) => role.id);

  return [...new Set([...explicitActorIds, ...groupActorIds, ...alignmentActorIds])];
}

function materializeRecipeForSession(session = {}, recipe = {}, context = {}) {
  const primaryAction = getPrimaryActionFromRecipe(recipe);
  if (primaryAction?.effect?.type !== 'block_property_change') {
    return { ok: true, errors: [], recipe };
  }

  const expiration = materializePropertyBlockExpiration(
    session,
    primaryAction.effect.duration,
    context
  );
  if (!expiration.ok) {
    return { ok: false, errors: expiration.errors, recipe: null };
  }

  return {
    ok: true,
    errors: [],
    recipe: {
      ...recipe,
      actions: recipe.actions.map((action, index) =>
        index === 0
          ? createAction({
              ...action,
              effect: {
                ...action.effect,
                blockedFor: {
                  actorIds: resolveBlockedForActorIds(session, action.effect.blockedFor)
                },
                expiresAt: expiration.expiresAt
              }
            })
          : action
      )
    }
  };
}

export function validateRecipeConstraints({ session, recipe, input = {}, context = {} }) {
  const constraints = getRecipeConstraints(recipe);
  if (constraints.length === 0) {
    return {
      ok: true,
      errors: []
    };
  }

  const { actor, targets } = getRecipeActorAndTargets(session, input, recipe, context.stage);
  const action = getActionFromRecipe(recipe);
  const recipeForConstraints = {
    ...recipe,
    id: action?.id ?? null,
    effect: action?.effect ?? null,
    visibility: action?.visibility ?? recipe.visibility,
    constraints
  };
  const errors = evaluateRecipeConstraints({
    session,
    recipe: recipeForConstraints,
    actor,
    targets,
    context
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

function appendEngineErrorMessages(session, errors, context = {}) {
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

function getRecipeHistoryResultFromActionResult(actionResult = {}) {
  const finalEffects = actionResult.finalEffects ?? [];
  const preventedPropertyChanges = actionResult.preventedPropertyChanges ?? [];
  const hasFinalEffects = finalEffects.length > 0;
  const hasPreventedChanges = preventedPropertyChanges.length > 0;
  const hasMechanicalChange = actionResult.mechanicalChangeApplied === true;

  if (hasFinalEffects && hasPreventedChanges) return HISTORY_RESULTS.PARTIAL;
  if (hasFinalEffects) return HISTORY_RESULTS.APPLIED;
  if (hasMechanicalChange) return HISTORY_RESULTS.APPLIED;
  if (hasPreventedChanges) return HISTORY_RESULTS.BLOCKED;
  return HISTORY_RESULTS.NO_EFFECT;
}

function getRecipeHistoryTargetIds(actionResult = {}, input = {}) {
  if ((actionResult.targetIds ?? []).length > 0) return actionResult.targetIds;
  if ((actionResult.targets ?? []).length > 0) {
    return actionResult.targets.map((target) => target.targetId).filter(Boolean);
  }
  if ((actionResult.reveals ?? []).length > 0) {
    return actionResult.reveals.map((reveal) => reveal.targetId).filter(Boolean);
  }
  return [...(input.targetIds ?? [])];
}

function appendResolvedRecipeHistory({
  session,
  recipe,
  action,
  input = {},
  context = {},
  actionResult = {}
} = {}) {
  return appendRecipeHistory(session, {
    cycleId: session?.cycle?.id ?? 0,
    poolKey: context.poolKey ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    stageCatalogId: context.stageCatalogId ?? null,
    recipeKey: context.recipeKey ?? getRecipeKey(recipe),
    actionId: action?.id ?? actionResult.actionId ?? null,
    actionSignature: getRecipeHistorySignature(action),
    actorIds: actionResult.actorIds ?? input.actorIds ?? [],
    selectorIds: actionResult.selection?.selectorIds ?? input.selectorIds ?? [],
    targetIds: getRecipeHistoryTargetIds(actionResult, input),
    actorContract: context.actorContract ?? recipe?.actor ?? null,
    targetContract: context.targetContract ?? recipe?.target ?? null,
    proposedEffects: actionResult.proposedEffects ?? [],
    finalEffects: actionResult.finalEffects ?? [],
    preventedPropertyChanges: actionResult.preventedPropertyChanges ?? [],
    blockedEffects: actionResult.blockedEffects ?? [],
    result: getRecipeHistoryResultFromActionResult(actionResult)
  });
}

export function appendRecipeNoEffectHistory(session, entry = {}) {
  return appendRecipeHistory(session, {
    ...entry,
    result: HISTORY_RESULTS.NO_EFFECT
  });
}

function createRecipeErrorResult(state, errors) {
  const action = getPrimaryActionFromRecipe(state.recipe);
  const messageState = appendEngineErrorMessages(state.session, errors, {
    ...state.context,
    actionId: action?.id ?? null,
    recipeKey: state.recipeKey
  });

  return {
    ok: false,
    actionId: action?.id ?? null,
    recipeKey: state.recipeKey,
    errors,
    session: messageState.session,
    result: null,
    messages: messageState.messages
  };
}

function startRecipe(session, recipe, input = {}, context = {}) {
  const recipeKey = context.recipeKey ?? getRecipeKey(recipe);

  return {
    ok: true,
    session,
    recipe,
    materializedRecipe: null,
    input,
    context,
    recipeKey,
    action: null,
    actionResolution: null,
    errors: [],
    result: null
  };
}

function evaluateRecipe(state) {
  const contractValidation = validateRecipe({
    recipe: state.recipe,
    input: state.input
  });
  if (!contractValidation.ok) {
    return {
      ...state,
      ok: false,
      errors: contractValidation.errors,
      result: createRecipeErrorResult(state, contractValidation.errors)
    };
  }

  const constraintValidation = validateRecipeConstraints({
    session: state.session,
    recipe: state.recipe,
    input: state.input,
    context: state.context
  });

  if (!constraintValidation.ok) {
    return {
      ...state,
      ok: false,
      errors: constraintValidation.errors,
      result: createRecipeErrorResult(state, constraintValidation.errors)
    };
  }

  const materialization = materializeRecipeForSession(
    state.session,
    state.recipe,
    state.context
  );
  if (!materialization.ok) {
    return {
      ...state,
      ok: false,
      errors: materialization.errors,
      result: createRecipeErrorResult(state, materialization.errors)
    };
  }

  return {
    ...state,
    materializedRecipe: materialization.recipe,
    action: getActionFromRecipe(materialization.recipe)
  };
}

function resolveRecipeAction(state) {
  if (!state.ok) return state;

  const actionResolution = resolveAction(state.session, state.action, state.input, {
    ...state.context,
    recipeKey: state.recipeKey,
    actorContract: state.materializedRecipe.actor ?? null,
    targetContract: state.materializedRecipe.target ?? null
  });

  return {
    ...state,
    ok: actionResolution.ok,
    actionResolution,
    session: actionResolution.session,
    errors: actionResolution.errors ?? [],
    result: actionResolution
  };
}

function validateRecipeOutput(state) {
  if (!state.ok) return state;
  if (!state.actionResolution?.ok) return state;

  if (!state.actionResolution.result) {
    return {
      ...state,
      ok: false,
      errors: [
        {
          code: 'recipe/missing-result',
          message: `recipe "${state.recipeKey}" finished without result`,
          recipeKey: state.recipeKey
        }
      ]
    };
  }

  return state;
}

function finishRecipe(state) {
  if (state.result && !state.actionResolution) return state.result;
  if (state.actionResolution && !state.actionResolution.ok) return state.actionResolution;
  if (!state.ok) return createRecipeErrorResult(state, state.errors);

  return {
    ...state.actionResolution,
    session: appendResolvedRecipeHistory({
      session: state.actionResolution.session,
      recipe: state.materializedRecipe,
      action: state.action,
      input: state.input,
      context: {
        ...state.context,
        recipeKey: state.recipeKey,
        actorContract: state.materializedRecipe.actor ?? null,
        targetContract: state.materializedRecipe.target ?? null
      },
      actionResult: state.actionResolution.result ?? {}
    })
  };
}

// Resuelve una receta:
// startRecipe -> evaluateRecipe -> resolveRecipeAction -> validateRecipeOutput -> finishRecipe.
export function resolveRecipe(session, recipe, input = {}, context = {}) {
  return finishRecipe(
    validateRecipeOutput(
      resolveRecipeAction(
        evaluateRecipe(
          startRecipe(session, recipe, input, context)
        )
      )
    )
  );
}

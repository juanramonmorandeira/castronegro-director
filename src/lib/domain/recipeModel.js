// recipeModel.js
// -----------------------------------------------------------------------------
// Gestiona recetas mecanicas.
//
// Una receta NO es una accion nueva. Es:
// - actionKey: nombre mecanico de la receta dentro de un step;
// - actionId: accion generica que se ejecutara;
// - parametros/efecto de esa accion;
// - restricciones que limitan cuando puede usarse.
// - acciones derivadas, por ejemplo onWinnerAction en una receta de voto.
//
// recipeModel valida restricciones y entrega a actionModel una accion pura,
// sin key ni constraints.
// -----------------------------------------------------------------------------

import { resolveAction, findRoleInstance } from './actionModel.js';
import { evaluateRecipeConstraints } from './constraintModel.js';
import { normalizeId } from './sessionModel.js';

export function getRecipeKey(recipe = {}) {
  return normalizeId(recipe.key ?? recipe.actionKey ?? recipe.id);
}

// Elimina metadatos propios de receta antes de llamar a actionModel.
export function createActionFromRecipe(recipe = {}) {
  const { key, actionKey, constraints, onWinnerAction, ...action } = recipe;
  return action;
}

export function getRecipeActorAndTargets(session, input = {}) {
  const actor = findRoleInstance(session, input.actorRoleInstanceId);
  const targets = (input.targetRoleInstanceIds ?? []).map((id) => findRoleInstance(session, id));

  return {
    actor,
    targets
  };
}

export function getRecipeConstraints(recipe = {}) {
  if (Array.isArray(recipe?.constraints)) return recipe.constraints;
  return [];
}

// Devuelve true si una receta necesita una segunda accion tras resolver voto.
export function hasOnWinnerAction(recipe = {}) {
  return !!recipe?.onWinnerAction;
}

// Crea el input para la accion que debe ejecutarse sobre el ganador de una
// votacion. Hereda el actorScope del step/receta y sustituye targets por el
// roleInstance ganador que devolvio voteModel.
export function createWinnerActionInput(input = {}, winnerRoleInstanceId = null, actorScope = null) {
  return {
    ...input,
    actorScope: input.actorScope ?? actorScope ?? null,
    targetRoleInstanceIds: winnerRoleInstanceId ? [winnerRoleInstanceId] : []
  };
}

// Combina el resultado de una receta de voto con el resultado de su accion
// posterior. La salida mantiene `vote` visible y expone los efectos reales de
// onWinnerAction como efectos finales de la receta compuesta.
export function createCompositeRecipeResult({ voteResult, winnerActionResult }) {
  return {
    ...(winnerActionResult ?? {}),
    vote: voteResult?.vote ?? null,
    voteActionId: voteResult?.actionId ?? null,
    onWinnerActionId: winnerActionResult?.actionId ?? null,
    proposedEffects: winnerActionResult?.proposedEffects ?? [],
    finalEffects: winnerActionResult?.finalEffects ?? [],
    blockedActions: winnerActionResult?.blockedActions ?? [],
    blockedEffects: winnerActionResult?.blockedEffects ?? []
  };
}

export function validateRecipeConstraints({ session, recipe, input = {} }) {
  const constraints = getRecipeConstraints(recipe);
  if (constraints.length === 0) {
    return {
      ok: true,
      errors: []
    };
  }

  const { actor, targets } = getRecipeActorAndTargets(session, input);
  const errors = evaluateRecipeConstraints({
    session,
    recipe,
    actor,
    targets
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

// Resuelve recetas compuestas de voto.
//
// Flujo:
// 1. Ejecuta vote como accion pura.
// 2. Si el voto no produce ganador, termina sin efectos.
// 3. Si hay ganador, ejecuta onWinnerAction usando ese ganador como target.
//
// Esto mantiene voteModel como recuento puro y permite reutilizar la misma
// votacion para aplicar acciones distintas segun la receta.
export function resolveVoteRecipe(session, recipe, input = {}, context = {}) {
  const actionKey = context.actionKey ?? getRecipeKey(recipe);
  const voteResolution = resolveAction(session, createActionFromRecipe(recipe), input, {
    ...context,
    actionKey
  });

  if (!voteResolution.ok) return voteResolution;

  const winnerRoleInstanceId = voteResolution.result?.vote?.winnerRoleInstanceId ?? null;
  if (!winnerRoleInstanceId) return voteResolution;

  const winnerAction = recipe.onWinnerAction;
  const winnerActionResolution = resolveAction(
    voteResolution.session,
    winnerAction,
    createWinnerActionInput(input, winnerRoleInstanceId, context.actorScope ?? null),
    {
      ...context,
      actionKey
    }
  );

  if (!winnerActionResolution.ok) {
    return {
      ...winnerActionResolution,
      result: {
        ...(winnerActionResolution.result ?? {}),
        vote: voteResolution.result?.vote ?? null
      }
    };
  }

  return {
    ...winnerActionResolution,
    actionId: recipe?.id ?? winnerActionResolution.actionId,
    actionKey,
    result: createCompositeRecipeResult({
      voteResult: voteResolution.result,
      winnerActionResult: winnerActionResolution.result
    })
  };
}

// Resuelve una receta:
// 1. Valida restricciones de receta.
// 2. Convierte la receta en accion pura.
// 3. Llama a actionModel.
export function resolveRecipe(session, recipe, input = {}, context = {}) {
  const actionKey = context.actionKey ?? getRecipeKey(recipe);
  const constraintValidation = validateRecipeConstraints({ session, recipe, input });

  if (!constraintValidation.ok) {
    return {
      ok: false,
      actionId: recipe?.id ?? null,
      actionKey,
      errors: constraintValidation.errors,
      session,
      result: null
    };
  }

  if (hasOnWinnerAction(recipe)) {
    return resolveVoteRecipe(session, recipe, input, {
      ...context,
      actionKey
    });
  }

  return resolveAction(session, createActionFromRecipe(recipe), input, {
    ...context,
    actionKey
  });
}

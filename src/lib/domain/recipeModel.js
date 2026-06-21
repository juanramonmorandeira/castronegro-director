// recipeModel.js
// -----------------------------------------------------------------------------
// Gestiona recetas mecanicas.
//
// Una receta NO es una accion nueva. Es:
// - actionKey: nombre mecanico de la receta dentro de un stage;
// - actionId: accion generica que se ejecutara;
// - parametros/efecto de esa accion;
// - restricciones que limitan cuando puede usarse.
//
// recipeModel valida restricciones y entrega a actionModel una accion pura,
// sin key ni constraints.
// -----------------------------------------------------------------------------

import { resolveAction, findRole } from './actionModel.js';
import { evaluateRecipeConstraints } from './constraintModel.js';
import { normalizeId } from './sessionModel.js';
import { materializePropertyBlockExpiration } from './roleModel.js';

export function getRecipeKey(recipe = {}) {
  return normalizeId(recipe.key ?? recipe.actionKey ?? recipe.id);
}

// Constructor generico de receta.
//
// Las recetas concretas viven en recipeCatalog como datos predefinidos. Este
// constructor solo normaliza la forma comun que recipeModel sabe resolver.
export function createRecipe(recipe = {}) {
  return {
    ...recipe,
    key: getRecipeKey(recipe),
    optional: recipe.optional !== false,
    constraints: [...(recipe.constraints ?? [])]
  };
}

// Elimina metadatos propios de receta antes de llamar a actionModel.
export function getActionFromRecipe(recipe = {}) {
  const { key, actionKey, constraints, ...action } = recipe;
  return action;
}

export function getRecipeActorAndTargets(session, input = {}) {
  const actors = (input.actorIds ?? []).map((id) => findRole(session, id));
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));

  return {
    actor: actors[0] ?? null,
    actors,
    targets
  };
}

export function getRecipeConstraints(recipe = {}) {
  if (Array.isArray(recipe?.constraints)) return recipe.constraints;
  return [];
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
  if (recipe.effect?.type !== 'block_property_change') {
    return { ok: true, errors: [], recipe };
  }

  const expiration = materializePropertyBlockExpiration(
    session,
    recipe.effect.duration,
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
      effect: {
        ...recipe.effect,
        blockedFor: {
          actorIds: resolveBlockedForActorIds(session, recipe.effect.blockedFor)
        },
        expiresAt: expiration.expiresAt
      }
    }
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

  const materialization = materializeRecipeForSession(session, recipe, context);
  if (!materialization.ok) {
    return {
      ok: false,
      actionId: recipe?.id ?? null,
      actionKey,
      errors: materialization.errors,
      session,
      result: null
    };
  }

  return resolveAction(session, getActionFromRecipe(materialization.recipe), input, {
    ...context,
    actionKey
  });
}

// recipeDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario y constructor basico de recipes.
//
// Una recipe declara como una stage puede invocar actions genericas:
// - quien tiene autoridad mecanica para ejecutarla;
// - que targets acepta;
// - que actions contiene;
// - que restricciones y uso publico expone.
//
// recipeModel resuelve recipes contra una session concreta. Este archivo no
// ejecuta nada.
// -----------------------------------------------------------------------------

import { createAction } from './actionDefinition.js';
import { CONSTRAINT_TYPES, CONSTRAINT_WINDOWS } from './constraintModel.js';
import { normalizeId } from './sessionModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  RECIPE_ACTOR_TYPES,
  isMechanicalEntityType,
  isRecipeActorType,
  isTargetFilterType
} from './domainTypes.js';

export function getRecipeKey(recipe = {}) {
  return normalizeId(recipe.key ?? recipe.recipeKey);
}

export function normalizeRecipeUsage(usage = {}) {
  return {
    limit: usage.limit === null
      ? null
      : Number.isInteger(usage.limit) && usage.limit > 0
        ? usage.limit
        : null,
    window: usage.window ?? CONSTRAINT_WINDOWS.SESSION
  };
}

export function createRecipe(recipe = {}) {
  return {
    ...recipe,
    key: getRecipeKey(recipe),
    actions: (recipe.actions ?? []).map(createAction),
    optional: recipe.optional !== false,
    usage: normalizeRecipeUsage(recipe.usage),
    constraints: [...(recipe.constraints ?? [])]
  };
}

export function getPrimaryActionFromRecipe(recipe = {}) {
  return recipe.actions?.[0] ?? null;
}

export function getActionFromRecipe(recipe = {}) {
  const primaryAction = getPrimaryActionFromRecipe(recipe);
  if (!primaryAction) return null;

  return createAction({
    ...primaryAction,
    target: recipe.target ?? primaryAction.target ?? null,
    visibility: recipe.visibility ?? primaryAction.visibility,
    selectionRules: recipe.selectionRules ?? primaryAction.selectionRules ?? null
  });
}

export function getRecipeConstraints(recipe = {}) {
  const explicitConstraints = recipe?.constraints ?? [];
  const hasExplicitLimitedUses = explicitConstraints.some(
    (constraint) => constraint?.type === CONSTRAINT_TYPES.LIMITED_USES
  );
  const usageConstraint =
    !hasExplicitLimitedUses &&
    Number.isInteger(recipe?.usage?.limit) && recipe.usage.limit > 0
      ? [
          {
            type: CONSTRAINT_TYPES.LIMITED_USES,
            limit: recipe.usage.limit,
            window: recipe.usage.window
          }
        ]
      : [];

  return [...usageConstraint, ...explicitConstraints];
}

export function validateRecipe({ recipe = {}, input = {} } = {}) {
  const errors = [...(recipe.diagnostics ?? [])];
  const actorType = recipe.actor?.type ?? null;
  const actorIds = input.actorIds ?? [];
  const target = recipe.target ?? {};
  const targetType = target.type ?? null;
  const targetCount = target.count ?? 0;
  const filters = target.filters ?? [];
  const actions = Array.isArray(recipe.actions) ? recipe.actions : [];

  if (!isRecipeActorType(actorType)) {
    errors.push({
      code: 'recipe/invalid-actor-type',
      message: `recipe "${getRecipeKey(recipe)}" has invalid actor type "${actorType ?? 'missing'}"`,
      actorType
    });
  }

  if (actorType === RECIPE_ACTOR_TYPES.ROLE && actorIds.length > 1) {
    errors.push({
      code: 'recipe/invalid-role-actor-count',
      message: `recipe "${getRecipeKey(recipe)}" role actor expects at most one actorId`,
      actorType,
      actorIds
    });
  }

  if (
    (actorType === RECIPE_ACTOR_TYPES.SYSTEM || actorType === RECIPE_ACTOR_TYPES.DIRECTOR) &&
    actorIds.length > 0
  ) {
    errors.push({
      code: 'recipe/actor-ids-not-allowed',
      message: `recipe "${getRecipeKey(recipe)}" actor type "${actorType}" must not receive role actorIds`,
      actorType,
      actorIds
    });
  }

  if (!isMechanicalEntityType(targetType)) {
    errors.push({
      code: 'recipe/invalid-target-type',
      message: `recipe "${getRecipeKey(recipe)}" has invalid target type "${targetType ?? 'missing'}"`,
      targetType
    });
  }

  if (!Number.isInteger(targetCount) || targetCount < 0) {
    errors.push({
      code: 'recipe/invalid-target-count',
      message: `recipe "${getRecipeKey(recipe)}" target.count must be a non-negative integer`,
      targetCount
    });
  }

  if (targetType === MECHANICAL_ENTITY_TYPES.SESSION && targetCount !== 0) {
    errors.push({
      code: 'recipe/invalid-session-target-count',
      message: `recipe "${getRecipeKey(recipe)}" session target must use count 0`,
      targetCount
    });
  }

  if (!Array.isArray(filters)) {
    errors.push({
      code: 'recipe/invalid-target-filters',
      message: `recipe "${getRecipeKey(recipe)}" target.filters must be an array`
    });
  } else {
    filters
      .filter((filter) => !isTargetFilterType(filter))
      .forEach((filter) => {
        errors.push({
          code: 'recipe/unknown-target-filter',
          message: `recipe "${getRecipeKey(recipe)}" has unknown target filter "${filter}"`,
          filter
        });
      });
  }

  if (!Array.isArray(recipe.actions) || actions.length === 0) {
    errors.push({
      code: 'recipe/missing-actions',
      message: `recipe "${getRecipeKey(recipe)}" must declare at least one action`
    });
  }

  actions
    .filter((action) => !action?.id)
    .forEach((action, index) => {
      errors.push({
        code: 'recipe/invalid-action',
        message: `recipe "${getRecipeKey(recipe)}" has invalid action at index ${index}`,
        action,
        index
      });
    });

  return {
    ok: errors.length === 0,
    errors
  };
}


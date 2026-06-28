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
import {
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  evaluateRecipeConstraints
} from './constraintModel.js';
import { normalizeId } from './sessionModel.js';
import { materializePropertyBlockExpiration } from './roleModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  RECIPE_ACTOR_TYPES,
  isMechanicalEntityType,
  isRecipeActorType,
  isTargetFilterType
} from './domainTypes.js';
import { createMessagesFromEngineErrors } from '../messages/messageModel.js';
import { routeMessages } from '../messages/messageLogModel.js';

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
    usage: normalizeUsage(recipe.usage),
    constraints: [...(recipe.constraints ?? [])]
  };
}

function normalizeUsage(usage = {}) {
  return {
    limit: usage.limit === null
      ? null
      : Number.isInteger(usage.limit) && usage.limit > 0
        ? usage.limit
        : null,
    window: usage.window ?? CONSTRAINT_WINDOWS.SESSION
  };
}

// Elimina metadatos propios de receta antes de llamar a actionModel.
export function getActionFromRecipe(recipe = {}) {
  const action = { ...recipe };
  delete action.key;
  delete action.actionKey;
  delete action.constraints;
  delete action.diagnostics;
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

export function validateRecipeContract({ recipe = {}, input = {} } = {}) {
  const errors = [...(recipe.diagnostics ?? [])];
  const actorType = recipe.actor?.type ?? null;
  const actorIds = input.actorIds ?? [];
  const target = recipe.target ?? {};
  const targetType = target.type ?? null;
  const targetCount = target.count ?? 0;
  const filters = target.filters ?? [];

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

  return {
    ok: errors.length === 0,
    errors
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

export function validateRecipeConstraints({ session, recipe, input = {}, context = {} }) {
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
    recipe: {
      ...recipe,
      constraints
    },
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

// Resuelve una receta:
// 1. Valida restricciones de receta.
// 2. Convierte la receta en accion pura.
// 3. Llama a actionModel.
export function resolveRecipe(session, recipe, input = {}, context = {}) {
  const actionKey = context.actionKey ?? getRecipeKey(recipe);
  const contractValidation = validateRecipeContract({ recipe, input });

  if (!contractValidation.ok) {
    const messageState = appendEngineErrorMessages(session, contractValidation.errors, {
      ...context,
      actionId: recipe?.id ?? null,
      actionKey
    });

    return {
      ok: false,
      actionId: recipe?.id ?? null,
      actionKey,
      errors: contractValidation.errors,
      session: messageState.session,
      result: null,
      messages: messageState.messages
    };
  }

  const constraintValidation = validateRecipeConstraints({ session, recipe, input, context });

  if (!constraintValidation.ok) {
    const messageState = appendEngineErrorMessages(session, constraintValidation.errors, {
      ...context,
      actionId: recipe?.id ?? null,
      actionKey
    });

    return {
      ok: false,
      actionId: recipe?.id ?? null,
      actionKey,
      errors: constraintValidation.errors,
      session: messageState.session,
      result: null,
      messages: messageState.messages
    };
  }

  const materialization = materializeRecipeForSession(session, recipe, context);
  if (!materialization.ok) {
    const messageState = appendEngineErrorMessages(session, materialization.errors, {
      ...context,
      actionId: recipe?.id ?? null,
      actionKey
    });

    return {
      ok: false,
      actionId: recipe?.id ?? null,
      actionKey,
      errors: materialization.errors,
      session: messageState.session,
      result: null,
      messages: messageState.messages
    };
  }

  return resolveAction(session, getActionFromRecipe(materialization.recipe), input, {
    ...context,
    actionKey,
    actorContract: materialization.recipe.actor ?? null,
    targetContract: materialization.recipe.target ?? null
  });
}

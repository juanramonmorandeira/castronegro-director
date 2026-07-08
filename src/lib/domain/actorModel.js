// actorModel.js
// -----------------------------------------------------------------------------
// Resuelve autoridad mecanica de actores.
//
// Este modelo no ejecuta actions, no valida targets y no aplica efectos. Solo
// normaliza quien actua en un contexto mecanico concreto.
// -----------------------------------------------------------------------------

import { RECIPE_ACTOR_TYPES, isRecipeActorType } from './domainTypes.js';
import { findRole } from './targetModel.js';

export const ACTOR_MODEL_ERRORS = Object.freeze({
  INVALID_ACTOR_TYPE: 'actor/invalid-actor-type'
});

export const SELECT_SELECTOR_SOURCES = Object.freeze({
  STAGE_ACTORS: 'stage_actors',
  IN_PLAY_ROLES: 'in_play_roles'
});

function uniqueIds(ids = []) {
  return [...new Set((ids ?? []).filter(Boolean).map(String))];
}

export function getActionActors(session, actorIds = []) {
  return uniqueIds(actorIds).map((actorId) => findRole(session, actorId));
}

export function getActorIdsFromInputOrStage({ input = {}, stage = {} } = {}) {
  return uniqueIds(
    (input.actorIds ?? []).length > 0
      ? input.actorIds
      : stage?.actorIds ?? []
  );
}

// Devuelve los roleIds que pueden actuar como selectors por defecto.
//
// Un selector no es necesariamente el actor de una recipe. Es quien emite una
// decision dentro de la action select.
export function getInPlaySelectorIds(session = {}) {
  return (session?.roles ?? [])
    .filter((role) => role?.inPlay === true)
    .map((role) => role.id);
}

export function getSelectSelectorIds(session = {}, stage = {}, input = {}, selectionRules = {}) {
  if ((input.selectorIds ?? []).length > 0) return input.selectorIds;
  if (selectionRules.selectorSource === SELECT_SELECTOR_SOURCES.IN_PLAY_ROLES) {
    return getInPlaySelectorIds(session);
  }
  if ((input.actorIds ?? []).length > 0) return input.actorIds;
  if ((stage.actorIds ?? []).length > 0) return stage.actorIds;

  return [];
}

export function getSelectRuleSelectorIds(session = {}, stage = {}, input = {}, selectionRules = {}) {
  const selectorIds = getSelectSelectorIds(session, stage, input, selectionRules);
  if (selectorIds.length > 0) return selectorIds;

  return [
    ...new Set((input.selections ?? []).map((selection) => selection.selectorId).filter(Boolean))
  ];
}

export function getRequiredSelectorIds(session = {}, selectorIds = []) {
  return Array.isArray(selectorIds) && selectorIds.length > 0
    ? [...selectorIds]
    : getInPlaySelectorIds(session);
}

export function createActorContext({
  actorType = null,
  actorIds = [],
  actors = [],
  errors = []
} = {}) {
  const normalizedActorType = actorType ?? null;
  const normalizedActorIds = uniqueIds(actorIds);
  const normalizedActors = (actors ?? []).filter(Boolean);

  return {
    ok: errors.length === 0,
    actorType: normalizedActorType,
    actorIds: normalizedActorIds,
    actors: normalizedActors,
    primaryActor: normalizedActors[0] ?? null,
    authority: normalizedActorType,
    errors
  };
}

export function resolveRecipeActor({ session = {}, recipe = {}, input = {}, stage = {} } = {}) {
  const actorType = recipe.actor?.type ?? null;

  if (!isRecipeActorType(actorType)) {
    return createActorContext({
      actorType,
      errors: [
        {
          code: ACTOR_MODEL_ERRORS.INVALID_ACTOR_TYPE,
          message: `invalid actor type "${actorType ?? 'missing'}"`,
          actorType
        }
      ]
    });
  }

  if (actorType === RECIPE_ACTOR_TYPES.SYSTEM || actorType === RECIPE_ACTOR_TYPES.DIRECTOR) {
    return createActorContext({
      actorType,
      actorIds: [],
      actors: []
    });
  }

  const actorIds = getActorIdsFromInputOrStage({ input, stage });

  return createActorContext({
    actorType,
    actorIds,
    actors: getActionActors(session, actorIds)
  });
}

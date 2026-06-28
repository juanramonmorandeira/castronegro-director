// domainTypes.js
// -----------------------------------------------------------------------------
// Vocabulario compartido del dominio.
//
// Este modulo contiene tipos transversales que aparecen en varios modelos y no
// pertenecen de forma exclusiva a recipe, action, effect, objective o stage.
// -----------------------------------------------------------------------------

export const MECHANICAL_ENTITY_TYPES = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  SESSION: 'session',
  OBJECTIVE_RULE: 'objectiveRule'
});

export const RECIPE_ACTOR_TYPES = Object.freeze({
  ROLE: MECHANICAL_ENTITY_TYPES.ROLE,
  GROUP: MECHANICAL_ENTITY_TYPES.GROUP,
  SYSTEM: 'system',
  DIRECTOR: 'director'
});

export const TARGET_FILTER_TYPES = Object.freeze({
  IN_PLAY: 'in_play',
  NOT_IN_PLAY: 'not_in_play',
  NOT_SELF: 'not_self',
  SAME_ALIGNMENT: 'same_alignment',
  NOT_SAME_ALIGNMENT: 'not_same_alignment',
  RECENTLY_OUT_OF_PLAY: 'recently_out_of_play',
  ASSUMABLE: 'assumable',
  DISTINCT: 'distinct'
});

export function isMechanicalEntityType(type) {
  return Object.values(MECHANICAL_ENTITY_TYPES).includes(type);
}

export function isRecipeActorType(type) {
  return Object.values(RECIPE_ACTOR_TYPES).includes(type);
}

export function isTargetFilterType(filter) {
  return Object.values(TARGET_FILTER_TYPES).includes(filter);
}

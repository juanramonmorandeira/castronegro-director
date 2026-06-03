// recipeCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de recetas mecanicas reutilizables.
//
// El catalogo guarda datos predefinidos. No ejecuta nada y no contiene un
// constructor distinto por cada receta. Para obtener una receta se usa:
//
// getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)
//
// El constructor generico de receta vive en recipeModel.js: createRecipe.
// -----------------------------------------------------------------------------

import { ACTION_IDS, VISIBILITY } from './actionModel.js';
import { CONSTRAINT_TYPES, CONSTRAINT_WINDOWS } from './constraintModel.js';
import { EFFECT_TYPES } from './effectModel.js';
import { createRecipe } from './recipeModel.js';
import { RELATION_TYPES } from './sessionModel.js';
import {
  VOTE_REQUIRED_POLICIES,
  VOTE_RESTRICTION_TYPES,
  VOTE_TIE_POLICIES
} from './voteModel.js';

export const RECIPE_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  ONE_SHOT_SET_OUT_OF_PLAY: 'one_shot_set_out_of_play',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  VOTE_OUT_OF_PLAY: 'vote_out_of_play',
  CLOSE_CYCLE: 'close_cycle'
});

export function createLimitedUsesConstraint({
  limit = 1,
  window = CONSTRAINT_WINDOWS.SESSION
} = {}) {
  return {
    type: CONSTRAINT_TYPES.LIMITED_USES,
    limit,
    window
  };
}

export const RECIPE_CATALOG = Object.freeze({
  [RECIPE_KEYS.INSPECT_ROLE]: {
    key: RECIPE_KEYS.INSPECT_ROLE,
    optional: true,
    id: ACTION_IDS.INSPECT_ROLE,
    phase: 'each_night',
    actor: { type: 'role_holder' },
    target: {
      type: 'role_instance',
      count: 1,
      filters: ['in_play', 'not_self']
    },
    effect: {
      type: EFFECT_TYPES.REVEAL_PROPERTY,
      property: 'roleId'
    },
    visibility: VISIBILITY.ACTOR_ONLY
  },

  [RECIPE_KEYS.SET_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.SET_OUT_OF_PLAY,
    optional: true,
    id: ACTION_IDS.SET_IN_PLAY,
    phase: 'each_night',
    actor: {
      type: 'alignment_group',
      alignmentId: 'team_b'
    },
    target: {
      type: 'role_instance',
      count: 1,
      filters: ['in_play', 'not_same_alignment']
    },
    constraints: [],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role_instance',
      property: 'inPlay',
      value: false
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.SET_OUT_OF_PLAY,
    optional: true,
    id: ACTION_IDS.SET_IN_PLAY,
    phase: 'each_night',
    actor: {
      type: 'alignment_group',
      alignmentId: 'team_b'
    },
    target: {
      type: 'role_instance',
      count: 1,
      filters: ['in_play', 'not_same_alignment']
    },
    constraints: [
      createLimitedUsesConstraint({
        limit: 1,
        window: CONSTRAINT_WINDOWS.SESSION
      })
    ],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role_instance',
      property: 'inPlay',
      value: false
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    optional: true,
    id: ACTION_IDS.SET_IN_PLAY,
    phase: 'each_night',
    actor: { type: 'role_holder' },
    target: {
      type: 'role_instance',
      count: 1,
      filters: []
    },
    constraints: [
      {
        type: CONSTRAINT_TYPES.REQUIRE_RECENT_SET_PROPERTY,
        window: CONSTRAINT_WINDOWS.CURRENT_CYCLE,
        property: 'inPlay',
        value: false,
        actionKey: RECIPE_KEYS.SET_OUT_OF_PLAY
      },
      createLimitedUsesConstraint({
        limit: 1,
        window: CONSTRAINT_WINDOWS.SESSION
      })
    ],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role_instance',
      property: 'inPlay',
      value: true
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.BLOCK_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.BLOCK_OUT_OF_PLAY,
    optional: true,
    id: ACTION_IDS.BLOCK_ACTION,
    phase: 'each_night',
    actor: { type: 'role_holder' },
    target: {
      type: 'role_instance',
      count: 1,
      filters: ['in_play', 'not_self']
    },
    constraints: [
      {
        type: CONSTRAINT_TYPES.NO_REPEAT_TARGET,
        window: CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
      }
    ],
    effect: {
      type: EFFECT_TYPES.BLOCK_ACTION,
      blocks: {
        actionId: ACTION_IDS.SET_IN_PLAY,
        params: {
          property: 'inPlay',
          value: false
        }
      },
      duration: 'current_cycle'
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.LINK_TARGETS]: {
    key: RECIPE_KEYS.LINK_TARGETS,
    optional: true,
    id: ACTION_IDS.LINK_TARGETS,
    phase: 'first_night',
    actor: { type: 'role_holder' },
    target: {
      type: 'role_instance',
      count: 2,
      filters: ['in_play', 'distinct']
    },
    effect: {
      type: EFFECT_TYPES.SET_RELATION,
      targetType: 'relation',
      relationType: RELATION_TYPES.LINKED,
      active: true
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.VOTE_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.VOTE_OUT_OF_PLAY,
    optional: true,
    id: ACTION_IDS.VOTE,
    phase: 'each_day_vote',
    tiePolicy: VOTE_TIE_POLICIES.NULL_ON_TIE,
    requiredVotes: VOTE_REQUIRED_POLICIES.ALL_IN_PLAY,
    relationRestrictions: [
      {
        type: VOTE_RESTRICTION_TYPES.EXCLUDE_RELATED_TARGET,
        relationType: RELATION_TYPES.LINKED
      }
    ],
    onWinnerAction: {
      id: ACTION_IDS.SET_IN_PLAY,
      target: {
        type: 'role_instance',
        count: 1,
        filters: ['in_play']
      },
      effect: {
        type: EFFECT_TYPES.SET_PROPERTY,
        targetType: 'role_instance',
        property: 'inPlay',
        value: false
      },
      visibility: VISIBILITY.ALL
    },
    visibility: VISIBILITY.ALL
  },

  [RECIPE_KEYS.CLOSE_CYCLE]: {
    key: RECIPE_KEYS.CLOSE_CYCLE,
    optional: false,
    id: ACTION_IDS.CLOSE_CYCLE,
    phase: 'cycle_close',
    actor: { type: 'system' },
    target: {
      type: 'all_role_instances',
      count: 'automatic'
    },
    effect: {
      type: EFFECT_TYPES.CLOSE_CYCLE
    },
    visibility: VISIBILITY.ALL
  }
});

function cloneCatalogValue(value) {
  if (Array.isArray(value)) return value.map(cloneCatalogValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneCatalogValue(entryValue)])
    );
  }
  return value;
}

export function getCatalogRecipe(recipeKey, overrides = {}) {
  const baseRecipe = RECIPE_CATALOG[recipeKey];
  if (!baseRecipe) return null;

  return createRecipe({
    ...cloneCatalogValue(baseRecipe),
    ...overrides,
    constraints: overrides.constraints
      ? [...overrides.constraints]
      : cloneCatalogValue(baseRecipe.constraints ?? []),
    target: overrides.target
      ? {
          ...overrides.target,
          filters: [...(overrides.target.filters ?? [])]
        }
      : cloneCatalogValue(baseRecipe.target),
    actor: overrides.actor ? { ...overrides.actor } : cloneCatalogValue(baseRecipe.actor),
    effect: overrides.effect ? cloneCatalogValue(overrides.effect) : cloneCatalogValue(baseRecipe.effect)
  });
}

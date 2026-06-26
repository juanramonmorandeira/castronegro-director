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
import {
  GROUP_RULE_TARGETS,
  GROUP_RULE_TYPES,
  GROUP_SELECTION_RULE_TYPES,
  GROUP_TYPES,
  defineGroupRule
} from './groupDefinition.js';
import { OBJECTIVE_CONDITIONS } from './objectiveModel.js';
import { createRecipe } from './recipeModel.js';

export const RECIPE_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  SET_DOUBLE_SELECTOR: 'set_double_selector',
  ASSUME_ROLE: 'assume_role',
  ONE_SHOT_SET_OUT_OF_PLAY: 'one_shot_set_out_of_play',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  CONCLUDE_PLAY: 'conclude_play'
});

const ROLE_IN_PLAY_FALSE_INFLUENCE = Object.freeze({
  subject: 'role',
  property: 'inPlay',
  operation: 'set',
  values: [false]
});

const ROLE_IN_PLAY_TRUE_INFLUENCE = Object.freeze({
  subject: 'role',
  property: 'inPlay',
  operation: 'set',
  values: [true]
});

const ROLE_DOUBLE_SELECTOR_TRUE_INFLUENCE = Object.freeze({
  subject: 'role',
  property: 'doubleSelector',
  operation: 'set',
  values: [true]
});

const ROLE_IDENTITY_INFLUENCE = Object.freeze({
  subject: 'role',
  property: 'identity',
  operation: 'replace'
});

const GROUP_MEMBERSHIP_INFLUENCE = Object.freeze({
  subject: 'group',
  property: 'roleIds',
  operation: 'set'
});

const OBJECTIVE_RULE_STATE_INFLUENCE = Object.freeze({
  subject: 'objectiveRule',
  property: 'state',
  operation: 'set'
});

export const RECIPE_CATALOG = Object.freeze({
  [RECIPE_KEYS.INSPECT_ROLE]: {
    key: RECIPE_KEYS.INSPECT_ROLE,
    optional: true,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.INSPECT_ROLE,
    actor: { type: 'role_holder' },
    target: {
      type: 'role',
      count: 1,
      filters: ['in_play', 'not_self']
    },
    effect: {
      type: EFFECT_TYPES.REVEAL_PROPERTY,
      property: 'roleKey'
    },
    visibility: VISIBILITY.ACTOR_ONLY
  },

  [RECIPE_KEYS.SET_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.SET_OUT_OF_PLAY,
    optional: true,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.SET_IN_PLAY,
    actor: {
      type: 'alignment_group',
      alignmentId: 'alignment_b'
    },
    target: {
      type: 'role',
      count: 1,
      filters: ['in_play', 'not_same_alignment']
    },
    constraints: [],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role',
      property: 'inPlay',
      value: false
    },
    influences: [ROLE_IN_PLAY_FALSE_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY,
    optional: true,
    usage: { limit: 1, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.SET_IN_PLAY,
    actor: {
      type: 'alignment_group',
      alignmentId: 'alignment_b'
    },
    target: {
      type: 'role',
      count: 1,
      filters: ['in_play', 'not_same_alignment']
    },
    constraints: [],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role',
      property: 'inPlay',
      value: false
    },
    influences: [ROLE_IN_PLAY_FALSE_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    optional: true,
    usage: { limit: 1, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.SET_IN_PLAY,
    actor: { type: 'role_holder' },
    target: {
      type: 'role',
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
    ],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role',
      property: 'inPlay',
      value: true
    },
    influences: [ROLE_IN_PLAY_TRUE_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.SET_DOUBLE_SELECTOR]: {
    key: RECIPE_KEYS.SET_DOUBLE_SELECTOR,
    optional: false,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.SET_PROPERTY,
    actor: { type: 'system' },
    target: {
      type: 'role',
      count: 1,
      filters: ['in_play']
    },
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role',
      property: 'doubleSelector',
      value: true
    },
    influences: [ROLE_DOUBLE_SELECTOR_TRUE_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.ASSUME_ROLE]: {
    key: RECIPE_KEYS.ASSUME_ROLE,
    optional: false,
    usage: { limit: 1, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.REPLACE_ROLE_IDENTITY,
    actor: { type: 'role_holder' },
    target: {
      type: 'role',
      count: 1,
      filters: ['assumable']
    },
    effect: {
      type: EFFECT_TYPES.REPLACE_ROLE_IDENTITY,
      targetType: 'role',
      forcedWhen: {
        allAssumableRolesHaveRoleKey: 'role_set_out_of_play'
      }
    },
    influences: [ROLE_IDENTITY_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.BLOCK_OUT_OF_PLAY]: {
    key: RECIPE_KEYS.BLOCK_OUT_OF_PLAY,
    optional: true,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.BLOCK_PROPERTY_CHANGE,
    actor: { type: 'role_holder' },
    target: {
      type: 'role',
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
      type: EFFECT_TYPES.BLOCK_PROPERTY_CHANGE,
      blockedPropertyChange: {
        property: 'inPlay',
        value: false
      },
      blockedFor: {
        groupIds: ['alignment_set_out_of_play'],
        alignmentIds: ['alignment_b']
      },
      duration: {
        unit: 'pool',
        offset: 0,
        boundary: 'after'
      }
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.LINK_TARGETS]: {
    key: RECIPE_KEYS.LINK_TARGETS,
    optional: true,
    usage: { limit: 1, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.LINK_TARGETS,
    actor: { type: 'role_holder' },
    target: {
      type: 'role',
      count: 2,
      filters: ['in_play', 'distinct']
    },
    effect: {
      type: EFFECT_TYPES.SET_GROUP,
      targetType: 'group',
      groupType: GROUP_TYPES.LINKED,
      groupRules: [
        defineGroupRule({
          key: 'propagate_out_of_play',
          type: GROUP_RULE_TYPES.PROPAGATE_PROPERTY_CHANGE,
          when: {
            property: 'inPlay',
            value: false
          },
          apply: {
            property: 'inPlay',
            value: false
          },
          targets: GROUP_RULE_TARGETS.OTHER_MEMBERS
        })
      ],
      selectionRules: [
        {
          key: 'members_cannot_vote_other_members_out_of_play',
          type: GROUP_SELECTION_RULE_TYPES.EXCLUDE_OTHER_GROUP_MEMBERS,
          scope: {
            methods: ['vote'],
            actionKeys: [RECIPE_KEYS.SET_OUT_OF_PLAY]
          }
        }
      ],
      objectiveRules: [
        {
          key: 'members_complete_exclusive_objective',
          holder: { type: 'self' },
          appliesWhen: {
            sourceState: 'active',
            conditions: [
              {
                type: OBJECTIVE_CONDITIONS.MEMBERS_SPAN_MULTIPLE_EFFECTIVE_ALIGNMENTS
              }
            ]
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ALL_HOLDER_MEMBERS_ARE_ONLY_ROLES_IN_PLAY
          },
          onFulfilled: [
            {
              conclusive: true,
              beneficiaries: { type: 'holder' }
            }
          ],
          conflictRules: []
        }
      ],
      active: true
    },
    influences: [GROUP_MEMBERSHIP_INFLUENCE, OBJECTIVE_RULE_STATE_INFLUENCE],
    visibility: VISIBILITY.STORYTELLER_ONLY
  },

  [RECIPE_KEYS.CONCLUDE_PLAY]: {
    key: RECIPE_KEYS.CONCLUDE_PLAY,
    optional: false,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.CONCLUDE_PLAY,
    actor: { type: 'system' },
    target: {
      type: 'session',
      count: 0
    },
    effect: {
      type: EFFECT_TYPES.CONCLUDE_PLAY
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
    effect: overrides.effect ? cloneCatalogValue(overrides.effect) : cloneCatalogValue(baseRecipe.effect),
    usage: overrides.usage ? cloneCatalogValue(overrides.usage) : cloneCatalogValue(baseRecipe.usage)
  });
}

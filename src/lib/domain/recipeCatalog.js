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
import {
  OBJECTIVE_BENEFICIARY_TYPES,
  INFLUENCE_OPERATIONS,
  INFLUENCE_SUBJECTS,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_HOLDER_TYPES
} from './objectiveModel.js';
import { createRecipe } from './recipeModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  RECIPE_ACTOR_TYPES,
  TARGET_FILTER_TYPES
} from './domainTypes.js';

export const RECIPE_KEYS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  LINK_TARGETS: 'link_targets',
  BLOCK_OUT_OF_PLAY: 'block_out_of_play',
  SET_OUT_OF_PLAY: 'set_out_of_play',
  SET_DOUBLE_SELECTOR: 'set_double_selector',
  ASSUME_ROLE: 'assume_role',
  RESTORE_RECENT_OUT_OF_PLAY: 'restore_recent_out_of_play',
  CONCLUDE_PLAY: 'conclude_play'
});

const ROLE_IN_PLAY_FALSE_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.ROLE,
  property: 'inPlay',
  operation: INFLUENCE_OPERATIONS.SET,
  values: [false]
});

const ROLE_IN_PLAY_TRUE_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.ROLE,
  property: 'inPlay',
  operation: INFLUENCE_OPERATIONS.SET,
  values: [true]
});

const ROLE_DOUBLE_SELECTOR_TRUE_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.ROLE,
  property: 'doubleSelector',
  operation: INFLUENCE_OPERATIONS.SET,
  values: [true]
});

const ROLE_IDENTITY_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.ROLE,
  property: 'identity',
  operation: 'replace'
});

const GROUP_MEMBERSHIP_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.GROUP,
  property: 'roleIds',
  operation: INFLUENCE_OPERATIONS.SET
});

const OBJECTIVE_RULE_STATE_INFLUENCE = Object.freeze({
  subject: INFLUENCE_SUBJECTS.OBJECTIVE_RULE,
  property: 'state',
  operation: INFLUENCE_OPERATIONS.SET
});

export const RECIPE_CATALOG = Object.freeze({
  [RECIPE_KEYS.INSPECT_ROLE]: {
    key: RECIPE_KEYS.INSPECT_ROLE,
    optional: true,
    usage: { limit: null, window: CONSTRAINT_WINDOWS.SESSION },
    id: ACTION_IDS.INSPECT_ROLE,
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SELF]
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
    actor: { type: RECIPE_ACTOR_TYPES.GROUP },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT]
    },
    constraints: [],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
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
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: []
    },
    constraints: [
      {
        type: CONSTRAINT_TYPES.REQUIRE_RECENT_SET_PROPERTY,
        window: CONSTRAINT_WINDOWS.CURRENT_CYCLE,
        property: 'inPlay',
        value: false,
        recipeKey: RECIPE_KEYS.SET_OUT_OF_PLAY
      },
    ],
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
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
    actor: { type: RECIPE_ACTOR_TYPES.SYSTEM },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.IN_PLAY]
    },
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
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
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.ASSUMABLE]
    },
    effect: {
      type: EFFECT_TYPES.REPLACE_ROLE_IDENTITY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
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
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SELF]
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
        groupIds: ['group_concealed_set_out_of_play'],
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
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 2,
      filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.DISTINCT]
    },
    effect: {
      type: EFFECT_TYPES.SET_GROUP,
      targetType: MECHANICAL_ENTITY_TYPES.GROUP,
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
            recipeKeys: [RECIPE_KEYS.SET_OUT_OF_PLAY]
          }
        }
      ],
      objectiveRules: [
        {
          key: 'members_complete_exclusive_objective',
          holder: { type: OBJECTIVE_HOLDER_TYPES.SELF },
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
              beneficiaries: { type: OBJECTIVE_BENEFICIARY_TYPES.HOLDER }
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
    actor: { type: RECIPE_ACTOR_TYPES.SYSTEM },
    target: {
      type: MECHANICAL_ENTITY_TYPES.SESSION,
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

const ALLOWED_RECIPE_OVERRIDE_FIELDS = Object.freeze([
  'actor',
  'target',
  'usage',
  'constraints',
  'visibility',
  'optional',
  'metadata',
  'influences'
]);

const BLOCKED_RECIPE_OVERRIDE_FIELDS = Object.freeze([
  'id',
  'effect'
]);

export function validateCatalogRecipeOverrides(recipeKey, overrides = {}) {
  const errors = [];
  const overrideKeys = Object.keys(overrides ?? {});

  BLOCKED_RECIPE_OVERRIDE_FIELDS
    .filter((field) => overrideKeys.includes(field))
    .forEach((field) => {
      errors.push({
        code: 'recipe/blocked-override',
        message: `recipe "${recipeKey}" cannot override "${field}"`,
        recipeKey,
        field
      });
    });

  overrideKeys
    .filter(
      (field) =>
        !ALLOWED_RECIPE_OVERRIDE_FIELDS.includes(field) &&
        !BLOCKED_RECIPE_OVERRIDE_FIELDS.includes(field)
    )
    .forEach((field) => {
      errors.push({
        code: 'recipe/unknown-override',
        message: `recipe "${recipeKey}" received unknown override "${field}"`,
        recipeKey,
        field
      });
    });

  return {
    ok: errors.length === 0,
    errors
  };
}

export function getCatalogRecipe(recipeKey, overrides = {}) {
  const baseRecipe = RECIPE_CATALOG[recipeKey];
  if (!baseRecipe) return null;
  const overrideValidation = validateCatalogRecipeOverrides(recipeKey, overrides);

  return createRecipe({
    ...cloneCatalogValue(baseRecipe),
    ...overrides,
    id: baseRecipe.id,
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
    effect: cloneCatalogValue(baseRecipe.effect),
    usage: overrides.usage ? cloneCatalogValue(overrides.usage) : cloneCatalogValue(baseRecipe.usage),
    diagnostics: [
      ...(baseRecipe.diagnostics ?? []),
      ...overrideValidation.errors
    ]
  });
}

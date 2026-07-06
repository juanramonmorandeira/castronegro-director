// stageCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de stages mecanicos reutilizables.
//
// El catalogo guarda stageDefinitions predefinidas mediante defineStage.
// -----------------------------------------------------------------------------

import { STAGE_STATUSES } from './sessionModel.js';
import { CONSTRAINT_TYPES, CONSTRAINT_WINDOWS } from './constraintModel.js';
import { defineStage } from './stageDefinition.js';
import {
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  STAGE_KEYS
} from './stageModel.js';
import {
  LINKED_PROPAGATED_EFFECT_STAGE,
  ROLE_STATE_REVEALED_STAGE
} from './stageTypes.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECTION_ABSTAIN_RULES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RUNOFF_RULES,
  SELECTION_SELECTOR_SOURCES,
  SELECTION_TIE_RULES,
  SELECTION_UNANIMOUS_RULES,
  createSelectionRules
} from './selectionModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  RECIPE_ACTOR_TYPES,
  TARGET_FILTER_TYPES
} from './domainTypes.js';

export const STAGE_CATALOG_IDS = Object.freeze({
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_OUT_OF_PLAY: 'role_in_out_of_play',
  ROLE_REACTIVE_RESPONSE: 'role_reactive_response',
  ROLE_ASSUMES_ROLE: 'role_assumes_role',
  SELECT_DOUBLE_SELECTOR: 'select_double_selector',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector',
  LINKED_PROPAGATED_EFFECT: LINKED_PROPAGATED_EFFECT_STAGE.CATALOG_ID,
  ROLE_STATE_REVEALED: ROLE_STATE_REVEALED_STAGE.CATALOG_ID,
  DELIBERATION: 'deliberation',
  CONCEALED_SET_OUT_OF_PLAY: 'concealed_set_out_of_play',
  EXPOSED_SET_OUT_OF_PLAY: 'exposed_set_out_of_play'
});

export function getManualCompletion(allowedRequesters = Object.values(STAGE_COMPLETION_REQUESTED_BY)) {
  return {
    mode: STAGE_COMPLETION_MODES.MANUAL,
    allowedRequesters
  };
}

export const STAGE_CATALOG = Object.freeze({
  [STAGE_CATALOG_IDS.ROLE_INSPECTS]: defineStage({
    key: STAGE_KEYS.STAGE_01,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_INSPECTS
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS]: defineStage({
    key: STAGE_KEYS.STAGE_02,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: defineStage({
    key: STAGE_KEYS.STAGE_02,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY]: defineStage({
    key: STAGE_KEYS.STAGE_03,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [
      getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY, {
        constraints: [
          {
            type: CONSTRAINT_TYPES.REQUIRE_SELF_TARGET_WHEN_ACTOR_OUT
          },
          {
            type: CONSTRAINT_TYPES.REQUIRE_RECENT_SET_PROPERTY,
            window: CONSTRAINT_WINDOWS.CURRENT_CYCLE,
            property: 'inPlay',
            value: false,
            recipeKey: RECIPE_KEYS.SET_OUT_OF_PLAY,
            stageCatalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
          }
        ]
      }),
      getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
        actor: { type: RECIPE_ACTOR_TYPES.ROLE },
        target: {
          type: MECHANICAL_ENTITY_TYPES.ROLE,
          count: 1,
          filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SELF]
        },
        constraints: [
          {
            type: CONSTRAINT_TYPES.REQUIRE_ACTOR_IN_PLAY
          }
        ],
        usage: {
          limit: 1,
          window: CONSTRAINT_WINDOWS.SESSION
        }
      })
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE]: defineStage({
    key: STAGE_KEYS.STAGE_07,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [
      getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
        actor: { type: RECIPE_ACTOR_TYPES.ROLE },
        target: {
          type: MECHANICAL_ENTITY_TYPES.ROLE,
          count: 1,
          filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SELF]
        }
      })
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_ASSUMES_ROLE]: defineStage({
    key: STAGE_KEYS.STAGE_09,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    recipes: [getCatalogRecipe(RECIPE_KEYS.ASSUME_ROLE)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_ASSUMES_ROLE
    }
  }),

  [STAGE_CATALOG_IDS.SELECT_DOUBLE_SELECTOR]: defineStage({
    key: STAGE_KEYS.STAGE_08,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECTION_RUNOFF_RULES.TIED_CANDIDATES,
      repeatLimit: 1
    }),
    recipes: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.SELECT_DOUBLE_SELECTOR
    }
  }),

  [STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR]: defineStage({
    key: STAGE_KEYS.STAGE_08,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      selectorEligibility: {
        requireInPlay: false
      }
    }),
    recipes: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR
    }
  }),

  [STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT]: defineStage({
    key: STAGE_KEYS.LINKED_PROPAGATED_EFFECT,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion([STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]),
    recipes: [],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_STATE_REVEALED]: defineStage({
    key: STAGE_KEYS.ROLE_STATE_REVEALED,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion([STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]),
    recipes: [],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
    }
  }),

  [STAGE_CATALOG_IDS.DELIBERATION]: defineStage({
    key: STAGE_KEYS.DELIBERATION,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion([STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]),
    recipes: [],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.DELIBERATION,
      interaction: {
        participants: SELECTION_SELECTOR_SOURCES.IN_PLAY_ROLES,
        mode: 'deliberation'
      }
    }
  }),

  [STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY]: defineStage({
    key: STAGE_KEYS.STAGE_04,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.REQUIRED,
      tie: SELECTION_TIE_RULES.NULL_ON_TIE
    }),
    recipes: [getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
    }
  }),

  [STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY]: defineStage({
    key: STAGE_KEYS.STAGE_05,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    selectionRules: createSelectionRules({
      selectorSource: SELECTION_SELECTOR_SOURCES.IN_PLAY_ROLES,
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.NULL_ON_TIE
    }),
    recipes: [
      getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
        target: {
          type: MECHANICAL_ENTITY_TYPES.ROLE,
          count: 1,
          filters: [TARGET_FILTER_TYPES.IN_PLAY]
        }
      })
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY,
      interaction: {
        participants: SELECTION_SELECTOR_SOURCES.IN_PLAY_ROLES,
        selectionMethod: 'vote'
      }
    }
  })
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

export function getCatalogStage(stageCatalogId, overrides = {}) {
  const baseStage = STAGE_CATALOG[stageCatalogId];
  if (!baseStage) return null;

  return defineStage({
    ...cloneCatalogValue(baseStage),
    ...overrides,
    actorIds: overrides.actorIds
      ? cloneCatalogValue(overrides.actorIds)
      : cloneCatalogValue(baseStage.actorIds),
    completion: overrides.completion
      ? cloneCatalogValue(overrides.completion)
      : cloneCatalogValue(baseStage.completion),
    selectionRules: overrides.selectionRules
      ? cloneCatalogValue(overrides.selectionRules)
      : cloneCatalogValue(baseStage.selectionRules),
    recipes: overrides.recipes
      ? cloneCatalogValue(overrides.recipes)
      : cloneCatalogValue(baseStage.recipes),
    metadata: {
      ...cloneCatalogValue(baseStage.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

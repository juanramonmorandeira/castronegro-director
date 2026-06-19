// stageCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de stages mecanicos reutilizables.
//
// El catalogo guarda stages predefinidos. No expone un constructor por cada tipo
// de stage. El constructor unico sigue siendo createStage.
// -----------------------------------------------------------------------------

import { GROUP_TYPES } from './groupDefinition.js';
import { STAGE_STATUSES } from './sessionModel.js';
import { createStage } from './stageDefinition.js';
import {
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  STAGE_KEYS
} from './stageModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECTION_ABSTAIN_RULES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RESTRICTION_TYPES,
  SELECTION_TIE_RULES,
  SELECTION_UNANIMOUS_RULES,
  createSelectionRules
} from './selectionModel.js';

export const STAGE_CATALOG_IDS = Object.freeze({
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_PLAY_CONTROL: 'role_in_play_control',
  ROLE_REACTIVE_RESPONSE: 'role_reactive_response',
  GROUP_SET_OUT_OF_PLAY: 'group_set_out_of_play',
  GROUP_SELECTION: 'group_selection',
  SYSTEM_STARTS_CYCLE: 'system_starts_cycle'
});

export function getManualCompletion(allowedRequesters = Object.values(STAGE_COMPLETION_REQUESTED_BY)) {
  return {
    mode: STAGE_COMPLETION_MODES.MANUAL,
    allowedRequesters
  };
}

export const STAGE_CATALOG = Object.freeze({
  [STAGE_CATALOG_IDS.ROLE_INSPECTS]: createStage({
    key: STAGE_KEYS.STAGE_01,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_INSPECTS
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS]: createStage({
    key: STAGE_KEYS.STAGE_02,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: createStage({
    key: STAGE_KEYS.STAGE_02,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL]: createStage({
    key: STAGE_KEYS.STAGE_03,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [
      getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      getCatalogRecipe(RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY)
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL
    }
  }),

  [STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE]: createStage({
    key: STAGE_KEYS.STAGE_07,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [
      getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
        actor: { type: 'role_holder' },
        target: {
          type: 'role',
          count: 1,
          filters: ['in_play', 'not_self']
        }
      })
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE
    }
  }),

  [STAGE_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY]: createStage({
    key: STAGE_KEYS.STAGE_04,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY
    }
  }),

  [STAGE_CATALOG_IDS.GROUP_SELECTION]: createStage({
    key: STAGE_KEYS.STAGE_05,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.NULL_ON_TIE,
      groupRestrictions: [
        {
          type: SELECTION_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE,
          groupType: GROUP_TYPES.LINKED
        }
      ]
    }),
    actions: [
      getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
        target: {
          type: 'role',
          count: 1,
          filters: ['in_play']
        }
      })
    ],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.GROUP_SELECTION
    }
  }),

  [STAGE_CATALOG_IDS.SYSTEM_STARTS_CYCLE]: createStage({
    key: STAGE_KEYS.STAGE_06,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion([STAGE_COMPLETION_REQUESTED_BY.SYSTEM]),
    actions: [getCatalogRecipe(RECIPE_KEYS.START_CYCLE)],
    metadata: {
      catalogId: STAGE_CATALOG_IDS.SYSTEM_STARTS_CYCLE
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

  return createStage({
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
    actions: overrides.actions
      ? cloneCatalogValue(overrides.actions)
      : cloneCatalogValue(baseStage.actions),
    metadata: {
      ...cloneCatalogValue(baseStage.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

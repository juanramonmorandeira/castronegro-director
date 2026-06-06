// stepCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de steps mecanicos reutilizables.
//
// El catalogo guarda steps predefinidos. No expone un constructor por cada tipo
// de step. El constructor unico sigue siendo createStep.
// -----------------------------------------------------------------------------

import { RELATION_TYPES, STEP_STATUSES } from './sessionModel.js';
import { createStep } from './stepDefinition.js';
import {
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY,
  STEP_KEYS
} from './stepModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  VOTE_ABSTAIN_RULES,
  VOTE_REQUIRED_RULES,
  VOTE_RESTRICTION_TYPES,
  VOTE_TIE_RULES,
  VOTE_UNANIMOUS_RULES,
  createVoteRules
} from './voteModel.js';

export const STEP_CATALOG_IDS = Object.freeze({
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_PLAY_CONTROL: 'role_in_play_control',
  ROLE_REACTIVE_RESPONSE: 'role_reactive_response',
  GROUP_SET_OUT_OF_PLAY: 'group_set_out_of_play',
  GROUP_VOTE: 'group_vote',
  SYSTEM_CLOSES_CYCLE: 'system_closes_cycle'
});

export function getManualCompletion(allowedRequesters = Object.values(STEP_COMPLETION_REQUESTED_BY)) {
  return {
    mode: STEP_COMPLETION_MODES.MANUAL,
    allowedRequesters
  };
}

export const STEP_CATALOG = Object.freeze({
  [STEP_CATALOG_IDS.ROLE_INSPECTS]: createStep({
    key: STEP_KEYS.STEP_01,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_INSPECTS
    }
  }),

  [STEP_CATALOG_IDS.ROLE_LINKS_TARGETS]: createStep({
    key: STEP_KEYS.STEP_02,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_LINKS_TARGETS
    }
  }),

  [STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: createStep({
    key: STEP_KEYS.STEP_02,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY
    }
  }),

  [STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL]: createStep({
    key: STEP_KEYS.STEP_03,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [
      getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      getCatalogRecipe(RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY)
    ],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL
    }
  }),

  [STEP_CATALOG_IDS.ROLE_REACTIVE_RESPONSE]: createStep({
    key: STEP_KEYS.STEP_07,
    status: STEP_STATUSES.ENABLED,
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
      catalogId: STEP_CATALOG_IDS.ROLE_REACTIVE_RESPONSE
    }
  }),

  [STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY]: createStep({
    key: STEP_KEYS.STEP_04,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY
    }
  }),

  [STEP_CATALOG_IDS.GROUP_VOTE]: createStep({
    key: STEP_KEYS.STEP_05,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion(),
    voteRules: createVoteRules({
      required: VOTE_REQUIRED_RULES.ALL_ACTORS,
      abstain: VOTE_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: VOTE_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: VOTE_TIE_RULES.NULL_ON_TIE,
      relationRestrictions: [
        {
          type: VOTE_RESTRICTION_TYPES.EXCLUDE_RELATED_TARGET,
          relationType: RELATION_TYPES.LINKED
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
      catalogId: STEP_CATALOG_IDS.GROUP_VOTE
    }
  }),

  [STEP_CATALOG_IDS.SYSTEM_CLOSES_CYCLE]: createStep({
    key: STEP_KEYS.STEP_06,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    completion: getManualCompletion([STEP_COMPLETION_REQUESTED_BY.SYSTEM]),
    actions: [getCatalogRecipe(RECIPE_KEYS.CLOSE_CYCLE)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.SYSTEM_CLOSES_CYCLE
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

export function getCatalogStep(stepCatalogId, overrides = {}) {
  const baseStep = STEP_CATALOG[stepCatalogId];
  if (!baseStep) return null;

  return createStep({
    ...cloneCatalogValue(baseStep),
    ...overrides,
    actorIds: overrides.actorIds
      ? cloneCatalogValue(overrides.actorIds)
      : cloneCatalogValue(baseStep.actorIds),
    completion: overrides.completion
      ? cloneCatalogValue(overrides.completion)
      : cloneCatalogValue(baseStep.completion),
    voteRules: overrides.voteRules
      ? cloneCatalogValue(overrides.voteRules)
      : cloneCatalogValue(baseStep.voteRules),
    actions: overrides.actions
      ? cloneCatalogValue(overrides.actions)
      : cloneCatalogValue(baseStep.actions),
    metadata: {
      ...cloneCatalogValue(baseStep.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

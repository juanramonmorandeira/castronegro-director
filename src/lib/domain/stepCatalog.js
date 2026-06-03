// stepCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de steps mecanicos reutilizables.
//
// El catalogo guarda steps predefinidos. No expone un constructor por cada tipo
// de step. El constructor unico sigue siendo createStep.
// -----------------------------------------------------------------------------

import { PHASE_STATUSES } from './sessionModel.js';
import { ACTOR_SCOPE_TYPES, createStep } from './stepDefinition.js';
import {
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY,
  STEP_KEYS
} from './stepModel.js';
import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';

export const STEP_CATALOG_IDS = Object.freeze({
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_PLAY_CONTROL: 'role_in_play_control',
  GROUP_SET_OUT_OF_PLAY: 'group_set_out_of_play',
  GROUP_VOTE_OUT_OF_PLAY: 'group_vote_out_of_play',
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
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ROLE },
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_INSPECTS
    }
  }),

  [STEP_CATALOG_IDS.ROLE_LINKS_TARGETS]: createStep({
    key: STEP_KEYS.STEP_02,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ROLE },
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_LINKS_TARGETS
    }
  }),

  [STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: createStep({
    key: STEP_KEYS.STEP_02,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ROLE },
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY
    }
  }),

  [STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL]: createStep({
    key: STEP_KEYS.STEP_03,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ROLE },
    completion: getManualCompletion(),
    actions: [
      getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      getCatalogRecipe(RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY)
    ],
    metadata: {
      catalogId: STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL
    }
  }),

  [STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY]: createStep({
    key: STEP_KEYS.STEP_04,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ROLE_GROUP },
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY
    }
  }),

  [STEP_CATALOG_IDS.GROUP_VOTE_OUT_OF_PLAY]: createStep({
    key: STEP_KEYS.STEP_05,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: ACTOR_SCOPE_TYPES.ALL_ROLES },
    completion: getManualCompletion(),
    actions: [getCatalogRecipe(RECIPE_KEYS.VOTE_OUT_OF_PLAY)],
    metadata: {
      catalogId: STEP_CATALOG_IDS.GROUP_VOTE_OUT_OF_PLAY
    }
  }),

  [STEP_CATALOG_IDS.SYSTEM_CLOSES_CYCLE]: createStep({
    key: STEP_KEYS.STEP_06,
    status: PHASE_STATUSES.ENABLED,
    actorScope: { type: 'system' },
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
    actorScope: overrides.actorScope
      ? cloneCatalogValue(overrides.actorScope)
      : cloneCatalogValue(baseStep.actorScope),
    completion: overrides.completion
      ? cloneCatalogValue(overrides.completion)
      : cloneCatalogValue(baseStep.completion),
    actions: overrides.actions
      ? cloneCatalogValue(overrides.actions)
      : cloneCatalogValue(baseStep.actions),
    metadata: {
      ...cloneCatalogValue(baseStep.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

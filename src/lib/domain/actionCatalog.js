// actionCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de actions mecanicas reutilizables.
//
// El catalogo no ejecuta actions. Solo entrega una action normalizada para que
// las recipes puedan componer su mecanica sin declarar id/effect directamente.
// -----------------------------------------------------------------------------

import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { EFFECT_TYPES } from './effectDefinition.js';
import { VISIBILITY } from './surfaceModel.js';
import {
  ACTION_IDS,
  createAction
} from './actionDefinition.js';

export const ACTION_CATALOG = Object.freeze({
  [ACTION_IDS.INSPECT_ROLE]: createAction({
    id: ACTION_IDS.INSPECT_ROLE,
    effect: {
      type: EFFECT_TYPES.REVEAL_PROPERTY,
      property: 'roleKey'
    },
    visibility: VISIBILITY.ACTOR_ONLY
  }),

  [ACTION_IDS.SET_IN_PLAY]: createAction({
    id: ACTION_IDS.SET_IN_PLAY,
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      property: 'inPlay',
      value: false
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  }),

  [ACTION_IDS.SET_PROPERTY]: createAction({
    id: ACTION_IDS.SET_PROPERTY,
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  }),

  [ACTION_IDS.BLOCK_PROPERTY_CHANGE]: createAction({
    id: ACTION_IDS.BLOCK_PROPERTY_CHANGE,
    effect: {
      type: EFFECT_TYPES.BLOCK_PROPERTY_CHANGE
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  }),

  [ACTION_IDS.LINK_TARGETS]: createAction({
    id: ACTION_IDS.LINK_TARGETS,
    effect: {
      type: EFFECT_TYPES.SET_GROUP,
      targetType: MECHANICAL_ENTITY_TYPES.GROUP
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  }),

  [ACTION_IDS.REPLACE_ROLE_IDENTITY]: createAction({
    id: ACTION_IDS.REPLACE_ROLE_IDENTITY,
    effect: {
      type: EFFECT_TYPES.REPLACE_ROLE_IDENTITY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE
    },
    visibility: VISIBILITY.STORYTELLER_ONLY
  }),

  [ACTION_IDS.SELECT]: createAction({
    id: ACTION_IDS.SELECT,
    visibility: VISIBILITY.ALL
  }),

  [ACTION_IDS.CONCLUDE_PLAY]: createAction({
    id: ACTION_IDS.CONCLUDE_PLAY,
    effect: {
      type: EFFECT_TYPES.CONCLUDE_PLAY
    },
    visibility: VISIBILITY.ALL
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

export function getCatalogAction(actionId, overrides = {}) {
  const baseAction = ACTION_CATALOG[actionId];
  if (!baseAction) return null;

  return createAction({
    ...cloneCatalogValue(baseAction),
    id: baseAction.id,
    target: overrides.target
      ? {
          ...overrides.target,
          filters: [...(overrides.target.filters ?? [])]
        }
      : cloneCatalogValue(baseAction.target),
    effect: overrides.effect
      ? cloneCatalogValue(overrides.effect)
      : cloneCatalogValue(baseAction.effect),
    selectionRules: overrides.selectionRules
      ? cloneCatalogValue(overrides.selectionRules)
      : cloneCatalogValue(baseAction.selectionRules),
    metadata: {
      ...(baseAction.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

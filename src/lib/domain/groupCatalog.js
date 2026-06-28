// groupCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de grupos mecanicos predefinidos.
//
// El catalogo usa defineGroup porque guarda definiciones previas a session.
// -----------------------------------------------------------------------------

import { POOL_KEYS } from './sessionModel.js';
import { getCatalogStage, STAGE_CATALOG_IDS } from './stageCatalog.js';
import { defineGroup, GROUP_MEMBERSHIP_RULE_TYPES } from './groupDefinition.js';

export const GROUP_CATALOG_IDS = Object.freeze({
  CONCEALED_SET_OUT_OF_PLAY: 'group_concealed_set_out_of_play',
  EXPOSED_SET_OUT_OF_PLAY: 'group_exposed_set_out_of_play'
});

export const GROUP_CATALOG = Object.freeze({
  [GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY]: defineGroup({
    key: GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
    membershipRule: {
      type: GROUP_MEMBERSHIP_RULE_TYPES.ALIGNMENT,
      alignmentId: 'alignment_b'
    },
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 30,
        metadata: {
          orderReason:
            'Runs before the out-of-play intervention stage so same-cycle restore can inspect the applied concealed result.'
        }
      })
    ]
  }),

  [GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY]: defineGroup({
    key: GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY,
    membershipRule: {
      type: GROUP_MEMBERSHIP_RULE_TYPES.ALL_ROLES
    },
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY, {
        poolKey: POOL_KEYS.POOL_EXPOSED,
        order: 10,
        metadata: {
          orderReason:
            'Runs in the exposed pool as the public set_out_of_play decision stage.'
        }
      })
    ]
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

export function getCatalogGroup(groupCatalogId, overrides = {}) {
  const baseGroup = GROUP_CATALOG[groupCatalogId];
  if (!baseGroup) return null;

  return defineGroup({
    ...cloneCatalogValue(baseGroup),
    ...overrides,
    membershipRule: overrides.membershipRule
      ? cloneCatalogValue(overrides.membershipRule)
      : cloneCatalogValue(baseGroup.membershipRule),
    stageDefinitions: overrides.stageDefinitions
      ? cloneCatalogValue(overrides.stageDefinitions)
      : cloneCatalogValue(baseGroup.stageDefinitions),
    metadata: {
      ...cloneCatalogValue(baseGroup.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

export function getCoreGroupCatalog() {
  return [
    getCatalogGroup(GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY),
    getCatalogGroup(GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY)
  ];
}

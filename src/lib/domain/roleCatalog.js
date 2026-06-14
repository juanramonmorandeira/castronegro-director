// roleCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de roles mecanicos predefinidos.
//
// El constructor unico de rol es createRole. El catalogo guarda roles ya
// definidos para que las sesiones puedan reutilizarlos sin duplicar datos.
// -----------------------------------------------------------------------------

import { POOL_KEYS } from './sessionModel.js';
import { getCatalogStep, STEP_CATALOG_IDS } from './stepCatalog.js';
import { createRole, ROLE_DEFINITION_TYPES } from './roleDefinition.js';
import {
  EVENT_RESPONSE_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_TYPES
} from './eventModel.js';

export const ROLE_CATALOG_IDS = Object.freeze({
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_PLAY_CONTROL: 'role_in_play_control',
  ROLE_REACTIVE: 'role_reactive'
});

export const ROLE_CATALOG = Object.freeze({
  [ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS]: createRole({
    key: ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS,
    type: ROLE_DEFINITION_TYPES.ROLE,
    stepDefinitions: [
      getCatalogStep(STEP_CATALOG_IDS.ROLE_LINKS_TARGETS, {
        poolKey: POOL_KEYS.POOL_DEPLOYMENT,
        order: null,
        metadata: {
          orderReason:
            'Runs during deployment so shared-destiny groups exist before recurrent actions can change inPlay or alignment state.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_INSPECTS]: createRole({
    key: ROLE_CATALOG_IDS.ROLE_INSPECTS,
    type: ROLE_DEFINITION_TYPES.ROLE,
    stepDefinitions: [
      getCatalogStep(STEP_CATALOG_IDS.ROLE_INSPECTS, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 10,
        metadata: {
          orderReason:
            'Runs before group set_out_of_play so private information is available before concealed removal attempts.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: createRole({
    key: ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY,
    type: ROLE_DEFINITION_TYPES.ROLE,
    stepDefinitions: [
      getCatalogStep(STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 20,
        metadata: {
          orderReason:
            'Runs before set_out_of_play because it blocks that effect for a chosen target in the current cycle.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL]: createRole({
    key: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL,
    type: ROLE_DEFINITION_TYPES.ROLE,
    stepDefinitions: [
      getCatalogStep(STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 40,
        metadata: {
          orderReason:
            'Runs after set_out_of_play because restore_recent_out_of_play needs a same-cycle inPlay=false history entry.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_REACTIVE]: createRole({
    key: ROLE_CATALOG_IDS.ROLE_REACTIVE,
    type: ROLE_DEFINITION_TYPES.ROLE,
    stepDefinitions: [],
    reactions: [
      {
        key: 'self_out_of_play_creates_special_step',
        trigger: {
          eventType: EVENT_TYPES.PROPERTY_CHANGED,
          targetType: 'role',
          target: EVENT_TRIGGER_TARGETS.SELF,
          property: 'inPlay',
          to: false
        },
        response: {
          type: EVENT_RESPONSE_TYPES.CREATE_STEP,
          poolKey: POOL_KEYS.POOL_SPECIAL,
          step: getCatalogStep(STEP_CATALOG_IDS.ROLE_REACTIVE_RESPONSE, {
            poolKey: POOL_KEYS.POOL_SPECIAL,
            metadata: {
              orderReason:
                'Created only after this role receives a final inPlay=false effect.'
            }
          })
        }
      }
    ],
    metadata: {
      mechanicalFamily: 'reactive'
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

export function getCatalogRole(roleCatalogId, overrides = {}) {
  const baseRole = ROLE_CATALOG[roleCatalogId];
  if (!baseRole) return null;

  return createRole({
    ...cloneCatalogValue(baseRole),
    ...overrides,
    stepDefinitions: overrides.stepDefinitions
      ? cloneCatalogValue(overrides.stepDefinitions)
      : cloneCatalogValue(baseRole.stepDefinitions),
    metadata: {
      ...cloneCatalogValue(baseRole.metadata ?? {}),
      ...(overrides.metadata ?? {})
    },
    reactions: overrides.reactions
      ? cloneCatalogValue(overrides.reactions)
      : cloneCatalogValue(baseRole.reactions ?? [])
  });
}

export function getCoreRoleCatalog() {
  return [
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_INSPECTS),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_REACTIVE)
  ];
}

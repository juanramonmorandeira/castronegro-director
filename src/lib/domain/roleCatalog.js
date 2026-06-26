// roleCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de roles mecanicos predefinidos.
//
// El catalogo usa defineRole porque guarda definiciones previas a session.
// -----------------------------------------------------------------------------

import { POOL_KEYS } from './sessionModel.js';
import { getCatalogStage, STAGE_CATALOG_IDS } from './stageCatalog.js';
import { AVAILABILITY_RULE_TYPES } from './stageDefinition.js';
import { defineRole, ROLE_DEFINITION_TYPES } from './roleDefinition.js';
import {
  EVENT_RESPONSE_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_TYPES
} from './eventModel.js';

export const ROLE_CATALOG_IDS = Object.freeze({
  ROLE_SET_OUT_OF_PLAY: 'role_set_out_of_play',
  ROLE_INSPECTS: 'role_inspects',
  ROLE_LINKS_TARGETS: 'role_links_targets',
  ROLE_BLOCKS_OUT_OF_PLAY: 'role_blocks_out_of_play',
  ROLE_IN_PLAY_CONTROL: 'role_in_play_control',
  ROLE_REACTIVE: 'role_reactive',
  ROLE_ASSUMES_ROLE: 'role_assumes_role',
  ROLE_PLAIN: 'role_plain'
});

export const ROLE_CATALOG = Object.freeze({
  [ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_b',
    stageDefinitions: [],
    metadata: {
      mechanicalFamily: 'set_out_of_play',
      contributesThroughAlignment: 'alignment_b'
    }
  }),

  [ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 5,
        availabilityRules: [
          { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY },
          {
            type: AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW,
            firstCycle: 1,
            lastCycle: 1,
            poolKey: POOL_KEYS.POOL_CONCEALED
          }
        ],
        metadata: {
          orderReason:
            'Runs once during the first concealed pool so shared-destiny groups exist before recurrent actions can change inPlay or alignment state.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_INSPECTS]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_INSPECTS,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_INSPECTS, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 10,
        availabilityRules: [
          { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY }
        ],
        metadata: {
          orderReason:
            'Runs before group set_out_of_play so private information is available before concealed removal attempts.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 20,
        availabilityRules: [
          { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY }
        ],
        metadata: {
          orderReason:
            'Runs before set_out_of_play because it blocks that effect for a chosen target in the current cycle.'
        }
      })
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 40,
        availabilityRules: [
          { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY }
        ],
        metadata: {
          orderReason:
            'Runs after set_out_of_play because restore_recent_out_of_play needs a same-cycle inPlay=false history entry.'
        }
      })
    ],
    resources: [
      { key: 'restore_in_play', count: 1 },
      { key: 'set_out_of_play', count: 1 }
    ]
  }),

  [ROLE_CATALOG_IDS.ROLE_REACTIVE]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_REACTIVE,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [],
    reactions: [
      {
        key: 'self_out_of_play_creates_special_stage',
        trigger: {
          eventType: EVENT_TYPES.PROPERTY_CHANGED,
          targetType: 'role',
          target: EVENT_TRIGGER_TARGETS.SELF,
          property: 'inPlay',
          to: false
        },
        response: {
          type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
          stage: getCatalogStage(STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE, {
            poolKey: null,
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
  }),

  [ROLE_CATALOG_IDS.ROLE_ASSUMES_ROLE]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_ASSUMES_ROLE,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_ASSUMES_ROLE, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 1,
        availabilityRules: [
          { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY },
          {
            type: AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW,
            firstCycle: 1,
            lastCycle: 1,
            poolKey: POOL_KEYS.POOL_CONCEALED
          }
        ],
        metadata: {
          orderReason:
            'Runs at the start of the first concealed pool so the role identity is replaced before recurrent concealed actions matter.'
        }
      })
    ],
    metadata: {
      mechanicalFamily: 'assumes_role',
      extraRoles: [
        {
          roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN,
          count: 2,
          assumable: true
        }
      ]
    }
  }),

  [ROLE_CATALOG_IDS.ROLE_PLAIN]: defineRole({
    key: ROLE_CATALOG_IDS.ROLE_PLAIN,
    type: ROLE_DEFINITION_TYPES.ROLE,
    alignmentId: 'alignment_a',
    stageDefinitions: [],
    metadata: {
      mechanicalFamily: 'plain'
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

  return defineRole({
    ...cloneCatalogValue(baseRole),
    ...overrides,
    stageDefinitions: overrides.stageDefinitions
      ? cloneCatalogValue(overrides.stageDefinitions)
      : cloneCatalogValue(baseRole.stageDefinitions),
    specialStageDefinitions: overrides.specialStageDefinitions
      ? cloneCatalogValue(overrides.specialStageDefinitions)
      : cloneCatalogValue(baseRole.specialStageDefinitions ?? []),
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
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_INSPECTS),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_REACTIVE),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_ASSUMES_ROLE),
    getCatalogRole(ROLE_CATALOG_IDS.ROLE_PLAIN)
  ];
}

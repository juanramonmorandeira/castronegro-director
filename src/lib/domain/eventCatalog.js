// eventCatalog.js
// -----------------------------------------------------------------------------
// Catalogo declarativo de reglas/eventos mecanicos conocidos.
//
// Paso A: centraliza claves y mapas declarativos que eventModel usa para seguir
// ejecutando la misma logica. La conversion completa a reglas catalogadas queda
// para una segunda pasada.
// -----------------------------------------------------------------------------

import {
  EVENT_RESPONSE_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_TYPES,
  defineEventRule
} from './eventDefinition.js';
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { INTER_POOL_QUEUE_EVENT_WINDOWS } from './interPoolQueueDefinition.js';
import {
  STAGE_COMPLETION_REQUESTED_BY
} from './stageTypes.js';

const EVENT_STAGE_CATALOG_IDS = Object.freeze({
  ROLE_STATE_REVEALED: 'role_state_revealed',
  ROLE_REACTIVE_RESPONSE: 'role_reactive_response',
  LINKED_PROPAGATED_EFFECT: 'linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'linked_target_recognition',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector'
});

const EVENT_STAGE_KEYS = Object.freeze({
  ROLE_STATE_REVEALED: 'stage_role_state_revealed',
  ROLE_REACTIVE_RESPONSE: 'stage_role_reactive_response',
  LINKED_PROPAGATED_EFFECT: 'stage_linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'stage_linked_target_recognition',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector'
});

export const EVENT_RULE_KEYS = Object.freeze({
  ROLE_STATE_REVEALED: 'role_state_revealed',
  ROLE_REACTIVE_RESPONSE: 'role_reactive_response',
  LINKED_PROPAGATED_EFFECT: 'linked_propagated_effect',
  LINKED_TARGET_RECOGNITION: 'linked_target_recognition',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector'
});

export const EVENT_RULE_KEYS_BY_FEATURE = Object.freeze({
  SELECTION_COUNTS_DOUBLE: 'selection_counts_double'
});

export const EVENT_SOURCE_STAGE_CATALOG_IDS = Object.freeze({
  CONCEALED_SET_OUT_OF_PLAY: 'concealed_set_out_of_play',
  EXPOSED_SET_OUT_OF_PLAY: 'exposed_set_out_of_play',
  ROLE_IN_OUT_OF_PLAY: 'role_in_out_of_play',
  ROLE_REACTIVE_RESPONSE: EVENT_STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE,
  LINKED_PROPAGATED_EFFECT: EVENT_STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
});

export const EVENT_WINDOW_BY_SOURCE_STAGE_CATALOG_ID = Object.freeze({
  [EVENT_SOURCE_STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY]: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED,
  [EVENT_SOURCE_STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY]: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED,
  [EVENT_SOURCE_STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY]: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED,
  [EVENT_SOURCE_STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE]: Object.freeze({
    fallback: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED,
    preserveAfterExposed: true
  }),
  [EVENT_SOURCE_STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT]: Object.freeze({
    fallback: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED,
    preserveAfterExposed: true
  })
});

export function getEventResponseWindow(event = {}) {
  const sourceStageCatalogId = event.source?.stageCatalogId ?? null;
  const sourceEventWindow = event.source?.eventWindow ?? null;
  const configuredWindow = EVENT_WINDOW_BY_SOURCE_STAGE_CATALOG_ID[sourceStageCatalogId] ?? null;

  if (typeof configuredWindow === 'string') return configuredWindow;

  if (configuredWindow?.preserveAfterExposed) {
    return sourceEventWindow === INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
      ? INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
      : configuredWindow.fallback;
  }

  if (event.source?.poolKey === 'poolConcealed') {
    return INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED;
  }
  if (event.source?.poolKey === 'poolExposed') {
    return INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED;
  }

  return configuredWindow?.fallback ?? null;
}

export const EVENT_CATALOG = Object.freeze({
  [EVENT_RULE_KEYS.ROLE_STATE_REVEALED]: defineEventRule({
    key: EVENT_RULE_KEYS.ROLE_STATE_REVEALED,
    trigger: {
      eventType: EVENT_TYPES.PROPERTY_CHANGED,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      property: 'inPlay'
    },
    response: {
      type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
      stageCatalogId: EVENT_STAGE_CATALOG_IDS.ROLE_STATE_REVEALED,
      stageKey: EVENT_STAGE_KEYS.ROLE_STATE_REVEALED,
      completion: {
        mode: 'manual',
        allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
      },
      visibility: 'public',
      metadataTemplate: {
        catalogId: EVENT_STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
      },
      payloadSource: 'property_changed_event',
      eventWindowStrategy: 'event_response_window'
    }
  }),

  [EVENT_RULE_KEYS.ROLE_REACTIVE_RESPONSE]: defineEventRule({
    key: EVENT_RULE_KEYS.ROLE_REACTIVE_RESPONSE,
    trigger: {
      eventType: EVENT_TYPES.PROPERTY_CHANGED,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      property: 'inPlay',
      from: true,
      to: false,
      target: EVENT_TRIGGER_TARGETS.SELF,
      stageCatalogIds: [
        EVENT_SOURCE_STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
        EVENT_SOURCE_STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY
      ]
    },
    response: {
      type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
      stageCatalogId: EVENT_STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE,
      stageKey: EVENT_STAGE_KEYS.ROLE_REACTIVE_RESPONSE,
      completion: {
        mode: 'manual',
        allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
      },
      visibility: 'public',
      metadataTemplate: {
        catalogId: EVENT_STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE
      },
      payloadSource: 'triggered_reaction',
      eventWindowBySourceStageCatalogId: {
        [EVENT_SOURCE_STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY]:
          INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED,
        [EVENT_SOURCE_STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY]:
          INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
      }
    }
  }),

  [EVENT_RULE_KEYS.LINKED_PROPAGATED_EFFECT]: defineEventRule({
    key: EVENT_RULE_KEYS.LINKED_PROPAGATED_EFFECT,
    response: {
      type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
      stageCatalogId: EVENT_STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT,
      stageKey: EVENT_STAGE_KEYS.LINKED_PROPAGATED_EFFECT,
      completion: {
        mode: 'manual',
        allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
      },
      visibility: 'director',
      metadataTemplate: {
        catalogId: EVENT_STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
      },
      payloadSource: 'linked_propagated_effect'
    }
  }),

  [EVENT_RULE_KEYS.LINKED_TARGET_RECOGNITION]: defineEventRule({
    key: EVENT_RULE_KEYS.LINKED_TARGET_RECOGNITION,
    response: {
      type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
      stageCatalogId: EVENT_STAGE_CATALOG_IDS.LINKED_TARGET_RECOGNITION,
      stageKey: EVENT_STAGE_KEYS.LINKED_TARGET_RECOGNITION,
      completion: {
        mode: 'manual',
        allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
      },
      visibility: 'linked_members',
      metadataTemplate: {
        catalogId: EVENT_STAGE_CATALOG_IDS.LINKED_TARGET_RECOGNITION,
        visibility: 'linked_members',
        directorVisible: true
      },
      payloadSource: 'linked_group'
    }
  }),

  [EVENT_RULE_KEYS.PICK_NEXT_DOUBLE_SELECTOR]: defineEventRule({
    key: EVENT_RULE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
    response: {
      type: EVENT_RESPONSE_TYPES.CREATE_STAGE,
      stageCatalogId: EVENT_STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR,
      stageKey: EVENT_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
      completion: {
        mode: 'manual',
        allowedRequesters: [
          STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
          STAGE_COMPLETION_REQUESTED_BY.SYSTEM
        ]
      },
      visibility: 'public',
      metadataTemplate: {
        ruleKey: EVENT_RULE_KEYS_BY_FEATURE.SELECTION_COUNTS_DOUBLE,
        requestKey: EVENT_STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR
      },
      payloadSource: 'double_selector_holder_out'
    },
    metadata: {
      ruleKey: EVENT_RULE_KEYS_BY_FEATURE.SELECTION_COUNTS_DOUBLE
    }
  })
});

export function getCatalogEventRule(ruleKey = null) {
  return EVENT_CATALOG[ruleKey] ?? null;
}

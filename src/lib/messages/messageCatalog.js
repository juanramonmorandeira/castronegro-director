import {
  MESSAGE_AUDIENCE_TYPES,
  MESSAGE_SEVERITIES,
  MESSAGE_TYPES
} from './messageDefinition.js';

export const MESSAGE_IMPLEMENTATION_STATUSES = Object.freeze({
  IMPLEMENTED: 'implemented',
  PLANNED: 'planned'
});

export const MESSAGE_KEYS = Object.freeze({
  ACTION_USAGE_LIMIT_REACHED: 'action_usage_limit_reached',
  INVALID_CANDIDATE: 'invalid_candidate',
  PROPERTY_CHANGE_BLOCKED: 'property_change_blocked',
  SELECTION_TIED: 'selection_tied',
  INSPECTION_REVEALED: 'inspection_revealed',
  COLLECTIVE_SELECTION_REQUESTED: 'collective_selection_requested',
  ROLE_STATE_REVEALED: 'role_state_revealed',
  REACTIVE_SELECTION_REQUESTED: 'reactive_selection_requested',
  LIMITED_ACTION_APPLIED: 'limited_action_applied',
  GROUP_CREATED: 'group_created',
  ROLE_ASSUMPTION_REQUESTED: 'role_assumption_requested',
  ROLE_ASSUMPTION_COMPLETED: 'role_assumption_completed',
  PEEK_AVAILABLE: 'peek_available',
  PEEK_ACCUSATION_RECEIVED: 'peek_accusation_received',
  SELECTION_AUTHORITY_ASSIGNED: 'selection_authority_assigned',
  SELECTION_AUTHORITY_TRANSFERRED: 'selection_authority_transferred',
  OBJECTIVE_ACHIEVED: 'objective_achieved',
  PLAY_CONCLUDED: 'play_concluded',
  MISSING_GROUP: 'missing_group',
  INVALID_STAGE: 'invalid_stage',
  UNKNOWN_ACTION: 'unknown_action',
  DOMAIN_OPERATION_FAILED: 'domain_operation_failed',
  APPLICATION_OPERATION_FAILED: 'application_operation_failed'
});

export const MESSAGE_CATALOG = Object.freeze({
  [MESSAGE_KEYS.ACTION_USAGE_LIMIT_REACHED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.WARNING,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['actor', 'recipe', 'limit', 'used']
  },
  [MESSAGE_KEYS.INVALID_CANDIDATE]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.WARNING,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['candidate']
  },
  [MESSAGE_KEYS.PROPERTY_CHANGE_BLOCKED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['target', 'property', 'value']
  },
  [MESSAGE_KEYS.SELECTION_TIED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.GROUP,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: []
  },
  [MESSAGE_KEYS.INSPECTION_REVEALED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor', 'target', 'revealedProperty', 'revealedValue']
  },
  [MESSAGE_KEYS.COLLECTIVE_SELECTION_REQUESTED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.GROUP,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['group']
  },
  [MESSAGE_KEYS.ROLE_STATE_REVEALED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.PUBLIC,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['role', 'property', 'value']
  },
  [MESSAGE_KEYS.REACTIVE_SELECTION_REQUESTED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor']
  },
  [MESSAGE_KEYS.LIMITED_ACTION_APPLIED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor', 'recipe']
  },
  [MESSAGE_KEYS.GROUP_CREATED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.GROUP,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['group']
  },
  [MESSAGE_KEYS.ROLE_ASSUMPTION_REQUESTED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor']
  },
  [MESSAGE_KEYS.ROLE_ASSUMPTION_COMPLETED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor', 'assumedRole']
  },
  [MESSAGE_KEYS.PEEK_AVAILABLE]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.ROLE,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['actor', 'observedStage']
  },
  [MESSAGE_KEYS.PEEK_ACCUSATION_RECEIVED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.DIRECTOR,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['accusedRole', 'group']
  },
  [MESSAGE_KEYS.SELECTION_AUTHORITY_ASSIGNED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.PUBLIC,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['role']
  },
  [MESSAGE_KEYS.SELECTION_AUTHORITY_TRANSFERRED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.PUBLIC,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['previousRole', 'nextRole']
  },
  [MESSAGE_KEYS.OBJECTIVE_ACHIEVED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.PUBLIC,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: ['objective']
  },
  [MESSAGE_KEYS.PLAY_CONCLUDED]: {
    type: MESSAGE_TYPES.GAMEPLAY,
    severity: MESSAGE_SEVERITIES.INFO,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.PUBLIC,
    status: MESSAGE_IMPLEMENTATION_STATUSES.PLANNED,
    requiredParams: []
  },
  [MESSAGE_KEYS.MISSING_GROUP]: {
    type: MESSAGE_TYPES.DIAGNOSTIC,
    severity: MESSAGE_SEVERITIES.ERROR,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.SYSTEM,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['groupId']
  },
  [MESSAGE_KEYS.INVALID_STAGE]: {
    type: MESSAGE_TYPES.DIAGNOSTIC,
    severity: MESSAGE_SEVERITIES.ERROR,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.SYSTEM,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['code']
  },
  [MESSAGE_KEYS.UNKNOWN_ACTION]: {
    type: MESSAGE_TYPES.DIAGNOSTIC,
    severity: MESSAGE_SEVERITIES.ERROR,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.SYSTEM,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['actionId']
  },
  [MESSAGE_KEYS.DOMAIN_OPERATION_FAILED]: {
    type: MESSAGE_TYPES.DIAGNOSTIC,
    severity: MESSAGE_SEVERITIES.ERROR,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.SYSTEM,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['code']
  },
  [MESSAGE_KEYS.APPLICATION_OPERATION_FAILED]: {
    type: MESSAGE_TYPES.APPLICATION,
    severity: MESSAGE_SEVERITIES.ERROR,
    defaultAudience: MESSAGE_AUDIENCE_TYPES.SYSTEM,
    status: MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED,
    requiredParams: ['code']
  }
});

export function getMessageCatalogEntry(key) {
  return MESSAGE_CATALOG[key] ?? null;
}

export function validateMessageAgainstCatalog(message = {}) {
  const definition = getMessageCatalogEntry(message.key);
  const errors = [];

  if (!definition) {
    errors.push({
      code: 'message/unknown-key',
      messageKey: message.key
    });
    return { ok: false, errors };
  }

  if (message.type !== definition.type) {
    errors.push({
      code: 'message/invalid-type',
      messageKey: message.key,
      expected: definition.type,
      received: message.type
    });
  }

  (definition.requiredParams ?? []).forEach((param) => {
    if (!Object.hasOwn(message.params ?? {}, param)) {
      errors.push({
        code: 'message/missing-param',
        messageKey: message.key,
        param
      });
    }
  });

  return { ok: errors.length === 0, errors };
}

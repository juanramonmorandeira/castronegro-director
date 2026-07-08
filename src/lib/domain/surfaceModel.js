// surfaceModel.js
// -----------------------------------------------------------------------------
// Contrato mecanico minimo para proyectar informacion hacia la UI.
//
// Este modelo no pinta pantalla ni aplica skin. Solo define nombres estables y
// constructores de datos que la capa de superficie puede consumir.
// -----------------------------------------------------------------------------

import { INTER_POOL_QUEUE_EVENT_WINDOWS } from './interPoolQueueDefinition.js';

export const SURFACE_SCREEN_MODES = Object.freeze({
  HIDDEN: 'screenHidden',
  READONLY: 'screenReadonly',
  INTERACTIVE: 'screenInteractive'
});

export const SURFACE_FLOW_STEPS = Object.freeze({
  BEFORE_CONCEALED: 'before_concealed',
  POOL_CONCEALED: 'poolConcealed',
  AFTER_CONCEALED: 'after_concealed',
  PUBLIC_REVEAL: 'publicReveal',
  BEFORE_EXPOSED: 'before_exposed',
  POOL_EXPOSED: 'poolExposed',
  AFTER_EXPOSED: 'after_exposed',
  PRIVATE_HIDE: 'privateHide'
});

export const SURFACE_FLOW_ORDER = Object.freeze([
  SURFACE_FLOW_STEPS.BEFORE_CONCEALED,
  SURFACE_FLOW_STEPS.POOL_CONCEALED,
  SURFACE_FLOW_STEPS.AFTER_CONCEALED,
  SURFACE_FLOW_STEPS.PUBLIC_REVEAL,
  SURFACE_FLOW_STEPS.BEFORE_EXPOSED,
  SURFACE_FLOW_STEPS.POOL_EXPOSED,
  SURFACE_FLOW_STEPS.AFTER_EXPOSED,
  SURFACE_FLOW_STEPS.PRIVATE_HIDE
]);

export const SURFACE_ITEM_TYPES = Object.freeze({
  PUBLIC_TABLE_STATE: 'public_table_state',
  EFFECT_RESULT: 'effect_result',
  CONCEALED_SELECTION_DRAFT: 'concealed_selection_draft',
  CONCEALED_SELECTION_SUBMISSION: 'concealed_selection_submission',
  EXPOSED_SELECTION_SUBMISSION: 'exposed_selection_submission',
  SELECTION_TALLY: 'selection_tally',
  SELECTION_RESULT: 'selection_result'
});

export const SURFACE_MESSAGE_EXPIRATIONS = Object.freeze({
  FINISH_STAGE: 'finish_stage'
});

export const SURFACE_EFFECT_REASONS = Object.freeze({
  REACTIVE_RESPONSE: 'reactive_response'
});

export const SURFACE_LIFECYCLE_KEYS = Object.freeze({
  TRANSITION: 'surface_transition'
});

function clonePayload(value) {
  if (Array.isArray(value)) return value.map(clonePayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, clonePayload(entryValue)])
    );
  }
  return value;
}

export function getSurfaceFlowOrder() {
  return [...SURFACE_FLOW_ORDER];
}

export function getSurfaceTransitionAfterWindow(eventWindow = null) {
  if (eventWindow === INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED) {
    return {
      step: SURFACE_FLOW_STEPS.PUBLIC_REVEAL,
      from: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED,
      to: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
    };
  }

  if (eventWindow === INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED) {
    return {
      step: SURFACE_FLOW_STEPS.PRIVATE_HIDE,
      from: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED,
      to: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_CONCEALED
    };
  }

  return null;
}

export function createSurfaceTransitionResult({ step, from = null, to = null } = {}) {
  return {
    key: SURFACE_LIFECYCLE_KEYS.TRANSITION,
    ok: true,
    result: { step },
    errors: [],
    metadata: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    }
  };
}

export function createSurfaceMessage({
  messageKey = null,
  audience = null,
  payload = {},
  expiresOn = null
} = {}) {
  return {
    messageKey,
    audience,
    payload: clonePayload(payload),
    ...(expiresOn ? { expiresOn } : {})
  };
}

export function createSurfaceItem({
  type = null,
  recipientRoleIds = [],
  payload = {},
  acknowledgementsRequired = false
} = {}) {
  return {
    type,
    recipientRoleIds: [...(recipientRoleIds ?? [])],
    payload: clonePayload(payload),
    ...(acknowledgementsRequired ? { acknowledgementsRequired: true } : {})
  };
}

export function createPublicTableStateItem({ roles = [], recipientRoleIds = null } = {}) {
  const seats = [...(roles ?? [])]
    .map((role) => ({
      seat: role.seat ?? null,
      roleId: role.roleId ?? role.id ?? null,
      playerId: role.playerId ?? null,
      inPlay: role.inPlay === true
    }))
    .sort((left, right) => {
      if (left.seat === null && right.seat === null) return 0;
      if (left.seat === null) return 1;
      if (right.seat === null) return -1;
      return left.seat - right.seat;
    });

  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.PUBLIC_TABLE_STATE,
    recipientRoleIds: recipientRoleIds ?? seats.map((seat) => seat.roleId).filter(Boolean),
    payload: { seats }
  });
}

export function createEffectResultItem({
  recipientRoleIds = [],
  sourceId = null,
  targetId = null,
  effect = {},
  reason = null
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.EFFECT_RESULT,
    recipientRoleIds,
    payload: {
      sourceId,
      targetId,
      ...(reason ? { reason } : {}),
      effect: clonePayload(effect)
    }
  });
}

export function createConcealedSelectionDraftItem({
  recipientRoleIds = [],
  selectorRoleId = null,
  candidateRoleId = null
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.CONCEALED_SELECTION_DRAFT,
    recipientRoleIds,
    payload: {
      selectorRoleId,
      candidateRoleId
    }
  });
}

export function createConcealedSelectionSubmissionItem({
  recipientRoleIds = [],
  selectorRoleId = null,
  candidateRoleId = null
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.CONCEALED_SELECTION_SUBMISSION,
    recipientRoleIds,
    payload: {
      selectorRoleId,
      candidateRoleId,
      editable: false
    }
  });
}

export function createExposedSelectionSubmissionItem({
  recipientRoleIds = [],
  selectorRoleId = null,
  candidateRoleId = null,
  weight = 1
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.EXPOSED_SELECTION_SUBMISSION,
    recipientRoleIds,
    payload: {
      selectorRoleId,
      candidateRoleId,
      weight
    }
  });
}

export function createSelectionTallyItem({
  recipientRoleIds = [],
  counts = [],
  pendingSelectorRoleIds = [],
  resolvedByRule = null,
  doubleSelectorRoleId = null
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.SELECTION_TALLY,
    recipientRoleIds,
    payload: {
      counts: clonePayload(counts),
      pendingSelectorRoleIds: [...(pendingSelectorRoleIds ?? [])],
      ...(resolvedByRule ? { resolvedByRule } : {}),
      ...(doubleSelectorRoleId ? { doubleSelectorRoleId } : {})
    }
  });
}

export function createSelectionResultItem({
  recipientRoleIds = [],
  outcome = null,
  candidateRoleId = null,
  reason = null,
  acknowledgementsRequired = false
} = {}) {
  return createSurfaceItem({
    type: SURFACE_ITEM_TYPES.SELECTION_RESULT,
    recipientRoleIds,
    payload: {
      outcome,
      candidateRoleId,
      ...(reason ? { reason } : {})
    },
    acknowledgementsRequired
  });
}

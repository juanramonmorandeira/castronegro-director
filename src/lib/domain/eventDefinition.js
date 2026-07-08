// eventDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario y constructores para eventos mecanicos.
//
// Este archivo no procesa session ni crea stages. Solo define la forma comun de
// los eventos y sus respuestas catalogables.
// -----------------------------------------------------------------------------

export const EVENT_TYPES = Object.freeze({
  PROPERTY_CHANGED: 'property_changed'
});

export const EVENT_TRIGGER_TARGETS = Object.freeze({
  SELF: 'self',
  ANY: 'any'
});

export const EVENT_RESPONSE_TYPES = Object.freeze({
  CREATE_STAGE: 'create_stage',
  CANCEL_STAGE: 'cancel_stage'
});

export function defineEventRule(rule = {}) {
  return Object.freeze({
    key: rule.key ?? null,
    enabled: rule.enabled !== false,
    trigger: { ...(rule.trigger ?? {}) },
    response: { ...(rule.response ?? {}) },
    metadata: { ...(rule.metadata ?? {}) }
  });
}

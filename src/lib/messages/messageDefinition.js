// Contrato compartido entre dominio, presentacion y aplicacion.
// Los mensajes estructurados no contienen texto final para el usuario.

export const MESSAGE_TYPES = Object.freeze({
  GAMEPLAY: 'gameplay',
  DIAGNOSTIC: 'diagnostic',
  APPLICATION: 'application'
});

export const MESSAGE_SEVERITIES = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  FATAL: 'fatal'
});

export const MESSAGE_AUDIENCE_TYPES = Object.freeze({
  ROLE: 'role',
  PLAYER: 'player',
  GROUP: 'group',
  DIRECTOR: 'director',
  PUBLIC: 'public',
  SYSTEM: 'system'
});

export const MESSAGE_ENTITY_TYPES = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  RESOURCE: 'resource',
  STAGE: 'stage',
  OBJECTIVE: 'objective',
  ACTION: 'action',
  RECIPE: 'recipe'
});

function normalizeAudience(audience = {}) {
  const type = Object.values(MESSAGE_AUDIENCE_TYPES).includes(audience.type)
    ? audience.type
    : MESSAGE_AUDIENCE_TYPES.SYSTEM;

  return {
    type,
    ids: [...new Set((audience.ids ?? []).filter(Boolean))]
  };
}

export function createEntityReference(type, id, metadata = {}) {
  return {
    entityType: type,
    id,
    metadata: { ...metadata }
  };
}

export function isEntityReference(value) {
  return (
    value &&
    typeof value === 'object' &&
    Object.values(MESSAGE_ENTITY_TYPES).includes(value.entityType) &&
    !!value.id
  );
}

export function createMessage({
  id = null,
  type,
  key,
  severity = MESSAGE_SEVERITIES.INFO,
  audience = {},
  params = {},
  context = {},
  timestamp = null,
  metadata = {}
} = {}) {
  return {
    id,
    type: Object.values(MESSAGE_TYPES).includes(type) ? type : MESSAGE_TYPES.DIAGNOSTIC,
    key: String(key ?? ''),
    severity: Object.values(MESSAGE_SEVERITIES).includes(severity)
      ? severity
      : MESSAGE_SEVERITIES.ERROR,
    audience: normalizeAudience(audience),
    params: { ...params },
    context: { ...context },
    timestamp,
    metadata: { ...metadata }
  };
}

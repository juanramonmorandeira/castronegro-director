// relationDefinition.js
// -----------------------------------------------------------------------------
// Constructor de relaciones entre roles.
//
// Una relacion vive en la sesion porque describe un hecho compartido. No debe
// guardarse dentro de un unico rol cuando afecta a varios.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';

export function createRelation({
  id,
  type,
  roleIds = [],
  active = true,
  createdCycleId = null,
  sourceActionId = null,
  metadata = {}
} = {}) {
  const normalizedType = normalizeId(type);
  const normalizedRoleIds = [...new Set((roleIds ?? []).filter(Boolean))];

  return {
    id: id || `${normalizedType || 'relation'}-${normalizedRoleIds.join('-')}`,
    type: normalizedType,
    roleIds: normalizedRoleIds,
    active: !!active,
    createdCycleId,
    sourceActionId,
    metadata: { ...metadata }
  };
}

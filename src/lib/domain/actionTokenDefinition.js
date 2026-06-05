// actionTokenDefinition.js
// -----------------------------------------------------------------------------
// Constructor de actionTokens.
//
// Un actionToken representa un recurso mecanico que un role puede
// consumir o conservar. El motor todavia no lo usa en profundidad, pero queda
// preparado para recetas con usos, cargas o recursos propios.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';

export function createActionToken({
  id,
  actionId,
  ownerRoleId = null,
  targetIds = [],
  consumed = false,
  metadata = {}
} = {}) {
  const tokenActionId = normalizeId(actionId);
  return {
    id: id || `${tokenActionId || 'action'}-token`,
    actionId: tokenActionId,
    ownerRoleId,
    targetIds: [...targetIds],
    consumed: !!consumed,
    metadata: { ...metadata }
  };
}

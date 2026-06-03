// roleDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones mecanicas de rol.
//
// Una roleDefinition no es una instancia en partida y no ejecuta acciones.
// Describe que puede aportar un tipo de rol al flujo:
// - a que alignment mecanico pertenece por defecto;
// - que stepDefinitions puede proponer;
// - si necesita estar inPlay para actuar.
//
// La instancia concreta vive en session.roleInstances. El step ejecutable se
// construye despues combinando roleDefinition + roleInstance + stepCatalog.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';
import { createStep } from './stepDefinition.js';

export const ROLE_DEFINITION_TYPES = Object.freeze({
  ROLE: 'role',
  SYSTEM: 'system'
});

export function createRole({
  key,
  type = ROLE_DEFINITION_TYPES.ROLE,
  alignmentId = null,
  stepDefinitions = [],
  metadata = {}
} = {}) {
  const normalizedKey = normalizeId(key);

  return {
    key: normalizedKey,
    type: normalizeId(type),
    alignmentId: alignmentId ? normalizeId(alignmentId) : null,
    stepDefinitions: (stepDefinitions ?? []).map(createStep),
    metadata: { ...metadata }
  };
}

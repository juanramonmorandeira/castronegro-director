// groupDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones mecanicas de grupo.
//
// Un grupo no es un alignment narrativo ni un rol individual. Es una forma de
// seleccionar roleInstances que pueden actuar juntas o compartir reglas.
//
// Ejemplos:
// - todos los roles con alignmentId = alignment_b;
// - todos los roles linked;
// - todos los roles con una marca concreta;
// - todos los roles inPlay.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';
import { createStep } from './stepDefinition.js';

export const GROUP_SELECTOR_TYPES = Object.freeze({
  ALIGNMENT: 'alignment',
  RELATION: 'relation',
  FLAG: 'flag',
  ALL_ROLES: 'all_roles',
  CUSTOM: 'custom'
});

export function createGroup({
  key,
  selector = {},
  stepDefinitions = [],
  metadata = {}
} = {}) {
  return {
    key: normalizeId(key),
    selector: {
      type: normalizeId(selector.type ?? GROUP_SELECTOR_TYPES.CUSTOM),
      alignmentId: selector.alignmentId ? normalizeId(selector.alignmentId) : null,
      relationType: selector.relationType ? normalizeId(selector.relationType) : null,
      flagKey: selector.flagKey ? normalizeId(selector.flagKey) : null,
      metadata: { ...(selector.metadata ?? {}) }
    },
    stepDefinitions: (stepDefinitions ?? []).map(createStep),
    metadata: { ...metadata }
  };
}

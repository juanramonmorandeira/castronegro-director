// groupDefinition.js
// -----------------------------------------------------------------------------
// Constructor de definiciones mecanicas de grupo.
//
// Un grupo no es un alignment narrativo ni un rol individual. Es una forma de
// seleccionar roles que pueden actuar juntos o compartir reglas.
//
// Ejemplos:
// - todos los roles con alignmentId = alignment_b;
// - todos los roles linked;
// - todos los roles con una marca concreta;
// - todos los roles inPlay.
// -----------------------------------------------------------------------------

import { normalizeId } from './sessionModel.js';
import { createStep } from './stepDefinition.js';

export const GROUP_MEMBERSHIP_RULE_TYPES = Object.freeze({
  ALIGNMENT: 'alignment',
  RELATION: 'relation',
  FLAG: 'flag',
  ALL_ROLES: 'all_roles',
  CUSTOM: 'custom'
});

export function createGroup({
  id = null,
  key,
  membershipRule = null,
  roleIds = [],
  stepDefinitions = [],
  metadata = {}
} = {}) {
  const normalizedKey = normalizeId(key);
  const normalizedMembershipRule = membershipRule
    ? {
        type: normalizeId(membershipRule.type ?? GROUP_MEMBERSHIP_RULE_TYPES.CUSTOM),
        alignmentId: membershipRule.alignmentId ? normalizeId(membershipRule.alignmentId) : null,
        relationType: membershipRule.relationType ? normalizeId(membershipRule.relationType) : null,
        flagKey: membershipRule.flagKey ? normalizeId(membershipRule.flagKey) : null,
        metadata: { ...(membershipRule.metadata ?? {}) }
      }
    : null;

  return {
    id: id ? normalizeId(id) : normalizedKey,
    key: normalizedKey,
    ...(normalizedMembershipRule ? { membershipRule: normalizedMembershipRule } : {}),
    roleIds: [...new Set((roleIds ?? []).filter(Boolean))],
    stepDefinitions: (stepDefinitions ?? []).map(createStep),
    metadata: { ...metadata }
  };
}

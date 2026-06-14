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
  FLAG: 'flag',
  ALL_ROLES: 'all_roles',
  CUSTOM: 'custom'
});

export const GROUP_TYPES = Object.freeze({
  LINKED: 'linked'
});

export function createGroup({
  id = null,
  key = null,
  type = null,
  active = true,
  createdCycleId = null,
  sourceActionId = null,
  membershipRule = null,
  roleIds = [],
  groupRules = [],
  stepDefinitions = [],
  metadata = {}
} = {}) {
  const normalizedType = type ? normalizeId(type) : null;
  const normalizedRoleIds = [...new Set((roleIds ?? []).filter(Boolean))];
  const normalizedKey = normalizeId(key ?? id ?? normalizedType ?? 'group');
  const normalizedMembershipRule = membershipRule
    ? {
        type: normalizeId(membershipRule.type ?? GROUP_MEMBERSHIP_RULE_TYPES.CUSTOM),
        alignmentId: membershipRule.alignmentId ? normalizeId(membershipRule.alignmentId) : null,
        flagKey: membershipRule.flagKey ? normalizeId(membershipRule.flagKey) : null,
        metadata: { ...(membershipRule.metadata ?? {}) }
      }
    : null;

  return {
    id: id ? normalizeId(id) : normalizedKey,
    key: normalizedKey,
    ...(normalizedType ? { type: normalizedType } : {}),
    active: active !== false,
    createdCycleId,
    sourceActionId,
    ...(normalizedMembershipRule ? { membershipRule: normalizedMembershipRule } : {}),
    roleIds: normalizedRoleIds,
    groupRules: (groupRules ?? []).map((rule) => ({ ...rule })),
    stepDefinitions: (stepDefinitions ?? []).map(createStep),
    metadata: { ...metadata }
  };
}

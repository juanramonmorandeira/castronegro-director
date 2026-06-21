// groupDefinition.js
// -----------------------------------------------------------------------------
// Definicion y constructor runtime de grupos.
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
import { defineStage } from './stageDefinition.js';

export const GROUP_MEMBERSHIP_RULE_TYPES = Object.freeze({
  ALIGNMENT: 'alignment',
  FLAG: 'flag',
  ALL_ROLES: 'all_roles',
  CUSTOM: 'custom'
});

export const GROUP_TYPES = Object.freeze({
  LINKED: 'linked'
});

export const GROUP_RULE_TYPES = Object.freeze({
  PROPAGATE_PROPERTY_CHANGE: 'propagate_property_change'
});

export const GROUP_RULE_TARGETS = Object.freeze({
  OTHER_MEMBERS: 'other_members'
});

export function defineGroupRule({
  type,
  when = {},
  apply = {},
  targets = GROUP_RULE_TARGETS.OTHER_MEMBERS,
  metadata = {}
} = {}) {
  return {
    type: normalizeId(type),
    when: {
      property: when.property ?? null,
      value: when.value
    },
    apply: {
      property: apply.property ?? when.property ?? null,
      value: Object.hasOwn(apply, 'value') ? apply.value : when.value
    },
    targets: normalizeId(targets),
    metadata: { ...metadata }
  };
}

export function defineGroup({
  key = null,
  type = null,
  membershipRule = null,
  groupRules = [],
  stageDefinitions = [],
  metadata = {}
} = {}) {
  const normalizedType = type ? normalizeId(type) : null;
  const normalizedKey = normalizeId(key ?? normalizedType ?? 'group');
  const normalizedMembershipRule = membershipRule
    ? {
        type: normalizeId(membershipRule.type ?? GROUP_MEMBERSHIP_RULE_TYPES.CUSTOM),
        alignmentId: membershipRule.alignmentId ? normalizeId(membershipRule.alignmentId) : null,
        flagKey: membershipRule.flagKey ? normalizeId(membershipRule.flagKey) : null,
        metadata: { ...(membershipRule.metadata ?? {}) }
      }
    : null;

  return {
    key: normalizedKey,
    ...(normalizedType ? { type: normalizedType } : {}),
    ...(normalizedMembershipRule ? { membershipRule: normalizedMembershipRule } : {}),
    groupRules: (groupRules ?? []).map(defineGroupRule),
    stageDefinitions: (stageDefinitions ?? []).map(defineStage),
    metadata: { ...metadata }
  };
}

export function createGroup({
  id = null,
  key = null,
  type = null,
  active = true,
  createdCycleId = null,
  sourceActionId = null,
  roleIds = [],
  groupRules = [],
  metadata = {}
} = {}) {
  const normalizedType = type ? normalizeId(type) : null;
  const normalizedKey = normalizeId(key ?? id ?? normalizedType ?? 'group');

  return {
    id: id ? normalizeId(id) : normalizedKey,
    key: normalizedKey,
    ...(normalizedType ? { type: normalizedType } : {}),
    active: active !== false,
    createdCycleId,
    sourceActionId,
    roleIds: [...new Set((roleIds ?? []).filter(Boolean))],
    groupRules: (groupRules ?? []).map(defineGroupRule),
    metadata: { ...metadata }
  };
}

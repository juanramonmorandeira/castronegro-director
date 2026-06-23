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

export const GROUP_SELECTION_RULE_TYPES = Object.freeze({
  EXCLUDE_OTHER_GROUP_MEMBERS: 'exclude_other_group_members'
});

export function defineGroupRule({
  key = null,
  type,
  when = {},
  apply = {},
  targets = GROUP_RULE_TARGETS.OTHER_MEMBERS,
  includeOutOfPlay = false,
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
    includeOutOfPlay: includeOutOfPlay === true,
    key: normalizeId(key ?? type),
    metadata: { ...metadata }
  };
}

export function defineGroupSelectionRule({
  key,
  type,
  scope = {},
  appliesWhen = {},
  metadata = {}
} = {}) {
  return {
    key: normalizeId(key ?? type),
    type: normalizeId(type),
    scope: {
      methods: [...(scope.methods ?? [])].map(normalizeId),
      actionKeys: [...(scope.actionKeys ?? [])].map(normalizeId)
    },
    appliesWhen: {
      sourceState: normalizeId(appliesWhen.sourceState ?? 'active')
    },
    metadata: { ...metadata }
  };
}

export function defineGroupObjectiveRule(rule = {}) {
  return {
    ...rule,
    key: normalizeId(rule.key),
    holder: rule.holder ? { ...rule.holder } : null,
    condition: rule.condition ? { ...rule.condition } : null,
    appliesWhen: rule.appliesWhen
      ? {
          ...rule.appliesWhen,
          sourceState: normalizeId(rule.appliesWhen.sourceState ?? 'active'),
          conditions: (rule.appliesWhen.conditions ?? []).map((condition) => ({ ...condition }))
        }
      : { sourceState: 'active', conditions: [] },
    onFulfilled: (rule.onFulfilled ?? []).map((proposal) => ({ ...proposal })),
    conflictRules: (rule.conflictRules ?? []).map((conflictRule) => ({ ...conflictRule })),
    metadata: { ...(rule.metadata ?? {}) }
  };
}

export function defineGroup({
  key = null,
  type = null,
  membershipRule = null,
  groupRules = [],
  selectionRules = [],
  objectiveRules = [],
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
    selectionRules: (selectionRules ?? []).map(defineGroupSelectionRule),
    objectiveRules: (objectiveRules ?? []).map(defineGroupObjectiveRule),
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
  selectionRules = [],
  objectiveRules = [],
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
    selectionRules: (selectionRules ?? []).map(defineGroupSelectionRule),
    objectiveRules: (objectiveRules ?? []).map(defineGroupObjectiveRule),
    metadata: { ...metadata }
  };
}

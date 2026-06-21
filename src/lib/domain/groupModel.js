// groupModel.js
// -----------------------------------------------------------------------------
// Gestion runtime de grupos.
//
// groupDefinition.js describe como se define un grupo. Este modelo trabaja con
// los grupos ya presentes en una sesion:
// - ensambla grupos desde reglas de membresia;
// - consulta grupos y roles miembros;
// - anade o elimina roles de un grupo durante la partida.
//
// En session.groups guardamos estado persistente simple:
// { id, key, type, active, roleIds, groupRules, metadata }.
// -----------------------------------------------------------------------------

import {
  createGroup,
  GROUP_MEMBERSHIP_RULE_TYPES,
  GROUP_RULE_TARGETS,
  GROUP_RULE_TYPES
} from './groupDefinition.js';
import { normalizeId } from './sessionModel.js';

function uniqueIds(ids = []) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

function findRole(session = {}, roleId = null) {
  return (session.roles ?? []).find((role) => role.id === roleId) ?? null;
}

// Resuelve una regla de membresia contra el estado actual de sesion.
//
// La regla solo sirve para calcular la base inicial del grupo. Despues, los
// cambios por addRoleToGroup/removeRoleFromGroup persisten en session.groups.
export function resolveMembershipRuleRoleIds(
  session = {},
  membershipRule = null,
  fallbackRoleIds = []
) {
  const roles = session.roles ?? [];
  const rule = membershipRule ?? { type: GROUP_MEMBERSHIP_RULE_TYPES.CUSTOM };

  if (rule.type === GROUP_MEMBERSHIP_RULE_TYPES.ALL_ROLES) {
    return roles.map((role) => role.id);
  }

  if (rule.type === GROUP_MEMBERSHIP_RULE_TYPES.ALIGNMENT) {
    return roles
      .filter((role) => role.alignmentId === rule.alignmentId)
      .map((role) => role.id);
  }

  if (rule.type === GROUP_MEMBERSHIP_RULE_TYPES.FLAG) {
    return roles
      .filter((role) => rule.flagKey && role.flags?.[rule.flagKey] === true)
      .map((role) => role.id);
  }

  return uniqueIds(fallbackRoleIds);
}

function createSessionGroup(groupDefinition = {}, roleIds = []) {
  const group = createGroup({
    ...groupDefinition,
    roleIds,
    metadata: {
      ...(groupDefinition.metadata ?? {}),
      source: groupDefinition.metadata?.source ?? 'session_build'
    }
  });

  return {
    id: group.id,
    key: group.key,
    ...(group.type ? { type: group.type } : {}),
    active: group.active,
    createdCycleId: group.createdCycleId,
    sourceActionId: group.sourceActionId,
    roleIds: group.roleIds,
    groupRules: group.groupRules,
    metadata: { ...group.metadata }
  };
}

// Construye los grupos iniciales de sesion desde definiciones de grupo.
export function buildGroups(session = {}, groupDefinitions = []) {
  return (groupDefinitions ?? []).map((groupDefinition) =>
    createSessionGroup(
      groupDefinition,
      resolveMembershipRuleRoleIds(
        session,
        groupDefinition.membershipRule ?? null,
        groupDefinition.roleIds ?? []
      )
    )
  );
}

export function getGroup(session = {}, groupId = null) {
  const normalizedGroupId = groupId ? normalizeId(groupId) : null;
  if (!normalizedGroupId) return null;

  return (
    (session.groups ?? []).find(
      (group) => group.id === normalizedGroupId || group.key === normalizedGroupId
    ) ?? null
  );
}

export function getGroupRoles(session = {}, groupId = null) {
  const group = getGroup(session, groupId);
  if (!group) return [];

  return (group.roleIds ?? []).map((roleId) => findRole(session, roleId)).filter(Boolean);
}

export function getGroupRoleIds(session = {}, groupId = null) {
  const group = getGroup(session, groupId);
  if (!group) return [];

  return [...(group.roleIds ?? [])];
}

export function findGroupsForRole(session = {}, roleId = null, type = null) {
  const normalizedType = type ? normalizeId(type) : null;
  if (!roleId) return [];

  return (session.groups ?? []).filter((group) => {
    if (group?.active === false) return false;
    if (normalizedType && group.type !== normalizedType) return false;
    return (group.roleIds ?? []).includes(roleId);
  });
}

export function hasGroupMembership(session = {}, roleId = null, type = null) {
  return findGroupsForRole(session, roleId, type).length > 0;
}

export function getGroupMemberRoleIds(session = {}, roleId = null, type = null) {
  return uniqueIds(
    findGroupsForRole(session, roleId, type)
      .flatMap((group) => group.roleIds ?? [])
      .filter((memberRoleId) => memberRoleId && memberRoleId !== roleId)
  );
}

function groupRuleMatchesEffect(rule = {}, effect = {}) {
  return (
    effect?.type === 'set_property' &&
    effect?.targetType === 'role' &&
    rule.when?.property === effect.property &&
    rule.when?.value === effect.value
  );
}

function getGroupRuleTargetIds(group = {}, sourceRoleId = null, rule = {}) {
  if (rule.targets === GROUP_RULE_TARGETS.OTHER_MEMBERS) {
    return (group.roleIds ?? []).filter((roleId) => roleId !== sourceRoleId);
  }
  return [];
}

// Interpreta las reglas declaradas por los groups que contienen al objetivo de
// un efecto. No aplica cambios: devuelve nuevos efectos para que resolverModel
// los procese mediante la misma cola y las mismas validaciones.
export function getGroupRuleEffects({ session = {}, effect = {} } = {}) {
  if (effect?.targetType !== 'role' || !effect?.targetId) return [];

  return findGroupsForRole(session, effect.targetId).flatMap((group) =>
    (group.groupRules ?? []).flatMap((rule) => {
      if (rule.type !== GROUP_RULE_TYPES.PROPAGATE_PROPERTY_CHANGE) return [];
      if (!groupRuleMatchesEffect(rule, effect)) return [];

      return getGroupRuleTargetIds(group, effect.targetId, rule).map((targetId) => ({
        type: 'set_property',
        targetType: 'role',
        targetId,
        property: rule.apply.property,
        value: rule.apply.value,
        causedBy: {
          type: 'group',
          id: group.id
        },
        derivedFrom: {
          type: 'group_rule',
          groupId: group.id,
          groupRuleType: rule.type,
          sourceTargetId: effect.targetId
        }
      }));
    })
  );
}

export function addRoleToGroup(session = {}, groupId = null, roleId = null) {
  const normalizedGroupId = groupId ? normalizeId(groupId) : null;
  const normalizedRoleId = roleId ?? null;
  if (!normalizedGroupId || !normalizedRoleId) return session;

  return {
    ...session,
    groups: (session.groups ?? []).map((group) => {
      if (group.id !== normalizedGroupId && group.key !== normalizedGroupId) return group;

      return {
        ...group,
        roleIds: uniqueIds([...(group.roleIds ?? []), normalizedRoleId])
      };
    })
  };
}

export function removeRoleFromGroup(session = {}, groupId = null, roleId = null) {
  const normalizedGroupId = groupId ? normalizeId(groupId) : null;
  const normalizedRoleId = roleId ?? null;
  if (!normalizedGroupId || !normalizedRoleId) return session;

  return {
    ...session,
    groups: (session.groups ?? []).map((group) => {
      if (group.id !== normalizedGroupId && group.key !== normalizedGroupId) return group;

      return {
        ...group,
        roleIds: (group.roleIds ?? []).filter((currentRoleId) => currentRoleId !== normalizedRoleId)
      };
    })
  };
}

// groupModel.js
// -----------------------------------------------------------------------------
// Gestion runtime de grupos.
//
// groupDefinition.js describe como se define un grupo. Este modelo trabaja con
// los grupos ya presentes en una sesion:
// - crea los grupos iniciales desde reglas de membresia;
// - consulta grupos y roles miembros;
// - anade o elimina roles de un grupo durante la partida.
//
// En session.groups guardamos solo estado persistente simple:
// { id, key, roleIds, metadata }.
// -----------------------------------------------------------------------------

import { createGroup, GROUP_MEMBERSHIP_RULE_TYPES } from './groupDefinition.js';
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

  if (rule.type === GROUP_MEMBERSHIP_RULE_TYPES.RELATION) {
    return uniqueIds(
      (session.relations ?? [])
        .filter(
          (relation) =>
            relation.active && (!rule.relationType || relation.type === rule.relationType)
        )
        .flatMap((relation) => relation.roleIds ?? [])
    );
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
    roleIds: group.roleIds,
    metadata: { ...group.metadata }
  };
}

// Construye los grupos iniciales de sesion desde definiciones de grupo.
export function buildInitialGroups(session = {}, groupDefinitions = []) {
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

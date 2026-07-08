// effectModel.js
// -----------------------------------------------------------------------------
// Este archivo resuelve y aplica effects genericos del motor.
//
// Diferencia importante:
// - El runtime superior decide que effects propone.
// - effectModel valida, resuelve y aplica effects ya definidos.
//
// Aqui no deberian aparecer nombres de skins, componentes Svelte, Firebase,
// traducciones ni logica visual.
// -----------------------------------------------------------------------------

import { createGroup } from './groupDefinition.js';
import { getCurrentCycleId, normalizeId } from './sessionModel.js';
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { getGroupRuleEffects, getLinkedPropagatedEffects } from './groupModel.js';
import {
  addBlockedPropertyChange,
  isPropertyChangeBlocked
} from './roleModel.js';
import {
  EFFECT_TYPES,
  validateEffect as validateEffectShape
} from './effectDefinition.js';

export { EFFECT_TYPES };

function startEffect({ session, effect, runtime = {} } = {}) {
  return {
    session,
    effect,
    runtime,
    errors: [],
    finalEffect: null,
    blockedEffect: null,
    linkedPropagatedEffects: [],
    derivedEffects: [],
    skipped: false
  };
}

function validateEffect(effectState) {
  const validation = validateEffectShape(effectState.effect);

  return {
    ...effectState,
    errors: [...effectState.errors, ...validation.errors]
  };
}

function findEffectTarget(session, effect) {
  if (effect?.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) return null;
  return (session?.roles ?? []).find((role) => role.id === effect.targetId) ?? null;
}

function getEffectKey(effect = {}) {
  return [
    effect.type ?? '',
    effect.targetType ?? '',
    effect.targetId ?? '',
    effect.property ?? '',
    String(effect.value),
    effect.causedBy?.type ?? '',
    effect.causedBy?.id ?? '',
    effect.groupType ?? '',
    (effect.roleIds ?? []).slice().sort().join(',')
  ].join(':');
}

function getEffectStateKey(effect = {}) {
  return [
    effect.type ?? '',
    effect.targetType ?? '',
    effect.targetId ?? '',
    effect.property ?? '',
    String(effect.value),
    effect.groupType ?? '',
    (effect.roleIds ?? []).slice().sort().join(',')
  ].join(':');
}

function resolveEffect(effectState) {
  if (effectState.errors.length > 0) return effectState;

  const { session, effect, runtime } = effectState;
  const attemptKey = getEffectKey(effect);
  if (runtime.seenAttemptKeys?.has(attemptKey)) {
    return {
      ...effectState,
      skipped: true
    };
  }
  runtime.seenAttemptKeys?.add(attemptKey);

  const target = findEffectTarget(session, effect);
  const responsibleActorId = effect.causedBy?.id ?? null;
  if (
    effect.type === EFFECT_TYPES.SET_PROPERTY &&
    target &&
    isPropertyChangeBlocked(target, {
      property: effect.property,
      value: effect.value,
      actorIds: responsibleActorId ? [responsibleActorId] : []
    })
  ) {
    return {
      ...effectState,
      blockedEffect: {
        ...effect,
        reason: 'blocked_property_change'
      }
    };
  }

  const acceptedEffectKey = getEffectStateKey(effect);
  if (runtime.acceptedEffectKeys?.has(acceptedEffectKey)) {
    return {
      ...effectState,
      skipped: true
    };
  }
  runtime.acceptedEffectKeys?.add(acceptedEffectKey);

  return {
    ...effectState,
    finalEffect: effect,
    linkedPropagatedEffects: getLinkedPropagatedEffects({ session, effect }),
    derivedEffects: getGroupRuleEffects({ session, effect })
  };
}

function finishEffect(effectState) {
  return effectState;
}

// Resuelve effects propuestos por el runtime superior.
//
// No aplica cambios en la sesion. La escritura final vive en applyEffect(s).
export function resolveEffects({ session, proposedEffects = [] } = {}) {
  const finalEffects = [];
  const blockedEffects = [];
  const linkedPropagatedEffects = [];
  const errors = [];
  const queuedEffects = [...(proposedEffects ?? [])];
  const runtime = {
    seenAttemptKeys: new Set(),
    acceptedEffectKeys: new Set()
  };

  while (queuedEffects.length > 0) {
    const effect = queuedEffects.shift();
    const finishedEffect = finishEffect(
      resolveEffect(
        validateEffect(
          startEffect({ session, effect, runtime })
        )
      )
    );

    errors.push(...finishedEffect.errors);
    if (finishedEffect.blockedEffect) {
      blockedEffects.push(finishedEffect.blockedEffect);
      continue;
    }
    if (!finishedEffect.finalEffect) continue;

    finalEffects.push(finishedEffect.finalEffect);
    linkedPropagatedEffects.push(...finishedEffect.linkedPropagatedEffects);

    finishedEffect.derivedEffects.forEach((derivedEffect) => {
      if (!runtime.seenAttemptKeys.has(getEffectKey(derivedEffect))) {
        queuedEffects.push(derivedEffect);
      }
    });
  }

  return {
    proposedEffects: [...(proposedEffects ?? [])],
    finalEffects,
    blockedEffects,
    linkedPropagatedEffects,
    errors
  };
}

// Aplica un efecto final de tipo set_property.
//
// Esta funcion pertenece al rol de Effect Applier: no decide si el efecto debe
// ocurrir. Solo cambia el dato indicado porque otra parte ya lo decidio.
function applySetPropertyEffect({ session, effect }) {
  if (effect?.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) return session;

  return {
    ...session,
    roles: (session.roles ?? []).map((role) =>
      role.id === effect.targetId
        ? {
            ...role,
            [effect.property]: effect.value
          }
        : role
    )
  };
}

const EFFECT_APPLIERS = Object.freeze({
  [EFFECT_TYPES.SET_PROPERTY]: applySetPropertyEffect,
  [EFFECT_TYPES.BLOCK_PROPERTY_CHANGE]: applyBlockPropertyChangeEffect,
  [EFFECT_TYPES.SET_GROUP]: applySetGroupEffect,
  [EFFECT_TYPES.REPLACE_ROLE_IDENTITY]: applyReplaceRoleIdentityEffect,
  [EFFECT_TYPES.CONCLUDE_PLAY]: applyConcludePlayEffect
});

export function applyEffect({ session, effect }) {
  const validatedEffect = validateEffect(startEffect({ session, effect }));
  if (validatedEffect.errors.length > 0) return session;

  const applyToSession = EFFECT_APPLIERS[effect.type];
  if (!applyToSession) return session;

  return finishEffect({
    ...validatedEffect,
    session: applyToSession({ session, effect })
  }).session;
}

export function applyEffects({ session, effects = [] } = {}) {
  return (effects ?? []).reduce(
    (currentSession, effect) => applyEffect({ session: currentSession, effect }),
    session
  );
}

function applyBlockPropertyChangeEffect({ session, effect }) {
  if (effect?.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) return session;

  const targetIds = new Set([
    ...(effect.targetIds ?? []),
    ...(effect.targetId ? [effect.targetId] : [])
  ]);
  if (targetIds.size === 0) return session;

  const blockedPropertyChange = effect.blockedPropertyChange ?? {};

  return {
    ...session,
    roles: (session.roles ?? []).map((role) => {
      if (!targetIds.has(role.id)) return role;
      return addBlockedPropertyChange(role, {
        property: blockedPropertyChange.property,
        value: blockedPropertyChange.value,
        blockedFor: effect.blockedFor ?? { actorIds: [] },
        expiresAt: effect.expiresAt,
        metadata: effect.metadata ?? {}
      });
    })
  };
}

// Crea o actualiza un grupo de sesion.
//
// set_group es el effect que escribe o actualiza un grupo mecanico.
// No guarda "amor", "hermandad", "maldicion" ni ningun texto narrativo.
// Solo registra que varios roles de sesion comparten un grupo mecanico.
function applySetGroupEffect({ session, effect }) {
  if (effect?.targetType !== MECHANICAL_ENTITY_TYPES.GROUP) return session;

  const groupType = normalizeId(effect.groupType);
  const roleIds = normalizeGroupMemberIds(effect.roleIds);
  if (!groupType || roleIds.length < 2) return session;

  const group = createGroup({
    id: effect.groupId,
    key: effect.groupKey ?? effect.groupId ?? `${groupType}-${roleIds.join('-')}`,
    type: groupType,
    roleIds,
    active: effect.active ?? true,
    createdCycleId: getCurrentCycleId(session),
    sourceActionId: effect.sourceActionId ?? null,
    groupRules: effect.groupRules ?? [],
    selectionRules: effect.selectionRules ?? [],
    objectiveRules: effect.objectiveRules ?? [],
    metadata: effect.metadata ?? {}
  });
  const groupKey = getGroupKey(group);
  const currentGroups = session?.groups ?? [];
  const existingIndex = currentGroups.findIndex(
    (currentGroup) => getGroupKey(currentGroup) === groupKey
  );

  if (existingIndex === -1) {
    return {
      ...session,
      groups: [...currentGroups, group]
    };
  }

  return {
    ...session,
    groups: currentGroups.map((currentGroup, index) =>
      index === existingIndex
        ? {
            ...currentGroup,
            ...group,
            id: currentGroup.id
          }
        : currentGroup
    )
  };
}

function applyReplaceRoleIdentityEffect({ session, effect }) {
  if (effect?.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) return session;

  const actorRoleId = effect.actorRoleId ?? null;
  const targetId = effect.targetId ?? null;
  if (!actorRoleId || !targetId || actorRoleId === targetId) return session;

  const actor = (session.roles ?? []).find((role) => role.id === actorRoleId) ?? null;
  const target = (session.roles ?? []).find((role) => role.id === targetId) ?? null;
  if (!actor || !target) return session;

  return {
    ...session,
    roles: (session.roles ?? []).map((role) => {
      if (role.id === actorRoleId) {
        return {
          ...role,
          playerId: null,
          seat: null,
          inPlay: false,
          metadata: {
            ...(role.metadata ?? {}),
            replacedByRoleId: targetId,
            replacedByRecipeKey: effect.recipeKey ?? null
          }
        };
      }

      if (role.id === targetId) {
        return {
          ...role,
          playerId: actor.playerId,
          seat: actor.seat,
          inPlay: actor.inPlay === true,
          metadata: {
            ...(role.metadata ?? {}),
            assumable: false,
            assumedFromRoleId: actorRoleId,
            assumedByRecipeKey: effect.recipeKey ?? null
          }
        };
      }

      return role;
    }),
    assumableRoles: (session.assumableRoles ?? []).filter((roleId) => roleId !== targetId)
  };
}

function applyConcludePlayEffect({ session, effect }) {
  return {
    ...session,
    metadata: {
      ...(session?.metadata ?? {}),
      playOutcome: effect.playOutcome ?? null
    },
    playOutcome: effect.playOutcome ?? null,
    interPoolQueue: []
  };
}

// Normaliza miembros de un grupo de vinculo para que A+B y B+A sean el mismo grupo.
function normalizeGroupMemberIds(roleIds = []) {
  return [...new Set((roleIds ?? []).filter(Boolean))].sort();
}

// Clave interna para detectar grupos mecanicamente equivalentes.
//
// La id visible puede venir de fuera, pero para evitar duplicados nos importa:
// - tipo de grupo;
// - conjunto de miembros.
function getGroupKey(group = {}) {
  return [normalizeId(group.type), ...normalizeGroupMemberIds(group.roleIds)].join(':');
}

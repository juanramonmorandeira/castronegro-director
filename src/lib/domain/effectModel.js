// effectModel.js
// -----------------------------------------------------------------------------
// Este archivo contiene utilidades del lado "Effect" del motor.
//
// Diferencia importante:
// - actionModel decide que una accion es valida y que efectos propone.
// - effectModel aplica o prepara efectos ya definidos.
//
// Aqui no deberian aparecer nombres de skins, componentes Svelte, Firebase,
// traducciones ni logica visual.
// -----------------------------------------------------------------------------

import { createGroup } from './groupDefinition.js';
import { normalizeId } from './sessionModel.js';

export const EFFECT_TYPES = Object.freeze({
  REVEAL_PROPERTY: 'reveal_property',
  SET_PROPERTY: 'set_property',
  BLOCK_PROPERTY_CHANGE: 'block_property_change',
  SET_GROUP: 'set_group',
  CONCLUDE_PLAY: 'conclude_play'
});

// Devuelve el ciclo actual de la sesion.
//
// cycle es el propietario del contador. La sesion inicial vive en ciclo 0
// mientras resuelve posibles specialStages previos al primer ciclo normal.
export function getCurrentCycleId(session) {
  const rawCycleId = session?.cycle?.id ?? 0;
  const numericCycleId = Number(rawCycleId);
  return Number.isFinite(numericCycleId) && numericCycleId >= 0 ? numericCycleId : 0;
}

// Aplica un efecto final de tipo set_property.
//
// Esta funcion pertenece al rol de Effect Applier: no decide si el efecto debe
// ocurrir. Solo cambia el dato indicado porque otra parte ya lo decidio.
export function applySetPropertyEffect({ session, effect }) {
  if (effect?.targetType !== 'role') return session;

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

// Crea o actualiza un grupo de sesion.
//
// set_group es el efecto anonimo que usa una accion como link_targets.
// No guarda "amor", "hermandad", "maldicion" ni ningun texto narrativo.
// Solo registra que varios roles de sesion comparten un grupo mecanico.
export function applySetGroupEffect({ session, effect }) {
  if (effect?.targetType !== 'group') return session;

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

// Normaliza miembros de un grupo de vinculo para que A+B y B+A sean el mismo grupo.
export function normalizeGroupMemberIds(roleIds = []) {
  return [...new Set((roleIds ?? []).filter(Boolean))].sort();
}

// Clave interna para detectar grupos mecanicamente equivalentes.
//
// La id visible puede venir de fuera, pero para evitar duplicados nos importa:
// - tipo de grupo;
// - conjunto de miembros.
export function getGroupKey(group = {}) {
  return [normalizeId(group.type), ...normalizeGroupMemberIds(group.roleIds)].join(':');
}

// Prepara el inicio de un nuevo ciclo.
//
// En esta version todavia no tenemos una cola real de efectos pendientes. Las
// acciones actuales resuelven y aplican sus efectos inmediatamente. Aun asi,
// mantenemos esta funcion para limpiar bloqueos temporales y avanzar
// cycle.id antes del siguiente poolConcealed.
// Concluye la parte jugable con un playOutcome ya calculado.
//
// Esta escritura vive como efecto para que la conclusion jugable pase por la
// misma ruta de aplicacion que el resto de cambios mecanicos.
//
// No cerramos administrativamente la session: esa decision pertenece al creador
// o al flujo de aplicacion. Guardamos playOutcome como estado mecanico.
export function applyConcludePlay({ session, playOutcome = null, visibility = 'all' } = {}) {
  return {
    session: {
      ...session,
      metadata: {
        ...(session?.metadata ?? {}),
        playOutcome
      },
      playOutcome
    },
    result: {
      type: EFFECT_TYPES.CONCLUDE_PLAY,
      visibility,
      finalEffects: [],
      playOutcome
    }
  };
}

// victoryModel.js
// -----------------------------------------------------------------------------
// Este archivo evalua si una partida ha terminado.
//
// Mantiene la misma regla que el resto del nucleo:
// - no sabe que es "alignment_a", "alignment_b" en terminos narrativos;
// - no muestra textos;
// - no guarda en Firebase;
// - solo mira datos mecanicos de la sesion.
//
// Version actual implementada:
// - ongoing: la partida sigue;
// - alignment_rule: una regla configurada de alignment se cumple;
// - single_alignment: solo queda un alignment en juego;
// - linked_exclusive_survivors: una relacion linked de alignments distintos es
//   el unico grupo que queda en juego.
// -----------------------------------------------------------------------------

import { RELATION_TYPES, normalizeId } from './sessionModel.js';

export const VICTORY_STATUSES = Object.freeze({
  ONGOING: 'ongoing',
  FINISHED: 'finished'
});

export const VICTORY_TYPES = Object.freeze({
  NONE: 'none',
  DRAW: 'draw',
  ALIGNMENT_RULE: 'alignment_rule',
  SINGLE_ALIGNMENT: 'single_alignment',
  LINKED_EXCLUSIVE_SURVIVORS: 'linked_exclusive_survivors'
});

export const VICTORY_RULE_TYPES = Object.freeze({
  AT_LEAST_REMAINING: 'at_least_remaining'
});

// Devuelve los roleInstances que siguen participando en el juego principal.
//
// Usamos `inPlay` porque es el termino anonimo acordado. No presupone muerte:
// un rol puede estar arrestado, expulsado, eyectado o fuera de la ronda por
// cualquier motivo narrativo de la skin.
export function getInPlayRoleInstances(session = {}) {
  return (session.roleInstances ?? []).filter((role) => role?.inPlay === true);
}

export function getRoleAlignmentId(role = {}) {
  return normalizeId(role?.alignmentId);
}

// Devuelve alignments unicos, ignorando valores vacios.
export function getAlignmentIds(roleInstances = []) {
  return [
    ...new Set(
      (roleInstances ?? [])
        .map(getRoleAlignmentId)
        .filter((alignmentId) => alignmentId.length > 0)
    )
  ];
}

// Devuelve las reglas de victoria por alignment configuradas en la sesion.
//
// Usamos una lista para que el orden sea explicito. Eso importa porque algunas
// partidas pueden tener varios alignments con condiciones diferentes.
//
// Forma esperada:
//
// {
//   settings: {
//     victory: {
//       alignmentRules: [
//         {
//           id: 'alignment_b_reaches_parity',
//           alignmentId: 'alignment_b',
//           condition: 'at_least_remaining'
//         }
//       ]
//     }
//   }
// }
export function getAlignmentVictoryRules(session = {}) {
  return session?.settings?.victory?.alignmentRules ?? session?.settings?.alignmentVictoryRules ?? [];
}

// Agrupa roleInstances inPlay por alignment.
export function getInPlayRolesByAlignment(session = {}) {
  return getInPlayRoleInstances(session).reduce((acc, role) => {
    const alignmentId = getRoleAlignmentId(role);
    if (!alignmentId) return acc;
    acc[alignmentId] = [...(acc[alignmentId] ?? []), role];
    return acc;
  }, {});
}

// Resultado estandar cuando la partida sigue.
export function getOngoingVictoryResult(reason = 'no_victory_condition_met') {
  return {
    status: VICTORY_STATUSES.ONGOING,
    type: VICTORY_TYPES.NONE,
    reason,
    winnerAlignmentId: null,
    winnerRoleInstanceIds: []
  };
}

// Evalua reglas configuradas de alignment.
//
// Regla implementada:
// - at_least_remaining: el alignment gana si sus miembros inPlay son al menos
//   tantos como todos los demas roleInstances inPlay juntos.
//
// Esta es la version abstracta de reglas tipo "cuando un alignment alcanza o
// iguala al resto de participantes, se cumple su condicion". No dice que ese
// alignment sea enemigo, hostil, bueno o malo.
export function evaluateAlignmentVictoryRules(session = {}) {
  const inPlayRoles = getInPlayRoleInstances(session);
  const rolesByAlignment = getInPlayRolesByAlignment(session);

  for (const rule of getAlignmentVictoryRules(session)) {
    const alignmentId = normalizeId(rule?.alignmentId);
    const condition = normalizeId(rule?.condition);
    const alignmentRoles = rolesByAlignment[alignmentId] ?? [];
    const remainingRoleCount = inPlayRoles.length - alignmentRoles.length;

    if (!alignmentId || alignmentRoles.length === 0) continue;

    if (
      condition === VICTORY_RULE_TYPES.AT_LEAST_REMAINING &&
      alignmentRoles.length >= remainingRoleCount
    ) {
      return {
        status: VICTORY_STATUSES.FINISHED,
        type: VICTORY_TYPES.ALIGNMENT_RULE,
        reason: 'alignment_rule_at_least_remaining_met',
        ruleId: rule.id ?? null,
        ruleCondition: VICTORY_RULE_TYPES.AT_LEAST_REMAINING,
        winnerAlignmentId: alignmentId,
        winnerRoleInstanceIds: alignmentRoles.map((role) => role.id),
        counts: {
          alignmentInPlay: alignmentRoles.length,
          remainingInPlay: remainingRoleCount,
          totalInPlay: inPlayRoles.length
        }
      };
    }
  }

  return null;
}

// Evalua la victoria especial de una relacion linked.
//
// Regla actual:
// - todos los miembros de la relacion siguen inPlay;
// - pertenecen a mas de un alignment;
// - no queda nadie mas inPlay fuera de esa relacion.
//
// Si linked une roles del mismo alignment, no cambia la condicion de victoria:
// ganara ese alignment por la regla normal si corresponde.
export function evaluateLinkedVictory(session = {}) {
  const inPlayRoles = getInPlayRoleInstances(session);
  const inPlayIds = new Set(inPlayRoles.map((role) => role.id));
  const activeLinkedRelations = (session.relations ?? []).filter(
    (relation) => relation?.active && relation.type === RELATION_TYPES.LINKED
  );

  for (const relation of activeLinkedRelations) {
    const relationIds = relation.roleInstanceIds ?? [];
    const linkedRoles = relationIds
      .map((roleInstanceId) => inPlayRoles.find((role) => role.id === roleInstanceId))
      .filter(Boolean);
    const linkedIds = new Set(linkedRoles.map((role) => role.id));
    const linkedAlignmentIds = getAlignmentIds(linkedRoles);
    const allRelationMembersInPlay = relationIds.length >= 2 && linkedRoles.length === relationIds.length;
    const onlyLinkedMembersRemain =
      inPlayIds.size === linkedIds.size && [...inPlayIds].every((id) => linkedIds.has(id));

    if (allRelationMembersInPlay && linkedAlignmentIds.length > 1 && onlyLinkedMembersRemain) {
      return {
        status: VICTORY_STATUSES.FINISHED,
        type: VICTORY_TYPES.LINKED_EXCLUSIVE_SURVIVORS,
        reason: 'linked_members_from_different_alignments_are_last_in_play',
        winnerAlignmentId: null,
        winnerRoleInstanceIds: [...linkedIds],
        relationId: relation.id
      };
    }
  }

  return null;
}

// Evalua la condicion generica: solo queda un alignment en juego.
//
// Esto cubre el caso basico donde solo queda una condicion de victoria posible.
// Las reglas mas especificas deben venir configuradas en alignmentRules para no
// hardcodear el significado narrativo de cada alignment.
export function evaluateSingleAlignmentVictory(session = {}) {
  const inPlayRoles = getInPlayRoleInstances(session);
  const alignmentIds = getAlignmentIds(inPlayRoles);

  if (inPlayRoles.length === 0) {
    return {
      status: VICTORY_STATUSES.FINISHED,
      type: VICTORY_TYPES.DRAW,
      reason: 'no_role_instances_in_play',
      winnerAlignmentId: null,
      winnerRoleInstanceIds: []
    };
  }

  if (alignmentIds.length === 1) {
    return {
      status: VICTORY_STATUSES.FINISHED,
      type: VICTORY_TYPES.SINGLE_ALIGNMENT,
      reason: 'single_alignment_left_in_play',
      winnerAlignmentId: alignmentIds[0],
      winnerRoleInstanceIds: inPlayRoles.map((role) => role.id)
    };
  }

  return null;
}

// Punto de entrada publico para evaluar victoria.
//
// Orden importante:
// 1. reglas configuradas de alignment se evaluan al inicio del chequeo de
//    victoria, justo despues de que el motor haya consumado efectos.
// 2. linked especial cubre el caso donde una relacion cambia la lectura normal
//    de alignments.
// 3. alignment unico cubre el caso generico de "solo queda un alignment".
// 4. si nada encaja, la partida sigue.
export function evaluateVictory(session = {}) {
  return (
    evaluateAlignmentVictoryRules(session) ??
    evaluateLinkedVictory(session) ??
    evaluateSingleAlignmentVictory(session) ??
    getOngoingVictoryResult()
  );
}

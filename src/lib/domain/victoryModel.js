// victoryModel.js
// -----------------------------------------------------------------------------
// Este archivo evalua si una partida ha terminado.
//
// Mantiene la misma regla que el resto del nucleo:
// - no sabe que es "faction_a", "faction_b" en terminos narrativos;
// - no muestra textos;
// - no guarda en Firebase;
// - solo mira datos mecanicos de la sesion.
//
// Version actual implementada:
// - ongoing: la partida sigue;
// - faction_rule: una regla configurada de faccion se cumple;
// - single_faction: solo queda una faccion en juego;
// - linked_exclusive_survivors: una relacion linked de facciones distintas es
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
  FACTION_RULE: 'faction_rule',
  SINGLE_FACTION: 'single_faction',
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

// Devuelve facciones unicas, ignorando valores vacios.
export function getFactionIds(roleInstances = []) {
  return [
    ...new Set(
      (roleInstances ?? [])
        .map((role) => normalizeId(role?.factionId))
        .filter((factionId) => factionId.length > 0)
    )
  ];
}

// Devuelve las reglas de victoria por faccion configuradas en la sesion.
//
// Usamos una lista para que el orden sea explicito. Eso importa porque algunas
// partidas pueden tener varias facciones con condiciones diferentes.
//
// Forma esperada:
//
// {
//   settings: {
//     victory: {
//       factionRules: [
//         {
//           id: 'faction_b_reaches_parity',
//           factionId: 'faction_b',
//           condition: 'at_least_remaining'
//         }
//       ]
//     }
//   }
// }
export function getFactionVictoryRules(session = {}) {
  return session?.settings?.victory?.factionRules ?? session?.settings?.factionVictoryRules ?? [];
}

// Agrupa roleInstances inPlay por faccion.
export function getInPlayRolesByFaction(session = {}) {
  return getInPlayRoleInstances(session).reduce((acc, role) => {
    const factionId = normalizeId(role?.factionId);
    if (!factionId) return acc;
    acc[factionId] = [...(acc[factionId] ?? []), role];
    return acc;
  }, {});
}

// Resultado estandar cuando la partida sigue.
export function createOngoingVictoryResult(reason = 'no_victory_condition_met') {
  return {
    status: VICTORY_STATUSES.ONGOING,
    type: VICTORY_TYPES.NONE,
    reason,
    winnerFactionId: null,
    winnerRoleInstanceIds: []
  };
}

// Evalua reglas configuradas de faccion.
//
// Regla implementada:
// - at_least_remaining: la faccion gana si sus miembros inPlay son al menos
//   tantos como todos los demas roleInstances inPlay juntos.
//
// Esta es la version abstracta de reglas tipo "cuando una faccion alcanza o
// iguala al resto de participantes, se cumple su condicion". No dice que esa
// faccion sea enemiga, hostil, buena o mala.
export function evaluateFactionVictoryRules(session = {}) {
  const inPlayRoles = getInPlayRoleInstances(session);
  const rolesByFaction = getInPlayRolesByFaction(session);

  for (const rule of getFactionVictoryRules(session)) {
    const factionId = normalizeId(rule?.factionId);
    const condition = normalizeId(rule?.condition);
    const factionRoles = rolesByFaction[factionId] ?? [];
    const remainingRoleCount = inPlayRoles.length - factionRoles.length;

    if (!factionId || factionRoles.length === 0) continue;

    if (
      condition === VICTORY_RULE_TYPES.AT_LEAST_REMAINING &&
      factionRoles.length >= remainingRoleCount
    ) {
      return {
        status: VICTORY_STATUSES.FINISHED,
        type: VICTORY_TYPES.FACTION_RULE,
        reason: 'faction_rule_at_least_remaining_met',
        ruleId: rule.id ?? null,
        ruleCondition: VICTORY_RULE_TYPES.AT_LEAST_REMAINING,
        winnerFactionId: factionId,
        winnerRoleInstanceIds: factionRoles.map((role) => role.id),
        counts: {
          factionInPlay: factionRoles.length,
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
// - pertenecen a mas de una faccion;
// - no queda nadie mas inPlay fuera de esa relacion.
//
// Si linked une roles de la misma faccion, no cambia la condicion de victoria:
// ganara la faccion por la regla normal si corresponde.
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
    const linkedFactionIds = getFactionIds(linkedRoles);
    const allRelationMembersInPlay = relationIds.length >= 2 && linkedRoles.length === relationIds.length;
    const onlyLinkedMembersRemain =
      inPlayIds.size === linkedIds.size && [...inPlayIds].every((id) => linkedIds.has(id));

    if (allRelationMembersInPlay && linkedFactionIds.length > 1 && onlyLinkedMembersRemain) {
      return {
        status: VICTORY_STATUSES.FINISHED,
        type: VICTORY_TYPES.LINKED_EXCLUSIVE_SURVIVORS,
        reason: 'linked_members_from_different_factions_are_last_in_play',
        winnerFactionId: null,
        winnerRoleInstanceIds: [...linkedIds],
        relationId: relation.id
      };
    }
  }

  return null;
}

// Evalua la condicion generica: solo queda una faccion en juego.
//
// Esto cubre el caso basico donde solo queda una condicion de victoria posible.
// Las reglas mas especificas deben venir configuradas en factionRules para no
// hardcodear el significado narrativo de cada faccion.
export function evaluateSingleFactionVictory(session = {}) {
  const inPlayRoles = getInPlayRoleInstances(session);
  const factionIds = getFactionIds(inPlayRoles);

  if (inPlayRoles.length === 0) {
    return {
      status: VICTORY_STATUSES.FINISHED,
      type: VICTORY_TYPES.DRAW,
      reason: 'no_role_instances_in_play',
      winnerFactionId: null,
      winnerRoleInstanceIds: []
    };
  }

  if (factionIds.length === 1) {
    return {
      status: VICTORY_STATUSES.FINISHED,
      type: VICTORY_TYPES.SINGLE_FACTION,
      reason: 'single_faction_left_in_play',
      winnerFactionId: factionIds[0],
      winnerRoleInstanceIds: inPlayRoles.map((role) => role.id)
    };
  }

  return null;
}

// Punto de entrada publico para evaluar victoria.
//
// Orden importante:
// 1. reglas configuradas de faccion se evaluan al inicio del chequeo de
//    victoria, justo despues de que el motor haya consumado efectos.
// 2. linked especial cubre el caso donde una relacion cambia la lectura normal
//    de facciones.
// 3. faccion unica cubre el caso generico de "solo queda una faccion".
// 4. si nada encaja, la partida sigue.
export function evaluateVictory(session = {}) {
  return (
    evaluateFactionVictoryRules(session) ??
    evaluateLinkedVictory(session) ??
    evaluateSingleFactionVictory(session) ??
    createOngoingVictoryResult()
  );
}

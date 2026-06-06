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

import { createRelation } from './relationDefinition.js';
import { SESSION_STATUSES, normalizeId } from './sessionModel.js';

export const EFFECT_TYPES = Object.freeze({
  REVEAL_PROPERTY: 'reveal_property',
  SET_PROPERTY: 'set_property',
  BLOCK_ACTION: 'block_action',
  SET_RELATION: 'set_relation',
  CLOSE_CYCLE: 'close_cycle',
  FINISH_SESSION: 'finish_session'
});

// Devuelve el ciclo actual de la sesion.
//
// Lo guardamos en metadata para no introducir todavia una estructura grande de
// calendario/steps. Si no existe, asumimos ciclo 1.
export function getCurrentCycleId(session) {
  const rawCycleId = session?.metadata?.currentCycleId ?? session?.cycleId ?? 1;
  const numericCycleId = Number(rawCycleId);
  return Number.isFinite(numericCycleId) && numericCycleId > 0 ? numericCycleId : 1;
}

// Avanza el contador de ciclo de la sesion.
//
// Por ahora lo hacemos al cerrar efectos pendientes, porque esa accion
// representa el cierre del ciclo y el paso al siguiente bloque de decisiones.
export function advanceSessionCycle(session) {
  return {
    ...session,
    metadata: {
      ...(session?.metadata ?? {}),
      currentCycleId: getCurrentCycleId(session) + 1
    }
  };
}

// Genera una clave estable para un bloqueo de accion.
//
// El motor no guarda "escudo", "defensa" o "proteccion" como concepto de skin.
// Guarda que una accion concreta queda bloqueada contra un objetivo concreto.
//
// {
//   actionId: 'set_in_play',
//   params: {
//     property: 'inPlay',
//     value: false
//   }
// }
//
// Nota sobre target:
// el objetivo no forma parte de esta clave porque la clave se guarda dentro del
// propio role objetivo:
//
// role.flags.blockedActions['set_in_play:property:inPlay:value:false'] = true
//
// Por eso block_action(set_in_play, params; target) se representa como:
// - params dentro del bloqueo;
// - target dentro de targetIds y del role que recibe el flag.
//
// Para una receta como block_out_of_play, la clave resultante bloquea solo:
//
// set_in_play + property=inPlay + value=false
//
// No bloquea set_in_play value=true ni otras acciones.
export function getActionBlockKey(block = {}) {
  const actionId = block.actionId ?? 'unknown';
  const params = normalizeBlockParams(block);
  const paramPairs = Object.keys(params)
    .sort()
    .map((key) => `${key}:${String(params[key])}`);

  return [actionId, ...paramPairs].join(':');
}

// Normaliza parametros especiales antes de construir la clave.
//
// set_in_play siempre trabaja sobre inPlay. Si una regla omite property pero
// indica value, asumimos property=inPlay para que estas dos formas sean
// equivalentes:
//
// { actionId: 'set_in_play', params: { value: false } }
// { actionId: 'set_in_play', params: { property: 'inPlay', value: false } }
export function normalizeBlockParams(block = {}) {
  const params = { ...(block.params ?? {}) };

  if (block.actionId === 'set_in_play' && params.property === undefined) {
    params.property = 'inPlay';
  }

  return params;
}

// Devuelve true si un rol tiene bloqueada una accion concreta.
//
// Guardamos los bloqueos temporales dentro de flags.blockedActions.
// Ejemplo:
//
// {
//   flags: {
//     blockedActions: {
//       'set_in_play:property:inPlay:value:false': true
//     }
//   }
// }
//
// Esto permite que una skin presente la misma mecanica como escudo, soborno,
// bloqueo, interferencia, fallo tecnico, niebla, etc.
export function hasActionBlock(role, block) {
  return role?.flags?.blockedActions?.[getActionBlockKey(block)] === true;
}

// Borra flags temporales del ciclo actual.
//
// Lo usamos al cerrar el ciclo: un bloqueo temporal no debe durar para
// siempre.
export function clearCycleFlags(role) {
  const nextFlags = { ...(role.flags ?? {}) };
  delete nextFlags.blockedActions;
  return {
    ...role,
    flags: nextFlags
  };
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

// Crea o actualiza una relacion de sesion.
//
// set_relation es el efecto anonimo que usa una accion como link_targets.
// No guarda "amor", "hermandad", "maldicion" ni ningun texto narrativo.
// Solo registra que varios roles de sesion comparten una relacion mecanica.
export function applySetRelationEffect({ session, effect }) {
  if (effect?.targetType !== 'relation') return session;

  const relationType = normalizeId(effect.relationType);
  const roleIds = normalizeRelationMemberIds(effect.roleIds);
  if (!relationType || roleIds.length < 2) return session;

  const relation = createRelation({
    id: effect.relationId,
    type: relationType,
    roleIds,
    active: effect.active ?? true,
    createdCycleId: getCurrentCycleId(session),
    sourceActionId: effect.sourceActionId ?? null,
    metadata: effect.metadata ?? {}
  });
  const relationKey = getRelationKey(relation);
  const currentRelations = session?.relations ?? [];
  const existingIndex = currentRelations.findIndex(
    (currentRelation) => getRelationKey(currentRelation) === relationKey
  );

  if (existingIndex === -1) {
    return {
      ...session,
      relations: [...currentRelations, relation]
    };
  }

  return {
    ...session,
    relations: currentRelations.map((currentRelation, index) =>
      index === existingIndex
        ? {
            ...currentRelation,
            ...relation,
            id: currentRelation.id
          }
        : currentRelation
    )
  };
}

// Normaliza miembros de una relacion para que A+B y B+A sean el mismo vinculo.
export function normalizeRelationMemberIds(roleIds = []) {
  return [...new Set((roleIds ?? []).filter(Boolean))].sort();
}

// Clave interna para detectar relaciones mecanicamente equivalentes.
//
// La id visible puede venir de fuera, pero para evitar duplicados nos importa:
// - tipo de relacion;
// - conjunto de miembros.
export function getRelationKey(relation = {}) {
  return [normalizeId(relation.type), ...normalizeRelationMemberIds(relation.roleIds)].join(
    ':'
  );
}

// Cierra el ciclo actual.
//
// En esta version todavia no tenemos una cola real de efectos pendientes. Las
// acciones actuales resuelven y aplican sus efectos inmediatamente. Aun asi,
// mantenemos esta funcion para cerrar ciclo, limpiar bloqueos temporales y
// avanzar currentCycleId.
export function applyCloseCycle({ session, visibility = 'all' } = {}) {
  const resolvedSession = {
    ...session,
    roles: (session?.roles ?? []).map(clearCycleFlags)
  };
  const nextSession = advanceSessionCycle(resolvedSession);

  return {
    session: nextSession,
    result: {
      type: EFFECT_TYPES.CLOSE_CYCLE,
      visibility,
      finalEffects: [],
      clearedTemporaryFlags: ['blockedActions'],
      nextCycleId: getCurrentCycleId(nextSession)
    }
  };
}

// Cierra la sesion con un resultado de victoria ya calculado.
//
// Esta escritura vive como efecto para que el fin de partida sea un step
// especial ejecutable, no un corte silencioso del motor antes de poolSpecial.
export function applyFinishSession({ session, victory = null, visibility = 'all' } = {}) {
  return {
    session: {
      ...session,
      status: SESSION_STATUSES.FINISHED,
      metadata: {
        ...(session?.metadata ?? {}),
        victory
      }
    },
    result: {
      type: EFFECT_TYPES.FINISH_SESSION,
      visibility,
      finalEffects: [],
      victory
    }
  };
}

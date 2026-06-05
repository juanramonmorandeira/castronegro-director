// historyModel.js
// -----------------------------------------------------------------------------
// Este archivo centraliza la memoria mecanica de la sesion.
//
// actionHistory vive dentro de la sesion porque cada partida tiene su propia
// historia. Este modelo no guarda nada fuera: solo crea, anade y consulta
// entradas de historial de forma consistente.
//
// Objetivo:
// - actionModel resuelve acciones;
// - historyModel registra que ocurrio;
// - otros modelos pueden consultar la sesion sin saber como se construyen las
//   entradas.
// -----------------------------------------------------------------------------

import { getActionBlockKey } from './effectModel.js';

export const HISTORY_RESULTS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED: 'blocked',
  PARTIAL: 'partial',
  NO_EFFECT: 'no_effect',
  FAILED: 'failed'
});

// Devuelve las acciones registradas en la sesion.
//
// No se limpia al cerrar ciclo. Es memoria de partida, no estado temporal.
export function getActionHistory(session) {
  return Array.isArray(session?.actionHistory) ? session.actionHistory : [];
}

// Construye una firma estable para comparar acciones en actionHistory.
//
// Para block_action no basta con action.id, porque puede bloquear muchas cosas
// distintas. Por eso incluimos la blockKey de la accion bloqueada:
//
// block_out_of_play -> block_action|set_in_play:property:inPlay:value:false
//
// En una accion normal, la firma es simplemente su id.
export function getActionHistorySignature(action = {}) {
  const blockedAction = action?.effect?.blocks;
  if (blockedAction?.actionId) {
    return `${action.id ?? 'unknown'}|${getActionBlockKey(blockedAction)}`;
  }

  return action.id ?? 'unknown';
}

// Anade una entrada a una coleccion de historial dentro de la sesion.
//
// Esta es la mecanica comun de escritura. Los modelos concretos siguen
// preparando sus entradas antes de llamar aqui, porque actionHistory y
// stepHistory no guardan el mismo tipo de hecho.
export function appendEntry(session, collectionName, entry, { getId } = {}) {
  const history = Array.isArray(session?.[collectionName]) ? session[collectionName] : [];
  const normalizedEntry = { ...entry };

  return {
    ...session,
    [collectionName]: [
      ...history,
      {
        ...normalizedEntry,
        id:
          normalizedEntry.id ??
          (typeof getId === 'function'
            ? getId(normalizedEntry, history)
            : `${collectionName}-${history.length}`)
      }
    ]
  };
}

// Anade una entrada al historial de acciones de la sesion.
//
// La entrada guarda datos mecanicos, no textos visibles. Esto permite que una
// regla futura pregunte cosas como:
// - quien fue afectado en este ciclo?
// - que step lo produjo?
// - hubo efectos finales o la accion fue bloqueada?
export function appendActionHistory(session, entry = {}) {
  const history = getActionHistory(session);
  const normalizedEntry = {
    id: entry.id ?? null,
    cycleId: entry.cycleId ?? 0,
    poolKey: entry.poolKey ?? null,
    stepKey: entry.stepKey ?? null,
    actionKey: entry.actionKey ?? null,
    actionId: entry.actionId ?? null,
    actionSignature: entry.actionSignature ?? null,
    actorIds: [...(entry.actorIds ?? [])],
    actor: entry.actor ? { ...entry.actor } : null,
    targetIds: [...(entry.targetIds ?? [])],
    proposedEffects: [...(entry.proposedEffects ?? [])],
    finalEffects: [...(entry.finalEffects ?? [])],
    blockedActions: [...(entry.blockedActions ?? [])],
    blockedEffects: [...(entry.blockedEffects ?? [])],
    result: entry.result ?? HISTORY_RESULTS.NO_EFFECT,
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'actionHistory', normalizedEntry, {
    getId: (item) => `${item.actionId ?? 'action'}-${item.cycleId}-${history.length}`
  });
}

// Devuelve entradas que aplicaron un cambio concreto de propiedad en un ciclo.
//
// Esto sera util para mecanicas como restaurar solo a quien recibio
// inPlay=false durante el ciclo actual.
export function findAppliedSetPropertyHistory(
  session,
  { cycleId, property, value, targetId = null, stepKey = null, actionKey = null } = {}
) {
  return getActionHistory(session).filter((entry) => {
    if (cycleId !== undefined && entry.cycleId !== cycleId) return false;
    if (stepKey && entry.stepKey !== stepKey) return false;
    if (actionKey && entry.actionKey !== actionKey) return false;
    if (entry.result !== HISTORY_RESULTS.APPLIED && entry.result !== HISTORY_RESULTS.PARTIAL) {
      return false;
    }

    return (entry.finalEffects ?? []).some((effect) => {
      if (effect?.type !== 'set_property') return false;
      if (effect.property !== property) return false;
      if (effect.value !== value) return false;
      if (targetId && effect.targetId !== targetId) return false;
      return true;
    });
  });
}

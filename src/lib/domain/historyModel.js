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

// Crea una entrada normalizada de historial.
//
// La entrada guarda datos mecanicos, no textos visibles. Esto permite que una
// regla futura pregunte cosas como:
// - quien fue afectado en este ciclo?
// - que step lo produjo?
// - hubo efectos finales o la accion fue bloqueada?
export function createActionHistoryEntry({
  id = null,
  cycleId = 0,
  poolKey = null,
  stepKey = null,
  actionKey = null,
  actionId = null,
  actionSignature = null,
  actorRoleInstanceId = null,
  actorScope = null,
  targetRoleInstanceIds = [],
  proposedEffects = [],
  finalEffects = [],
  blockedActions = [],
  blockedEffects = [],
  result = HISTORY_RESULTS.NO_EFFECT,
  metadata = {}
} = {}) {
  return {
    id,
    cycleId,
    poolKey,
    stepKey,
    actionKey,
    actionId,
    actionSignature,
    actorRoleInstanceId,
    actorScope: actorScope ? { ...actorScope } : null,
    targetRoleInstanceIds: [...targetRoleInstanceIds],
    proposedEffects: [...proposedEffects],
    finalEffects: [...finalEffects],
    blockedActions: [...blockedActions],
    blockedEffects: [...blockedEffects],
    result,
    metadata: { ...metadata }
  };
}

// Anade una entrada al historial de acciones de la sesion.
export function appendActionHistory(session, entry) {
  const history = getActionHistory(session);
  const normalizedEntry = createActionHistoryEntry(entry);

  return {
    ...session,
    actionHistory: [
      ...history,
      {
        ...normalizedEntry,
        id:
          normalizedEntry.id ??
          `${normalizedEntry.actionId ?? 'action'}-${normalizedEntry.cycleId}-${history.length}`
      }
    ]
  };
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

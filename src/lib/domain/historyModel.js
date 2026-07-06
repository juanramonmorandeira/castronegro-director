// historyModel.js
// -----------------------------------------------------------------------------
// Este archivo centraliza la memoria mecanica de la sesion.
//
// recipeHistory vive dentro de la sesion porque cada partida tiene su propia
// historia. Este modelo no guarda nada fuera: solo crea, anade y consulta
// entradas de historial de forma consistente.
//
// Objetivo:
// - actionModel resuelve acciones;
// - historyModel registra que ocurrio;
// - otros modelos pueden consultar la sesion sin saber como se construyen las
//   entradas.
// -----------------------------------------------------------------------------

export const HISTORY_RESULTS = Object.freeze({
  APPLIED: 'applied',
  BLOCKED: 'blocked',
  PARTIAL: 'partial',
  NO_EFFECT: 'no_effect',
  FAILED: 'failed'
});

// Devuelve las recipes registradas en la sesion.
//
// No se limpia al iniciar ciclo. Es memoria de partida, no estado temporal.
export function getRecipeHistory(session) {
  return Array.isArray(session?.recipeHistory) ? session.recipeHistory : [];
}

// Construye una firma estable para comparar la action pura ejecutada por una recipe.
//
export function getRecipeHistorySignature(action = {}) {
  const blockedPropertyChange = action?.effect?.blockedPropertyChange;
  if (blockedPropertyChange?.property) {
    return [
      action.id ?? 'unknown',
      blockedPropertyChange.property,
      String(blockedPropertyChange.value)
    ].join('|');
  }

  return action.id ?? 'unknown';
}

// Anade una entrada a una coleccion de historial dentro de la sesion.
//
// Esta es la mecanica comun de escritura. Los modelos concretos siguen
// preparando sus entradas antes de llamar aqui, porque recipeHistory y
// stageHistory no guardan el mismo tipo de hecho.
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

// Anade una entrada al historial de recipes de la sesion.
//
// La entrada guarda datos mecanicos, no textos visibles. Esto permite que una
// regla futura pregunte cosas como:
// - quien fue afectado en este ciclo?
// - que stage lo produjo?
// - hubo efectos finales o la recipe no produjo efecto?
export function appendRecipeHistory(session, entry = {}) {
  const history = getRecipeHistory(session);
  const normalizedEntry = {
    id: entry.id ?? null,
    cycleId: entry.cycleId ?? 0,
    poolKey: entry.poolKey ?? null,
    stageId: entry.stageId ?? null,
    stageKey: entry.stageKey ?? null,
    stageCatalogId: entry.stageCatalogId ?? null,
    recipeKey: entry.recipeKey ?? null,
    actionId: entry.actionId ?? null,
    actionSignature: entry.actionSignature ?? null,
    actorIds: [...(entry.actorIds ?? [])],
    actor: entry.actor ? { ...entry.actor } : null,
    selectorIds: [...(entry.selectorIds ?? [])],
    actorContract: entry.actorContract ? { ...entry.actorContract } : null,
    targetContract: entry.targetContract ? { ...entry.targetContract } : null,
    targetIds: [...(entry.targetIds ?? [])],
    proposedEffects: [...(entry.proposedEffects ?? [])],
    finalEffects: [...(entry.finalEffects ?? [])],
    preventedPropertyChanges: [...(entry.preventedPropertyChanges ?? [])],
    blockedEffects: [...(entry.blockedEffects ?? [])],
    result: entry.result ?? HISTORY_RESULTS.NO_EFFECT,
    metadata: { ...(entry.metadata ?? {}) }
  };

  return appendEntry(session, 'recipeHistory', normalizedEntry, {
    getId: (item) => `${item.actionId ?? 'action'}-${item.cycleId}-${history.length}`
  });
}

// Devuelve entradas que aplicaron un cambio concreto de propiedad en un ciclo.
//
// Esto sera util para mecanicas como restaurar solo a quien recibio
// inPlay=false durante el ciclo actual.
export function findAppliedSetPropertyHistory(
  session,
  {
    cycleId,
    property,
    value,
    targetId = null,
    stageKey = null,
    stageCatalogId = null,
    recipeKey = null
  } = {}
) {
  return getRecipeHistory(session).filter((entry) => {
    if (cycleId !== undefined && entry.cycleId !== cycleId) return false;
    if (stageKey && entry.stageKey !== stageKey) return false;
    if (stageCatalogId && entry.stageCatalogId !== stageCatalogId) return false;
    if (recipeKey && entry.recipeKey !== recipeKey) return false;
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

import { STAGE_STATUSES } from './sessionModel.js';

export const POOL_CURSOR_ERRORS = Object.freeze({
  NO_RUNNABLE_STAGES: 'pool/no-runnable-stages'
});

// poolCursorModel.js
// -----------------------------------------------------------------------------
// Este archivo mueve el cursor de stages.
//
// No sabe que es una bruja, un lobo o una vidente.
// Solo sabe trabajar con:
// - pools: grupos de stages;
// - stages concretos dentro de cada pool;
// - status: enabled, disabled o done.
//
// El orden no depende del nombre del stage. Depende de:
// - poolOrder: orden de pools;
// - orden del array de stages dentro de cada pool.
//
// Esto permite que una skin/flavor cambie el orden declarando otra lista, sin
// que el motor tenga que entender nombres tematicos como vidente, defensor o
// sheriff.
//
// La idea es separar dos preguntas:
// 1. Que stages existen?                    -> definiciones/catalogos
// 2. Cual es el siguiente stage ejecutable? -> este archivo
// -----------------------------------------------------------------------------

// Devuelve los stages que hay dentro de un pool.
//
// Ejemplo:
// getPoolStages(stagePools, 'poolConcealed')
// podria devolver:
// [
//   { key: 'seer_inspects', status: 'enabled' },
//   { key: 'wolves_attack', status: 'enabled' }
// ]
export function getPoolStages(stagePools, poolKey = stagePools?.poolCurrent) {
  if (!stagePools || !poolKey) return [];
  return stagePools.pools?.[poolKey] ?? [];
}

// Devuelve el stage actual segun el cursor.
//
// El cursor se compone de:
// - poolCurrent: en que grupo estamos;
// - poolCurrentStageIndex: que posicion dentro de ese grupo.
export function getCurrentStageCursor(stagePools) {
  if (!stagePools?.poolCurrent) return null;
  const stages = getPoolStages(stagePools, stagePools.poolCurrent);
  const index = Number.isFinite(stagePools.poolCurrentStageIndex)
    ? stagePools.poolCurrentStageIndex
    : 0;
  const stage = stages[index] ?? null;

  if (!stage) return null;

  return {
    poolKey: stagePools.poolCurrent,
    stageKey: stage.key,
    status: stage.status,
    index,
    stage
  };
}

// Un stage es "runnable" si se puede ejecutar.
// Por ahora solo ENABLED significa ejecutable.
// DISABLED se salta.
// DONE ya paso.
export function isStageRunnable(stage) {
  return stage?.status === STAGE_STATUSES.ENABLED;
}

// Responde: "este pool tiene al menos un stage ejecutable?"
export function hasRunnableStage(stagePools, poolKey) {
  return getPoolStages(stagePools, poolKey).some(isStageRunnable);
}

// Busca el siguiente stage ejecutable dentro de una lista de stages.
//
// Devuelve el indice, no el stage.
// Por eso se llama "Index".
//
// Ejemplo:
// [done, disabled, enabled] empezando en 0 devuelve 2.
export function findNextRunnableIndex(stages = [], startIndex = 0) {
  for (let index = startIndex; index < stages.length; index += 1) {
    if (isStageRunnable(stages[index])) return index;
  }
  return null;
}

// Cambia el estado de un stage concreto.
//
// Ejemplo:
// markStageStatus(pools, 'poolDay', 'select', 'done')
//
// No modifica el objeto original. Devuelve una copia actualizada.
export function markStageStatus(stagePools, poolKey, stageKey, status) {
  const pools = { ...(stagePools?.pools ?? {}) };
  const stages = (pools[poolKey] ?? []).map((stage) =>
    stage.key === stageKey ? { ...stage, status } : stage
  );

  return {
    ...stagePools,
    pools: {
      ...pools,
      [poolKey]: stages
    }
  };
}

// Hidratar significa recalcular que stages estan activos segun el estado actual.
//
// Ejemplo:
// - si hay observer en juego, observer_inspects pasa a enabled;
// - si no hay observer en juego, observer_inspects pasa a disabled.
//
// Esta funcion hidrata UN pool.
export function hydrateStagePool(stagePools, poolKey, ruleMap = {}, sessionState = {}) {
  const pools = { ...(stagePools?.pools ?? {}) };
  const stages = (pools[poolKey] ?? []).map((stage) => {
    const rule = ruleMap[stage.key];
    if (typeof rule !== 'function') return stage;
    const enabled = !!rule(sessionState, stage);
    return {
      ...stage,
      status: enabled ? STAGE_STATUSES.ENABLED : STAGE_STATUSES.DISABLED
    };
  });

  return {
    ...stagePools,
    pools: {
      ...pools,
      [poolKey]: stages
    }
  };
}

// Igual que hydrateStagePool, pero para TODOS los pools.
//
// Diferencia:
// - hydrateStagePool: recalcula un grupo concreto.
// - hydrateStagePools: recalcula todos los grupos.
export function hydrateStagePools(stagePools, rulesByPool = {}, sessionState = {}) {
  return (stagePools?.poolOrder ?? []).reduce((nextPools, poolKey) => {
    return hydrateStagePool(nextPools, poolKey, rulesByPool[poolKey] ?? {}, sessionState);
  }, stagePools);
}

// Devuelve la key del siguiente pool segun poolOrder.
//
// "key" aqui significa identificador estable.
// Ejemplo:
// poolCurrent = 'poolConcealed'
// poolOrder = ['poolConcealed', 'poolExposed']
// getNextPoolKey(...) devuelve 'poolExposed'
export function getNextPoolKey(stagePools, fromPoolKey = stagePools?.poolCurrent) {
  const order = stagePools?.poolOrder ?? [];
  if (!order.length) return null;

  const currentIndex = order.indexOf(fromPoolKey);
  if (currentIndex < 0) return order[0] ?? null;

  return order[(currentIndex + 1) % order.length] ?? null;
}

export function enterNextPool(stagePools, nextNormalPoolKey = stagePools?.poolNext) {
  if (!nextNormalPoolKey || !hasRunnableStage(stagePools, nextNormalPoolKey)) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: POOL_CURSOR_ERRORS.NO_RUNNABLE_STAGES,
          poolKey: nextNormalPoolKey,
          message: `pool "${nextNormalPoolKey ?? 'unknown'}" has no runnable stages`
        }
      ],
      stagePools,
      next: null,
      reason: 'next-pool-not-runnable'
    };
  }

  const nextPools = {
    ...stagePools,
    poolPrevious: stagePools.poolCurrent,
    poolCurrent: nextNormalPoolKey,
    poolNext: getNextPoolKey(stagePools, nextNormalPoolKey),
    poolCurrentStageIndex:
      findNextRunnableIndex(getPoolStages(stagePools, nextNormalPoolKey), 0) ?? 0
  };

  return {
    ok: true,
    errors: [],
    stagePools: nextPools,
    next: getCurrentStageCursor(nextPools),
    reason: 'next-pool'
  };
}

// Avanza el cursor de stages.
//
// Pasos:
// 1. Mira el stage actual.
// 2. Si estaba enabled, la marca como done.
// 3. Busca el siguiente stage enabled dentro del mismo pool.
// 4. Si no hay, termina el pool y deja preparada la proxima entrada normal.
// 5. La entrada efectiva se decide despues de ejecutar automaticStages.onExit.
export function advanceStageCursor(stagePools, options = {}) {
  const markCurrentDone = options.markCurrentDone ?? true;
  const current = getCurrentStageCursor(stagePools);

  if (!current) {
    return {
      stagePools,
      current: null,
      next: null,
      changed: false,
      reason: 'missing-current-stage'
    };
  }

  let nextPools = stagePools;

  if (markCurrentDone) {
    nextPools = markStageStatus(
      nextPools,
      current.poolKey,
      current.stageKey,
      STAGE_STATUSES.DONE
    );
  }

  const currentPoolStages = getPoolStages(nextPools, current.poolKey);
  const nextIndex = findNextRunnableIndex(currentPoolStages, current.index + 1);

  if (nextIndex !== null) {
    nextPools = {
      ...nextPools,
      poolPrevious: current.poolKey,
      poolCurrent: current.poolKey,
      poolNext: getNextPoolKey(nextPools, current.poolKey),
      poolCurrentStageIndex: nextIndex
    };

    return {
      stagePools: nextPools,
      current,
      next: getCurrentStageCursor(nextPools),
      changed: true,
      reason: 'next-stage-in-current-pool'
    };
  }

  const nextNormalPoolKey = getNextPoolKey(nextPools, current.poolKey);

  if (!nextNormalPoolKey) {
    return {
      stagePools: nextPools,
      current,
      next: null,
      changed: true,
      reason: 'no-runnable-stage'
    };
  }

  return {
    stagePools: {
      ...nextPools,
      poolNext: nextNormalPoolKey
    },
    current,
    next: null,
    changed: true,
    reason: 'pool-completed'
  };
}

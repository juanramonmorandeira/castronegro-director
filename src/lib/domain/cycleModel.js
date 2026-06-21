// cycleModel.js
// -----------------------------------------------------------------------------
// Administra el ciclo runtime y la navegacion entre sus pools.
// Cada pool conserva su propio cursor de stages; cycle solo decide que pool
// esta activo y cual corresponde ejecutar despues.
// -----------------------------------------------------------------------------

import { DEFAULT_POOL_ORDER } from './sessionModel.js';
import { createPool } from './poolDefinition.js';
import { findNextRunnableIndex, getCurrentStageCursor, hasRunnableStage } from './poolCursorModel.js';

export const CYCLE_ERRORS = Object.freeze({
  NO_RUNNABLE_STAGES: 'cycle/no-runnable-stages'
});

export function createCycle({
  id = 0,
  pools = {},
  poolOrder = DEFAULT_POOL_ORDER,
  poolCurrent = poolOrder[0] ?? null,
  poolPrevious = null,
  poolNext = poolOrder[1] ?? poolOrder[0] ?? null
} = {}) {
  const normalizedOrder = (poolOrder ?? []).map(String);
  const current = normalizedOrder.includes(poolCurrent) ? poolCurrent : normalizedOrder[0] ?? null;
  const normalizedPools = normalizedOrder.reduce((result, poolKey) => {
    const pool = pools?.[poolKey];
    result[poolKey] = Array.isArray(pool)
      ? createPool({ key: poolKey, stages: pool })
      : createPool({ key: poolKey, ...(pool ?? {}) });
    return result;
  }, {});

  return {
    id: Number.isInteger(id) && id >= 0 ? id : 0,
    pools: normalizedPools,
    poolOrder: normalizedOrder,
    poolCurrent: current,
    poolPrevious,
    poolNext: poolNext ?? normalizedOrder[1] ?? normalizedOrder[0] ?? null
  };
}

export function startCycle(cycle = {}) {
  const nextCycle = {
    ...cycle,
    id: (Number.isInteger(cycle.id) ? cycle.id : 0) + 1
  };

  return {
    ok: true,
    cycle: nextCycle,
    changes: [{ property: 'id', from: cycle.id ?? 0, to: nextCycle.id }],
    errors: []
  };
}

export function getCurrentPool(cycle = {}) {
  return cycle.pools?.[cycle.poolCurrent] ?? null;
}

export function getNextPoolKey(cycle = {}, fromPoolKey = cycle.poolCurrent) {
  const order = cycle.poolOrder ?? [];
  if (!order.length) return null;

  const currentIndex = order.indexOf(fromPoolKey);
  if (currentIndex < 0) return order[0] ?? null;
  return order[(currentIndex + 1) % order.length] ?? null;
}

export function getCurrentCycleStage(cycle = {}) {
  const pool = getCurrentPool(cycle);
  const cursor = getCurrentStageCursor(pool);
  return cursor ? { ...cursor, poolKey: cycle.poolCurrent } : null;
}

export function updateCyclePool(cycle = {}, pool = null) {
  if (!pool?.key) return cycle;
  return {
    ...cycle,
    pools: {
      ...(cycle.pools ?? {}),
      [pool.key]: pool
    }
  };
}

export function enterNextPool(cycle = {}, nextPoolKey = cycle.poolNext) {
  const pool = cycle.pools?.[nextPoolKey] ?? null;
  if (!nextPoolKey || !pool || !hasRunnableStage(pool)) {
    return {
      ok: false,
      errors: [
        {
          severity: 'error',
          code: CYCLE_ERRORS.NO_RUNNABLE_STAGES,
          poolKey: nextPoolKey,
          message: `pool "${nextPoolKey ?? 'unknown'}" has no runnable stages`
        }
      ],
      cycle,
      next: null,
      reason: 'next-pool-not-runnable'
    };
  }

  const enteredPool = {
    ...pool,
    currentStageIndex: findNextRunnableIndex(pool.stages, 0) ?? 0
  };
  const nextCycle = {
    ...cycle,
    pools: {
      ...cycle.pools,
      [nextPoolKey]: enteredPool
    },
    poolPrevious: cycle.poolCurrent,
    poolCurrent: nextPoolKey,
    poolNext: getNextPoolKey(cycle, nextPoolKey)
  };

  return {
    ok: true,
    errors: [],
    cycle: nextCycle,
    next: getCurrentCycleStage(nextCycle),
    reason: 'next-pool'
  };
}

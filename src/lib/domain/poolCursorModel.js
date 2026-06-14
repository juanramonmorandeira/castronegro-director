import { POOL_KEYS, SPECIAL_STEP_PRIORITIES, STEP_STATUSES } from './sessionModel.js';

// poolCursorModel.js
// -----------------------------------------------------------------------------
// Este archivo mueve el cursor de steps.
//
// No sabe que es una bruja, un lobo o una vidente.
// Solo sabe trabajar con:
// - pools: grupos de steps;
// - steps concretos dentro de cada pool;
// - status: enabled, disabled o done.
//
// El orden no depende del nombre del step. Depende de:
// - poolOrder: orden de pools;
// - orden del array de steps dentro de cada pool.
//
// Esto permite que una skin/flavor cambie el orden declarando otra lista, sin
// que el motor tenga que entender nombres tematicos como vidente, defensor o
// sheriff.
//
// La idea es separar dos preguntas:
// 1. Que steps existen?                    -> definiciones/catalogos
// 2. Cual es el siguiente step ejecutable? -> este archivo
// -----------------------------------------------------------------------------

// Devuelve los steps que hay dentro de un pool.
//
// Ejemplo:
// getPoolSteps(stepPools, 'poolDeployment')
// podria devolver:
// [
//   { key: 'seer_inspects', status: 'enabled' },
//   { key: 'wolves_attack', status: 'enabled' }
// ]
export function getPoolSteps(stepPools, poolKey = stepPools?.poolCurrent) {
  if (!stepPools || !poolKey) return [];
  return stepPools.pools?.[poolKey] ?? [];
}

function isConcludePlaySpecialStep(step = {}) {
  return step?.metadata?.specialPriority === SPECIAL_STEP_PRIORITIES.CONCLUDE_PLAY;
}

// Devuelve el step actual segun el cursor.
//
// El cursor se compone de:
// - poolCurrent: en que grupo estamos;
// - poolCurrentStepIndex: que posicion dentro de ese grupo.
export function getCurrentStepCursor(stepPools) {
  if (!stepPools?.poolCurrent) return null;
  const steps = getPoolSteps(stepPools, stepPools.poolCurrent);
  const index = Number.isFinite(stepPools.poolCurrentStepIndex)
    ? stepPools.poolCurrentStepIndex
    : 0;
  const priorityIndex =
    stepPools.poolCurrent === POOL_KEYS.POOL_SPECIAL
      ? steps.findIndex((step) => isStepRunnable(step) && isConcludePlaySpecialStep(step))
      : -1;
  const resolvedIndex = priorityIndex >= 0 ? priorityIndex : index;
  const step = steps[resolvedIndex] ?? null;

  if (!step) return null;

  return {
    poolKey: stepPools.poolCurrent,
    stepKey: step.key,
    status: step.status,
    index: resolvedIndex,
    step
  };
}

// Un step es "runnable" si se puede ejecutar.
// Por ahora solo ENABLED significa ejecutable.
// DISABLED se salta.
// DONE ya paso.
export function isStepRunnable(step) {
  return step?.status === STEP_STATUSES.ENABLED;
}

// Responde: "este pool tiene al menos un step ejecutable?"
export function hasRunnableStep(stepPools, poolKey) {
  return getPoolSteps(stepPools, poolKey).some(isStepRunnable);
}

// Busca el siguiente step ejecutable dentro de una lista de steps.
//
// Devuelve el indice, no el step.
// Por eso se llama "Index".
//
// Ejemplo:
// [done, disabled, enabled] empezando en 0 devuelve 2.
export function findNextRunnableIndex(steps = [], startIndex = 0) {
  for (let index = startIndex; index < steps.length; index += 1) {
    if (isStepRunnable(steps[index])) return index;
  }
  return null;
}

// Cambia el estado de un step concreto.
//
// Ejemplo:
// markStepStatus(pools, 'poolDay', 'select', 'done')
//
// No modifica el objeto original. Devuelve una copia actualizada.
export function markStepStatus(stepPools, poolKey, stepKey, status) {
  const pools = { ...(stepPools?.pools ?? {}) };
  const steps = (pools[poolKey] ?? []).map((step) =>
    step.key === stepKey ? { ...step, status } : step
  );

  return {
    ...stepPools,
    pools: {
      ...pools,
      [poolKey]: steps
    }
  };
}

// Hidratar significa recalcular que steps estan activos segun el estado actual.
//
// Ejemplo:
// - si hay observer en juego, observer_inspects pasa a enabled;
// - si no hay observer en juego, observer_inspects pasa a disabled.
//
// Esta funcion hidrata UN pool.
export function hydrateStepPool(stepPools, poolKey, ruleMap = {}, sessionState = {}) {
  const pools = { ...(stepPools?.pools ?? {}) };
  const steps = (pools[poolKey] ?? []).map((step) => {
    const rule = ruleMap[step.key];
    if (typeof rule !== 'function') return step;
    const enabled = !!rule(sessionState, step);
    return {
      ...step,
      status: enabled ? STEP_STATUSES.ENABLED : STEP_STATUSES.DISABLED
    };
  });

  return {
    ...stepPools,
    pools: {
      ...pools,
      [poolKey]: steps
    }
  };
}

// Igual que hydrateStepPool, pero para TODOS los pools.
//
// Diferencia:
// - hydrateStepPool: recalcula un grupo concreto.
// - hydrateStepPools: recalcula todos los grupos.
export function hydrateStepPools(stepPools, rulesByPool = {}, sessionState = {}) {
  return (stepPools?.poolOrder ?? []).reduce((nextPools, poolKey) => {
    return hydrateStepPool(nextPools, poolKey, rulesByPool[poolKey] ?? {}, sessionState);
  }, stepPools);
}

// Devuelve la key del siguiente pool segun poolOrder.
//
// "key" aqui significa identificador estable.
// Ejemplo:
// poolCurrent = 'poolDeployment'
// poolOrder = ['poolDeployment', 'poolConcealed', 'poolExposed']
// getNextPoolKey(...) devuelve 'poolExposed'
export function getNextPoolKey(stepPools, fromPoolKey = stepPools?.poolCurrent) {
  const order = stepPools?.poolOrder ?? [];
  if (!order.length) return null;

  const currentIndex = order.indexOf(fromPoolKey);
  if (currentIndex < 0) return order[0] ?? null;

  return order[(currentIndex + 1) % order.length] ?? null;
}

// Busca el siguiente pool que tenga algun step ejecutable.
//
// Diferencia con findNextRunnableIndex:
// - findNextRunnableIndex busca dentro de UN pool.
// - findNextPoolWithRunnableStep busca ENTRE pools.
export function findNextPoolWithRunnableStep(stepPools, fromPoolKey = stepPools?.poolCurrent) {
  const order = stepPools?.poolOrder ?? [];
  if (!order.length) return null;

  const startIndex = Math.max(0, order.indexOf(fromPoolKey));

  for (let offset = 1; offset <= order.length; offset += 1) {
    const poolKey = order[(startIndex + offset) % order.length];
    if (hasRunnableStep(stepPools, poolKey)) return poolKey;
  }

  return null;
}

// Avanza el cursor de steps.
//
// Pasos:
// 1. Mira el step actual.
// 2. Si estaba enabled, la marca como done.
// 3. Busca el siguiente step enabled dentro del mismo pool.
// 4. Si no hay, busca el siguiente pool con algun step enabled.
// 5. Devuelve el nuevo stepPools y una explicacion corta en "reason".
export function advanceStepCursor(stepPools, options = {}) {
  const markCurrentDone = options.markCurrentDone ?? true;
  const current = getCurrentStepCursor(stepPools);

  if (!current) {
    return {
      stepPools,
      current: null,
      next: null,
      changed: false,
      reason: 'missing-current-step'
    };
  }

  let nextPools = stepPools;

  if (markCurrentDone) {
    nextPools = markStepStatus(
      nextPools,
      current.poolKey,
      current.stepKey,
      STEP_STATUSES.DONE
    );
  }

  const currentPoolSteps = getPoolSteps(nextPools, current.poolKey);
  const nextIndex = findNextRunnableIndex(currentPoolSteps, current.index + 1);

  if (nextIndex !== null) {
    nextPools = {
      ...nextPools,
      poolPrevious: current.poolKey,
      poolCurrent: current.poolKey,
      poolNext: getNextPoolKey(nextPools, current.poolKey),
      poolCurrentStepIndex: nextIndex
    };

    return {
      stepPools: nextPools,
      current,
      next: getCurrentStepCursor(nextPools),
      changed: true,
      reason: 'next-step-in-current-pool'
    };
  }

  const nextPoolKey = findNextPoolWithRunnableStep(nextPools, current.poolKey);

  if (!nextPoolKey) {
    return {
      stepPools: nextPools,
      current,
      next: null,
      changed: true,
      reason: 'no-runnable-step'
    };
  }

  nextPools = {
    ...nextPools,
    poolPrevious: current.poolKey,
    poolCurrent: nextPoolKey,
    poolNext: getNextPoolKey(nextPools, nextPoolKey),
    poolCurrentStepIndex: findNextRunnableIndex(getPoolSteps(nextPools, nextPoolKey), 0) ?? 0
  };

  return {
    stepPools: nextPools,
    current,
    next: getCurrentStepCursor(nextPools),
    changed: true,
    reason: 'next-pool'
  };
}

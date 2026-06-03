import { PHASE_STATUSES, createPhasePools, createPhaseStep } from './sessionModel.js';

// phaseModel.js
// -----------------------------------------------------------------------------
// Este archivo mueve el cursor de fases.
//
// No sabe que es una bruja, un lobo o una vidente.
// Solo sabe trabajar con:
// - pools: grupos de fases;
// - steps: fases concretas dentro de cada pool;
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
// 1. Que fases existen?                  -> definicion de fases
// 2. Cual es la siguiente fase ejecutable? -> este archivo
// -----------------------------------------------------------------------------

// Devuelve los pasos/fases que hay dentro de un pool.
//
// Ejemplo:
// getPoolSteps(phasePools, 'poolDeployment')
// podria devolver:
// [
//   { key: 'seer_inspects', status: 'enabled' },
//   { key: 'wolves_attack', status: 'enabled' }
// ]
export function getPoolSteps(phasePools, poolKey = phasePools?.poolCurrent) {
  if (!phasePools || !poolKey) return [];
  return phasePools.pools?.[poolKey] ?? [];
}

// Devuelve la fase actual segun el cursor.
//
// El cursor se compone de:
// - poolCurrent: en que grupo estamos;
// - poolCurrentPhaseIndex: que posicion dentro de ese grupo.
export function getCurrentPhase(phasePools) {
  if (!phasePools?.poolCurrent) return null;
  const steps = getPoolSteps(phasePools, phasePools.poolCurrent);
  const index = Number.isFinite(phasePools.poolCurrentPhaseIndex)
    ? phasePools.poolCurrentPhaseIndex
    : 0;
  const step = steps[index] ?? null;

  if (!step) return null;

  return {
    poolKey: phasePools.poolCurrent,
    phaseKey: step.key,
    status: step.status,
    index,
    step
  };
}

// Una fase es "runnable" si se puede ejecutar.
// Por ahora solo ENABLED significa ejecutable.
// DISABLED se salta.
// DONE ya paso.
export function isPhaseRunnable(step) {
  return step?.status === PHASE_STATUSES.ENABLED;
}

// Responde: "este pool tiene al menos una fase ejecutable?"
export function hasRunnablePhase(phasePools, poolKey) {
  return getPoolSteps(phasePools, poolKey).some(isPhaseRunnable);
}

// Busca la siguiente fase ejecutable dentro de una lista de fases.
//
// Devuelve el indice, no la fase.
// Por eso se llama "Index".
//
// Ejemplo:
// [done, disabled, enabled] empezando en 0 devuelve 2.
export function findNextRunnableIndex(steps = [], startIndex = 0) {
  for (let index = startIndex; index < steps.length; index += 1) {
    if (isPhaseRunnable(steps[index])) return index;
  }
  return null;
}

// Cambia el estado de una fase concreta.
//
// Ejemplo:
// markPhaseStatus(pools, 'poolDay', 'vote', 'done')
//
// No modifica el objeto original. Devuelve una copia actualizada.
export function markPhaseStatus(phasePools, poolKey, phaseKey, status) {
  const pools = { ...(phasePools?.pools ?? {}) };
  const steps = (pools[poolKey] ?? []).map((step) =>
    step.key === phaseKey ? { ...step, status } : step
  );

  return {
    ...phasePools,
    pools: {
      ...pools,
      [poolKey]: steps
    }
  };
}

// Hidratar significa recalcular que fases estan activas segun el estado actual.
//
// Ejemplo:
// - si hay observer en juego, observer_inspects pasa a enabled;
// - si no hay observer en juego, observer_inspects pasa a disabled.
//
// Esta funcion hidrata UN pool.
export function hydratePhasePool(phasePools, poolKey, ruleMap = {}, sessionState = {}) {
  const pools = { ...(phasePools?.pools ?? {}) };
  const steps = (pools[poolKey] ?? []).map((step) => {
    const rule = ruleMap[step.key];
    if (typeof rule !== 'function') return step;
    const enabled = !!rule(sessionState, step);
    return {
      ...step,
      status: enabled ? PHASE_STATUSES.ENABLED : PHASE_STATUSES.DISABLED
    };
  });

  return {
    ...phasePools,
    pools: {
      ...pools,
      [poolKey]: steps
    }
  };
}

// Igual que hydratePhasePool, pero para TODOS los pools.
//
// Diferencia:
// - hydratePhasePool: recalcula un grupo concreto.
// - hydratePhasePools: recalcula todos los grupos.
export function hydratePhasePools(phasePools, rulesByPool = {}, sessionState = {}) {
  return (phasePools?.poolOrder ?? []).reduce((nextPools, poolKey) => {
    return hydratePhasePool(nextPools, poolKey, rulesByPool[poolKey] ?? {}, sessionState);
  }, phasePools);
}

// Devuelve la key del siguiente pool segun poolOrder.
//
// "key" aqui significa identificador estable.
// Ejemplo:
// poolCurrent = 'poolDeployment'
// poolOrder = ['poolDeployment', 'poolConcealed', 'poolExposed']
// getNextPoolKey(...) devuelve 'poolExposed'
export function getNextPoolKey(phasePools, fromPoolKey = phasePools?.poolCurrent) {
  const order = phasePools?.poolOrder ?? [];
  if (!order.length) return null;

  const currentIndex = order.indexOf(fromPoolKey);
  if (currentIndex < 0) return order[0] ?? null;

  return order[(currentIndex + 1) % order.length] ?? null;
}

// Busca el siguiente pool que tenga alguna fase ejecutable.
//
// Diferencia con findNextRunnableIndex:
// - findNextRunnableIndex busca dentro de UN pool.
// - findNextPoolWithRunnablePhase busca ENTRE pools.
export function findNextPoolWithRunnablePhase(phasePools, fromPoolKey = phasePools?.poolCurrent) {
  const order = phasePools?.poolOrder ?? [];
  if (!order.length) return null;

  const startIndex = Math.max(0, order.indexOf(fromPoolKey));

  for (let offset = 1; offset <= order.length; offset += 1) {
    const poolKey = order[(startIndex + offset) % order.length];
    if (hasRunnablePhase(phasePools, poolKey)) return poolKey;
  }

  return null;
}

// Avanza el cursor de fases.
//
// Pasos:
// 1. Mira la fase actual.
// 2. Si estaba enabled, la marca como done.
// 3. Busca la siguiente fase enabled dentro del mismo pool.
// 4. Si no hay, busca el siguiente pool con alguna fase enabled.
// 5. Devuelve el nuevo phasePools y una explicacion corta en "reason".
export function advancePhaseCursor(phasePools, options = {}) {
  const markCurrentDone = options.markCurrentDone ?? true;
  const current = getCurrentPhase(phasePools);

  if (!current) {
    return {
      phasePools,
      current: null,
      next: null,
      changed: false,
      reason: 'missing-current-phase'
    };
  }

  let nextPools = phasePools;

  if (markCurrentDone) {
    nextPools = markPhaseStatus(
      nextPools,
      current.poolKey,
      current.phaseKey,
      PHASE_STATUSES.DONE
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
      poolCurrentPhaseIndex: nextIndex
    };

    return {
      phasePools: nextPools,
      current,
      next: getCurrentPhase(nextPools),
      changed: true,
      reason: 'next-phase-in-current-pool'
    };
  }

  const nextPoolKey = findNextPoolWithRunnablePhase(nextPools, current.poolKey);

  if (!nextPoolKey) {
    return {
      phasePools: nextPools,
      current,
      next: null,
      changed: true,
      reason: 'no-runnable-phase'
    };
  }

  nextPools = {
    ...nextPools,
    poolPrevious: current.poolKey,
    poolCurrent: nextPoolKey,
    poolNext: getNextPoolKey(nextPools, nextPoolKey),
    poolCurrentPhaseIndex: findNextRunnableIndex(getPoolSteps(nextPools, nextPoolKey), 0) ?? 0
  };

  return {
    phasePools: nextPools,
    current,
    next: getCurrentPhase(nextPools),
    changed: true,
    reason: 'next-pool'
  };
}

// Crea phasePools desde una definicion legible.
//
// Esta funcion es una comodidad para no tener que escribir a mano toda la
// estructura interna de createPhasePools.
//
// createPhasePools: crea el contenedor tecnico.
// createPhasePoolsFromDefinition: acepta una definicion mas comoda para humanos.
export function createPhasePoolsFromDefinition(definition = {}) {
  const poolOrder = definition.poolOrder ?? Object.keys(definition.pools ?? {});
  const pools = poolOrder.reduce((acc, poolKey) => {
    acc[poolKey] = (definition.pools?.[poolKey] ?? []).map((step) =>
      createPhaseStep(typeof step === 'string' ? { key: step } : step)
    );
    return acc;
  }, {});

  return createPhasePools({
    poolOrder,
    poolCurrent: definition.poolCurrent ?? poolOrder[0],
    poolPrevious: definition.poolPrevious ?? null,
    poolNext: definition.poolNext ?? poolOrder[1] ?? null,
    poolCurrentPhaseIndex: definition.poolCurrentPhaseIndex ?? 0,
    pools
  });
}

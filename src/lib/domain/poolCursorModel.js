import { STAGE_STATUSES } from './sessionModel.js';

// poolCursorModel.js
// -----------------------------------------------------------------------------
// Este archivo mueve el cursor de stages dentro de un unico pool.
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
// Esto permite que un ruleSet cambie el orden declarando otra lista, sin
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
// getPoolStages(pool)
// podria devolver:
// [
//   { key: 'seer_inspects', status: 'enabled' },
//   { key: 'wolves_attack', status: 'enabled' }
// ]
export function getPoolStages(pool = {}) {
  return pool.stages ?? [];
}

// Devuelve el stage actual segun el cursor.
//
// currentStageIndex indica la posicion dentro del pool.
export function getCurrentStageCursor(pool = {}) {
  const stages = getPoolStages(pool);
  const index = Number.isFinite(pool.currentStageIndex)
    ? pool.currentStageIndex
    : 0;
  const stage = stages[index] ?? null;

  if (!stage) return null;

  return {
    poolKey: pool.key ?? null,
    stageId: stage.id,
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
export function hasRunnableStage(pool = {}) {
  return getPoolStages(pool).some(isStageRunnable);
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
export function markStageStatus(pool = {}, stageId, status) {
  const stages = getPoolStages(pool).map((stage) =>
    stage.id === stageId ? { ...stage, status } : stage
  );

  return {
    ...pool,
    stages
  };
}

// Avanza el cursor de stages.
//
// Pasos:
// 1. Mira el stage actual.
// 2. Si estaba enabled, la marca como done.
// 3. Busca el siguiente stage enabled dentro del mismo pool.
// 4. Si no hay, termina el pool y deja preparada la proxima entrada normal.
// 5. La entrada efectiva se decide despues de completar pool.onExit.
export function advanceStageCursor(pool = {}, options = {}) {
  const markCurrentDone = options.markCurrentDone ?? true;
  const current = getCurrentStageCursor(pool);

  if (!current) {
    return {
      pool,
      current: null,
      next: null,
      changed: false,
      reason: 'missing-current-stage'
    };
  }

  let nextPool = pool;

  if (markCurrentDone) {
    nextPool = markStageStatus(
      nextPool,
      current.stageId,
      STAGE_STATUSES.DONE
    );
  }

  const currentPoolStages = getPoolStages(nextPool);
  const nextIndex = findNextRunnableIndex(currentPoolStages, current.index + 1);

  if (nextIndex !== null) {
    nextPool = {
      ...nextPool,
      currentStageIndex: nextIndex
    };

    return {
      pool: nextPool,
      current,
      next: getCurrentStageCursor(nextPool),
      changed: true,
      reason: 'next-stage-in-current-pool'
    };
  }

  return {
    pool: nextPool,
    current,
    next: null,
    changed: true,
    reason: 'pool-completed'
  };
}

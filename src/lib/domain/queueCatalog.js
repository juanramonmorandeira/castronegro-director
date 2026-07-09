// queueCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de queues mecanicas que el ciclo ejecuta alrededor de cada pool.
//
// queueDefinition define la forma valida.
// queueModel administra la FIFO runtime.
// Este archivo declara las queues conocidas por el flujo base.
// -----------------------------------------------------------------------------

import { DEFAULT_POOL_ORDER, POOL_KEYS } from './poolCatalog.js';

export const QUEUE_TIMINGS = Object.freeze({
  BEFORE: 'before',
  AFTER: 'after'
});

function toPascalCase(value = '') {
  return String(value ?? '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('');
}

export function getBeforeQueueKey(poolKey = '') {
  return `queueBefore${toPascalCase(poolKey)}`;
}

export function getAfterQueueKey(poolKey = '') {
  return `queueAfter${toPascalCase(poolKey)}`;
}

export function getPoolQueueKeys(poolKey = '') {
  return {
    before: getBeforeQueueKey(poolKey),
    after: getAfterQueueKey(poolKey)
  };
}

export const QUEUE_KEYS = Object.freeze({
  QUEUE_BEFORE_CONCEALED: getBeforeQueueKey(POOL_KEYS.POOL_CONCEALED),
  QUEUE_AFTER_CONCEALED: getAfterQueueKey(POOL_KEYS.POOL_CONCEALED),
  QUEUE_BEFORE_EXPOSED: getBeforeQueueKey(POOL_KEYS.POOL_EXPOSED),
  QUEUE_AFTER_EXPOSED: getAfterQueueKey(POOL_KEYS.POOL_EXPOSED)
});

export function createQueueOrder(poolOrder = DEFAULT_POOL_ORDER) {
  return (poolOrder ?? []).flatMap((poolKey) => [
    getBeforeQueueKey(poolKey),
    getAfterQueueKey(poolKey)
  ]);
}

export const DEFAULT_QUEUE_ORDER = Object.freeze(createQueueOrder(DEFAULT_POOL_ORDER));

export function createQueueCatalog(poolOrder = DEFAULT_POOL_ORDER) {
  return Object.freeze(
    Object.fromEntries(
      (poolOrder ?? []).flatMap((poolKey) => [
        [
          getBeforeQueueKey(poolKey),
          Object.freeze({
            key: getBeforeQueueKey(poolKey),
            poolKey,
            timing: QUEUE_TIMINGS.BEFORE
          })
        ],
        [
          getAfterQueueKey(poolKey),
          Object.freeze({
            key: getAfterQueueKey(poolKey),
            poolKey,
            timing: QUEUE_TIMINGS.AFTER
          })
        ]
      ])
    )
  );
}

export const QUEUE_CATALOG = createQueueCatalog(DEFAULT_POOL_ORDER);

export function getCatalogQueue(queueKey, poolOrder = DEFAULT_POOL_ORDER) {
  return QUEUE_CATALOG[queueKey] ?? createQueueCatalog(poolOrder)[queueKey] ?? null;
}

export function isValidQueueKey(queueKey, queueOrder = DEFAULT_QUEUE_ORDER) {
  return (queueOrder ?? DEFAULT_QUEUE_ORDER).includes(queueKey);
}

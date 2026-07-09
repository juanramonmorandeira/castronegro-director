// queueCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de queues mecanicas que el ciclo ejecuta entre pools.
//
// queueDefinition define la forma valida.
// queueModel administra la FIFO runtime.
// Este archivo declara las queues conocidas por el flujo base.
// -----------------------------------------------------------------------------

export const QUEUE_KEYS = Object.freeze({
  QUEUE_BEFORE_CONCEALED: 'queueBeforeConcealed',
  QUEUE_AFTER_CONCEALED: 'queueAfterConcealed',
  QUEUE_BEFORE_EXPOSED: 'queueBeforeExposed',
  QUEUE_AFTER_EXPOSED: 'queueAfterExposed'
});

export const QUEUE_CATALOG = Object.freeze({
  [QUEUE_KEYS.QUEUE_BEFORE_CONCEALED]: Object.freeze({
    key: QUEUE_KEYS.QUEUE_BEFORE_CONCEALED
  }),
  [QUEUE_KEYS.QUEUE_AFTER_CONCEALED]: Object.freeze({
    key: QUEUE_KEYS.QUEUE_AFTER_CONCEALED
  }),
  [QUEUE_KEYS.QUEUE_BEFORE_EXPOSED]: Object.freeze({
    key: QUEUE_KEYS.QUEUE_BEFORE_EXPOSED
  }),
  [QUEUE_KEYS.QUEUE_AFTER_EXPOSED]: Object.freeze({
    key: QUEUE_KEYS.QUEUE_AFTER_EXPOSED
  })
});

export const DEFAULT_QUEUE_ORDER = Object.freeze([
  QUEUE_KEYS.QUEUE_BEFORE_CONCEALED,
  QUEUE_KEYS.QUEUE_AFTER_CONCEALED,
  QUEUE_KEYS.QUEUE_BEFORE_EXPOSED,
  QUEUE_KEYS.QUEUE_AFTER_EXPOSED
]);

export function getCatalogQueue(queueKey) {
  return QUEUE_CATALOG[queueKey] ?? null;
}

export function isValidQueueKey(queueKey) {
  return Object.values(QUEUE_KEYS).includes(queueKey);
}

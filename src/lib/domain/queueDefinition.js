// queueDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario compartido para queue.
//
// Una queueStage es un stage runtime encolado por eventos o peticiones fuera
// del flujo normal de pools. Este archivo no encola ni ejecuta nada.
// -----------------------------------------------------------------------------

export const QUEUE_HISTORY_OPERATIONS = Object.freeze({
  QUEUED: 'queued',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  FAILED: 'failed'
});

export const QUEUE_ERRORS = Object.freeze({
  INVALID_QUEUE_KEY: 'queue/invalid-queue-key',
  MISSING_QUEUE_KEY: 'queue/missing-queue-key'
});

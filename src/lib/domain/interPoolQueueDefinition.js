// interPoolQueueDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario compartido para interPoolQueue.
//
// Una interPoolStage es un stage runtime encolado por eventos o peticiones fuera
// del flujo normal de pools. Este archivo no encola ni ejecuta nada.
// -----------------------------------------------------------------------------

export const INTER_POOL_QUEUE_HISTORY_OPERATIONS = Object.freeze({
  QUEUED: 'queued',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  FAILED: 'failed'
});

export const INTER_POOL_QUEUE_EVENT_WINDOWS = Object.freeze({
  BEFORE_CONCEALED: 'before_concealed',
  AFTER_CONCEALED: 'after_concealed',
  BEFORE_EXPOSED: 'before_exposed',
  AFTER_EXPOSED: 'after_exposed'
});

export const INTER_POOL_QUEUE_ERRORS = Object.freeze({
  INVALID_EVENT_WINDOW: 'inter-pool-queue/invalid-event-window',
  MISSING_EVENT_WINDOW: 'inter-pool-queue/missing-event-window'
});

export function isValidInterPoolQueueEventWindow(eventWindow) {
  return Object.values(INTER_POOL_QUEUE_EVENT_WINDOWS).includes(eventWindow);
}

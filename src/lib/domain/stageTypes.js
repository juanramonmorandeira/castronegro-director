// stageTypes.js
// -----------------------------------------------------------------------------
// Vocabulario compartido de stage que otros modelos pueden importar sin crear
// ciclos con stageModel.
// -----------------------------------------------------------------------------

export const STAGE_COMPLETION_MODES = Object.freeze({
  MANUAL: 'manual',
  AUTOMATIC: 'automatic'
});

export const STAGE_COMPLETION_REQUESTED_BY = Object.freeze({
  PLAYER: 'player',
  DIRECTOR: 'director',
  SYSTEM: 'system'
});

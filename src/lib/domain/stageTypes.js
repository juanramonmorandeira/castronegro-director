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

export const LINKED_PROPAGATED_EFFECT_STAGE = Object.freeze({
  KEY: 'stage_linked_propagated_effect',
  CATALOG_ID: 'linked_propagated_effect',
  ACTION_KEY: 'linked_propagated_effect'
});

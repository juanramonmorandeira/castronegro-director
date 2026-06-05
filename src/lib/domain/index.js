// index.js
// -----------------------------------------------------------------------------
// Puerta publica del nucleo de dominio.
//
// Este archivo no ejecuta nada ni exporta automaticamente todos los helpers
// internos. Solo reexporta las piezas que otros modulos deberian usar para
// construir sesiones, organizar pools, ejecutar steps y consultar resultados.
// -----------------------------------------------------------------------------

export {
  SESSION_STATUSES,
  PLAYER_TYPES,
  STEP_STATUSES,
  POOL_KEYS,
  DEFAULT_POOL_ORDER,
  RELATION_TYPES,
  normalizeId,
  findRelationsForRole,
  hasRelation,
  getRelatedRoleIds
} from './sessionModel.js';

export { createPlayer } from './playerDefinition.js';
export { createActionToken } from './actionTokenDefinition.js';
export { createRelation } from './relationDefinition.js';
export {
  CONFIGURABLE_STEP_ORDER_POOLS,
  POOL_DEFINITION_ORDER_FIELD,
  POOL_DEFINITION_ERRORS,
  buildStepPool,
  buildPools,
  createPool,
  organizePoolSteps
} from './poolDefinition.js';
export { buildSession, createSession } from './sessionDefinition.js';
export {
  isMatchComplete,
  validateGroups,
  validateUniqueIds,
  validateRoles,
  validateRelations,
  validateSession
} from './sessionValidation.js';

export {
  HISTORY_RESULTS,
  getActionHistory,
  getActionHistorySignature,
  appendEntry,
  appendActionHistory,
  findAppliedSetPropertyHistory
} from './historyModel.js';

export {
  ROLE_DEFINITION_TYPES,
  buildRolesFromSeats,
  createRole,
  createSessionRole
} from './roleDefinition.js';
export {
  ROLE_CATALOG_IDS,
  ROLE_CATALOG,
  getCatalogRole,
  getCoreRoleCatalog
} from './roleCatalog.js';
export {
  GROUP_MEMBERSHIP_RULE_TYPES,
  createGroup
} from './groupDefinition.js';
export {
  addRoleToGroup,
  buildInitialGroups,
  getGroup,
  getGroupRoleIds,
  getGroupRoles,
  removeRoleFromGroup,
  resolveMembershipRuleRoleIds
} from './groupModel.js';
export {
  GROUP_CATALOG_IDS,
  GROUP_CATALOG,
  getCatalogGroup,
  getCoreGroupCatalog
} from './groupCatalog.js';

export { STEP_SOURCE_TYPES, createStep } from './stepDefinition.js';
export {
  STEP_CATALOG_IDS,
  STEP_CATALOG,
  getManualCompletion,
  getCatalogStep
} from './stepCatalog.js';
export {
  getPoolSteps,
  getCurrentStepCursor,
  isStepRunnable,
  hasRunnableStep,
  findNextRunnableIndex,
  markStepStatus,
  hydrateStepPool,
  hydrateStepPools,
  getNextPoolKey,
  findNextPoolWithRunnableStep,
  advanceStepCursor
} from './poolCursorModel.js';
export {
  STEP_ERRORS,
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY,
  STEP_KEYS,
  STEP_ACTION_KEYS,
  getCurrentStep,
  getStepActions,
  getStepActionKey,
  selectStepAction,
  validateCurrentStep,
  isValidStepCompletionRequester,
  getStepCompletionDefinition,
  canRequesterCompleteStep,
  appendStepHistory,
  completeCurrentStep,
  resolveCurrentStep
} from './stepModel.js';

export { RECIPE_KEYS, RECIPE_CATALOG, getCatalogRecipe } from './recipeCatalog.js';
export {
  getRecipeKey,
  createRecipe,
  getActionFromRecipe,
  getRecipeActorAndTargets,
  getRecipeConstraints,
  validateRecipeConstraints,
  resolveRecipe
} from './recipeModel.js';
export {
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  createConstraint,
  evaluateRecipeConstraints
} from './constraintModel.js';

export {
  EFFECT_TYPES,
  getCurrentCycleId,
  advanceSessionCycle,
  getActionBlockKey,
  hasActionBlock,
  clearCycleFlags,
  applySetPropertyEffect,
  applySetRelationEffect,
  applyCloseCycle
} from './effectModel.js';
export { resolveProposedEffects } from './resolverModel.js';
export {
  ACTION_IDS,
  VISIBILITY,
  findRole,
  validateActionTargets,
  validateActionDefinition,
  validateActionResolution,
  resolveAction
} from './actionModel.js';

export {
  VICTORY_STATUSES,
  VICTORY_TYPES,
  VICTORY_RULE_TYPES,
  getInPlayRoles,
  getRoleAlignmentId,
  getAlignmentIds,
  getAlignmentVictoryRules,
  getInPlayRolesByAlignment,
  getOngoingVictoryResult,
  evaluateAlignmentVictoryRules,
  evaluateLinkedVictory,
  evaluateSingleAlignmentVictory,
  evaluateVictory
} from './victoryModel.js';
export {
  VOTE_OUTCOME_TYPES,
  VOTE_ABSTAIN_RULES,
  VOTE_UNANIMOUS_RULES,
  VOTE_TIE_RULES,
  VOTE_ROUND_TYPES,
  VOTE_REQUIRED_RULES,
  VOTE_RESTRICTION_TYPES,
  createVote,
  createVoteRules,
  getDefaultVoteCandidateIds,
  validateVotes,
  tallyVotes,
  resolveVoteRound
} from './voteModel.js';

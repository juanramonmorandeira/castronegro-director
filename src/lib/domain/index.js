// index.js
// -----------------------------------------------------------------------------
// Puerta publica del nucleo de dominio.
//
// Este archivo no ejecuta nada ni exporta automaticamente todos los helpers
// internos. Solo reexporta las piezas que otros modulos deberian usar para
// construir sesiones, organizar pools, ejecutar stages y consultar resultados.
// -----------------------------------------------------------------------------

export {
  SESSION_STATUSES,
  PLAYER_TYPES,
  STAGE_STATUSES,
  POOL_KEYS,
  DEFAULT_POOL_ORDER,
  normalizeId
} from './sessionModel.js';

export { createPlayer } from './playerDefinition.js';
export { createActionToken } from './actionTokenDefinition.js';
export {
  CONFIGURABLE_STAGE_ORDER_POOLS,
  AUTOMATIC_STAGE_KEYS,
  POOL_DEFINITION_ORDER_FIELD,
  POOL_DEFINITION_ERRORS,
  buildStagePool,
  buildPools,
  createPool,
  organizePoolStages
} from './poolDefinition.js';
export { buildSession, createSession } from './sessionDefinition.js';
export {
  isMatchComplete,
  validateGroups,
  validateUniqueIds,
  validateRoles,
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
  GROUP_TYPES,
  GROUP_MEMBERSHIP_RULE_TYPES,
  createGroup
} from './groupDefinition.js';
export {
  addRoleToGroup,
  buildInitialGroups,
  findGroupsForRole,
  getGroup,
  getGroupMemberRoleIds,
  getGroupRoleIds,
  getGroupRoles,
  hasGroupMembership,
  removeRoleFromGroup,
  resolveMembershipRuleRoleIds
} from './groupModel.js';
export {
  GROUP_CATALOG_IDS,
  GROUP_CATALOG,
  getCatalogGroup,
  getCoreGroupCatalog
} from './groupCatalog.js';

export { STAGE_SOURCE_TYPES, createStage } from './stageDefinition.js';
export {
  STAGE_CATALOG_IDS,
  STAGE_CATALOG,
  getManualCompletion,
  getCatalogStage
} from './stageCatalog.js';
export {
  getPoolStages,
  getCurrentStageCursor,
  isStageRunnable,
  hasRunnableStage,
  findNextRunnableIndex,
  markStageStatus,
  hydrateStagePool,
  hydrateStagePools,
  POOL_CURSOR_ERRORS,
  getNextPoolKey,
  enterNextPool,
  advanceStageCursor
} from './poolCursorModel.js';
export {
  STAGE_ERRORS,
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  STAGE_KEYS,
  STAGE_ACTION_KEYS,
  getCurrentStage,
  getStageActions,
  getStageActionKey,
  selectStageAction,
  validateCurrentStage,
  isValidStageCompletionRequester,
  getStageCompletionDefinition,
  canRequesterCompleteStage,
  appendStageHistory,
  completeCurrentStage,
  resolveCurrentStage
} from './stageModel.js';
export {
  SPECIAL_STAGE_HISTORY_OPERATIONS,
  getSpecialStages,
  hasPendingSpecialStages,
  getCurrentSpecialStage,
  appendSpecialStagesHistory,
  appendSpecialStage,
  activateSpecialStages,
  completeSpecialStage
} from './specialStagesModel.js';

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
  applySetGroupEffect,
  applyStartCycle,
  applyConcludePlay
} from './effectModel.js';
export {
  EVENT_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_RESPONSE_TYPES,
  getEventsFromActionResult,
  getTriggeredReactions,
  resolveEventResponses,
  applyEventResponses,
  processActionResultEvents
} from './eventModel.js';
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
  OBJECTIVE_EVALUATION_STATUSES,
  OBJECTIVE_CONDITIONS,
  INFLUENCE_SUBJECTS,
  INFLUENCE_OPERATIONS,
  getSessionObjectiveRules,
  getObjectiveRuleDependencies,
  getActionInfluences,
  getStageInfluences,
  isStagePendingForObjectiveStability,
  canStageInfluenceObjectiveOutcome,
  getPendingObjectiveInfluenceStages,
  createOngoingObjectiveEvaluation,
  evaluateObjectiveRule,
  evaluateSessionObjectiveRules,
  checkObjectives
} from './objectiveModel.js';
export {
  SELECTION_OUTCOME_TYPES,
  SELECTION_ABSTAIN_RESOLUTION_TYPES,
  SELECTION_ABSTAIN_RULES,
  SELECTION_UNANIMOUS_RULES,
  SELECTION_NULL_RULES,
  SELECTION_RUNOFF_RULES,
  SELECTION_SUPPORT_BASES,
  SELECTION_SUPPORT_THRESHOLD_TYPES,
  SELECTION_TIE_RULES,
  SELECTION_ROUND_TYPES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RESTRICTION_TYPES,
  CANDIDATE_RULE_TYPES,
  createSelection,
  createAbstainResolution,
  createSelectionRules,
  createSupportThreshold,
  getDefaultSelectionCandidateIds,
  resolveCandidateIds,
  validateSelections,
  tallySelections,
  resolveSelectionRound
} from './selectionModel.js';

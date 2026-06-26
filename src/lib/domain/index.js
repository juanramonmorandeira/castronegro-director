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
  CURRENT_STAGE_SOURCES,
  POOL_KEYS,
  DEFAULT_POOL_ORDER,
  normalizeId
} from './sessionModel.js';

export { createPlayer } from './playerDefinition.js';
export {
  CONFIGURABLE_STAGE_ORDER_POOLS,
  POOL_LIFECYCLE_OPERATION_TYPES,
  POOL_DEFINITION_ORDER_FIELD,
  POOL_DEFINITION_ERRORS,
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
  buildRoles,
  createRole,
  defineRole
} from './roleDefinition.js';
export {
  ROLE_CATALOG_IDS,
  ROLE_CATALOG,
  getCatalogRole,
  getCoreRoleCatalog
} from './roleCatalog.js';
export {
  ALIGNMENT_IDS,
  RULE_SET_SUPPORT_STATUSES,
  buildRuleSet,
  defineRuleSet,
  validateRuleSetSelection
} from './ruleSetDefinition.js';
export {
  BASIC_AVAILABLE_RULE_KEYS,
  BASIC_ROLE_OPTION_KEYS,
  RULE_SET_CATALOG_IDS,
  RULE_SET_CATALOG,
  getBasicAlignmentDistribution,
  getCatalogRuleSet
} from './ruleSetCatalog.js';
export {
  GROUP_TYPES,
  GROUP_MEMBERSHIP_RULE_TYPES,
  GROUP_RULE_TARGETS,
  GROUP_RULE_TYPES,
  createGroup,
  defineGroupRule,
  defineGroup
} from './groupDefinition.js';
export {
  addRoleToGroup,
  buildGroups,
  findGroupsForRole,
  getGroup,
  getGroupRuleEffects,
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

export {
  AVAILABILITY_RULE_TYPES,
  STAGE_SOURCE_TYPES,
  createStage,
  defineStage
} from './stageDefinition.js';
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
  advanceStageCursor
} from './poolCursorModel.js';
export {
  CYCLE_ERRORS,
  createCycle,
  enterNextPool,
  getCurrentCycleStage,
  getCurrentPool,
  getNextPoolKey,
  startCycle,
  updateCyclePool
} from './cycleModel.js';
export {
  POOL_ERRORS,
  POOL_HISTORY_OPERATIONS,
  createPoolHistoryEntry,
  preparePool,
  validatePool
} from './poolModel.js';
export {
  STAGE_ERRORS,
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  STAGE_KEYS,
  STAGE_ACTION_KEYS,
  getCurrentStage,
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
  removeSpecialStages,
  startSpecialStages,
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
  applySetPropertyEffect,
  applySetGroupEffect,
  applyReplaceRoleIdentityEffect,
  applyConcludePlay
} from './effectModel.js';
export {
  PROPERTY_BLOCK_BOUNDARIES,
  PROPERTY_BLOCK_DURATION_UNITS,
  PROPERTY_BLOCK_EXPIRATION_TYPES,
  createBlockedPropertyChange,
  addBlockedPropertyChange,
  isPropertyChangeBlocked,
  materializePropertyBlockExpiration,
  reviewPropertyBlocks
} from './roleModel.js';
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
  DOUBLE_SELECTOR_ERRORS,
  DOUBLE_SELECTOR_RULE_KEY,
  DOUBLE_SELECTOR_STAGE_KEYS,
  cancelPendingPickNextDoubleSelectorStage,
  createPickNextDoubleSelectorStage,
  createSelectDoubleSelectorStage,
  queuePickNextDoubleSelectorStage,
  requestSelectDoubleSelectorStage
} from './doubleSelectorModel.js';
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
  collectObjectiveRules,
  getObjectiveRuleDependencies,
  getActionInfluences,
  getStageInfluences,
  isStagePendingForObjectiveStability,
  canStageInfluenceObjectiveOutcome,
  getPendingObjectiveInfluenceStages,
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
  SELECTION_TIE_BREAKER_TYPES,
  SELECTION_VALUE_RULE_TYPES,
  SELECTION_ROUND_TYPES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RESTRICTION_TYPES,
  CANDIDATE_RULE_TYPES,
  createSelection,
  createSelectionRules,
  getDefaultSelectionCandidateIds,
  resolveCandidateIds,
  validateSelections,
  tallySelections,
  resolveSelectionRound
} from './selectionModel.js';

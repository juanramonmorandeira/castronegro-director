// index.js
// -----------------------------------------------------------------------------
// Puerta publica del nucleo de dominio.
//
// Este archivo no ejecuta nada ni exporta automaticamente todos los helpers
// internos. Solo reexporta las piezas que otros modulos deberian usar para
// construir sesiones, organizar pools, ejecutar stages y consultar resultados.
// -----------------------------------------------------------------------------

export {
  MECHANICAL_ENTITY_TYPES,
  RECIPE_ACTOR_TYPES,
  TARGET_FILTER_TYPES
} from './domainTypes.js';

export {
  SESSION_STATUSES,
  PLAYER_TYPES,
  STAGE_STATUSES,
  CURRENT_STAGE_SOURCES,
  POOL_KEYS,
  DEFAULT_POOL_ORDER,
  normalizeId,
  getCurrentCycleId
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
  HISTORY_COLLECTIONS,
  HISTORY_EVENTS,
  HISTORY_RESULTS,
  getHistoryCollection,
  getRecipeHistory,
  getSessionHistory,
  getRecipeHistorySignature,
  appendEntry,
  appendRecipeHistory,
  appendStageHistory,
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
  STAGE_VISIBILITY,
  STAGE_CATALOG,
  getManualCompletion,
  getCatalogStage
} from './stageCatalog.js';
export {
  INTER_POOL_QUEUE_ERRORS,
  INTER_POOL_QUEUE_EVENT_WINDOWS,
  INTER_POOL_QUEUE_HISTORY_OPERATIONS,
  isValidInterPoolQueueEventWindow
} from './interPoolQueueDefinition.js';
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
  STAGE_RECIPE_KEYS,
  STAGE_RULE_TYPES,
  PEEK_RECIPE_KEYS,
  PEEK_WARNING_TIMINGS,
  PEEK_WARNING_CONFIRMATION_RULES,
  getCurrentStage,
  getStageRecipeKey,
  selectStageRecipe,
  validateCurrentStage,
  isValidStageCompletionRequester,
  getStageCompletionDefinition,
  canRequesterCompleteStage,
  completeCurrentStage,
  resolveCurrentStage
} from './stageModel.js';
export {
  getInterPoolQueue,
  getInterPoolStagesForWindow,
  hasPendingInterPoolStages,
  getCurrentInterPoolStage,
  getCurrentInterPoolStageForWindow,
  appendInterPoolQueueHistory,
  appendInterPoolStage,
  removeInterPoolStages,
  startInterPoolQueue,
  startInterPoolQueueForWindow,
  completeInterPoolStageForWindow,
  completeInterPoolStage
} from './interPoolQueueModel.js';

export {
  VISIBILITY,
  SURFACE_SCREEN_MODES,
  SURFACE_FLOW_STEPS,
  SURFACE_FLOW_ORDER,
  SURFACE_ITEM_TYPES,
  SURFACE_MESSAGE_EXPIRATIONS,
  SURFACE_EFFECT_REASONS,
  SURFACE_LIFECYCLE_KEYS,
  getSurfaceFlowOrder,
  getSurfaceTransitionAfterWindow,
  createSurfaceTransitionResult,
  createSurfaceMessage,
  createSurfaceItem,
  createPublicTableStateItem,
  createEffectResultItem,
  createConcealedSelectionDraftItem,
  createConcealedSelectionSubmissionItem,
  createExposedSelectionSubmissionItem,
  createSelectionTallyItem,
  createSelectionResultItem
} from './surfaceModel.js';

export {
  RECIPE_KEYS,
  RECIPE_CATALOG,
  getCatalogRecipe
} from './recipeCatalog.js';
export {
  ACTION_CATALOG,
  getCatalogAction
} from './actionCatalog.js';
export {
  ACTOR_MODEL_ERRORS,
  createActorContext,
  getActionActors,
  getActorIdsFromInputOrStage,
  resolveRecipeActor
} from './actorModel.js';
export {
  createAction,
  validateAction
} from './actionDefinition.js';
export {
  getRecipeKey,
  createRecipe,
  getActionFromRecipe,
  getRecipeActorAndTargets,
  getRecipeConstraints,
  validateRecipeContract,
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
  createEffect,
  validateEffect
} from './effectDefinition.js';
export {
  resolveEffects,
  applyEffect,
  applyEffects
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
  EVENT_RESPONSE_TYPES,
  EVENT_TRIGGER_TARGETS,
  EVENT_TYPES,
  defineEventRule
} from './eventDefinition.js';
export {
  EVENT_CATALOG,
  EVENT_RULE_KEYS,
  EVENT_RULE_KEYS_BY_FEATURE,
  EVENT_SOURCE_STAGE_CATALOG_IDS,
  EVENT_WINDOW_BY_SOURCE_STAGE_CATALOG_ID,
  getEventResponseWindow,
  getCatalogEventRule
} from './eventCatalog.js';
export {
  getEventsFromActionResult,
  getTriggeredReactions,
  createStageResponseFromRule,
  createCancelStageResponseFromRule,
  applyCatalogEventResponses,
  resolveEventResponses,
  applyEventResponses,
  processActionResultEvents
} from './eventModel.js';
export {
  DOUBLE_SELECTOR_ERRORS,
  DOUBLE_SELECTOR_RULE_KEY,
  DOUBLE_SELECTOR_STAGE_KEYS,
  cancelPendingPickNextDoubleSelectorStage,
  createPickNextDoubleSelectorStage,
  createSelectDoubleSelectorStage,
  getDoubleSelectorEventResponses,
  queuePickNextDoubleSelectorStage,
  requestSelectDoubleSelectorStage
} from './doubleSelectorModel.js';
export {
  ACTION_IDS,
  resolveAction
} from './actionModel.js';
export {
  findRole,
  canResolveWithoutActor,
  targetMatchesFilter,
  validateActionTargets
} from './targetModel.js';

export {
  OBJECTIVE_EVALUATION_STATUSES,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_HOLDER_TYPES,
  OBJECTIVE_BENEFICIARY_TYPES,
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
  SELECT_OUTCOME_TYPES,
  SELECT_ABSTAIN_RESOLUTION_TYPES,
  SELECT_ABSTAIN_RULES,
  SELECT_UNANIMOUS_RULES,
  SELECT_NULL_RULES,
  SELECT_RUNOFF_RULES,
  SELECT_SUPPORT_BASES,
  SELECT_SUPPORT_THRESHOLD_TYPES,
  SELECT_TIE_RULES,
  SELECT_TIE_BREAKER_TYPES,
  SELECT_VALUE_RULE_TYPES,
  SELECT_ROUND_TYPES,
  SELECT_REQUIRED_RULES,
  SELECT_RESTRICTION_TYPES,
  SELECT_SELECTOR_SOURCES,
  CANDIDATE_RULE_TYPES,
  createSelectDecision,
  createSelectRules,
  buildSelectActionInput,
  getDefaultSelectCandidateIds,
  resolveCandidateIds,
  validateSelectDecisions,
  tallySelectDecisions,
  resolveSelectRound
} from './actionModel.js';

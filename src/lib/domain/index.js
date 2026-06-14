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
  SPECIAL_STEP_PRIORITIES,
  normalizeId
} from './sessionModel.js';

export { createPlayer } from './playerDefinition.js';
export { createActionToken } from './actionTokenDefinition.js';
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
  applySetGroupEffect,
  applyCloseCycle,
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
  createConcludePlayStep,
  appendConcludePlayEventResponse,
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
  getSessionObjectiveRules,
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

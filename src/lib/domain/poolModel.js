// poolModel.js
// -----------------------------------------------------------------------------
// Prepara y valida un unico pool. No navega entre pools ni modifica session.
// -----------------------------------------------------------------------------

import { AVAILABILITY_RULE_TYPES } from './stageDefinition.js';
import { STAGE_STATUSES } from './sessionModel.js';
import { findAppliedSetPropertyHistory } from './historyModel.js';

export const POOL_HISTORY_OPERATIONS = Object.freeze({
  PREPARED: 'prepared',
  VALIDATED: 'validated',
  STARTED: 'started',
  COMPLETED: 'completed',
  FAILED: 'failed'
});

export const POOL_ERRORS = Object.freeze({
  MISSING_KEY: 'pool/missing-key',
  INVALID_STAGES: 'pool/invalid-stages',
  INVALID_STAGE_INDEX: 'pool/invalid-stage-index',
  NO_RUNNABLE_STAGES: 'pool/no-runnable-stages',
  MISSING_STAGE_ACTION: 'pool/missing-stage-action',
  UNKNOWN_LIFECYCLE_OPERATION: 'pool/unknown-lifecycle-operation',
  MISSING_ACTOR: 'pool/missing-actor',
  UNKNOWN_AVAILABILITY_RULE: 'pool/unknown-availability-rule'
});

function getRole(context = {}, roleId = null) {
  return (context.roleStates ?? []).find((role) => role.id === roleId) ?? null;
}

function isWithinExecutionWindow(rule = {}, context = {}) {
  const cycleId = context.cycleId ?? 0;
  const poolKey = context.poolKey ?? null;

  if (rule.poolKey && rule.poolKey !== poolKey) return false;
  if (Number.isInteger(rule.cycleId) && rule.cycleId !== cycleId) return false;
  if (Number.isInteger(rule.firstCycle) && cycleId < rule.firstCycle) return false;
  if (Number.isInteger(rule.lastCycle) && cycleId > rule.lastCycle) return false;
  return true;
}

function evaluateAvailabilityRule(stage = {}, rule = {}, context = {}) {
  if (rule.type === AVAILABILITY_RULE_TYPES.ALWAYS_AVAILABLE) return { ok: true, value: true };

  if (rule.type === AVAILABILITY_RULE_TYPES.HAS_EXECUTABLE_ACTION) {
    return { ok: true, value: (stage.actions ?? []).length > 0 };
  }

  if (rule.type === AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW) {
    return { ok: true, value: isWithinExecutionWindow(rule, context) };
  }

  if (rule.type === AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY) {
    const actorIds = rule.actorIds ?? stage.actorIds ?? [];
    const missingActorIds = actorIds.filter((roleId) => !getRole(context, roleId));
    if (missingActorIds.length > 0) {
      return {
        ok: false,
        value: false,
        errors: [{
          code: POOL_ERRORS.MISSING_ACTOR,
          stageId: stage.id,
          stageKey: stage.key,
          actorIds: missingActorIds,
          message: `stage "${stage.key}" references missing actors`
        }]
      };
    }
    return {
      ok: true,
      value: actorIds.length > 0 && actorIds.every((roleId) => getRole(context, roleId)?.inPlay === true)
    };
  }

  if (rule.type === AVAILABILITY_RULE_TYPES.ACTOR_RECENTLY_OUT_OF_PLAY) {
    const actorIds = rule.actorIds ?? stage.actorIds ?? [];
    const missingActorIds = actorIds.filter((roleId) => !getRole(context, roleId));
    if (missingActorIds.length > 0) {
      return {
        ok: false,
        value: false,
        errors: [{
          code: POOL_ERRORS.MISSING_ACTOR,
          stageId: stage.id,
          stageKey: stage.key,
          actorIds: missingActorIds,
          message: `stage "${stage.key}" references missing actors`
        }]
      };
    }

    return {
      ok: true,
      value:
        actorIds.length > 0 &&
        actorIds.every((roleId) =>
          getRole(context, roleId)?.inPlay === false &&
          findAppliedSetPropertyHistory(context.session, {
            cycleId: context.cycleId,
            property: rule.property ?? 'inPlay',
            value: Object.hasOwn(rule, 'value') ? rule.value : false,
            targetId: roleId,
            actionKey: rule.actionKey ?? null,
            stageCatalogId: rule.stageCatalogId ?? null
          }).length > 0
        )
    };
  }

  return {
    ok: false,
    value: false,
    errors: [{
      code: POOL_ERRORS.UNKNOWN_AVAILABILITY_RULE,
      stageId: stage.id,
      stageKey: stage.key,
      ruleType: rule.type,
      message: `stage "${stage.key}" has unknown availability rule "${rule.type}"`
    }]
  };
}

function evaluateAvailabilityGroup(stage = {}, group = {}, context = {}) {
  const allResults = (group.all ?? []).map((rule) => evaluateAvailabilityRule(stage, rule, context));
  const anyResults = (group.any ?? []).map((entry) =>
    entry?.type
      ? evaluateAvailabilityRule(stage, entry, context)
      : evaluateAvailabilityGroup(stage, entry, context)
  );
  const errors = [...allResults, ...anyResults].flatMap((result) => result.errors ?? []);

  return {
    ok: errors.length === 0,
    value:
      allResults.every((result) => result.value === true) &&
      (anyResults.length === 0 || anyResults.some((result) => result.value === true)),
    errors
  };
}

function hasExpiredExecutionWindow(stage = {}, context = {}) {
  const rules = [
    ...(stage.availabilityRules?.all ?? []),
    ...(stage.availabilityRules?.any ?? []).filter((entry) => entry?.type)
  ];

  return rules.some((rule) => {
    if (rule.type !== AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW) return false;
    return Number.isInteger(rule.lastCycle) && (context.cycleId ?? 0) > rule.lastCycle;
  });
}

export function preparePool(pool = {}, context = {}) {
  const changes = [];
  const errors = [];
  const stages = (pool.stages ?? []).map((stage) => {
    if (stage.status === STAGE_STATUSES.FINISHED) return stage;

    if (hasExpiredExecutionWindow(stage, context)) {
      if (stage.status !== STAGE_STATUSES.FINISHED) {
        changes.push({
          stageId: stage.id,
          stageKey: stage.key,
          from: stage.status,
          to: STAGE_STATUSES.FINISHED
        });
      }
      return { ...stage, status: STAGE_STATUSES.FINISHED };
    }

    const evaluation = evaluateAvailabilityGroup(stage, stage.availabilityRules ?? {}, context);
    errors.push(...(evaluation.errors ?? []));
    const nextStatus = evaluation.value ? STAGE_STATUSES.ENABLED : STAGE_STATUSES.DISABLED;
    if (stage.status !== nextStatus) {
      changes.push({ stageId: stage.id, stageKey: stage.key, from: stage.status, to: nextStatus });
    }
    return { ...stage, status: nextStatus };
  });

  return {
    ok: errors.length === 0,
    pool: {
      ...pool,
      stages,
      currentStageIndex: Math.max(0, stages.findIndex((stage) => stage.status === STAGE_STATUSES.ENABLED))
    },
    changes,
    errors
  };
}

export function validatePool(pool = {}, knownLifecycleOperationTypes = []) {
  const errors = [];

  if (!pool.key) errors.push({ code: POOL_ERRORS.MISSING_KEY, message: 'pool requires key' });
  if (!Array.isArray(pool.stages)) {
    errors.push({ code: POOL_ERRORS.INVALID_STAGES, message: 'pool stages must be an array' });
    return { ok: false, errors };
  }

  if (
    !Number.isInteger(pool.currentStageIndex) ||
    pool.currentStageIndex < 0 ||
    pool.currentStageIndex >= pool.stages.length
  ) {
    errors.push({
      code: POOL_ERRORS.INVALID_STAGE_INDEX,
      stageIndex: pool.currentStageIndex,
      message: 'pool currentStageIndex is invalid'
    });
  }

  const enabledStages = pool.stages.filter((stage) => stage.status === STAGE_STATUSES.ENABLED);
  if (enabledStages.length === 0) {
    errors.push({ code: POOL_ERRORS.NO_RUNNABLE_STAGES, message: `pool "${pool.key}" has no runnable stages` });
  }

  enabledStages.forEach((stage) => {
    if ((stage.actions ?? []).length === 0) {
      errors.push({
        code: POOL_ERRORS.MISSING_STAGE_ACTION,
        stageId: stage.id,
        stageKey: stage.key,
        message: `enabled stage "${stage.key}" has no actions`
      });
    }
  });

  const knownTypes = new Set(knownLifecycleOperationTypes);
  ['onEnter', 'onExit'].forEach((timing) => {
    (pool[timing] ?? []).forEach((operation) => {
      if (!knownTypes.has(operation.type)) {
        errors.push({
          code: POOL_ERRORS.UNKNOWN_LIFECYCLE_OPERATION,
          operationType: operation.type,
          timing,
          message: `pool "${pool.key}" has unknown lifecycle operation "${operation.type}"`
        });
      }
    });
  });

  return { ok: errors.length === 0, errors };
}

export function createPoolHistoryEntry({
  cycleId = 0,
  poolKey = null,
  operation,
  stageIndex = 0,
  metadata = {}
} = {}) {
  return {
    cycleId,
    poolKey,
    operation,
    stageIndex,
    metadata: { ...metadata }
  };
}

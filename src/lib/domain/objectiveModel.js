// objectiveModel.js
// -----------------------------------------------------------------------------
// Evalua objectiveRules ya materializadas en la session.
//
// Este modelo no decide que objectives existen. Los objectives nacen en
// ruleSet, role o group, y se copian o anaden a session.objectiveRules.
// Aqui solo se responde una pregunta: que reglas de esa lista se cumplen ahora?
// -----------------------------------------------------------------------------

import { getGroupRoles } from './groupModel.js';
import { STAGE_STATUSES, normalizeId } from './sessionModel.js';
import { getSpecialStages } from './specialStagesModel.js';

export const OBJECTIVE_EVALUATION_STATUSES = Object.freeze({
  ONGOING: 'ongoing',
  FULFILLED: 'fulfilled'
});

export const OBJECTIVE_CONDITIONS = Object.freeze({
  HOLDER_REACHES_IN_PLAY_PARITY: 'holder_reaches_in_play_parity',
  ONLY_HOLDER_GROUP_REMAINS_IN_PLAY: 'only_holder_group_remains_in_play',
  NO_ROLES_IN_PLAY: 'no_roles_in_play'
});

export const INFLUENCE_SUBJECTS = Object.freeze({
  ROLE: 'role',
  GROUP: 'group',
  OBJECTIVE_RULE: 'objectiveRule'
});

export const INFLUENCE_OPERATIONS = Object.freeze({
  SET: 'set',
  ADD: 'add',
  REMOVE: 'remove'
});

export function getInPlayRoles(session = {}) {
  return (session.roles ?? []).filter((role) => role?.inPlay === true);
}

export function getSessionObjectiveRules(session = {}) {
  return session?.objectiveRules ?? [];
}

function uniqueIds(ids = []) {
  return [...new Set((ids ?? []).filter(Boolean))];
}

function getRoleById(session = {}, roleId = null) {
  return (session.roles ?? []).find((role) => role.id === roleId) ?? null;
}

function getHolderRoles(session = {}, holder = {}) {
  const holderType = normalizeId(holder?.type);
  const holderId = normalizeId(holder?.id);

  if (holderType === 'role') {
    return holderId ? [getRoleById(session, holderId)].filter(Boolean) : [];
  }

  if (holderType === 'group') {
    return getGroupRoles(session, holderId);
  }

  return [];
}

function getHolderRoleIds(session = {}, holder = {}) {
  return uniqueIds(getHolderRoles(session, holder).map((role) => role.id));
}

function getRuleKey(rule = {}) {
  return normalizeId(rule.key ?? rule.id);
}

function getConditionType(rule = {}) {
  return normalizeId(rule?.condition?.type ?? rule?.condition);
}

function getRuleBeneficiaries({ rule = {}, holderRoleIds = [] } = {}) {
  const onFulfilled = rule.onFulfilled?.[0] ?? {};
  const beneficiaries = onFulfilled.beneficiaries;

  if (beneficiaries?.type === 'holder') {
    return [
      {
        type: rule.holder?.type ?? null,
        ids: rule.holder?.id ? [rule.holder.id] : [],
        roleIds: holderRoleIds
      }
    ];
  }

  if (Array.isArray(beneficiaries)) return beneficiaries;
  if (beneficiaries && typeof beneficiaries === 'object') return [beneficiaries];

  return [];
}

function isRuleConclusive(rule = {}) {
  return (rule.onFulfilled ?? []).some((proposal) => proposal?.conclusive === true);
}

function createFulfilledRuleResult({ rule, condition, holderRoleIds, details = {} }) {
  const ruleKey = getRuleKey(rule);

  return {
    key: ruleKey,
    holder: rule.holder ?? null,
    condition,
    onFulfilled: [...(rule.onFulfilled ?? [])],
    conflictRules: [...(rule.conflictRules ?? [])],
    beneficiaries: getRuleBeneficiaries({ rule, holderRoleIds }),
    metadata: { ...(rule.metadata ?? {}) },
    details
  };
}

function uniqueInfluenceValues(values = []) {
  return [...new Set((values ?? []).filter((value) => value !== undefined))];
}

function normalizeDependency(dependency = {}) {
  return {
    subject: normalizeId(dependency.subject),
    property: normalizeId(dependency.property),
    id: dependency.id ?? null,
    scope: dependency.scope ?? null
  };
}

function normalizeInfluence(influence = {}) {
  const value =
    influence.value !== undefined && influence.values === undefined
      ? [influence.value]
      : influence.values;

  return {
    subject: normalizeId(influence.subject),
    property: normalizeId(influence.property),
    operation: normalizeId(influence.operation ?? INFLUENCE_OPERATIONS.SET),
    values: uniqueInfluenceValues(value),
    roleIds: uniqueIds(influence.roleIds ?? []),
    id: influence.id ?? null,
    scope: influence.scope ?? null,
    metadata: { ...(influence.metadata ?? {}) }
  };
}

function roleInPlayDependency() {
  return {
    subject: INFLUENCE_SUBJECTS.ROLE,
    property: 'inPlay'
  };
}

function getDefaultObjectiveDependencies(rule = {}) {
  const conditionType = getConditionType(rule);

  if (
    conditionType === OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY ||
    conditionType === OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY ||
    conditionType === OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY
  ) {
    return [roleInPlayDependency()];
  }

  return [];
}

export function getObjectiveRuleDependencies(rule = {}) {
  const dependencies = rule.dependencies ?? getDefaultObjectiveDependencies(rule);
  return dependencies.map(normalizeDependency).filter((dependency) => dependency.subject && dependency.property);
}

export function getActionInfluences(action = {}) {
  if (Array.isArray(action.influences)) {
    return action.influences.map(normalizeInfluence).filter((influence) => influence.subject && influence.property);
  }

  if (action?.effect?.type === 'set_property') {
    return [
      normalizeInfluence({
        subject: action.effect.targetType ?? INFLUENCE_SUBJECTS.ROLE,
        property: action.effect.property,
        operation: INFLUENCE_OPERATIONS.SET,
        value: action.effect.value
      })
    ].filter((influence) => influence.subject && influence.property);
  }

  return [];
}

export function getStageInfluences(stage = {}) {
  if (Array.isArray(stage.influences) && stage.influences.length > 0) {
    return stage.influences.map(normalizeInfluence).filter((influence) => influence.subject && influence.property);
  }

  return (stage.actions ?? []).flatMap(getActionInfluences);
}

function hasUnconsumedStageAction(stage = {}) {
  const consumedActionKeys = new Set(stage.executionState?.consumedActionKeys ?? []);
  const actionConsumed = (action) => consumedActionKeys.has(getRuleKey(action));

  return (stage.actions ?? []).some((action) => !actionConsumed(action));
}

export function isStagePendingForObjectiveStability(stage = {}) {
  if (stage.status !== STAGE_STATUSES.ENABLED) return false;
  if (stage.executionState?.resolved === true) return false;
  if (stage.executionState?.skipped === true) return false;
  if (stage.executionState?.consumed === true) return false;
  if (Array.isArray(stage.actions) && stage.actions.length > 0) return hasUnconsumedStageAction(stage);
  return getStageInfluences(stage).length > 0;
}

function influenceTouchesDependency(influence = {}, dependency = {}) {
  if (influence.subject !== dependency.subject) return false;
  if (influence.property !== dependency.property) return false;
  if (dependency.id && influence.id && dependency.id !== influence.id) return false;
  return true;
}

function getRoleInPlayValue(session = {}, roleId = null) {
  const role = getRoleById(session, roleId);
  return role?.inPlay ?? null;
}

function getInPlayChangeDelta({ session, roleId, nextValue }) {
  const currentValue = getRoleInPlayValue(session, roleId);
  if (currentValue === nextValue) return 0;
  if (currentValue === true && nextValue === false) return -1;
  if (currentValue === false && nextValue === true) return 1;
  return 0;
}

function canRoleInPlaySetChangeFulfilledParity({ session, rule, roleId, nextValue }) {
  const fulfilled = evaluateHolderReachesInPlayParity(session, rule);
  if (!fulfilled) return false;

  const holderRoleIds = getHolderRoleIds(session, rule.holder);
  const delta = getInPlayChangeDelta({ session, roleId, nextValue });
  if (delta === 0) return false;

  const holderDelta = holderRoleIds.includes(roleId) ? delta : 0;
  const nonHolderDelta = holderRoleIds.includes(roleId) ? 0 : delta;
  const holderInPlayCount = fulfilled.details.holderInPlayCount + holderDelta;
  const nonHolderInPlayCount = fulfilled.details.nonHolderInPlayCount + nonHolderDelta;

  return holderInPlayCount < nonHolderInPlayCount;
}

function canRoleInPlaySetChangeOnlyHolderRemains({ session, rule, roleId, nextValue }) {
  const fulfilled = evaluateOnlyHolderGroupRemainsInPlay(session, rule);
  if (!fulfilled) return false;

  const holderRoleIds = getHolderRoleIds(session, rule.holder);
  const delta = getInPlayChangeDelta({ session, roleId, nextValue });
  if (delta === 0) return false;

  if (holderRoleIds.includes(roleId) && nextValue === false) {
    const remainingHolderInPlay = fulfilled.details.holderInPlayRoleIds.filter((id) => id !== roleId);
    return remainingHolderInPlay.length === 0;
  }

  return !holderRoleIds.includes(roleId) && nextValue === true;
}

function canRoleInPlaySetChangeNoRolesInPlay({ session, roleId, nextValue }) {
  const fulfilled = evaluateNoRolesInPlay(session, {
    condition: { type: OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY }
  });
  if (!fulfilled) return false;

  return getRoleInPlayValue(session, roleId) === false && nextValue === true;
}

function getCandidateRoleIdsForInfluence({ session = {}, stage = {}, influence = {} } = {}) {
  if (Array.isArray(influence.roleIds) && influence.roleIds.length > 0) return uniqueIds(influence.roleIds);
  if (influence.id) return [influence.id];
  if (Array.isArray(stage.context?.candidateIds)) return uniqueIds(stage.context.candidateIds);
  if (Array.isArray(stage.candidateIds)) return uniqueIds(stage.candidateIds);
  if (Array.isArray(stage.selectionRules?.candidateIds)) return uniqueIds(stage.selectionRules.candidateIds);
  return (session.roles ?? []).map((role) => role.id);
}

function canInfluenceValueChangeFulfilledRule({ session, objectiveRule, stage, influence }) {
  const conditionType = getConditionType(objectiveRule);

  if (influence.subject !== INFLUENCE_SUBJECTS.ROLE || influence.property !== 'inplay') return true;
  if (influence.operation !== INFLUENCE_OPERATIONS.SET) return true;

  return getCandidateRoleIdsForInfluence({ session, stage, influence }).some((roleId) =>
    influence.values.some((nextValue) => {
      if (conditionType === OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY) {
        return canRoleInPlaySetChangeFulfilledParity({ session, rule: objectiveRule, roleId, nextValue });
      }
      if (conditionType === OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY) {
        return canRoleInPlaySetChangeOnlyHolderRemains({ session, rule: objectiveRule, roleId, nextValue });
      }
      if (conditionType === OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY) {
        return canRoleInPlaySetChangeNoRolesInPlay({ session, roleId, nextValue });
      }
      return true;
    })
  );
}

export function canStageInfluenceObjectiveOutcome({ session = {}, objectiveRule = {}, stage = {} } = {}) {
  if (!isStagePendingForObjectiveStability(stage)) return false;

  const dependencies = getObjectiveRuleDependencies(objectiveRule);
  const influences = getStageInfluences(stage);

  return influences.some((influence) =>
    dependencies.some((dependency) => {
      if (!influenceTouchesDependency(influence, dependency)) return false;
      return canInfluenceValueChangeFulfilledRule({ session, objectiveRule, stage, influence });
    })
  );
}

export function getPendingObjectiveInfluenceStages({
  session = {},
  objectiveRules = getSessionObjectiveRules(session)
} = {}) {
  const stages = getSpecialStages(session);

  return stages.filter((stage) =>
    (objectiveRules ?? []).some((objectiveRule) =>
      canStageInfluenceObjectiveOutcome({ session, objectiveRule, stage })
    )
  );
}

function evaluateHolderReachesInPlayParity(session = {}, rule = {}) {
  const inPlayRoles = getInPlayRoles(session);
  const holderRoleIds = getHolderRoleIds(session, rule.holder);
  const holderInPlayRoles = inPlayRoles.filter((role) => holderRoleIds.includes(role.id));
  const nonHolderInPlayCount = inPlayRoles.length - holderInPlayRoles.length;

  if (!holderRoleIds.length || !holderInPlayRoles.length) return null;
  if (holderInPlayRoles.length < nonHolderInPlayCount) return null;

  return createFulfilledRuleResult({
    rule,
    condition: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY,
    holderRoleIds,
    details: {
      holderInPlayCount: holderInPlayRoles.length,
      nonHolderInPlayCount,
      totalInPlayCount: inPlayRoles.length
    }
  });
}

function evaluateOnlyHolderGroupRemainsInPlay(session = {}, rule = {}) {
  const inPlayRoles = getInPlayRoles(session);
  const inPlayRoleIds = inPlayRoles.map((role) => role.id);
  const holderRoleIds = getHolderRoleIds(session, rule.holder);
  const holderInPlayRoleIds = inPlayRoleIds.filter((roleId) => holderRoleIds.includes(roleId));
  const onlyHolderRolesRemain =
    holderInPlayRoleIds.length > 0 &&
    inPlayRoleIds.length === holderInPlayRoleIds.length &&
    inPlayRoleIds.every((roleId) => holderRoleIds.includes(roleId));

  if (!holderRoleIds.length || !onlyHolderRolesRemain) return null;

  return createFulfilledRuleResult({
    rule,
    condition: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY,
    holderRoleIds,
    details: {
      holderInPlayRoleIds,
      totalInPlayCount: inPlayRoles.length
    }
  });
}

function evaluateNoRolesInPlay(session = {}, rule = {}) {
  const inPlayRoles = getInPlayRoles(session);
  if (inPlayRoles.length > 0) return null;

  return createFulfilledRuleResult({
    rule,
    condition: OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY,
    holderRoleIds: [],
    details: {
      totalInPlayCount: 0
    }
  });
}

export function evaluateObjectiveRule(session = {}, rule = {}) {
  const conditionType = getConditionType(rule);

  if (conditionType === OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY) {
    return evaluateHolderReachesInPlayParity(session, rule);
  }

  if (conditionType === OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY) {
    return evaluateOnlyHolderGroupRemainsInPlay(session, rule);
  }

  if (conditionType === OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY) {
    return evaluateNoRolesInPlay(session, rule);
  }

  return null;
}

function getOngoingObjectiveEvaluation(reason = 'no_objective_condition_met') {
  return {
    status: OBJECTIVE_EVALUATION_STATUSES.ONGOING,
    reason,
    fulfilledRules: [],
    achievedObjectives: [],
    playOutcome: null
  };
}

function createFulfilledObjectiveEvaluation(fulfilledRules = []) {
  const conclusiveRules = fulfilledRules.filter((rule) =>
    (rule.onFulfilled ?? []).some((proposal) => proposal?.conclusive === true)
  );
  const achievedObjectives = fulfilledRules.filter((rule) => !isRuleConclusive(rule));
  const playOutcome =
    conclusiveRules.length > 0
      ? {
          conclusive: true,
          beneficiaries: conclusiveRules.flatMap((rule) => rule.beneficiaries ?? []),
          fulfilledObjectiveRuleKeys: conclusiveRules.map((rule) => rule.key),
          resolutionReason:
            conclusiveRules.length === 1
              ? 'single_conclusive_objective'
              : 'multiple_conclusive_objectives'
        }
      : null;

  return {
    status: OBJECTIVE_EVALUATION_STATUSES.FULFILLED,
    reason: playOutcome ? playOutcome.resolutionReason : 'non_conclusive_objective_fulfilled',
    fulfilledRules,
    achievedObjectives,
    playOutcome
  };
}

export function evaluateSessionObjectiveRules(session = {}) {
  return getSessionObjectiveRules(session)
    .map((rule) => evaluateObjectiveRule(session, rule))
    .filter(Boolean);
}

export function checkObjectives(session = {}) {
  const fulfilledRules = evaluateSessionObjectiveRules(session);

  if (!fulfilledRules.length) {
    return getOngoingObjectiveEvaluation();
  }

  return createFulfilledObjectiveEvaluation(fulfilledRules);
}

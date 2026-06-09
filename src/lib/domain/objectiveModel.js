// objectiveModel.js
// -----------------------------------------------------------------------------
// Evalua objectiveRules ya materializadas en la session.
//
// Este modelo no decide que objectives existen. Los objectives nacen en
// ruleSet, role o group, y se copian o anaden a session.sessionObjectiveRules.
// Aqui solo se responde una pregunta: que reglas de esa lista se cumplen ahora?
// -----------------------------------------------------------------------------

import { getGroupRoles } from './groupModel.js';
import { normalizeId } from './sessionModel.js';

export const OBJECTIVE_EVALUATION_STATUSES = Object.freeze({
  ONGOING: 'ongoing',
  FULFILLED: 'fulfilled'
});

export const OBJECTIVE_CONDITIONS = Object.freeze({
  HOLDER_REACHES_IN_PLAY_PARITY: 'holder_reaches_in_play_parity',
  ONLY_HOLDER_GROUP_REMAINS_IN_PLAY: 'only_holder_group_remains_in_play',
  NO_ROLES_IN_PLAY: 'no_roles_in_play'
});

export function getInPlayRoles(session = {}) {
  return (session.roles ?? []).filter((role) => role?.inPlay === true);
}

export function getSessionObjectiveRules(session = {}) {
  return (
    session?.sessionObjectiveRules ??
    session?.settings?.objectives?.rules ??
    session?.settings?.objectiveRules ??
    []
  );
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

export function createOngoingObjectiveEvaluation(reason = 'no_objective_condition_met') {
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
    return createOngoingObjectiveEvaluation();
  }

  return createFulfilledObjectiveEvaluation(fulfilledRules);
}

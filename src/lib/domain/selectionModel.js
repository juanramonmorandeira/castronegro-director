// selectionModel.js
// -----------------------------------------------------------------------------
// Este archivo modela una seleccion mecanica.
//
// Seleccionar no significa automaticamente eliminar, expulsar o nombrar a
// alguien. Una seleccion significa:
// - uno o varios selectorIds eligen entre candidateIds;
// - cada seleccion no abstenida vale una unidad;
// - las selecciones se agrupan por candidateId;
// - el candidate con mas selecciones es el chosen provisional;
// - selectionRules decide si ese chosen se acepta, se anula o pide otra ronda.
//
// El efecto de ganar la seleccion vive fuera de este archivo. Puede ser
// set_property inPlay=false, dar una accion extra, crear una marca, etc.
// -----------------------------------------------------------------------------

import { getGroupMemberRoleIds } from './groupModel.js';
import { normalizeId } from './sessionModel.js';

export const SELECTION_OUTCOME_TYPES = Object.freeze({
  CHOSEN: 'chosen',
  TIE: 'tie',
  NULL: 'null'
});

export const SELECTION_TIE_RULES = Object.freeze({
  NULL_ON_TIE: 'null_on_tie',
  RUNOFF_ON_TIE: 'runoff_on_tie'
});

export const SELECTION_TIE_BREAKER_TYPES = Object.freeze({
  SELECTOR_AUTHORITY: 'selector_authority',
  SELECTOR_PROPERTY: 'selector_property'
});

export const SELECTION_RUNOFF_RULES = Object.freeze({
  TIED_CANDIDATES: 'tied_candidates',
  SELECTED_CANDIDATES: 'selected_candidates',
  SAME_CANDIDATES: 'same_candidates'
});

export const SELECTION_NULL_RULES = Object.freeze({
  END_AS_NULL: 'end_as_null',
  REPEAT_ON_NULL: 'repeat_on_null'
});

export const SELECTION_SUPPORT_THRESHOLD_TYPES = Object.freeze({
  NONE: 'none',
  MAJORITY: 'majority',
  FRACTION: 'fraction'
});

export const SELECTION_SUPPORT_BASES = Object.freeze({
  CAST_SELECTIONS: 'cast_selections',
  SELECTOR_COUNT: 'selector_count'
});

export const SELECTION_ROUND_TYPES = Object.freeze({
  INITIAL: 'initial',
  RUNOFF: 'runoff'
});

export const SELECTION_REQUIRED_RULES = Object.freeze({
  OPTIONAL: 'optional',
  ALL_SELECTORS: 'all_selectors'
});

export const SELECTION_ABSTAIN_RULES = Object.freeze({
  NOT_ALLOWED: 'not_allowed',
  ALLOWED: 'allowed'
});

export const SELECTION_ABSTAIN_RESOLUTION_TYPES = Object.freeze({
  IGNORE: 'ignore',
  NULL_IF_HIGHEST: 'null_if_highest'
});

export const SELECTION_UNANIMOUS_RULES = Object.freeze({
  NOT_REQUIRED: 'not_required',
  REQUIRED: 'required'
});

export const SELECTION_RESTRICTION_TYPES = Object.freeze({
  EXCLUDE_GROUP_MEMBER_CANDIDATE: 'exclude_group_member_candidate'
});

export const SELECTION_VALUE_RULE_TYPES = Object.freeze({
  SELECTOR_PROPERTY: 'selector_property'
});

export const CANDIDATE_RULE_TYPES = Object.freeze({
  HAS_PROPERTY: 'has_property',
  NOT_HAS_PROPERTY: 'not_has_property',
  NOT_SELECTOR: 'not_selector',
  SAME_GROUP: 'same_group',
  NOT_SAME_GROUP: 'not_same_group',
  EXPLICIT_INCLUDE: 'explicit_include',
  EXPLICIT_EXCLUDE: 'explicit_exclude'
});

export function createSelectionRules({
  required = SELECTION_REQUIRED_RULES.OPTIONAL,
  abstain = SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
  unanimous = SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
  tie = SELECTION_TIE_RULES.NULL_ON_TIE,
  runoff = SELECTION_RUNOFF_RULES.TIED_CANDIDATES,
  nullResult = SELECTION_NULL_RULES.END_AS_NULL,
  repeatLimit = 1,
  supportThreshold = {},
  abstainResolution = {},
  groupRestrictions = [],
  candidateIds = null,
  candidateRules = [],
  selectionWeights = [],
  selectionValueRules = [],
  tieBreakers = [],
  selectorEligibility = {}
} = {}) {
  return {
    required,
    abstain,
    unanimous,
    tie,
    runoff,
    nullResult,
    repeatLimit: Number.isInteger(repeatLimit) && repeatLimit >= 0 ? repeatLimit : 1,
    supportThreshold: normalizeSupportThreshold(supportThreshold),
    abstainResolution: normalizeAbstainResolution(abstainResolution),
    groupRestrictions: (groupRestrictions ?? []).map((restriction) => ({ ...restriction })),
    candidateIds: Array.isArray(candidateIds) ? [...candidateIds] : null,
    candidateRules: (candidateRules ?? []).map((rule) => ({ ...rule })),
    selectionWeights: normalizeSelectionWeights(selectionWeights),
    selectionValueRules: normalizeSelectionValueRules(selectionValueRules),
    tieBreakers: normalizeTieBreakers(tieBreakers),
    selectorEligibility: normalizeSelectorEligibility(selectorEligibility)
  };
}

function normalizeSupportThreshold({
  type = SELECTION_SUPPORT_THRESHOLD_TYPES.NONE,
  base = SELECTION_SUPPORT_BASES.CAST_SELECTIONS,
  numerator = 1,
  denominator = 2
} = {}) {
  const normalizedType = Object.values(SELECTION_SUPPORT_THRESHOLD_TYPES).includes(type)
    ? type
    : SELECTION_SUPPORT_THRESHOLD_TYPES.NONE;
  const normalizedBase = Object.values(SELECTION_SUPPORT_BASES).includes(base)
    ? base
    : SELECTION_SUPPORT_BASES.CAST_SELECTIONS;

  return {
    type: normalizedType,
    base: normalizedBase,
    numerator: Number.isInteger(numerator) && numerator > 0 ? numerator : 1,
    denominator: Number.isInteger(denominator) && denominator > 0 ? denominator : 2
  };
}

function normalizeAbstainResolution({
  type = SELECTION_ABSTAIN_RESOLUTION_TYPES.IGNORE
} = {}) {
  return {
    type: Object.values(SELECTION_ABSTAIN_RESOLUTION_TYPES).includes(type)
      ? type
      : SELECTION_ABSTAIN_RESOLUTION_TYPES.IGNORE
  };
}

function normalizeSelectionWeights(selectionWeights = []) {
  return (selectionWeights ?? [])
    .map((rule) => ({
      selectorId: rule?.selectorId ?? null,
      value: Number.isFinite(rule?.value) && rule.value > 0 ? rule.value : 1,
      metadata: { ...(rule?.metadata ?? {}) }
    }))
    .filter((rule) => rule.selectorId);
}

function normalizeSelectionValueRules(selectionValueRules = []) {
  return (selectionValueRules ?? [])
    .map((rule) => ({
      type: Object.values(SELECTION_VALUE_RULE_TYPES).includes(rule?.type)
        ? rule.type
        : null,
      property: rule?.property ?? null,
      value: Object.hasOwn(rule ?? {}, 'value') ? rule.value : true,
      selectionValue: Number.isFinite(rule?.selectionValue) && rule.selectionValue > 0
        ? rule.selectionValue
        : 1,
      metadata: { ...(rule?.metadata ?? {}) }
    }))
    .filter((rule) => rule.type && rule.property);
}

function normalizeTieBreakers(tieBreakers = []) {
  return (tieBreakers ?? [])
    .map((rule) => ({
      type: Object.values(SELECTION_TIE_BREAKER_TYPES).includes(rule?.type)
        ? rule.type
        : null,
      selectorIds: [...(rule?.selectorIds ?? [])].filter(Boolean),
      property: rule?.property ?? null,
      value: Object.hasOwn(rule ?? {}, 'value') ? rule.value : true,
      metadata: { ...(rule?.metadata ?? {}) }
    }))
    .filter((rule) =>
      rule.type === SELECTION_TIE_BREAKER_TYPES.SELECTOR_PROPERTY
        ? !!rule.property
        : rule.type && rule.selectorIds.length > 0
    );
}

function normalizeSelectorEligibility({ requireInPlay = true } = {}) {
  return {
    requireInPlay: requireInPlay !== false
  };
}

// Crea una seleccion normalizada.
//
// Guardamos selectorId y candidateId porque el motor trabaja
// sobre roles, no sobre nombres visuales ni tokens de tablero.
export function createSelection({
  selectorId,
  candidateId = null,
  abstain = false,
  value = 1,
  roundId = SELECTION_ROUND_TYPES.INITIAL,
  metadata = {}
} = {}) {
  const isAbstention = abstain === true;

  return {
    selectorId,
    candidateId: isAbstention ? null : candidateId,
    abstain: isAbstention,
    value: Number.isFinite(value) ? value : 1,
    roundId,
    metadata: { ...metadata }
  };
}

function getSelectionWeightForSelector(selectorId = null, selectionWeights = []) {
  return (
    (selectionWeights ?? []).find((rule) => rule.selectorId === selectorId)?.value ??
    null
  );
}

function selectorMatchesValueRule(selector = null, rule = {}) {
  if (rule.type !== SELECTION_VALUE_RULE_TYPES.SELECTOR_PROPERTY) return false;
  return hasPropertyValue(selector, rule.property, rule.value);
}

function getSelectionValueRuleForSelector(session = {}, selectorId = null, selectionValueRules = []) {
  const selector = findRole(session, selectorId);
  return (selectionValueRules ?? []).find((rule) => selectorMatchesValueRule(selector, rule)) ?? null;
}

function getSelectionValueForSelector({
  session = {},
  selectorId = null,
  selectionWeights = [],
  selectionValueRules = []
} = {}) {
  return (
    getSelectionValueRuleForSelector(session, selectorId, selectionValueRules)?.selectionValue ??
    getSelectionWeightForSelector(selectorId, selectionWeights) ??
    1
  );
}

function applySelectionRuleWeights(session = {}, selections = [], rules = {}) {
  return (selections ?? []).map((rawSelection) => {
    const selection = createSelection(rawSelection);
    const ruleWeight = getSelectionValueForSelector({
      session,
      selectorId: selection.selectorId,
      selectionWeights: rules.selectionWeights,
      selectionValueRules: rules.selectionValueRules
    });

    if (ruleWeight === selection.value) return selection;

    return {
      ...selection,
      value: ruleWeight,
      metadata: {
        ...selection.metadata,
        effectiveSelectionValue: ruleWeight,
        valueSource: 'selection_rule'
      }
    };
  });
}

// Busca un rol de sesion por id.
function findRole(session, roleId) {
  return (session?.roles ?? []).find((role) => role.id === roleId) ?? null;
}

// Devuelve los ids de roles activos por defecto.
export function getInPlaySelectorIds(session = {}) {
  return (session?.roles ?? [])
    .filter((role) => role?.inPlay === true)
    .map((role) => role.id);
}

// Devuelve los candidatos por defecto de una seleccion.
//
// candidateIds no significa "objetivos narrativos"; significa roles que pueden
// recibir selecciones en esta ronda. Si una regla no acota candidatos, todos los roles
// inPlay son candidatos.
export function getDefaultSelectionCandidateIds(session = {}) {
  return getInPlaySelectorIds(session);
}

export function getRequiredSelectorIds(session = {}, selectorIds = []) {
  return Array.isArray(selectorIds) && selectorIds.length > 0
    ? [...selectorIds]
    : getInPlaySelectorIds(session);
}

// Crea errores de selecciones obligatorias faltantes.
export function getRequiredSelectionErrors({ session, selectorIds = [], seenSelectors, selectionRules = {} }) {
  if (selectionRules.required !== SELECTION_REQUIRED_RULES.ALL_SELECTORS) return [];

  const missingSelectorIds = getRequiredSelectorIds(session, selectorIds).filter((id) => !seenSelectors.has(id));
  if (missingSelectorIds.length === 0) return [];

  return [
    {
      code: 'selection/missing-required-selections',
      message: 'all required selectors must select',
      missingSelectorIds
    }
  ];
}

function hasPropertyValue(role, property, value) {
  return role?.[property] === value || role?.properties?.[property]?.value === value;
}

function getRoleIdsByGroup(session = {}, groupId = null) {
  return (session.groups ?? []).find((group) => group.id === groupId || group.key === groupId)?.roleIds ?? [];
}

export function resolveCandidateIds({
  session = {},
  selectorIds = [],
  candidateIds = null,
  candidateRules = []
} = {}) {
  const baseCandidateIds = Array.isArray(candidateIds)
    ? [...candidateIds]
    : getDefaultSelectionCandidateIds(session);
  let resolvedCandidateIds = new Set(baseCandidateIds);
  const roleById = new Map((session.roles ?? []).map((role) => [role.id, role]));

  (candidateRules ?? []).forEach((rule) => {
    if (rule?.type === CANDIDATE_RULE_TYPES.HAS_PROPERTY) {
      resolvedCandidateIds = new Set(
        [...resolvedCandidateIds].filter((roleId) =>
          hasPropertyValue(roleById.get(roleId), rule.property, rule.value)
        )
      );
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.NOT_HAS_PROPERTY) {
      resolvedCandidateIds = new Set(
        [...resolvedCandidateIds].filter((roleId) =>
          !hasPropertyValue(roleById.get(roleId), rule.property, rule.value)
        )
      );
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.NOT_SELECTOR) {
      selectorIds.forEach((selectorId) => resolvedCandidateIds.delete(selectorId));
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.SAME_GROUP) {
      const groupRoleIds = new Set(getRoleIdsByGroup(session, rule.groupId));
      resolvedCandidateIds = new Set(
        [...resolvedCandidateIds].filter((roleId) => groupRoleIds.has(roleId))
      );
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.NOT_SAME_GROUP) {
      const groupRoleIds = new Set(getRoleIdsByGroup(session, rule.groupId));
      resolvedCandidateIds = new Set(
        [...resolvedCandidateIds].filter((roleId) => !groupRoleIds.has(roleId))
      );
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.EXPLICIT_INCLUDE) {
      (rule.roleIds ?? []).forEach((roleId) => resolvedCandidateIds.add(roleId));
    }

    if (rule?.type === CANDIDATE_RULE_TYPES.EXPLICIT_EXCLUDE) {
      (rule.roleIds ?? []).forEach((roleId) => resolvedCandidateIds.delete(roleId));
    }
  });

  return [...resolvedCandidateIds];
}

// Valida selecciones antes del recuento.
//
// Reglas actuales:
// - el selector debe existir;
// - el selector debe estar inPlay;
// - el candidate debe existir;
// - el candidate debe estar inPlay;
// - cada selector solo puede emitir una seleccion por ronda;
// - todo candidate debe estar dentro de los candidatos de la ronda;
// - si selectionRules.required=all_selectors, todos los selectorIds del stage deben decidir;
// - abstenerse solo es valido si selectionRules.abstain lo permite;
// - si hay restricciones de grupo, selector y candidate no pueden incumplirlas.
export function validateSelections({
  session,
  selectorIds = [],
  selections = [],
  selectionRules = createSelectionRules()
} = {}) {
  const rules = createSelectionRules(selectionRules);
  const errors = [];
  const seenSelectors = new Set();
  const allowedSelectors = Array.isArray(selectorIds) && selectorIds.length > 0 ? new Set(selectorIds) : null;
  const candidateIds = resolveCandidateIds({
    session,
    selectorIds,
    candidateIds: rules.candidateIds,
    candidateRules: rules.candidateRules
  });
  const candidates = new Set(candidateIds);

  (selections ?? []).forEach((rawSelection, index) => {
    const selection = createSelection(rawSelection);
    const selector = findRole(session, selection.selectorId);
    const candidate = selection.abstain ? null : findRole(session, selection.candidateId);

    if (!selector) {
      errors.push({
        code: 'selection/missing-selector',
        message: `selection at index ${index} has missing selector "${selection.selectorId}"`,
        index,
        selectorId: selection.selectorId
      });
    } else if (rules.selectorEligibility.requireInPlay && selector.inPlay !== true) {
      errors.push({
        code: 'selection/selector-not-in-play',
        message: `selector "${selector.id}" is not inPlay`,
        index,
        selectorId: selector.id
      });
    }

    if (allowedSelectors && !allowedSelectors.has(selection.selectorId)) {
      errors.push({
        code: 'selection/selector-not-allowed',
        message: `selector "${selection.selectorId}" is not allowed in this selection round`,
        index,
        selectorId: selection.selectorId,
        allowedSelectorIds: [...allowedSelectors]
      });
    }

    if (selection.abstain && rules.abstain !== SELECTION_ABSTAIN_RULES.ALLOWED) {
      errors.push({
        code: 'selection/abstain-not-allowed',
        message: `selector "${selection.selectorId}" cannot abstain in this selection round`,
        index,
        selectorId: selection.selectorId
      });
    }

    if (!selection.abstain && !candidate) {
      errors.push({
        code: 'selection/missing-candidate',
        message: `selection at index ${index} has missing candidate "${selection.candidateId}"`,
        index,
        candidateId: selection.candidateId
      });
    } else if (!selection.abstain && candidate.inPlay !== true) {
      errors.push({
        code: 'selection/candidate-not-in-play',
        message: `candidate "${candidate.id}" is not inPlay`,
        index,
        candidateId: candidate.id
      });
    }

    if (!selection.abstain && !candidates.has(selection.candidateId)) {
      errors.push({
        code: 'selection/candidate-not-candidate',
        message: `candidate "${selection.candidateId}" is not a candidate in this selection round`,
        index,
        candidateId: selection.candidateId,
        candidateIds: [...candidates]
      });
    }

    if (!selection.abstain) {
      getGroupRestrictionErrors({
        session,
        selection,
        index,
        groupRestrictions: rules.groupRestrictions
      }).forEach((error) =>
        errors.push(error)
      );
    }

    if (seenSelectors.has(selection.selectorId)) {
      errors.push({
        code: 'selection/duplicate-selector',
        message: `selector "${selection.selectorId}" selected more than once`,
        index,
        selectorId: selection.selectorId
      });
    }
    seenSelectors.add(selection.selectorId);
  });

  errors.push(...getRequiredSelectionErrors({ session, selectorIds, seenSelectors, selectionRules: rules }));

  return {
    ok: errors.length === 0,
    errors
  };
}

// Valida restricciones basadas en grupos de sesion.
//
// Ejemplo actual:
// - exclude_group_member_candidate + linked impide elegir a un miembro del grupo.
export function getGroupRestrictionErrors({
  session,
  selection,
  index,
  groupRestrictions = []
} = {}) {
  return (groupRestrictions ?? []).flatMap((restriction) => {
    if (restriction?.type !== SELECTION_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE) return [];

    const groupType = restriction.groupType ? normalizeId(restriction.groupType) : null;
    const groupId = restriction.groupId ? normalizeId(restriction.groupId) : null;
    if (!groupType && !groupId) return [];

    const group = groupId
      ? (session.groups ?? []).find((entry) => entry.id === groupId || entry.key === groupId)
      : null;
    if (groupId && !(group?.roleIds ?? []).includes(selection.selectorId)) return [];

    const groupMemberRoleIds = groupId
      ? (group?.roleIds ?? []).filter((roleId) => roleId !== selection.selectorId)
      : getGroupMemberRoleIds(
          session,
          selection.selectorId,
          groupType
        );

    if (!groupMemberRoleIds.includes(selection.candidateId)) return [];

    return [
      {
        code: 'selection/restricted-group-member-candidate',
        message: `selector "${selection.selectorId}" cannot select group member candidate "${selection.candidateId}"`,
        index,
        selectorId: selection.selectorId,
        candidateId: selection.candidateId,
        groupType,
        groupId
      }
    ];
  });
}

// Agrupa selecciones no abstenidas por candidateId y suma sus unidades.
export function tallySelections(selections = []) {
  const totals = new Map();

  (selections ?? []).forEach((rawSelection) => {
    const selection = createSelection(rawSelection);
    if (selection.abstain) return;

    const currentTotal = totals.get(selection.candidateId) ?? 0;
    totals.set(selection.candidateId, currentTotal + selection.value);
  });

  return [...totals.entries()]
    .map(([candidateId, selectionCount]) => ({
      candidateId,
      selectionCount
    }))
    .sort(
      (a, b) =>
        b.selectionCount - a.selectionCount || a.candidateId.localeCompare(b.candidateId)
    );
}

function getCurrentCandidateIds(session, rules) {
  return Array.isArray(rules.candidateIds)
    ? [...rules.candidateIds]
    : getDefaultSelectionCandidateIds(session);
}

function getSelectedCandidateIds(selectionTally = []) {
  return selectionTally.map((entry) => entry.candidateId);
}

function getRunoffCandidateIds({ session, rules, selectionTally, tiedCandidates }) {
  if (rules.runoff === SELECTION_RUNOFF_RULES.SELECTED_CANDIDATES) {
    return getSelectedCandidateIds(selectionTally);
  }
  if (rules.runoff === SELECTION_RUNOFF_RULES.SAME_CANDIDATES) {
    return getCurrentCandidateIds(session, rules);
  }
  return [...tiedCandidates];
}

function canRequestAnotherRound({ roundIndex = 0, rules }) {
  return roundIndex < rules.repeatLimit;
}

function createNextRound({ roundType, roundIndex, candidateIds }) {
  return {
    roundType,
    roundIndex: roundIndex + 1,
    candidateIds: [...candidateIds]
  };
}

function createNullSelectionResult({
  reason,
  selectionTally,
  abstainedSelections,
  tiedCandidateIds = [],
  nextRound = null,
  metadata = {}
}) {
  return {
    type: SELECTION_OUTCOME_TYPES.NULL,
    reason,
    selectionTally,
    abstainedSelections,
    chosenId: null,
    tiedCandidateIds,
    ...metadata,
    ...(nextRound ? { nextRound } : {})
  };
}

function createChosenSelectionResult({
  reason,
  selectionTally,
  abstainedSelections,
  chosenId,
  metadata = {}
}) {
  return {
    type: SELECTION_OUTCOME_TYPES.CHOSEN,
    reason,
    selectionTally,
    abstainedSelections,
    chosenId,
    tiedCandidateIds: [],
    ...metadata
  };
}

function createTieSelectionResult({ selectionTally, abstainedSelections, tiedCandidateIds, nextRound }) {
  return {
    type: SELECTION_OUTCOME_TYPES.TIE,
    reason: 'runoff_required',
    selectionTally,
    abstainedSelections,
    chosenId: null,
    tiedCandidateIds,
    nextRound
  };
}

function createSelectionResolution(result) {
  return {
    ok: true,
    errors: [],
    result
  };
}

function getRepeatOnNullNextRound({ session, rules, roundType, roundIndex }) {
  if (
    rules.nullResult !== SELECTION_NULL_RULES.REPEAT_ON_NULL ||
    !canRequestAnotherRound({ roundIndex, rules })
  ) {
    return null;
  }

  return createNextRound({
    roundType,
    roundIndex,
    candidateIds: getCurrentCandidateIds(session, rules)
  });
}

function getSupportBaseCount({
  session,
  selectorIds = [],
  selections = [],
  supportThreshold,
  selectionWeights = [],
  selectionValueRules = []
}) {
  if (supportThreshold.base === SELECTION_SUPPORT_BASES.SELECTOR_COUNT) {
    return getRequiredSelectorIds(session, selectorIds).reduce(
      (total, selectorId) =>
        total + getSelectionValueForSelector({
          session,
          selectorId,
          selectionWeights,
          selectionValueRules
        }),
      0
    );
  }
  return (selections ?? [])
    .map(createSelection)
    .filter((selection) => !selection.abstain)
    .reduce((total, selection) => total + selection.value, 0);
}

function getRequiredSupportCount({ baseCount, supportThreshold }) {
  if (supportThreshold.type === SELECTION_SUPPORT_THRESHOLD_TYPES.MAJORITY) {
    return Math.floor(baseCount / 2) + 1;
  }
  if (supportThreshold.type === SELECTION_SUPPORT_THRESHOLD_TYPES.FRACTION) {
    return Math.ceil((baseCount * supportThreshold.numerator) / supportThreshold.denominator);
  }
  return 0;
}

function evaluateSupportThreshold({
  session,
  selectorIds = [],
  selections = [],
  selectionCount = 0,
  supportThreshold,
  selectionWeights = [],
  selectionValueRules = []
}) {
  if (supportThreshold.type === SELECTION_SUPPORT_THRESHOLD_TYPES.NONE) {
    return {
      ok: true,
      requiredSupportCount: 0,
      supportBaseCount: 0
    };
  }

  const supportBaseCount = getSupportBaseCount({
    session,
    selectorIds,
    selections,
    supportThreshold,
    selectionWeights,
    selectionValueRules
  });
  const requiredSupportCount = getRequiredSupportCount({ baseCount: supportBaseCount, supportThreshold });

  return {
    ok: selectionCount >= requiredSupportCount,
    requiredSupportCount,
    supportBaseCount
  };
}

function resolveTieByAuthority({ decisions = [], tiedCandidates = [], tieBreakers = [] }) {
  const tiedCandidateIds = new Set(tiedCandidates);

  for (const rule of tieBreakers ?? []) {
    if (rule.type !== SELECTION_TIE_BREAKER_TYPES.SELECTOR_AUTHORITY) continue;

    for (const selectorId of rule.selectorIds ?? []) {
      const selection = decisions.find(
        (decision) =>
          decision.selectorId === selectorId &&
          !decision.abstain &&
          tiedCandidateIds.has(decision.candidateId)
      );

      if (selection) {
        return {
          chosenId: selection.candidateId,
          tieBreaker: {
            type: rule.type,
            selectorId,
            candidateId: selection.candidateId
          }
        };
      }
    }
  }

  return null;
}

function resolveTieBySelectorProperty({ session = {}, decisions = [], tiedCandidates = [], tieBreakers = [] }) {
  const tiedCandidateIds = new Set(tiedCandidates);

  for (const rule of tieBreakers ?? []) {
    if (rule.type !== SELECTION_TIE_BREAKER_TYPES.SELECTOR_PROPERTY) continue;

    const selection = decisions.find((decision) => {
      const selector = findRole(session, decision.selectorId);
      return (
        !decision.abstain &&
        tiedCandidateIds.has(decision.candidateId) &&
        hasPropertyValue(selector, rule.property, rule.value)
      );
    });

    if (selection) {
      return {
        chosenId: selection.candidateId,
        tieBreaker: {
          type: rule.type,
          selectorId: selection.selectorId,
          candidateId: selection.candidateId,
          property: rule.property,
          value: rule.value
        }
      };
    }
  }

  return null;
}

function getAbstainSelectionCount(abstainedSelections = []) {
  return (abstainedSelections ?? []).reduce((total, selection) => total + selection.value, 0);
}

function shouldNullifyByAbstention({ abstainedSelections = [], highestSelectionCount = 0, rules }) {
  if (rules.abstainResolution.type !== SELECTION_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST) {
    return false;
  }
  return getAbstainSelectionCount(abstainedSelections) > highestSelectionCount;
}

function evaluateUnanimousSelection({ session, selectorIds = [], selectionTally = [], abstainedSelections = [] }) {
  const requiredSelectorCount = getRequiredSelectorIds(session, selectorIds).length;
  const hasUnanimousTarget =
    selectionTally.length === 1 &&
    abstainedSelections.length === 0 &&
    selectionTally[0].selectionCount === requiredSelectorCount;

  return {
    hasUnanimousTarget,
    chosenId: hasUnanimousTarget ? selectionTally[0].candidateId : null
  };
}

// Resuelve una ronda de seleccion.
//
// Prioridad de reglas:
// 1. Validar participantes, candidatos y restricciones.
// 2. Resolver seleccion vacia o totalmente abstenida como null.
// 3. Aplicar unanimidad si el stage la exige.
// 4. Aplicar abstainResolution si la abstencion domina.
// 5. Aceptar chosen provisional solo si supera supportThreshold.
// 6. Resolver empate con tie/runoff/repeatLimit.
export function resolveSelectionRound({
  session,
  selectorIds = [],
  selections = [],
  selectionRules = createSelectionRules(),
  roundType = SELECTION_ROUND_TYPES.INITIAL,
  roundIndex = null
} = {}) {
  const rules = createSelectionRules(selectionRules);
  const currentRoundIndex =
    Number.isInteger(roundIndex)
      ? roundIndex
      : roundType === SELECTION_ROUND_TYPES.RUNOFF
        ? 1
        : 0;
  const validation = validateSelections({
    session,
    selectorIds,
    selections,
    selectionRules: rules
  });
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      result: null
    };
  }

  const decisions = applySelectionRuleWeights(session, selections, rules);
  const abstainedSelections = decisions.filter((selection) => selection.abstain);
  const selectionTally = tallySelections(decisions);
  const highestSelectionCount = selectionTally[0]?.selectionCount ?? 0;
  const tiedCandidates = selectionTally
    .filter((entry) => entry.selectionCount === highestSelectionCount)
    .map((entry) => entry.candidateId);

  if (selectionTally.length === 0) {
    const reason =
      decisions.length > 0 && decisions.length === abstainedSelections.length ? 'all_abstained' : 'no_selections';
    return createSelectionResolution(
      createNullSelectionResult({
        reason,
        selectionTally,
        abstainedSelections,
        nextRound: getRepeatOnNullNextRound({
          session,
          rules,
          roundType,
          roundIndex: currentRoundIndex
        })
      })
    );
  }

  if (rules.unanimous === SELECTION_UNANIMOUS_RULES.REQUIRED) {
    const unanimous = evaluateUnanimousSelection({ session, selectorIds, selectionTally, abstainedSelections });

    return createSelectionResolution(
      unanimous.hasUnanimousTarget
        ? createChosenSelectionResult({
            reason: 'unanimous_candidate',
            selectionTally,
            abstainedSelections,
            chosenId: unanimous.chosenId
          })
        : createNullSelectionResult({
            reason: 'not_unanimous',
            selectionTally,
            abstainedSelections,
            nextRound: getRepeatOnNullNextRound({
              session,
              rules,
              roundType,
              roundIndex: currentRoundIndex
            })
          })
    );
  }

  if (shouldNullifyByAbstention({ abstainedSelections, highestSelectionCount, rules })) {
    return createSelectionResolution(
      createNullSelectionResult({
        reason: 'abstention_highest',
        selectionTally,
        abstainedSelections,
        tiedCandidateIds: tiedCandidates.length > 1 ? tiedCandidates : [],
        nextRound: getRepeatOnNullNextRound({
          session,
          rules,
          roundType,
          roundIndex: currentRoundIndex
        }),
        metadata: {
          abstainSelectionCount: getAbstainSelectionCount(abstainedSelections)
        }
      })
    );
  }

  if (tiedCandidates.length === 1) {
    const chosenEntry = selectionTally.find((entry) => entry.candidateId === tiedCandidates[0]);
    const support = evaluateSupportThreshold({
      session,
      selectorIds,
      selections: decisions,
      selectionCount: chosenEntry?.selectionCount ?? 0,
      supportThreshold: rules.supportThreshold,
      selectionWeights: rules.selectionWeights,
      selectionValueRules: rules.selectionValueRules
    });

    if (!support.ok) {
      return createSelectionResolution(
        createNullSelectionResult({
          reason: 'insufficient_support',
          selectionTally,
          abstainedSelections,
          nextRound: getRepeatOnNullNextRound({
            session,
            rules,
            roundType,
            roundIndex: currentRoundIndex
          }),
          metadata: {
            support
          }
        })
      );
    }

    return createSelectionResolution(
      createChosenSelectionResult({
        reason: 'single_highest_selection_count',
        selectionTally,
        abstainedSelections,
        chosenId: tiedCandidates[0],
        metadata: {
          support
        }
      })
    );
  }

  const authorityTieBreak = resolveTieByAuthority({
    decisions,
    tiedCandidates,
    tieBreakers: rules.tieBreakers
  });

  if (authorityTieBreak) {
    return createSelectionResolution(
      createChosenSelectionResult({
        reason: 'tie_break_authority',
        selectionTally,
        abstainedSelections,
        chosenId: authorityTieBreak.chosenId,
        metadata: {
          tieBreaker: authorityTieBreak.tieBreaker,
          tiedCandidateIds: tiedCandidates
        }
      })
    );
  }

  const selectorPropertyTieBreak = resolveTieBySelectorProperty({
    session,
    decisions,
    tiedCandidates,
    tieBreakers: rules.tieBreakers
  });

  if (selectorPropertyTieBreak) {
    return createSelectionResolution(
      createChosenSelectionResult({
        reason: 'tie_break_selector_property',
        selectionTally,
        abstainedSelections,
        chosenId: selectorPropertyTieBreak.chosenId,
        metadata: {
          tieBreaker: selectorPropertyTieBreak.tieBreaker,
          tiedCandidateIds: tiedCandidates
        }
      })
    );
  }

  if (
    rules.tie === SELECTION_TIE_RULES.RUNOFF_ON_TIE &&
    canRequestAnotherRound({ roundIndex: currentRoundIndex, rules })
  ) {
    return createSelectionResolution(
      createTieSelectionResult({
        selectionTally,
        abstainedSelections,
        tiedCandidateIds: tiedCandidates,
        nextRound: createNextRound({
          roundType: SELECTION_ROUND_TYPES.RUNOFF,
          roundIndex: currentRoundIndex,
          candidateIds: getRunoffCandidateIds({ session, rules, selectionTally, tiedCandidates })
        })
      })
    );
  }

  return createSelectionResolution(
    createNullSelectionResult({
      reason: roundType === SELECTION_ROUND_TYPES.RUNOFF ? 'runoff_tied' : 'tied_selection',
      selectionTally,
      abstainedSelections,
      tiedCandidateIds: tiedCandidates
    })
  );
}

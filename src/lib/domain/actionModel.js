// actionModel.js
// -----------------------------------------------------------------------------
// Este archivo resuelve acciones genericas del motor.
//
// Acciones implementadas por ahora:
// - inspect_role: revela informacion.
// - set_in_play: intenta cambiar si un objetivo sigue en el juego principal.
// - block_property_change: bloquea un cambio concreto contra un objetivo.
// - link_targets: crea un grupo mecanico entre varios objetivos.
// - select: resuelve una seleccion y devuelve chosen/empate/nulo.
// - conclude_play: concluye la parte jugable cuando el ciclo ya tiene outcome.
//
// Importante:
// - No sabe que skin o nombre visible tendra un role.
// - No sabe que fantasia representa cada alignment.
// - No pinta nada en pantalla.
// - No guarda nada fuera de la session.
//
// Recibe datos de session/input/context, coordina la resolucion/aplicacion de
// efectos con effectModel y devuelve una resolucion mecanica para otros modelos.
// -----------------------------------------------------------------------------

import {
  applyEffects,
  resolveEffects
} from './effectModel.js';
import { EFFECT_TYPES, validateEffect } from './effectDefinition.js';
import { PROPERTY_BLOCK_EXPIRATION_TYPES } from './roleModel.js';
import {
  collectSelectionRules,
  getGroupMemberRoleIds
} from './groupModel.js';
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { getCurrentCycleId, normalizeId } from './sessionModel.js';
import {
  ACTION_IDS,
  validateAction as validateActionShape
} from './actionDefinition.js';
import { HISTORY_RESULTS, appendActionHistory } from './historyModel.js';
import { VISIBILITY } from './surfaceModel.js';
import {
  SELECT_SELECTOR_SOURCES,
  getActionActors,
  getRequiredSelectorIds,
  getSelectRuleSelectorIds,
  getSelectSelectorIds
} from './actorModel.js';
import {
  findRole,
  getDefaultSelectCandidateIds,
  hasRolePropertyValue,
  resolveCandidateIds,
  validateActionTargets
} from './targetModel.js';

export { ACTION_IDS };
export {
  SELECT_SELECTOR_SOURCES,
  getRequiredSelectorIds,
  getSelectSelectorIds
} from './actorModel.js';
export {
  CANDIDATE_RULE_TYPES,
  getDefaultSelectCandidateIds,
  resolveCandidateIds
} from './targetModel.js';

export const SELECT_OUTCOME_TYPES = Object.freeze({
  CHOSEN: 'chosen',
  TIE: 'tie',
  NULL: 'null'
});

export const SELECT_TIE_RULES = Object.freeze({
  NULL_ON_TIE: 'null_on_tie',
  RUNOFF_ON_TIE: 'runoff_on_tie'
});

export const SELECT_TIE_BREAKER_TYPES = Object.freeze({
  SELECTOR_AUTHORITY: 'selector_authority',
  SELECTOR_PROPERTY: 'selector_property'
});

export const SELECT_RUNOFF_RULES = Object.freeze({
  TIED_CANDIDATES: 'tied_candidates',
  SELECTED_CANDIDATES: 'selected_candidates',
  SAME_CANDIDATES: 'same_candidates'
});

export const SELECT_NULL_RULES = Object.freeze({
  END_AS_NULL: 'end_as_null',
  REPEAT_ON_NULL: 'repeat_on_null'
});

export const SELECT_SUPPORT_THRESHOLD_TYPES = Object.freeze({
  NONE: 'none',
  MAJORITY: 'majority',
  FRACTION: 'fraction'
});

export const SELECT_SUPPORT_BASES = Object.freeze({
  CAST_SELECTIONS: 'cast_selections',
  SELECTOR_COUNT: 'selector_count'
});

export const SELECT_ROUND_TYPES = Object.freeze({
  INITIAL: 'initial',
  RUNOFF: 'runoff'
});

export const SELECT_REQUIRED_RULES = Object.freeze({
  OPTIONAL: 'optional',
  ALL_SELECTORS: 'all_selectors'
});

export const SELECT_ABSTAIN_RULES = Object.freeze({
  NOT_ALLOWED: 'not_allowed',
  ALLOWED: 'allowed'
});

export const SELECT_ABSTAIN_RESOLUTION_TYPES = Object.freeze({
  IGNORE: 'ignore',
  NULL_IF_HIGHEST: 'null_if_highest'
});

export const SELECT_UNANIMOUS_RULES = Object.freeze({
  NOT_REQUIRED: 'not_required',
  REQUIRED: 'required'
});

export const SELECT_RESTRICTION_TYPES = Object.freeze({
  EXCLUDE_GROUP_MEMBER_CANDIDATE: 'exclude_group_member_candidate'
});

export const SELECT_VALUE_RULE_TYPES = Object.freeze({
  SELECTOR_PROPERTY: 'selector_property'
});

export function createSelectRules({
  required = SELECT_REQUIRED_RULES.OPTIONAL,
  abstain = SELECT_ABSTAIN_RULES.NOT_ALLOWED,
  unanimous = SELECT_UNANIMOUS_RULES.NOT_REQUIRED,
  tie = SELECT_TIE_RULES.NULL_ON_TIE,
  runoff = SELECT_RUNOFF_RULES.TIED_CANDIDATES,
  nullResult = SELECT_NULL_RULES.END_AS_NULL,
  repeatLimit = 1,
  supportThreshold = {},
  abstainResolution = {},
  groupRestrictions = [],
  candidateIds = null,
  candidateRules = [],
  selectionWeights = [],
  selectionValueRules = [],
  tieBreakers = [],
  selectorEligibility = {},
  selectorSource = SELECT_SELECTOR_SOURCES.STAGE_ACTORS
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
    selectionWeights: normalizeSelectWeights(selectionWeights),
    selectionValueRules: normalizeSelectValueRules(selectionValueRules),
    tieBreakers: normalizeTieBreakers(tieBreakers),
    selectorEligibility: normalizeSelectorEligibility(selectorEligibility),
    selectorSource: Object.values(SELECT_SELECTOR_SOURCES).includes(selectorSource)
      ? selectorSource
      : SELECT_SELECTOR_SOURCES.STAGE_ACTORS
  };
}

function normalizeSupportThreshold({
  type = SELECT_SUPPORT_THRESHOLD_TYPES.NONE,
  base = SELECT_SUPPORT_BASES.CAST_SELECTIONS,
  numerator = 1,
  denominator = 2
} = {}) {
  const normalizedType = Object.values(SELECT_SUPPORT_THRESHOLD_TYPES).includes(type)
    ? type
    : SELECT_SUPPORT_THRESHOLD_TYPES.NONE;
  const normalizedBase = Object.values(SELECT_SUPPORT_BASES).includes(base)
    ? base
    : SELECT_SUPPORT_BASES.CAST_SELECTIONS;

  return {
    type: normalizedType,
    base: normalizedBase,
    numerator: Number.isInteger(numerator) && numerator > 0 ? numerator : 1,
    denominator: Number.isInteger(denominator) && denominator > 0 ? denominator : 2
  };
}

function normalizeAbstainResolution({
  type = SELECT_ABSTAIN_RESOLUTION_TYPES.IGNORE
} = {}) {
  return {
    type: Object.values(SELECT_ABSTAIN_RESOLUTION_TYPES).includes(type)
      ? type
      : SELECT_ABSTAIN_RESOLUTION_TYPES.IGNORE
  };
}

function normalizeSelectWeights(selectionWeights = []) {
  return (selectionWeights ?? [])
    .map((rule) => ({
      selectorId: rule?.selectorId ?? null,
      value: Number.isFinite(rule?.value) && rule.value > 0 ? rule.value : 1,
      metadata: { ...(rule?.metadata ?? {}) }
    }))
    .filter((rule) => rule.selectorId);
}

function normalizeSelectValueRules(selectionValueRules = []) {
  return (selectionValueRules ?? [])
    .map((rule) => ({
      type: Object.values(SELECT_VALUE_RULE_TYPES).includes(rule?.type)
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
      type: Object.values(SELECT_TIE_BREAKER_TYPES).includes(rule?.type)
        ? rule.type
        : null,
      selectorIds: [...(rule?.selectorIds ?? [])].filter(Boolean),
      property: rule?.property ?? null,
      value: Object.hasOwn(rule ?? {}, 'value') ? rule.value : true,
      metadata: { ...(rule?.metadata ?? {}) }
    }))
    .filter((rule) =>
      rule.type === SELECT_TIE_BREAKER_TYPES.SELECTOR_PROPERTY
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
export function createSelectDecision({
  selectorId,
  candidateId = null,
  abstain = false,
  value = 1,
  roundId = SELECT_ROUND_TYPES.INITIAL,
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

function getSelectWeightForSelector(selectorId = null, selectionWeights = []) {
  return (
    (selectionWeights ?? []).find((rule) => rule.selectorId === selectorId)?.value ??
    null
  );
}

function selectorMatchesValueRule(selector = null, rule = {}) {
  if (rule.type !== SELECT_VALUE_RULE_TYPES.SELECTOR_PROPERTY) return false;
  return hasRolePropertyValue(selector, rule.property, rule.value);
}

function getSelectValueRuleForSelector(session = {}, selectorId = null, selectionValueRules = []) {
  const selector = findRole(session, selectorId);
  return (selectionValueRules ?? []).find((rule) => selectorMatchesValueRule(selector, rule)) ?? null;
}

function getSelectValueForSelector({
  session = {},
  selectorId = null,
  selectionWeights = [],
  selectionValueRules = []
} = {}) {
  return (
    getSelectValueRuleForSelector(session, selectorId, selectionValueRules)?.selectionValue ??
    getSelectWeightForSelector(selectorId, selectionWeights) ??
    1
  );
}

function resolveSelectDecisionValues(session = {}, selections = [], rules = {}) {
  return (selections ?? []).map((rawSelection) => {
    const selection = createSelectDecision(rawSelection);
    const ruleWeight = getSelectValueForSelector({
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

function ruleScopeMatchesContext(scope = {}, context = {}) {
  const poolKeys = (scope.poolKeys ?? []).map(normalizeId);
  const stageKeys = (scope.stageKeys ?? []).map(normalizeId);
  const recipeKeys = (scope.recipeKeys ?? []).map(normalizeId);
  const methods = (scope.methods ?? []).map(normalizeId);

  if (poolKeys.length > 0 && !poolKeys.includes(normalizeId(context.poolKey))) return false;
  if (stageKeys.length > 0 && !stageKeys.includes(normalizeId(context.stageKey))) return false;
  if (recipeKeys.length > 0 && !recipeKeys.includes(normalizeId(context.recipeKey))) return false;
  if (methods.length > 0 && !methods.includes(normalizeId(context.method))) return false;

  return true;
}

function collectSessionSelectRules(session = {}, selectionContext = {}) {
  return (session.selectionRules ?? [])
    .filter((rule) => ruleScopeMatchesContext(rule.scope ?? {}, selectionContext))
    .map((rule) => rule.rules ?? rule);
}

export function mergeSelectRules(baseRules = {}, additionalRules = []) {
  return (additionalRules ?? []).reduce((merged, rule) => ({
    ...merged,
    ...rule,
    groupRestrictions: [
      ...(merged.groupRestrictions ?? []),
      ...(rule.groupRestrictions ?? [])
    ],
    candidateRules: [
      ...(merged.candidateRules ?? []),
      ...(rule.candidateRules ?? [])
    ],
    selectionWeights: [
      ...(merged.selectionWeights ?? []),
      ...(rule.selectionWeights ?? [])
    ],
    selectionValueRules: [
      ...(merged.selectionValueRules ?? []),
      ...(rule.selectionValueRules ?? [])
    ],
    tieBreakers: [
      ...(merged.tieBreakers ?? []),
      ...(rule.tieBreakers ?? [])
    ],
    selectorEligibility: {
      ...(merged.selectorEligibility ?? {}),
      ...(rule.selectorEligibility ?? {})
    },
    supportThreshold: {
      ...(merged.supportThreshold ?? {}),
      ...(rule.supportThreshold ?? {})
    },
    abstainResolution: {
      ...(merged.abstainResolution ?? {}),
      ...(rule.abstainResolution ?? {})
    }
  }), { ...baseRules });
}

// Prepara el input para la action select.
//
// No resuelve la seleccion. Solo combina:
// - selectores reales de la fuente de seleccion;
// - selections recibidas por input;
// - reglas de seleccion de la fuente;
// - reglas globales de sesion;
// - restricciones aportadas por groups activos.
export function buildSelectActionInput({
  session = {},
  selectionSource = {},
  recipeKey = null,
  input = {}
} = {}) {
  const selectionRules = selectionSource?.selectionRules ?? {};
  const selectorIds = getSelectSelectorIds(session, selectionSource, input, selectionRules);
  const selectionContext = {
    method: 'vote',
    poolKey: selectionSource.poolKey ?? null,
    stageKey: selectionSource.key ?? null,
    recipeKey
  };
  const collectedRules = collectSelectionRules(session, {
    selectorIds: getSelectRuleSelectorIds(session, selectionSource, input, selectionRules),
    selectionContext
  });
  const sessionSelectionRules = collectSessionSelectRules(session, selectionContext);
  const mergedSelectionRules = mergeSelectRules(selectionRules, sessionSelectionRules);

  return {
    selectorIds,
    selections: input.selections ?? [],
    selectionRules: {
      ...mergedSelectionRules,
      candidateIds: input.candidateIds ?? mergedSelectionRules.candidateIds ?? null,
      groupRestrictions: [
        ...(mergedSelectionRules.groupRestrictions ?? []),
        ...(collectedRules.groupRestrictions ?? [])
      ]
    },
    roundType: input.roundType,
    roundIndex: input.roundIndex ?? 0
  };
}

// Crea errores de selecciones obligatorias faltantes.
export function getRequiredSelectDecisionErrors({ session, selectorIds = [], seenSelectors, selectionRules = {} }) {
  if (selectionRules.required !== SELECT_REQUIRED_RULES.ALL_SELECTORS) return [];

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
export function validateSelectDecisions({
  session,
  selectorIds = [],
  selections = [],
  selectionRules = createSelectRules()
} = {}) {
  const rules = createSelectRules(selectionRules);
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
    const selection = createSelectDecision(rawSelection);
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

    if (selection.abstain && rules.abstain !== SELECT_ABSTAIN_RULES.ALLOWED) {
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

  errors.push(...getRequiredSelectDecisionErrors({ session, selectorIds, seenSelectors, selectionRules: rules }));

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
    if (restriction?.type !== SELECT_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE) return [];

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
export function tallySelectDecisions(selections = []) {
  const totals = new Map();

  (selections ?? []).forEach((rawSelection) => {
    const selection = createSelectDecision(rawSelection);
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
    : getDefaultSelectCandidateIds(session);
}

function getSelectedCandidateIds(selectionTally = []) {
  return selectionTally.map((entry) => entry.candidateId);
}

function getRunoffCandidateIds({ session, rules, selectionTally, tiedCandidates }) {
  if (rules.runoff === SELECT_RUNOFF_RULES.SELECTED_CANDIDATES) {
    return getSelectedCandidateIds(selectionTally);
  }
  if (rules.runoff === SELECT_RUNOFF_RULES.SAME_CANDIDATES) {
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

function createNullSelectResolution({
  reason,
  selectionTally,
  abstainedSelections,
  tiedCandidateIds = [],
  nextRound = null,
  metadata = {}
}) {
  return {
    type: SELECT_OUTCOME_TYPES.NULL,
    reason,
    selectionTally,
    abstainedSelections,
    chosenId: null,
    tiedCandidateIds,
    ...metadata,
    ...(nextRound ? { nextRound } : {})
  };
}

function createChosenSelectResolution({
  reason,
  selectionTally,
  abstainedSelections,
  chosenId,
  metadata = {}
}) {
  return {
    type: SELECT_OUTCOME_TYPES.CHOSEN,
    reason,
    selectionTally,
    abstainedSelections,
    chosenId,
    tiedCandidateIds: [],
    ...metadata
  };
}

function createTieSelectResolution({ selectionTally, abstainedSelections, tiedCandidateIds, nextRound }) {
  return {
    type: SELECT_OUTCOME_TYPES.TIE,
    reason: 'runoff_required',
    selectionTally,
    abstainedSelections,
    chosenId: null,
    tiedCandidateIds,
    nextRound
  };
}

function createSelectResolution(result) {
  return {
    ok: true,
    errors: [],
    result
  };
}

function getRepeatOnNullNextRound({ session, rules, roundType, roundIndex }) {
  if (
    rules.nullResult !== SELECT_NULL_RULES.REPEAT_ON_NULL ||
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
  if (supportThreshold.base === SELECT_SUPPORT_BASES.SELECTOR_COUNT) {
    return getRequiredSelectorIds(session, selectorIds).reduce(
      (total, selectorId) =>
        total + getSelectValueForSelector({
          session,
          selectorId,
          selectionWeights,
          selectionValueRules
        }),
      0
    );
  }
  return (selections ?? [])
    .map(createSelectDecision)
    .filter((selection) => !selection.abstain)
    .reduce((total, selection) => total + selection.value, 0);
}

function getRequiredSupportCount({ baseCount, supportThreshold }) {
  if (supportThreshold.type === SELECT_SUPPORT_THRESHOLD_TYPES.MAJORITY) {
    return Math.floor(baseCount / 2) + 1;
  }
  if (supportThreshold.type === SELECT_SUPPORT_THRESHOLD_TYPES.FRACTION) {
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
  if (supportThreshold.type === SELECT_SUPPORT_THRESHOLD_TYPES.NONE) {
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
    if (rule.type !== SELECT_TIE_BREAKER_TYPES.SELECTOR_AUTHORITY) continue;

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
    if (rule.type !== SELECT_TIE_BREAKER_TYPES.SELECTOR_PROPERTY) continue;

    const selection = decisions.find((decision) => {
      const selector = findRole(session, decision.selectorId);
      return (
        !decision.abstain &&
        tiedCandidateIds.has(decision.candidateId) &&
        hasRolePropertyValue(selector, rule.property, rule.value)
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

function getAbstainSelectCount(abstainedSelections = []) {
  return (abstainedSelections ?? []).reduce((total, selection) => total + selection.value, 0);
}

function shouldNullifyByAbstention({ abstainedSelections = [], highestSelectionCount = 0, rules }) {
  if (rules.abstainResolution.type !== SELECT_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST) {
    return false;
  }
  return getAbstainSelectCount(abstainedSelections) > highestSelectionCount;
}

function evaluateUnanimousSelect({ session, selectorIds = [], selectionTally = [], abstainedSelections = [] }) {
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
export function resolveSelectRound({
  session,
  selectorIds = [],
  selections = [],
  selectionRules = createSelectRules(),
  roundType = SELECT_ROUND_TYPES.INITIAL,
  roundIndex = null
} = {}) {
  const rules = createSelectRules(selectionRules);
  const currentRoundIndex =
    Number.isInteger(roundIndex)
      ? roundIndex
      : roundType === SELECT_ROUND_TYPES.RUNOFF
        ? 1
        : 0;
  const validation = validateSelectDecisions({
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

  const decisions = resolveSelectDecisionValues(session, selections, rules);
  const abstainedSelections = decisions.filter((selection) => selection.abstain);
  const selectionTally = tallySelectDecisions(decisions);
  const highestSelectionCount = selectionTally[0]?.selectionCount ?? 0;
  const tiedCandidates = selectionTally
    .filter((entry) => entry.selectionCount === highestSelectionCount)
    .map((entry) => entry.candidateId);

  if (selectionTally.length === 0) {
    const reason =
      decisions.length > 0 && decisions.length === abstainedSelections.length ? 'all_abstained' : 'no_selections';
    return createSelectResolution(
      createNullSelectResolution({
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

  if (rules.unanimous === SELECT_UNANIMOUS_RULES.REQUIRED) {
    const unanimous = evaluateUnanimousSelect({ session, selectorIds, selectionTally, abstainedSelections });

    return createSelectResolution(
      unanimous.hasUnanimousTarget
        ? createChosenSelectResolution({
            reason: 'unanimous_candidate',
            selectionTally,
            abstainedSelections,
            chosenId: unanimous.chosenId
          })
        : createNullSelectResolution({
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
    return createSelectResolution(
      createNullSelectResolution({
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
          abstainSelectionCount: getAbstainSelectCount(abstainedSelections)
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
      return createSelectResolution(
        createNullSelectResolution({
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

    return createSelectResolution(
      createChosenSelectResolution({
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
    return createSelectResolution(
      createChosenSelectResolution({
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
    return createSelectResolution(
      createChosenSelectResolution({
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
    rules.tie === SELECT_TIE_RULES.RUNOFF_ON_TIE &&
    canRequestAnotherRound({ roundIndex: currentRoundIndex, rules })
  ) {
    return createSelectResolution(
      createTieSelectResolution({
        selectionTally,
        abstainedSelections,
        tiedCandidateIds: tiedCandidates,
        nextRound: createNextRound({
          roundType: SELECT_ROUND_TYPES.RUNOFF,
          roundIndex: currentRoundIndex,
          candidateIds: getRunoffCandidateIds({ session, rules, selectionTally, tiedCandidates })
        })
      })
    );
  }

  return createSelectResolution(
    createNullSelectResolution({
      reason: roundType === SELECT_ROUND_TYPES.RUNOFF ? 'runoff_tied' : 'tied_selection',
      selectionTally,
      abstainedSelections,
      tiedCandidateIds: tiedCandidates
    })
  );
}


// Construye la salida de una action que revela informacion.
//
// Esto no cambia el estado de la partida. Solo produce informacion visible para
// alguien.
//
// Ejemplo:
// reveal_property roleKey sobre hidden_role-0 devuelve que su roleKey es enemy.
function buildRevealPropertyActionResolution({ action, actor, targets }) {
  const property = action?.effect?.property;
  const visibility = action?.visibility ?? VISIBILITY.ACTOR_ONLY;

  return {
    type: EFFECT_TYPES.REVEAL_PROPERTY,
    visibility,
    actorIds: [actor.id],
    reveals: targets.map((target) => ({
      targetId: target.id,
      property,
      value: target?.[property]
    }))
  };
}

function getImmediateCause(actor = null, context = {}) {
  if (context.causedBy?.id) {
    return {
      type: context.causedBy.type ?? MECHANICAL_ENTITY_TYPES.ROLE,
      id: context.causedBy.id
    };
  }

  return actor?.id
    ? {
        type: MECHANICAL_ENTITY_TYPES.ROLE,
        id: actor.id
      }
    : null;
}

// Evalua una action que cambia una propiedad de roles.
//
// Distincion importante:
// - La accion SI se produce como intento.
// - Si el objetivo ya tenia bloqueada esta accion, el intento falla para ese
//   objetivo.
// - En ese caso NO se propone set_property.
// - Si no estaba bloqueada, propone set_property para que effectModel lo aplique.
function evaluateRolePropertyChangeAction({ action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const causedBy = getImmediateCause(actor, context);
  const proposedEffects = targets.map((target) => ({
    ...action.effect,
    causedBy,
    targetId: target.id
  }));

  return {
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: actor ? [actor.id] : [],
      targetIds: targets.map((target) => target.id),
      targets: targets.map((target) => ({
        targetId: target.id,
        actionAttempted: true,
        propertyChangePrevented: false,
        failureReason: null
      })),
      proposedEffects,
      finalEffects: [],
      causedBy,
      preventedPropertyChanges: [],
      blockedEffects: [],
      linkedPropagatedEffects: [],
      effectResolutionMode: 'role_property_change'
    }
  };
}

function buildPropertyBlockActionResolution({ session, action, actor, targets, context = {} }) {
  const blockedPropertyChange = action.effect?.blockedPropertyChange ?? {};
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const causedBy = getImmediateCause(actor, context);
  const blockedFor = action.effect?.blockedFor ?? { actorIds: [] };
  const expiresAt = action.effect?.expiresAt ?? {
    type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
  };
  const proposedEffects = [
    {
      ...action.effect,
      causedBy,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      targetIds: targets.map((target) => target.id),
      blockedPropertyChange,
      blockedFor,
      expiresAt,
      metadata: {
        ...(action.effect?.metadata ?? {}),
        createdByRoleId: actor?.id ?? null,
        recipeKey: context.recipeKey ?? action.key ?? action.id
      }
    }
  ];

  return {
    session,
    result: {
      type: EFFECT_TYPES.BLOCK_PROPERTY_CHANGE,
      visibility,
      actionId: action?.id ?? ACTION_IDS.BLOCK_PROPERTY_CHANGE,
      actorIds: [actor.id],
      targetIds: targets.map((target) => target.id),
      blockedPropertyChange,
      blockedFor,
      expiresAt,
      causedBy,
      cycleId: currentCycleId,
      proposedEffects,
      finalEffects: [],
      blockedEffects: [],
      preventedPropertyChanges: [],
      targets: targets.map((target) => ({
        targetId: target.id,
        blockedPropertyChange
      }))
    }
  };
}

// Resuelve los efectos de link_targets.
//
// Separacion conceptual:
// - link_targets es la accion: alguien intenta enlazar objetivos.
// - set_group es el efecto final: se escribe un grupo en la sesion.
// - las groupRules materializadas deciden despues si un cambio se propaga.
function buildLinkTargetsActionResolution({ session, action, actor, targets }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const proposedEffects = [
    {
      ...action.effect,
      causedBy: actor?.id ? { type: MECHANICAL_ENTITY_TYPES.ROLE, id: actor.id } : null,
      roleIds: targets.map((target) => target.id),
      sourceActionId: action.id
    }
  ];
  return {
    session,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: [actor.id],
      targetIds: targets.map((target) => target.id),
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetId: target.id
      })),
      proposedEffects,
      finalEffects: [],
      blockedEffects: [],
      effectResolutionMode: 'standard'
    }
  };
}

function getForcedAssumableRoleTarget(session = {}, forcedWhen = {}) {
  const assumableRoleIds = session.assumableRoles ?? [];
  if (assumableRoleIds.length !== 2) return null;

  const assumableRoles = assumableRoleIds
    .map((roleId) => findRole(session, roleId))
    .filter(Boolean);
  if (assumableRoles.length !== 2) return null;

  if (forcedWhen.allAssumableRolesHaveRoleKey) {
    const roleKey = forcedWhen.allAssumableRolesHaveRoleKey;
    if (!assumableRoles.every((role) => role.roleKey === roleKey)) return null;
    return assumableRoles[0];
  }

  return null;
}

function getReplaceRoleIdentityTargetIds(session = {}, action = {}, input = {}) {
  const explicitTargetIds = input.targetIds ?? [];
  if (explicitTargetIds.length > 0) return { targetIds: explicitTargetIds, forced: false };

  // Las reglas forzadas siguen requiriendo feedback humano minimo: la UI debe
  // mostrar las opciones y enviar acknowledged=true antes de que el motor asigne.
  if (input.acknowledged !== true) return { targetIds: [], forced: false };

  const forcedTarget = getForcedAssumableRoleTarget(session, action.effect?.forcedWhen ?? {});
  return {
    targetIds: forcedTarget ? [forcedTarget.id] : [],
    forced: !!forcedTarget
  };
}

function buildReplaceRoleIdentityActionResolution({ session, action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const target = targets[0] ?? null;
  const proposedEffects = [
    {
      ...action.effect,
      actorRoleId: actor.id,
      targetId: target.id,
      recipeKey: context.recipeKey ?? action.key ?? action.id,
      causedBy: actor?.id ? { type: MECHANICAL_ENTITY_TYPES.ROLE, id: actor.id } : null
    }
  ];

  return {
    session,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: [actor.id],
      targetIds: [target.id],
      proposedEffects,
      finalEffects: [],
      blockedEffects: [],
      effectResolutionMode: 'standard'
    }
  };
}

// Resuelve una seleccion pura.
//
// La action select cuenta selecciones y decide chosen/empate/nulo. No aplica efectos.
// Si el chosen debe producir otro cambio, una recipe posterior usara ese valor.
function buildSelectActionResolution({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  const selectionResolution = resolveSelectRound({
    session,
    selectorIds: input.selectorIds ?? input.actorIds ?? [],
    selections: input.selections ?? [],
    selectionRules: input.selectionRules ?? action?.selectionRules ?? {},
    roundType: input.roundType ?? SELECT_ROUND_TYPES.INITIAL,
    roundIndex: input.roundIndex ?? 0
  });

  if (!selectionResolution.ok) {
    return {
      ok: false,
      errors: selectionResolution.errors,
      session,
      result: null
    };
  }

  if (selectionResolution.result.type !== SELECT_OUTCOME_TYPES.CHOSEN) {
    return {
      ok: true,
      errors: [],
      session,
      result: {
        type: 'action_resolution',
        visibility,
        actionId: action.id,
        selection: selectionResolution.result,
        proposedEffects: [],
        finalEffects: [],
        blockedEffects: []
      }
    };
  }

  return {
    ok: true,
    errors: [],
    session,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      selection: selectionResolution.result,
      proposedEffects: [],
      finalEffects: [],
      blockedEffects: []
    }
  };
}

// Prepara el efecto que concluye la parte jugable.
//
// Esta action la dispara una operacion de cycle cuando el playOutcome es estable.
// No decide objetivos ni cierra administrativamente la session.
function buildConcludePlayActionResolution({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  const playOutcome =
      input.playOutcome ??
      action?.effect?.playOutcome ??
      session?.playOutcome ??
      session?.metadata?.pendingPlayOutcome ??
      null;
  const proposedEffects = [
    {
      ...action.effect,
      visibility,
      playOutcome
    }
  ];

  return {
    session,
    result: {
      type: EFFECT_TYPES.CONCLUDE_PLAY,
      visibility,
      actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
      proposedEffects,
      finalEffects: [],
      blockedEffects: [],
      playOutcome
    }
  };
}

// Ejecuta inspect_role.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca los objetivos.
// 3. Valida que los objetivos cumplen count + filtros.
// 4. Devuelve una resolucion reveal_property.
//
// No modifica la sesion porque inspeccionar solo revela informacion.
function evaluateInspectRoleAction(actionState) {
  const { session, action, actor, targets } = actionState;
  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session,
    result: buildRevealPropertyActionResolution({ action, actor, targets })
  };
}

// Ejecuta set_in_play.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count + filtros, por ejemplo in_play y not_same_alignment.
// 4. Propone el intento de cambiar inPlay.
// 5. Si el objetivo tenia bloqueada esa accion, no genera efecto final.
// 6. Si no estaba bloqueada, effectModel aplica set_property inPlay=value.
function evaluateSetInPlayAction(actionState) {
  const { session, action, actor, targets, context } = actionState;
  const evaluation = evaluateRolePropertyChangeAction({
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session,
    result: evaluation.result
  };
}

function evaluateSetPropertyAction(actionState) {
  const { session, action, actor, targets, context } = actionState;
  const evaluation = evaluateRolePropertyChangeAction({
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session,
    result: evaluation.result
  };
}

// Ejecuta block_property_change o una receta basada en esa primitiva.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count y filtros sobre la action materializada.
// 4. Propone bloquear el cambio indicado contra el objetivo.
// 5. effectModel aplica el bloqueo; el runtime superior registra history.
function evaluateBlockPropertyChangeAction(actionState) {
  const { session, action, actor, targets, context } = actionState;
  const resolved = buildPropertyBlockActionResolution({
    session,
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: resolved.session,
    result: resolved.result
  };
}

// Ejecuta link_targets.
//
// Esta accion no decide que significa narrativamente el vinculo. Solo crea un
// grupo mecanico en session.groups. Por ejemplo, una skin podria llamarlo
// enamorar, sincronizar, esposar, conectar destinos o cualquier otra fantasia.
function evaluateLinkTargetsAction(actionState) {
  const { session, action, actor, targets } = actionState;
  const resolved = buildLinkTargetsActionResolution({ session, action, actor, targets });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: resolved.session,
    result: resolved.result
  };
}

function evaluateReplaceRoleIdentityAction(actionState) {
  const { session, action, actor, targets, context, targetSelection } = actionState;
  const resolved = buildReplaceRoleIdentityActionResolution({ session, action, actor, targets, context });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: resolved.session,
    result: {
      ...resolved.result,
      forced: targetSelection.forced
    }
  };
}

// Ejecuta select.
//
// La accion no recibe un actor unico porque representa una ronda de seleccion.
// Cada seleccion individual ya trae su selectorId.
function evaluateSelectAction(actionState) {
  const { session, action, input } = actionState;
  const resolved = buildSelectActionResolution({ session, action, input });

  return {
    ok: resolved.ok,
    actionId: action.id,
    errors: resolved.errors,
    session: resolved.session,
    result: resolved.result
  };
}

function evaluateConcludePlayAction(actionState) {
  const { session, action, input } = actionState;
  const resolved = buildConcludePlayActionResolution({ session, action, input });

  return {
    ok: true,
    actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
    errors: [],
    session: resolved.session,
    result: resolved.result
  };
}

const ACTION_RESOLVERS = Object.freeze({
  [ACTION_IDS.INSPECT_ROLE]: evaluateInspectRoleAction,
  [ACTION_IDS.SET_PROPERTY]: evaluateSetPropertyAction,
  [ACTION_IDS.SET_IN_PLAY]: evaluateSetInPlayAction,
  [ACTION_IDS.BLOCK_PROPERTY_CHANGE]: evaluateBlockPropertyChangeAction,
  [ACTION_IDS.LINK_TARGETS]: evaluateLinkTargetsAction,
  [ACTION_IDS.REPLACE_ROLE_IDENTITY]: evaluateReplaceRoleIdentityAction,
  [ACTION_IDS.SELECT]: evaluateSelectAction,
  [ACTION_IDS.CONCLUDE_PLAY]: evaluateConcludePlayAction
});

function startAction({ session, action, input = {}, context = {} } = {}) {
  return {
    session,
    action,
    input,
    context,
    actionId: action?.id ?? null,
    actors: [],
    actor: null,
    targets: [],
    targetSelection: null,
    errors: [],
    result: null
  };
}

const ACTIONS_WITHOUT_TARGET_VALIDATION = Object.freeze([
  ACTION_IDS.SELECT,
  ACTION_IDS.CONCLUDE_PLAY
]);

function collectActionContext(actionState) {
  const { session, action, actionId, input } = actionState;
  const actors = getActionActors(session, input.actorIds ?? []);
  const targetSelection =
    actionId === ACTION_IDS.REPLACE_ROLE_IDENTITY
      ? getReplaceRoleIdentityTargetIds(session, action, input)
      : {
          targetIds: input.targetIds ?? [],
          forced: false
        };
  const targets = (targetSelection.targetIds ?? []).map((id) => findRole(session, id));

  return {
    ...actionState,
    actors,
    actor: actors[0] ?? null,
    targets,
    targetSelection
  };
}

function validateAction(actionState) {
  const actionValidation = validateActionShape(actionState.action);
  const shouldValidateTargets =
    actionValidation.ok &&
    ACTION_RESOLVERS[actionState.actionId] &&
    !ACTIONS_WITHOUT_TARGET_VALIDATION.includes(actionState.actionId);
  const targetValidation = shouldValidateTargets
    ? validateActionTargets({
        session: actionState.session,
        action: actionState.action,
        actor: actionState.actor,
        targets: actionState.targets
      })
    : { errors: [] };

  return {
    ...actionState,
    errors: [
      ...actionState.errors,
      ...actionValidation.errors,
      ...targetValidation.errors
    ]
  };
}

function evaluateAction(actionState) {
  if (actionState.errors.length > 0) return actionState;

  const resolver = ACTION_RESOLVERS[actionState.actionId];
  if (!resolver) {
    return {
      ...actionState,
      errors: [
        ...actionState.errors,
        {
          code: 'action/unsupported',
          message: `unsupported action "${actionState.actionId ?? 'unknown'}"`
        }
      ]
    };
  }

  const resolution = resolver(actionState);

  return {
    ...actionState,
    session: resolution.session,
    errors: [...actionState.errors, ...(resolution.errors ?? [])],
    result: resolution.result,
    ok: resolution.ok === true
  };
}

function resolveActionResolution(actionState) {
  const proposedEffects = actionState.result?.proposedEffects ?? [];
  if (proposedEffects.length === 0) return actionState;

  const effectResolution = resolveEffects({
    session: actionState.session,
    proposedEffects
  });
  const sessionAfterEffects = applyEffects({
    session: actionState.session,
    effects: effectResolution.finalEffects
  });

  if (actionState.result?.effectResolutionMode === 'role_property_change') {
    const preventedPropertyChanges = effectResolution.blockedEffects
      .filter((effect) => effect.type === EFFECT_TYPES.SET_PROPERTY)
      .map((effect) => ({
        property: effect.property,
        value: effect.value,
        reason: effect.reason,
        targetId: effect.targetId,
        causedBy: effect.causedBy ?? null
      }));
    const blockedTargetIds = new Set(
      preventedPropertyChanges.map((change) => change.targetId)
    );

    return {
      ...actionState,
      session: sessionAfterEffects,
      result: {
        ...actionState.result,
        proposedEffects: effectResolution.proposedEffects,
        finalEffects: effectResolution.finalEffects,
        blockedEffects: effectResolution.blockedEffects,
        linkedPropagatedEffects: effectResolution.linkedPropagatedEffects,
        preventedPropertyChanges,
        targets: (actionState.result.targets ?? []).map((target) => ({
          ...target,
          propertyChangePrevented: blockedTargetIds.has(target.targetId),
          failureReason: blockedTargetIds.has(target.targetId)
            ? 'blocked_property_change'
            : null
        }))
      }
    };
  }

  return {
    ...actionState,
    session: sessionAfterEffects,
    result: {
      ...actionState.result,
      proposedEffects: effectResolution.proposedEffects,
      finalEffects: effectResolution.finalEffects,
      blockedEffects: effectResolution.blockedEffects,
      linkedPropagatedEffects: effectResolution.linkedPropagatedEffects
    }
  };
}

function validateActionResolution(actionState) {
  if (actionState.errors.length > 0) return actionState;

  const errors = [];
  if (!actionState.result) {
    errors.push({
      code: 'action/missing-result',
      message: `action "${actionState.actionId ?? 'unknown'}" finished without result`
    });
  }

  [
    ...(actionState.result?.proposedEffects ?? []),
    ...(actionState.result?.finalEffects ?? [])
  ].forEach((effect, index) => {
    const validation = validateEffect(effect);
    validation.errors.forEach((error) => {
      errors.push({
        ...error,
        code: `action/output/${error.code}`,
        index,
        actionId: actionState.actionId
      });
    });
  });

  return {
    ...actionState,
    errors: [...actionState.errors, ...errors]
  };
}

function finishAction(actionState) {
  const ok = actionState.errors.length === 0 && actionState.ok !== false;
  const result = actionState.result ?? null;
  const shouldRecordHistory =
    actionState.context?.recordHistory === true ||
    Boolean(actionState.context?.recipeKey || actionState.context?.stageId);
  const nextSession = shouldRecordHistory
    ? appendActionHistory(actionState.session, {
        cycleId: actionState.context?.cycleId ?? getCurrentCycleId(actionState.session),
        poolKey: actionState.context?.poolKey ?? null,
        stageId: actionState.context?.stageId ?? null,
        stageKey: actionState.context?.stageKey ?? null,
        stageCatalogId: actionState.context?.stageCatalogId ?? null,
        recipeKey: actionState.context?.recipeKey ?? null,
        actionId: actionState.actionId,
        actorIds: actionState.actors.map((actor) => actor.id).filter(Boolean),
        targetIds: actionState.targets.map((target) => target?.id).filter(Boolean),
        result: ok ? HISTORY_RESULTS.APPLIED : HISTORY_RESULTS.FAILED,
        proposedEffects: result?.proposedEffects ?? [],
        finalEffects: result?.finalEffects ?? [],
        blockedEffects: result?.blockedEffects ?? [],
        preventedPropertyChanges: result?.preventedPropertyChanges ?? [],
        metadata: {
          actionOk: ok,
          errorCodes: actionState.errors.map((error) => error.code).filter(Boolean)
        }
      })
    : actionState.session;

  return {
    ok,
    actionId: actionState.actionId,
    errors: actionState.errors,
    session: nextSession,
    result
  };
}

// Punto de entrada generico para resolver acciones.
export function resolveAction(session, action, input = {}, context = {}) {
  const actionState = startAction({ session, action, input, context });
  const contextState = collectActionContext(actionState);
  const validationState = validateAction(contextState);
  const evaluatedState = evaluateAction(validationState);
  const resolvedState = resolveActionResolution(evaluatedState);
  const outputState = validateActionResolution(resolvedState);

  return finishAction(outputState);
}

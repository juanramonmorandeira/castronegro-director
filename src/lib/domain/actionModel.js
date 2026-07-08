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
// - conclude_play: concluye la parte jugable desde pool.onExit.
//
// Importante:
// - No sabe que skin o nombre visible tendra un role.
// - No sabe que fantasia representa cada alignment.
// - No pinta nada en pantalla.
// - No guarda nada fuera de la session.
//
// Recibe datos de session/input/context, aplica efectos aceptados en la session
// y devuelve un resultado mecanico para que otros modelos puedan derivar eventos.
// -----------------------------------------------------------------------------

import {
  EFFECT_TYPES,
  applyEffects,
  applyConcludePlay as applyConcludePlayFromModel,
  getCurrentCycleId,
  resolveEffect
} from './effectModel.js';
import {
  PROPERTY_BLOCK_EXPIRATION_TYPES,
  addBlockedPropertyChange
} from './roleModel.js';
import {
  collectSelectionRules,
  getGroupMemberRoleIds
} from './groupModel.js';
import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { normalizeId } from './sessionModel.js';
import { ACTION_IDS, VISIBILITY } from './actionDefinition.js';
import {
  SELECTION_SELECTOR_SOURCES,
  getActionActors,
  getRequiredSelectorIds,
  getSelectionRuleSelectorIds,
  getSelectionSelectorIds
} from './actorModel.js';
import {
  findRole,
  getDefaultSelectionCandidateIds,
  hasRolePropertyValue,
  resolveCandidateIds,
  validateActionTargets
} from './targetModel.js';

export { ACTION_IDS, VISIBILITY };
export {
  SELECTION_SELECTOR_SOURCES,
  getRequiredSelectorIds,
  getSelectionSelectorIds
} from './actorModel.js';
export {
  CANDIDATE_RULE_TYPES,
  getDefaultSelectionCandidateIds,
  resolveCandidateIds
} from './targetModel.js';

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
  selectorEligibility = {},
  selectorSource = SELECTION_SELECTOR_SOURCES.STAGE_ACTORS
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
    selectorEligibility: normalizeSelectorEligibility(selectorEligibility),
    selectorSource: Object.values(SELECTION_SELECTOR_SOURCES).includes(selectorSource)
      ? selectorSource
      : SELECTION_SELECTOR_SOURCES.STAGE_ACTORS
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
  return hasRolePropertyValue(selector, rule.property, rule.value);
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

function collectSessionSelectionRules(session = {}, selectionContext = {}) {
  return (session.selectionRules ?? [])
    .filter((rule) => ruleScopeMatchesContext(rule.scope ?? {}, selectionContext))
    .map((rule) => rule.rules ?? rule);
}

export function mergeSelectionRules(baseRules = {}, additionalRules = []) {
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

// Prepara el input que una stage con selectionRules entregara a actionModel.
//
// No resuelve la seleccion. Solo combina:
// - selectores reales de la stage;
// - selections recibidas por input;
// - reglas de seleccion de la stage;
// - reglas globales de sesion;
// - restricciones aportadas por groups activos.
export function buildStageSelectionInput({
  session = {},
  stage = {},
  recipeKey = null,
  input = {}
} = {}) {
  const selectionRules = stage?.selectionRules ?? {};
  const selectorIds = getSelectionSelectorIds(session, stage, input, selectionRules);
  const selectionContext = {
    method: 'vote',
    poolKey: stage.poolKey ?? null,
    stageKey: stage.key ?? null,
    recipeKey
  };
  const collectedRules = collectSelectionRules(session, {
    selectorIds: getSelectionRuleSelectorIds(session, stage, input, selectionRules),
    selectionContext
  });
  const sessionSelectionRules = collectSessionSelectionRules(session, selectionContext);
  const mergedSelectionRules = mergeSelectionRules(selectionRules, sessionSelectionRules);

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


// Valida requisitos internos de una accion antes de resolverla.
//
// Esta validacion es distinta de validateActionTargets:
// - validateActionTargets comprueba actor + objetivos + filtros.
// - validateActionDefinition comprueba que la accion trae los datos mecanicos
//   necesarios para que el motor no cree resultados incompletos.
export function validateActionDefinition(action) {
  const errors = [];

  if (!action?.id) {
    errors.push({
      code: 'action/missing-id',
      message: 'action has no id'
    });
  }

  if (action?.id === ACTION_IDS.SET_PROPERTY || action?.id === ACTION_IDS.SET_IN_PLAY) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_PROPERTY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: `${action.id} requires a set_property effect`
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: `${action.id} currently requires targetType "role"`
      });
    }
    if (action?.id === ACTION_IDS.SET_IN_PLAY && effect.property !== 'inPlay') {
      errors.push({
        code: 'action/invalid-effect-property',
        message: 'set_in_play requires effect.property "inPlay"'
      });
    }
    if (action?.id === ACTION_IDS.SET_IN_PLAY && typeof effect.value !== 'boolean') {
      errors.push({
        code: 'action/invalid-effect-value',
        message: 'set_in_play requires a boolean effect.value'
      });
    }
  }

  if (action?.id === ACTION_IDS.BLOCK_PROPERTY_CHANGE) {
    const blockedPropertyChange = action?.effect?.blockedPropertyChange;
    if (action?.effect?.type !== EFFECT_TYPES.BLOCK_PROPERTY_CHANGE) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: `${action.id} requires a block_property_change effect`
      });
    }
    if (!blockedPropertyChange?.property) {
      errors.push({
        code: 'action/missing-blocked-property',
        message: `${action.id} requires effect.blockedPropertyChange.property`
      });
    }
    if ((action?.effect?.blockedFor?.actorIds ?? []).length === 0) {
      errors.push({
        code: 'action/missing-blocked-actors',
        message: `${action.id} requires effect.blockedFor.actorIds`
      });
    }
  }

  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_GROUP) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'link_targets requires a set_group effect'
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.GROUP) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'link_targets requires targetType "group"'
      });
    }
    if (!effect.groupType) {
      errors.push({
        code: 'action/missing-group-type',
        message: 'link_targets requires effect.groupType'
      });
    }
  }

  if (action?.id === ACTION_IDS.CONCLUDE_PLAY) {
    if (action?.effect?.type !== EFFECT_TYPES.CONCLUDE_PLAY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'conclude_play requires a conclude_play effect'
      });
    }
  }

  if (action?.id === ACTION_IDS.REPLACE_ROLE_IDENTITY) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.REPLACE_ROLE_IDENTITY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'replace_role_identity requires a replace_role_identity effect'
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'replace_role_identity requires targetType "role"'
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

// Une la validacion de definicion con la validacion de objetivos.
//
// Mantenerlo en una funcion evita repetir el mismo patron en cada resolver.
//
// Las restricciones no se validan aqui. Pertenecen a recipeModel porque son
// condiciones de uso de una receta, no de la accion pura.
export function validateActionResolution({
  session,
  action,
  actor,
  targets
}) {
  const definitionValidation = validateActionDefinition(action);
  const targetValidation = validateActionTargets({
    session,
    action,
    actor,
    targets
  });
  const errors = [...definitionValidation.errors, ...targetValidation.errors];

  return {
    ok: errors.length === 0,
    errors
  };
}

// Aplica un efecto de tipo reveal_property.
//
// Esto no cambia el estado de la partida. Solo produce informacion visible para
// alguien.
//
// Ejemplo:
// reveal_property roleKey sobre hidden_role-0 devuelve que su roleKey es enemy.
export function applyRevealPropertyEffect({ action, actor, targets }) {
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

// Resuelve la consecuencia principal de set_in_play.
//
// Distincion importante:
// - La accion SI se produce como intento.
// - Si el objetivo ya tenia bloqueada esta accion, el intento falla para ese
//   objetivo.
// - En ese caso NO se propone set_property.
// - Si no estaba bloqueada, propone y aplica set_property inPlay=value.
export function resolveSetInPlayEffect({ session, action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const causedBy = getImmediateCause(actor, context);
  const proposedEffects = targets.map((target) => ({
    ...action.effect,
    causedBy,
    targetId: target.id
  }));
  const effectResolution = resolveEffect({ session, proposedEffects });
  const { finalEffects, blockedEffects, linkedPropagatedEffects } = effectResolution;
  const preventedPropertyChanges = blockedEffects
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
  const sessionAfterEffects = applyEffects({ session, effects: finalEffects });

  return {
    session: sessionAfterEffects,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: actor ? [actor.id] : [],
      targetIds: targets.map((target) => target.id),
      targets: targets.map((target) => ({
        targetId: target.id,
        actionAttempted: true,
        propertyChangePrevented: blockedTargetIds.has(target.id),
        failureReason: blockedTargetIds.has(target.id) ? 'blocked_property_change' : null
      })),
      proposedEffects,
      finalEffects,
      causedBy,
      preventedPropertyChanges,
      blockedEffects,
      linkedPropagatedEffects
    }
  };
}

export function applyPropertyBlock({ session, action, actor, targets, context = {} }) {
  const blockedPropertyChange = action.effect?.blockedPropertyChange ?? {};
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const causedBy = getImmediateCause(actor, context);
  const targetIds = new Set(targets.map((target) => target.id));
  const blockedFor = action.effect?.blockedFor ?? { actorIds: [] };
  const expiresAt = action.effect?.expiresAt ?? {
    type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
  };

  const sessionWithBlock = {
    ...session,
    roles: (session.roles ?? []).map((role) => {
      if (!targetIds.has(role.id)) return role;
      return addBlockedPropertyChange(role, {
        property: blockedPropertyChange.property,
        value: blockedPropertyChange.value,
        blockedFor,
        expiresAt,
        metadata: {
          createdByRoleId: actor?.id ?? null,
          recipeKey: context.recipeKey ?? action.key ?? action.id
        }
      });
    })
  };

  return {
    session: sessionWithBlock,
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
      proposedEffects: [],
      finalEffects: [],
      blockedEffects: [],
      preventedPropertyChanges: [],
      mechanicalChangeApplied: true,
      targets: targets.map((target) => ({
        targetId: target.id,
        blockedPropertyChange
      }))
    }
  };
}

// Aplica un grupo creado por link_targets.
//
// Separacion conceptual:
// - link_targets es la accion: alguien intenta enlazar objetivos.
// - set_group es el efecto final: se escribe un grupo en la sesion.
// - las groupRules materializadas deciden despues si un cambio se propaga.
export function applyLinkTargets({ session, action, actor, targets }) {
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
  const effectResolution = resolveEffect({ session, proposedEffects });
  const sessionAfterEffects = applyEffects({ session, effects: effectResolution.finalEffects });
  return {
    session: sessionAfterEffects,
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
      proposedEffects: effectResolution.proposedEffects,
      finalEffects: effectResolution.finalEffects,
      blockedEffects: effectResolution.blockedEffects
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

export function applyReplaceRoleIdentity({ session, action, actor, targets, context = {} }) {
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
  const finalEffects = proposedEffects;
  const sessionAfterEffects = applyEffects({ session, effects: finalEffects });

  return {
    session: sessionAfterEffects,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: [actor.id],
      targetIds: [target.id],
      proposedEffects,
      finalEffects,
      blockedEffects: []
    }
  };
}

// Resuelve una seleccion pura.
//
// La action select cuenta selecciones y decide chosen/empate/nulo. No aplica efectos.
// Si un stage quiere hacer algo con el chosen, stageModel aplicara despues la
// receta normal configurada en ese stage.
export function applySelection({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  const selectionResolution = resolveSelectionRound({
    session,
    selectorIds: input.selectorIds ?? input.actorIds ?? [],
    selections: input.selections ?? [],
    selectionRules: input.selectionRules ?? action?.selectionRules ?? {},
    roundType: input.roundType ?? SELECTION_ROUND_TYPES.INITIAL,
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

  if (selectionResolution.result.type !== SELECTION_OUTCOME_TYPES.CHOSEN) {
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

// Prepara un nuevo ciclo.
//
// En esta version todavia no tenemos una cola real de efectos pendientes. Las
// acciones actuales resuelven y aplican sus efectos inmediatamente. Aun asi,
// mantenemos esta accion de sistema para limpiar bloqueos temporales y avanzar
// cycle.id antes del siguiente poolConcealed.
//
// Limpia flags temporales para empezar el siguiente ciclo sin basura:
// - preventedPropertyChanges.
// Ejecuta conclude_play.
//
// Esta accion la dispara una operacion de pool.onExit cuando el playOutcome es
// estable. No se encola en interPoolQueue.
export function applyConcludePlayAction({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  return applyConcludePlayFromModel({
    session,
    visibility,
    playOutcome:
      input.playOutcome ??
      action?.effect?.playOutcome ??
      session?.playOutcome ??
      session?.metadata?.pendingPlayOutcome ??
      null
  });
}

// Ejecuta inspect_role.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca los objetivos.
// 3. Valida que los objetivos cumplen count + filtros.
// 4. Devuelve un resultado reveal_property.
//
// No modifica la sesion porque inspeccionar solo revela informacion.
export function resolveInspectRole(session, action, input = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.INSPECT_ROLE,
      errors: validation.errors,
      session,
      result: null
    };
  }

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session,
    result: applyRevealPropertyEffect({ action, actor, targets })
  };
}

// Ejecuta set_in_play.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count + filtros, por ejemplo in_play y not_same_alignment.
// 4. Ejecuta el intento de cambiar inPlay.
// 5. Si el objetivo tenia bloqueada esa accion, no genera efecto final.
// 6. Si no estaba bloqueada, aplica set_property inPlay=value.
export function resolveSetInPlay(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({
    session,
    action,
    actor,
    targets
  });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SET_IN_PLAY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = resolveSetInPlayEffect({
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
    session: applied.session,
    result: applied.result
  };
}

export function resolveSetProperty(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({
    session,
    action,
    actor,
    targets
  });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SET_PROPERTY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = resolveSetInPlayEffect({
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
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta block_property_change o una receta basada en esa primitiva.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count y filtros. Las restricciones ya las valido recipeModel.
// 4. Marca al objetivo como prevenido contra la accion indicada.
// 5. Registra el bloqueo aplicado en session.history.recipeHistory.
export function resolveBlockPropertyChange(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.BLOCK_PROPERTY_CHANGE,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyPropertyBlock({
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
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta link_targets.
//
// Esta accion no decide que significa narrativamente el vinculo. Solo crea un
// grupo mecanico en session.groups. Por ejemplo, una skin podria llamarlo
// enamorar, sincronizar, esposar, conectar destinos o cualquier otra fantasia.
export function resolveLinkTargets(session, action, input = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.LINK_TARGETS,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyLinkTargets({ session, action, actor, targets });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

export function resolveReplaceRoleIdentity(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targetSelection = getReplaceRoleIdentityTargetIds(session, action, input);
  const targetIds = targetSelection.targetIds;
  const targets = targetIds.map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.REPLACE_ROLE_IDENTITY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyReplaceRoleIdentity({ session, action, actor, targets, context });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: {
      ...applied.result,
      forced: targetSelection.forced
    }
  };
}

// Ejecuta select.
//
// La accion no recibe un actor unico porque representa una ronda de seleccion.
// Cada seleccion individual ya trae su selectorId.
export function resolveSelection(session, action, input = {}) {
  const definitionValidation = validateActionDefinition(action);

  if (!definitionValidation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SELECT,
      errors: definitionValidation.errors,
      session,
      result: null
    };
  }

  const applied = applySelection({ session, action, input });

  return {
    ok: applied.ok,
    actionId: action.id,
    errors: applied.errors,
    session: applied.session,
    result: applied.result
  };
}

export function resolveConcludePlay(session, action, input = {}) {
  const definitionValidation = validateActionDefinition(action);

  if (!definitionValidation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
      errors: definitionValidation.errors,
      session,
      result: null
    };
  }

  const applied = applyConcludePlayAction({ session, action, input });

  return {
    ok: true,
    actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Punto de entrada generico para resolver acciones.
//
// Por ahora entiende:
// - inspect_role
// - set_in_play
// - block_property_change
// - block_out_of_play
// - link_targets
// - select
//
// Las proximas acciones genericas se conectaran aqui.
export function resolveAction(session, action, input = {}, context = {}) {
  if (action?.id === ACTION_IDS.INSPECT_ROLE) {
    return resolveInspectRole(session, action, input);
  }
  if (action?.id === ACTION_IDS.SET_PROPERTY) {
    return resolveSetProperty(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.SET_IN_PLAY) {
    return resolveSetInPlay(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.BLOCK_PROPERTY_CHANGE) {
    return resolveBlockPropertyChange(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    return resolveLinkTargets(session, action, { ...input, context });
  }
  if (action?.id === ACTION_IDS.REPLACE_ROLE_IDENTITY) {
    return resolveReplaceRoleIdentity(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.SELECT) {
    return resolveSelection(session, action, input);
  }
  if (action?.id === ACTION_IDS.CONCLUDE_PLAY) {
    return resolveConcludePlay(session, action, input);
  }

  return {
    ok: false,
    actionId: action?.id ?? null,
    errors: [
      {
        code: 'action/unsupported',
        message: `unsupported action "${action?.id ?? 'unknown'}"`
      }
    ],
    session,
    result: null
  };
}

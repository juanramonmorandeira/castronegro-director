// doubleSelectorModel.js
// -----------------------------------------------------------------------------
// Regla opcional selection_counts_double.
//
// No es un role ni un group: es una selectionRule del ruleSet que puede encolar
// specialStages y setear role.doubleSelector=true.
// -----------------------------------------------------------------------------

import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECTION_ABSTAIN_RULES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RUNOFF_RULES,
  SELECTION_TIE_RULES,
  SELECTION_UNANIMOUS_RULES,
  createSelectionRules
} from './selectionModel.js';
import { createStage } from './stageDefinition.js';
import { STAGE_STATUSES } from './sessionModel.js';
import { STAGE_COMPLETION_REQUESTED_BY } from './stageTypes.js';
import {
  appendSpecialStage,
  removeSpecialStages
} from './specialStagesModel.js';

export const DOUBLE_SELECTOR_RULE_KEY = 'selection_counts_double';

export const DOUBLE_SELECTOR_STAGE_KEYS = Object.freeze({
  SELECT_DOUBLE_SELECTOR: 'select_double_selector',
  PICK_NEXT_DOUBLE_SELECTOR: 'pick_next_double_selector'
});

export const DOUBLE_SELECTOR_ERRORS = Object.freeze({
  RULE_NOT_ENABLED: 'double-selector/rule-not-enabled',
  PLAY_CONCLUDED: 'double-selector/play-concluded',
  INITIAL_STAGE_ALREADY_REQUESTED: 'double-selector/initial-stage-already-requested',
  MISSING_HOLDER: 'double-selector/missing-holder',
  NO_CANDIDATES: 'double-selector/no-candidates'
});

function isSelectionCountsDoubleEnabled(session = {}) {
  return (session.settings?.selectedRuleKeys ?? []).includes(DOUBLE_SELECTOR_RULE_KEY);
}

function hasInitialDoubleSelectorRequest(session = {}) {
  return (session.specialStagesHistory ?? []).some(
    (entry) =>
      entry.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY &&
      entry.metadata?.requestKey === DOUBLE_SELECTOR_STAGE_KEYS.SELECT_DOUBLE_SELECTOR
  );
}

function getInPlayRoleIds(session = {}, excludedRoleIds = []) {
  const excluded = new Set(excludedRoleIds);
  return (session.roles ?? [])
    .filter((role) => role.inPlay === true && !excluded.has(role.id))
    .map((role) => role.id);
}

export function createSelectDoubleSelectorStage(overrides = {}) {
  return createStage({
    ...overrides,
    key: DOUBLE_SELECTOR_STAGE_KEYS.SELECT_DOUBLE_SELECTOR,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    completion: {
      mode: 'manual',
      allowedRequesters: [
        STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
        STAGE_COMPLETION_REQUESTED_BY.SYSTEM
      ]
    },
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECTION_RUNOFF_RULES.TIED_CANDIDATES,
      repeatLimit: 1
    }),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      ruleKey: DOUBLE_SELECTOR_RULE_KEY,
      requestKey: DOUBLE_SELECTOR_STAGE_KEYS.SELECT_DOUBLE_SELECTOR,
      ...(overrides.metadata ?? {})
    }
  });
}

export function createPickNextDoubleSelectorStage({ holderRoleId, candidateIds = [] } = {}) {
  return createStage({
    key: DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
    status: STAGE_STATUSES.ENABLED,
    actorIds: holderRoleId ? [holderRoleId] : [],
    completion: {
      mode: 'manual',
      allowedRequesters: [
        STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
        STAGE_COMPLETION_REQUESTED_BY.SYSTEM
      ]
    },
    selectionRules: createSelectionRules({
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECTION_TIE_RULES.NULL_ON_TIE,
      candidateIds,
      selectorEligibility: {
        requireInPlay: false
      }
    }),
    actions: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      ruleKey: DOUBLE_SELECTOR_RULE_KEY,
      requestKey: DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
      holderRoleId
    }
  });
}

export function requestSelectDoubleSelectorStage(
  session = {},
  { requestedBy = STAGE_COMPLETION_REQUESTED_BY.DIRECTOR } = {}
) {
  if (!isSelectionCountsDoubleEnabled(session)) {
    return {
      ok: false,
      errors: [
        {
          code: DOUBLE_SELECTOR_ERRORS.RULE_NOT_ENABLED,
          message: 'selection_counts_double is not enabled for this session'
        }
      ],
      session
    };
  }

  if (session.playOutcome) {
    return {
      ok: false,
      errors: [
        {
          code: DOUBLE_SELECTOR_ERRORS.PLAY_CONCLUDED,
          message: 'cannot request doubleSelector selection after play concluded'
        }
      ],
      session
    };
  }

  if (hasInitialDoubleSelectorRequest(session)) {
    return {
      ok: false,
      errors: [
        {
          code: DOUBLE_SELECTOR_ERRORS.INITIAL_STAGE_ALREADY_REQUESTED,
          message: 'initial doubleSelector selection was already requested'
        }
      ],
      session
    };
  }

  return {
    ok: true,
    errors: [],
    session: appendSpecialStage(
      session,
      createSelectDoubleSelectorStage(),
      {
        source: 'director_request',
        requestedBy,
        ruleKey: DOUBLE_SELECTOR_RULE_KEY,
        requestKey: DOUBLE_SELECTOR_STAGE_KEYS.SELECT_DOUBLE_SELECTOR
      }
    )
  };
}

export function queuePickNextDoubleSelectorStage(session = {}, { holderRoleId = null } = {}) {
  if (!isSelectionCountsDoubleEnabled(session)) {
    return { ok: true, errors: [], session, queued: false };
  }

  if (!holderRoleId) {
    return {
      ok: false,
      errors: [
        {
          code: DOUBLE_SELECTOR_ERRORS.MISSING_HOLDER,
          message: 'cannot queue doubleSelector succession without holderRoleId'
        }
      ],
      session,
      queued: false
    };
  }

  const candidateIds = getInPlayRoleIds(session, [holderRoleId]);
  if (candidateIds.length === 0) {
    return {
      ok: false,
      errors: [
        {
          code: DOUBLE_SELECTOR_ERRORS.NO_CANDIDATES,
          message: 'doubleSelector succession has no inPlay candidates'
        }
      ],
      session,
      queued: false
    };
  }

  return {
    ok: true,
    errors: [],
    session: appendSpecialStage(
      session,
      createPickNextDoubleSelectorStage({ holderRoleId, candidateIds }),
      {
        source: 'event_response',
        ruleKey: DOUBLE_SELECTOR_RULE_KEY,
        requestKey: DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
        holderRoleId
      }
    ),
    queued: true
  };
}

export function cancelPendingPickNextDoubleSelectorStage(session = {}, { holderRoleId = null } = {}) {
  return removeSpecialStages(
    session,
    (stage) =>
      stage.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY &&
      stage.metadata?.requestKey === DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR &&
      (!holderRoleId || stage.metadata?.holderRoleId === holderRoleId),
    {
      source: 'event_response',
      ruleKey: DOUBLE_SELECTOR_RULE_KEY,
      requestKey: DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
      holderRoleId,
      reason: 'holder_returned_in_play'
    }
  );
}

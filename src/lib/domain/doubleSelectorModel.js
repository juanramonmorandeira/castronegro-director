// doubleSelectorModel.js
// -----------------------------------------------------------------------------
// Regla opcional selection_counts_double.
//
// No es un role ni un group: es una selectionRule del ruleSet que puede encolar
// queue y setear role.doubleSelector=true.
// -----------------------------------------------------------------------------

import { getCatalogRecipe, RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECT_ABSTAIN_RULES,
  SELECT_REQUIRED_RULES,
  SELECT_RUNOFF_RULES,
  SELECT_TIE_RULES,
  SELECT_UNANIMOUS_RULES,
  createSelectRules
} from './actionModel.js';
import { createStage } from './stageDefinition.js';
import { STAGE_STATUSES } from './sessionModel.js';
import { STAGE_COMPLETION_REQUESTED_BY } from './stageTypes.js';
import {
  STAGE_CATALOG_IDS,
  getCatalogStage
} from './stageCatalog.js';
import {
  appendQueueStage,
  getQueue,
  removeQueueStages
} from './queueModel.js';
import {
  HISTORY_COLLECTIONS,
  getHistoryCollection
} from './historyModel.js';
import {
  EVENT_RESPONSE_TYPES,
  EVENT_TYPES
} from './eventDefinition.js';
import {
  EVENT_RULE_KEYS,
  getCatalogEventRule,
  getEventResponseQueueKey
} from './eventCatalog.js';
import { findRole } from './targetModel.js';

export const DOUBLE_SELECTOR_RULE_KEY = 'selection_counts_double';

export const DOUBLE_SELECTOR_STAGE_KEYS = Object.freeze({
  SELECT_DOUBLE_SELECTOR: STAGE_CATALOG_IDS.SELECT_DOUBLE_SELECTOR,
  PICK_NEXT_DOUBLE_SELECTOR: STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR
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
  return getHistoryCollection(session, HISTORY_COLLECTIONS.QUEUE).some(
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
  const catalogStage = getCatalogStage(STAGE_CATALOG_IDS.SELECT_DOUBLE_SELECTOR, overrides);

  return createStage({
    ...catalogStage,
    status: STAGE_STATUSES.ENABLED,
    selectionRules: createSelectRules({
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECT_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECT_UNANIMOUS_RULES.NOT_REQUIRED,
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECT_RUNOFF_RULES.TIED_CANDIDATES,
      repeatLimit: 1
    }),
    recipes: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      ...(catalogStage.metadata ?? {})
    }
  });
}

export function createPickNextDoubleSelectorStage({
  holderRoleId,
  candidateIds = [],
  queueKey = null
} = {}) {
  const catalogStage = getCatalogStage(STAGE_CATALOG_IDS.PICK_NEXT_DOUBLE_SELECTOR, {
    actorIds: holderRoleId ? [holderRoleId] : [],
    metadata: {
      holderRoleId,
      ...(queueKey ? { queueKey } : {})
    }
  });

  return createStage({
    ...catalogStage,
    status: STAGE_STATUSES.ENABLED,
    selectionRules: createSelectRules({
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECT_ABSTAIN_RULES.NOT_ALLOWED,
      unanimous: SELECT_UNANIMOUS_RULES.NOT_REQUIRED,
      candidateIds,
      selectorEligibility: {
        requireInPlay: false
      }
    }),
    recipes: [getCatalogRecipe(RECIPE_KEYS.SET_DOUBLE_SELECTOR)],
    metadata: {
      ...(catalogStage.metadata ?? {})
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
    session: appendQueueStage(
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
    session: appendQueueStage(
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
  return removeQueueStages(
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

function hasPendingPickNextDoubleSelectorStage(session = {}, holderRoleId = null) {
  return getQueue(session).some(
    (stage) =>
      stage.metadata?.ruleKey === DOUBLE_SELECTOR_RULE_KEY &&
      stage.metadata?.requestKey === DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR &&
      stage.metadata?.holderRoleId === holderRoleId
  );
}

export function getDoubleSelectorEventResponses({ session = {}, events = [] } = {}) {
  if (!isSelectionCountsDoubleEnabled(session)) return [];
  const rule = getCatalogEventRule(EVENT_RULE_KEYS.PICK_NEXT_DOUBLE_SELECTOR);

  return (events ?? []).flatMap((event) => {
    if (
      event.type !== EVENT_TYPES.PROPERTY_CHANGED ||
      event.targetType !== 'role' ||
      event.property !== 'inPlay'
    ) {
      return [];
    }

    const role = findRole(session, event.roleId);
    if (role?.doubleSelector !== true) return [];

    if (event.to === false) {
      if (hasPendingPickNextDoubleSelectorStage(session, event.roleId)) return [];

      const candidateIds = getInPlayRoleIds(session, [event.roleId]);
      if (candidateIds.length === 0) return [];
      const queueKey = getEventResponseQueueKey(event);

      return [
        {
          type: rule?.response?.type ?? EVENT_RESPONSE_TYPES.CREATE_STAGE,
          stage: createPickNextDoubleSelectorStage({
            holderRoleId: event.roleId,
            candidateIds,
            queueKey
          }),
          metadata: {
            catalogId: rule?.response?.stageCatalogId ?? null,
            ruleKey: rule?.metadata?.ruleKey ?? DOUBLE_SELECTOR_RULE_KEY,
            requestKey: rule?.key ?? DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
            holderRoleId: event.roleId,
            ...(queueKey ? { queueKey } : {})
          }
        }
      ];
    }

    if (event.to === true) {
      return [
        {
          type: EVENT_RESPONSE_TYPES.CANCEL_STAGE,
          metadata: {
            catalogId: rule?.response?.stageCatalogId ?? null,
            ruleKey: rule?.metadata?.ruleKey ?? DOUBLE_SELECTOR_RULE_KEY,
            requestKey: rule?.key ?? DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR,
            holderRoleId: event.roleId,
            reason: 'holder_returned_in_play'
          },
          cancelPredicate: (stage) =>
            stage.metadata?.ruleKey === (rule?.metadata?.ruleKey ?? DOUBLE_SELECTOR_RULE_KEY) &&
            stage.metadata?.requestKey === (rule?.key ?? DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR) &&
            stage.metadata?.holderRoleId === event.roleId
        }
      ];
    }

    return [];
  });
}

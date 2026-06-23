// ruleSetCatalog.js
// -----------------------------------------------------------------------------
// Primer ruleSet mecanico anonimo.
//
// Las referencias historicas se usan solo para extraer mecanicas. Los nombres,
// textos e imagenes visibles pertenecen a una skin y no aparecen aqui.
// -----------------------------------------------------------------------------

import { getCatalogGroup, GROUP_CATALOG_IDS } from './groupCatalog.js';
import { OBJECTIVE_CONDITIONS } from './objectiveModel.js';
import { ROLE_CATALOG_IDS } from './roleCatalog.js';
import { MESSAGE_KEYS } from '../messages/messageCatalog.js';
import {
  ALIGNMENT_IDS,
  RULE_SET_SUPPORT_STATUSES,
  defineRuleSet
} from './ruleSetDefinition.js';

export const RULE_SET_CATALOG_IDS = Object.freeze({
  BASIC_RULE_SET: 'basic_ruleset'
});

export const BASIC_ROLE_OPTION_KEYS = Object.freeze({
  COLLECTIVE_SET_OUT_OF_PLAY: ROLE_CATALOG_IDS.ROLE_COLLECTIVE_SET_OUT_OF_PLAY,
  INSPECTS: ROLE_CATALOG_IDS.ROLE_INSPECTS,
  REACTIVE: ROLE_CATALOG_IDS.ROLE_REACTIVE,
  IN_PLAY_CONTROL: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL,
  PLAIN: ROLE_CATALOG_IDS.ROLE_PLAIN,
  LINKS_TARGETS: ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS,
  ASSUMES_ROLE: 'role_assumes_role',
  OBSERVES_SELECTION: 'role_observes_selection',
  SELECTION_AUTHORITY: 'position_selection_authority'
});

export function getBasicAlignmentDistribution(playersExpected) {
  const players = Number(playersExpected);
  if (!Number.isInteger(players) || players < 8 || players > 18) return null;

  const alignmentB = Math.floor(players / 6) + 1;
  return {
    [ALIGNMENT_IDS.ALIGNMENT_A]: players - alignmentB,
    [ALIGNMENT_IDS.ALIGNMENT_B]: alignmentB,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  };
}

const BASIC_OBJECTIVE_RULES = [
  {
    key: 'alignment_b_reaches_in_play_parity',
    holder: { type: 'group', id: 'group_alignment_b' },
    condition: { type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY },
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: { type: 'holder' }
      }
    ],
    conflictRules: []
  },
  {
    key: 'only_alignment_a_remains_in_play',
    holder: { type: 'group', id: 'group_alignment_a' },
    condition: { type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY },
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: { type: 'holder' }
      }
    ],
    conflictRules: []
  },
  {
    key: 'no_roles_remain_in_play',
    holder: null,
    condition: { type: OBJECTIVE_CONDITIONS.NO_ROLES_IN_PLAY },
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: []
      }
    ],
    conflictRules: []
  }
];

export const RULE_SET_CATALOG = Object.freeze({
  [RULE_SET_CATALOG_IDS.BASIC_RULE_SET]: defineRuleSet({
    id: RULE_SET_CATALOG_IDS.BASIC_RULE_SET,
    version: 1,
    availableRoles: [
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.COLLECTIVE_SET_OUT_OF_PLAY,
        instanceRule: {
          min: 0,
          max: 'players_expected_minus_one',
          step: 1
        }
      },
      { roleKey: BASIC_ROLE_OPTION_KEYS.INSPECTS },
      { roleKey: BASIC_ROLE_OPTION_KEYS.REACTIVE },
      { roleKey: BASIC_ROLE_OPTION_KEYS.IN_PLAY_CONTROL },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.PLAIN,
        instanceRule: {
          min: 0,
          max: 'players_expected_minus_one',
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS,
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE,
        support: RULE_SET_SUPPORT_STATUSES.PENDING,
        selectable: false,
        missingMechanics: ['role_choice_set', 'assume_role']
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.OBSERVES_SELECTION,
        support: RULE_SET_SUPPORT_STATUSES.PENDING,
        selectable: false,
        missingMechanics: [
          'observe_other_stage',
          'observation_detection',
          'replace_selected_candidate'
        ]
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.SELECTION_AUTHORITY,
        support: RULE_SET_SUPPORT_STATUSES.PENDING,
        selectable: false,
        missingMechanics: [
          'honorary_position',
          'weighted_selection',
          'tie_break_authority',
          'position_succession'
        ]
      }
    ],
    groups: [
      {
        key: 'group_alignment_a',
        membershipRule: {
          type: 'alignment',
          alignmentId: ALIGNMENT_IDS.ALIGNMENT_A
        }
      },
      getCatalogGroup(GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY, {
        key: 'group_alignment_b',
        metadata: {
          mechanicalPurpose: 'alignment_holder_and_collective_action'
        }
      })
    ],
    rules: {
      baseRules: [
        {
          key: 'total_role_count_matches_players',
          type: 'configuration_rule'
        },
        {
          key: 'session_cannot_start_with_conclusive_objective',
          type: 'configuration_rule'
        }
      ],
      objectiveRules: BASIC_OBJECTIVE_RULES
    },
    distributionRules: {
      allowOverride: true,
      overrideEnabledByDefault: false,
      formula: {
        type: 'basic_ruleset_distribution',
        minPlayers: 8,
        maxPlayers: 18,
        alignmentB: 'floor(players_expected / 6) + 1',
        alignmentA: 'players_expected - alignment_b'
      }
    },
    skinRequirements: {
      languages: ['es', 'en'],
      requiredMessageKeys: [
        MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED,
        MESSAGE_KEYS.INSPECTION_REVEALED,
        MESSAGE_KEYS.COLLECTIVE_SELECTION_REQUESTED,
        MESSAGE_KEYS.ROLE_STATE_REVEALED,
        MESSAGE_KEYS.REACTIVE_SELECTION_REQUESTED,
        MESSAGE_KEYS.RESOURCE_ACTION_APPLIED,
        MESSAGE_KEYS.OBJECTIVE_ACHIEVED,
        MESSAGE_KEYS.PLAY_CONCLUDED
      ],
      requiredEntities: {
        role: [
          BASIC_ROLE_OPTION_KEYS.COLLECTIVE_SET_OUT_OF_PLAY,
          BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS,
          BASIC_ROLE_OPTION_KEYS.INSPECTS,
          BASIC_ROLE_OPTION_KEYS.REACTIVE,
          BASIC_ROLE_OPTION_KEYS.IN_PLAY_CONTROL,
          BASIC_ROLE_OPTION_KEYS.PLAIN
        ],
        group: ['group_alignment_a', 'group_alignment_b'],
        objective: BASIC_OBJECTIVE_RULES.map((rule) => rule.key)
      }
    },
    metadata: {
      maturity: 'initial',
      mechanicsOnly: true
    }
  })
});

export function getCatalogRuleSet(ruleSetId) {
  const ruleSet = RULE_SET_CATALOG[ruleSetId];
  if (!ruleSet) return null;
  return defineRuleSet(ruleSet);
}

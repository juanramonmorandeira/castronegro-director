// ruleSetCatalog.js
// -----------------------------------------------------------------------------
// Primer ruleSet mecanico anonimo.
//
// Las referencias historicas se usan solo para extraer mecanicas. Los nombres,
// textos e imagenes visibles pertenecen a una skin y no aparecen aqui.
// -----------------------------------------------------------------------------

import { getCatalogGroup, GROUP_CATALOG_IDS } from './groupCatalog.js';
import {
  OBJECTIVE_BENEFICIARY_TYPES,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_HOLDER_TYPES
} from './objectiveModel.js';
import { ROLE_CATALOG_IDS } from './roleCatalog.js';
import { RECIPE_KEYS } from './recipeCatalog.js';
import {
  SELECTION_RUNOFF_RULES,
  SELECTION_TIE_BREAKER_TYPES,
  SELECTION_TIE_RULES,
  SELECTION_VALUE_RULE_TYPES
} from './selectionModel.js';
import { POOL_KEYS } from './sessionModel.js';
import { MESSAGE_KEYS } from '../messages/messageCatalog.js';
import {
  ALIGNMENT_IDS,
  defineRuleSet
} from './ruleSetDefinition.js';

export const RULE_SET_CATALOG_IDS = Object.freeze({
  BASIC_RULE_SET: 'basic_ruleset'
});

export const BASIC_ROLE_OPTION_KEYS = Object.freeze({
  SET_OUT_OF_PLAY: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
  INSPECTS: ROLE_CATALOG_IDS.ROLE_INSPECTS,
  REACTIVE: ROLE_CATALOG_IDS.ROLE_REACTIVE,
  IN_OUT_OF_PLAY: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY,
  PLAIN: ROLE_CATALOG_IDS.ROLE_PLAIN,
  LINKS_TARGETS: ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS,
  ASSUMES_ROLE: ROLE_CATALOG_IDS.ROLE_ASSUMES_ROLE,
  PEEK: ROLE_CATALOG_IDS.ROLE_PEEK
});

export const BASIC_AVAILABLE_RULE_KEYS = Object.freeze({
  SELECTION_COUNTS_DOUBLE: 'selection_counts_double'
});

export function getBasicAlignmentDistribution(playersExpected) {
  const players = Number(playersExpected);
  if (!Number.isInteger(players) || players < 5 || players > 20) return null;

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
    holder: { type: OBJECTIVE_HOLDER_TYPES.GROUP, id: 'group_alignment_b' },
    condition: { type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY },
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: { type: OBJECTIVE_BENEFICIARY_TYPES.HOLDER }
      }
    ],
    conflictRules: []
  },
  {
    key: 'only_alignment_a_remains_in_play',
    holder: { type: OBJECTIVE_HOLDER_TYPES.GROUP, id: 'group_alignment_a' },
    condition: { type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY },
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: { type: OBJECTIVE_BENEFICIARY_TYPES.HOLDER }
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
        roleKey: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
        instanceRule: {
          min: 0,
          max: 'players_expected_minus_one',
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.INSPECTS,
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.REACTIVE,
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        }
      },
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
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        }
      },
      {
        roleKey: BASIC_ROLE_OPTION_KEYS.PEEK,
        instanceRule: {
          min: 0,
          max: 1,
          step: 1
        },
        metadata: {
          advanced: true,
          riskNotes: [
            'Requires director judgement for human peek accusations.',
            'Recommended only for experienced tables or sessions where conduct rules are explicit.'
          ]
        }
      }
    ],
    availableRules: [
      {
        key: BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE,
        type: 'selectionRule',
        selectable: true,
        defaultEnabled: false,
        configuration: {
          exposedVoteAbstainDefault: 'not_allowed',
          initialSelectionTieDefault: 'runoff_on_tie',
          initialSelectionRunoffDefault: 'tied_candidates',
          unresolvedRunoffDefault: 'director_selects_from_tied_candidates_or_null'
        },
        rules: {
          selectionRules: [
            {
              key: 'double_selector_counts_double_in_exposed_vote',
              scope: {
                methods: ['vote'],
                poolKeys: [POOL_KEYS.POOL_EXPOSED],
                actionKeys: [RECIPE_KEYS.SET_OUT_OF_PLAY]
              },
              rules: {
                tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
                runoff: SELECTION_RUNOFF_RULES.SAME_CANDIDATES,
                repeatLimit: 1,
                selectionValueRules: [
                  {
                    type: SELECTION_VALUE_RULE_TYPES.SELECTOR_PROPERTY,
                    property: 'doubleSelector',
                    value: true,
                    selectionValue: 2
                  }
                ],
                tieBreakers: [
                  {
                    type: SELECTION_TIE_BREAKER_TYPES.SELECTOR_PROPERTY,
                    property: 'doubleSelector',
                    value: true
                  }
                ]
              }
            }
          ]
        },
        metadata: {
          mechanicalFamily: 'optional_selection_rule'
        }
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
      {
        key: 'group_alignment_b',
        membershipRule: {
          type: 'alignment',
          alignmentId: ALIGNMENT_IDS.ALIGNMENT_B
        }
      },
      getCatalogGroup(GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, {
        key: GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
        metadata: {
          mechanicalPurpose: 'concealed_collective_set_out_of_play'
        }
      }),
      getCatalogGroup(GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY, {
        key: GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY,
        metadata: {
          mechanicalPurpose: 'exposed_collective_set_out_of_play'
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
        minPlayers: 5,
        maxPlayers: 20,
        alignmentB: 'floor(players_expected / 6) + 1',
        alignmentA: 'players_expected - alignment_b',
        roleFillPolicyDefault: 'plain'
      }
    },
    skinRequirements: {
      languages: ['es', 'en'],
      requiredMessageKeys: [
        MESSAGE_KEYS.ACTION_USAGE_LIMIT_REACHED,
        MESSAGE_KEYS.INSPECTION_REVEALED,
        MESSAGE_KEYS.COLLECTIVE_SELECTION_REQUESTED,
        MESSAGE_KEYS.ROLE_STATE_REVEALED,
        MESSAGE_KEYS.REACTIVE_SELECTION_REQUESTED,
        MESSAGE_KEYS.LIMITED_ACTION_APPLIED,
        MESSAGE_KEYS.OBJECTIVE_ACHIEVED,
        MESSAGE_KEYS.PLAY_CONCLUDED
      ],
      requiredEntities: {
        role: [
          BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
          BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS,
          BASIC_ROLE_OPTION_KEYS.INSPECTS,
          BASIC_ROLE_OPTION_KEYS.REACTIVE,
          BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
          BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE,
          BASIC_ROLE_OPTION_KEYS.PEEK,
          BASIC_ROLE_OPTION_KEYS.PLAIN
        ],
        group: [
          'group_alignment_a',
          'group_alignment_b',
          GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
          GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY
        ],
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

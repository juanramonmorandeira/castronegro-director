import assert from 'node:assert/strict';

import {
  ACTION_IDS,
  ALIGNMENT_IDS,
  AVAILABILITY_RULE_TYPES,
  BASIC_ROLE_OPTION_KEYS,
  EFFECT_TYPES,
  HISTORY_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  GROUP_TYPES,
  VISIBILITY,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_EVALUATION_STATUSES,
  INFLUENCE_OPERATIONS,
  INFLUENCE_SUBJECTS,
  SELECTION_ABSTAIN_RESOLUTION_TYPES,
  SELECTION_ABSTAIN_RULES,
  SELECTION_UNANIMOUS_RULES,
  SELECTION_NULL_RULES,
  SELECTION_OUTCOME_TYPES,
  SELECTION_REQUIRED_RULES,
  SELECTION_RESTRICTION_TYPES,
  SELECTION_RUNOFF_RULES,
  SELECTION_ROUND_TYPES,
  SELECTION_SUPPORT_BASES,
  SELECTION_SUPPORT_THRESHOLD_TYPES,
  SELECTION_TIE_RULES,
  buildPools,
  buildGroups,
  buildRoles,
  buildSession,
  advanceStageCursor,
  completeCurrentStage,
  createCycle,
  createPool,
  preparePool,
  startCycle,
  startSpecialStages,
  validatePool,
  organizePoolStages,
  createSelectionRules,
  createSession,
  createGroup,
  defineGroup,
  addRoleToGroup,
  addBlockedPropertyChange,
  appendSpecialStage,
  getCoreGroupCatalog,
  getCurrentStage,
  getCurrentStageCursor,
  getGroupRoles,
  getCoreRoleCatalog,
  removeRoleFromGroup,
  createStage,
  canStageInfluenceObjectiveOutcome,
  checkObjectives,
  findAppliedSetPropertyHistory,
  STAGE_STATUSES,
  CURRENT_STAGE_SOURCES,
  POOL_DEFINITION_ERRORS,
  POOL_KEYS,
  GROUP_CATALOG_IDS,
  GROUP_MEMBERSHIP_RULE_TYPES,
  ROLE_CATALOG_IDS,
  ROLE_CATALOG,
  RULE_SET_CATALOG_IDS,
  RULE_SET_SUPPORT_STATUSES,
  RECIPE_KEYS,
  resolveSelectionRound,
  resolveAction,
  resolveCurrentStage,
  resolveRecipe,
  buildRuleSet,
  getBasicAlignmentDistribution,
  getCatalogRuleSet,
  STAGE_ACTION_KEYS,
  STAGE_CATALOG_IDS,
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  STAGE_KEYS,
  POOL_LIFECYCLE_OPERATION_TYPES,
  PROPERTY_BLOCK_BOUNDARIES,
  PROPERTY_BLOCK_DURATION_UNITS,
  PROPERTY_BLOCK_EXPIRATION_TYPES,
  SESSION_STATUSES,
  materializePropertyBlockExpiration,
  getCatalogRecipe,
  getCatalogStage,
  validateSession
} from '../index.js';
import {
  MESSAGE_AUDIENCE_TYPES,
  MESSAGE_CATALOG,
  MESSAGE_IMPLEMENTATION_STATUSES,
  MESSAGE_KEYS,
  MESSAGE_SEVERITIES,
  MESSAGE_TYPES,
  createMessage,
  defineSkin,
  presentMessage,
  recordRenderedSessionMessage,
  routeMessage,
  toToastInput,
  validateSkinCoverage
} from '../../messages/index.js';

const tests = [];

// Runner minimo y explicito.
//
// Podriamos usar librerias como Vitest, pero ahora mismo no hay runner instalado
// en el proyecto. Este wrapper mantiene los tests como codigo real con
// assert.strict, imprime cada caso y hace fallar el proceso si algo se rompe.
function test(name, fn) {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// Tests reales del nucleo de dominio
// ---------------------------------------------------------------------------
//
// Estos tests fijan los contratos mecanicos que ya decidimos:
// - inspect_role revela datos sin cambiar sesion.
// - set_in_play cambia la participacion principal.
// - block_out_of_play bloquea set_in_play(false) sobre un target concreto.
// - link_targets crea una relacion linked en la sesion.
// - linked deriva inPlay=false hacia roles relacionados.
// - no_repeat_target impide repetir bloqueo sobre el mismo target.
// - objectiveModel detecta objetivos concluyentes genericos y linked.
// - selectionModel cuenta selecciones y resuelve empates configurables.
// - stageModel conecta el stage actual con actionModel y avanza el cursor.
//
// No usan Svelte, Firebase, i18n ni navegador.
// ---------------------------------------------------------------------------

const inspectRoleAction = getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE);
const setInPlayFalseAction = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY);
const restoreRecentOutOfPlayAction = getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY);
const blockOutOfPlayRecipe = getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY);
const linkTargetsAction = getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS);
const setOutOfPlayAfterSelectionRecipe = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
  target: {
    type: 'role',
    count: 1,
    filters: ['in_play']
  },
  visibility: VISIBILITY.ALL
});
const selectionOutOfPlayRules = createSelectionRules({
  required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
  abstain: SELECTION_ABSTAIN_RULES.NOT_ALLOWED,
  unanimous: SELECTION_UNANIMOUS_RULES.NOT_REQUIRED,
  tie: SELECTION_TIE_RULES.NULL_ON_TIE,
  groupRestrictions: [
    {
      type: SELECTION_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE,
      groupType: GROUP_TYPES.LINKED
    }
  ]
});

function createBaseSession({
  groups = [],
  objectiveRules = [],
  settings = {}
} = {}) {
  const roleDefinitions = {
    alignment_b_attacker: {
      alignmentId: 'alignment_b'
    },
    alignment_a_blocker: {
      alignmentId: 'alignment_a'
    },
    alignment_a_target: {
      alignmentId: 'alignment_a'
    },
    alignment_a_plain: {
      alignmentId: 'alignment_a'
    },
    alignment_b_target: {
      alignmentId: 'alignment_b'
    },
    role_inspector: {
      alignmentId: 'alignment_a'
    },
    hidden_enemy: {
      alignmentId: 'alignment_b'
    }
  };
  const roles = buildRoles(
    [
      { seat: 0, playerId: 'player-1', role: 'alignment_b_attacker' },
      { seat: 1, playerId: 'player-2', role: 'alignment_a_blocker' },
      { seat: 2, playerId: 'player-3', role: 'alignment_a_target' },
      { seat: 3, playerId: 'player-4', role: 'alignment_a_plain' },
      { seat: 4, playerId: 'player-5', role: 'alignment_b_target' },
      { seat: 5, playerId: 'player-6', role: 'role_inspector' },
      { seat: 6, playerId: 'player-7', role: 'hidden_enemy' }
    ],
    roleDefinitions
  );

  return createSession({
    id: 'domain-test-session',
    definitionId: 'domain-test',
    players: Array.from({ length: 7 }, (_, index) => ({
      id: `player-${index + 1}`,
      displayName: `Player ${index + 1}`,
      connected: true,
      ready: true
    })),
    roles,
    groups,
    objectiveRules,
    settings
  });
}

function createAlignmentGroup(alignmentId, roleIds = []) {
  return createGroup({
    key: `group_${alignmentId}`,
    roleIds,
    metadata: {
      alignmentId
    }
  });
}

function createLinkedGroup({
  id = 'linked-test-group',
  roleIds = ['alignment_a_target-0', 'alignment_a_plain-0'],
  active = true,
  sourceActionId = ACTION_IDS.LINK_TARGETS,
  groupRules = [
    {
      type: 'propagate_property_change',
      when: { property: 'inPlay', value: false },
      apply: { property: 'inPlay', value: false },
      targets: 'other_members'
    }
  ]
} = {}) {
  return createGroup({
    id,
    key: id,
    type: GROUP_TYPES.LINKED,
    roleIds,
    active,
    sourceActionId,
    groupRules
  });
}

function createConclusiveObjectiveRule({ key, holder, condition }) {
  return {
    key,
    holder,
    condition,
    onFulfilled: [
      {
        conclusive: true,
        beneficiaries: {
          type: 'holder'
        }
      }
    ],
    conflictRules: []
  };
}

function roleById(session, roleKey) {
  return session.roles.find((role) => role.id === roleKey);
}

function withCycle(session, cycle) {
  return {
    ...session,
    cycle
  };
}

function advanceTestCycle(session) {
  return {
    session: {
      ...session,
      cycle: startCycle(session.cycle).cycle
    }
  };
}

function createSelectionOutOfPlayStage(overrides = {}) {
  return createStage({
    key: STAGE_KEYS.STAGE_05,
    status: STAGE_STATUSES.ENABLED,
    actorIds: [],
    selectionRules: selectionOutOfPlayRules,
    actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)],
    ...overrides
  });
}

function resolveSelectionOutOfPlayStage(session, input = {}, stageOverrides = {}) {
  const sessionWithSelectionStage = withCycle(
    session,
    createCycle({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [createSelectionOutOfPlayStage(stageOverrides)]
      }
    })
  );

  return resolveCurrentStage(sessionWithSelectionStage, input);
}

function withInPlayState(session, inPlayByRoleId = {}) {
  return {
    ...session,
    roles: session.roles.map((role) => ({
      ...role,
      inPlay: inPlayByRoleId[role.id] ?? role.inPlay
    }))
  };
}

function createSelections(selectionsBySelectorRoleId = {}) {
  return Object.entries(selectionsBySelectorRoleId).map(
    ([selectorId, candidateId]) => ({
      selectorId,
      candidateId
    })
  );
}

function actionRecipe(action, key) {
  return {
    ...action,
    key
  };
}

function collectiveSelectionInput(input = {}) {
  return {
    ...input
  };
}

test('inspect_role revela roleKey sin modificar la sesion', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, inspectRoleAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['hidden_enemy-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.session, session);
  assert.deepEqual(resolved.result.reveals, [
    {
      targetId: 'hidden_enemy-0',
      property: 'roleKey',
      value: 'hidden_enemy'
    }
  ]);
});

test('resolveCurrentStage ejecuta receta y completeCurrentStage avanza el cursor', () => {
  const session = createSession({
    ...createBaseSession(),
    currentStageSource: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
    specialStages: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: STAGE_KEYS.STAGE_02,
        status: STAGE_STATUSES.ENABLED,
        actions: [actionRecipe(linkTargetsAction, STAGE_ACTION_KEYS.LINK_TARGETS)]
      })
    ]
  });
  const inspectedAction = resolveCurrentStage(session, {
    actorIds: ['role_inspector-0'],
    targetIds: ['hidden_enemy-0']
  });
  const inspected = completeCurrentStage(inspectedAction.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['role_inspector-0'],
    reason: 'player_finished_stage'
  });
  const linkedAction = resolveCurrentStage(inspected.session, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const linked = completeCurrentStage(linkedAction.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_finished_stage'
  });

  assert.equal(inspectedAction.ok, true);
  assert.equal(inspectedAction.stage.stageKey, STAGE_KEYS.STAGE_01);
  assert.equal(inspectedAction.result.reveals[0].value, 'hidden_enemy');
  assert.equal(inspectedAction.stageAdvance, null);
  assert.equal(inspected.ok, true);
  assert.equal(
    inspected.session.specialStages[0].key,
    STAGE_KEYS.STAGE_02
  );
  assert.equal(inspected.stageAdvance.reason, 'next-special-stage');
  assert.equal(inspected.stageAdvance.next.stageKey, STAGE_KEYS.STAGE_02);
  assert.equal(linkedAction.ok, true);
  assert.equal(linkedAction.session.groups[0].type, GROUP_TYPES.LINKED);
  assert.equal(linkedAction.stageAdvance, null);
  assert.equal(linked.ok, false);
  assert.equal(linked.stageAdvance.reason, 'next-pool-not-runnable');
  assert.equal(linked.errors[0].code, 'cycle/no-runnable-stages');
  assert.equal(linked.session.specialStages.length, 0);
  assert.deepEqual(
    linked.session.specialStagesHistory.map((entry) => entry.operation),
    ['queued', 'started', 'queued', 'completed', 'started', 'completed']
  );
  assert.equal(linked.session.stageHistory.length, 2);
  assert.equal(linked.session.stageHistory[0].requestedBy, STAGE_COMPLETION_REQUESTED_BY.PLAYER);
  assert.equal(linked.session.stageHistory[1].requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('resolveCurrentStage rechaza un stage ejecutable sin action declarada', () => {
  const session = createSession({
    ...createBaseSession(),
    currentStageSource: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
    specialStages: [
      createStage({
        key: 'stageMissingAction',
        status: STAGE_STATUSES.ENABLED
      })
    ]
  });
  const resolved = resolveCurrentStage(session, {});

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'stage/missing-action');
  assert.equal(
    resolved.session.specialStages[0].status,
    STAGE_STATUSES.ENABLED
  );
  assert.equal(resolved.messages[0].key, MESSAGE_KEYS.INVALID_STAGE);
  assert.equal(resolved.session.errorLog.length, 1);
  assert.equal(resolved.session.errorLog[0].message.context.stageKey, 'stagemissingaction');
});

test('poolDefinition organiza stages construidos por stageDefinition', () => {
  const lateStage = createStage({
    key: STAGE_KEYS.STAGE_02,
    status: STAGE_STATUSES.ENABLED,
    order: 20,
    actorIds: ['role_inspector-0'],
    actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
  });
  const earlyStage = createStage({
    key: STAGE_KEYS.STAGE_01,
    status: STAGE_STATUSES.ENABLED,
    order: 10,
    actorIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
  });
  const created = organizePoolStages({
    poolOrder: ['poolExposed'],
    poolCurrent: 'poolExposed',
    pools: {
      poolExposed: [lateStage, earlyStage]
    }
  });
  const duplicated = organizePoolStages({
    poolOrder: ['poolExposed'],
    pools: {
      poolExposed: [
        { ...earlyStage, order: 10 },
        { ...lateStage, order: 10 }
      ]
    }
  });

  assert.equal(created.ok, true);
  assert.equal(created.pools.poolExposed.stages[0].key, STAGE_KEYS.STAGE_01);
  assert.deepEqual(created.pools.poolExposed.stages[0].actorIds, [
    'alignment_a_target-0',
    'alignment_a_plain-0'
  ]);
  assert.equal(created.pools.poolExposed.stages[1].key, STAGE_KEYS.STAGE_02);
  assert.equal(duplicated.ok, false);
  assert.equal(duplicated.errors[0].code, POOL_DEFINITION_ERRORS.DUPLICATE_ORDER);
});

test('poolDefinition declara onEnter y onExit del pool', () => {
  const cycle = createCycle();

  assert.deepEqual(
    cycle.pools.poolConcealed.onEnter.map((operation) => operation.type),
    []
  );
  assert.deepEqual(
    cycle.pools.poolConcealed.onExit.map((operation) => operation.type),
    [
      POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS,
      POOL_LIFECYCLE_OPERATION_TYPES.CHECK_OBJECTIVES
    ]
  );
  assert.deepEqual(
    cycle.pools.poolExposed.onExit.map((operation) => operation.type),
    [
      POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS,
      POOL_LIFECYCLE_OPERATION_TYPES.CHECK_OBJECTIVES
    ]
  );
});

test('stageId distingue materializaciones que comparten stageKey', () => {
  const pool = createPool({
    key: POOL_KEYS.POOL_CONCEALED,
    stages: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actorIds: ['role-1'],
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actorIds: ['role-1'],
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      })
    ]
  });

  assert.equal(pool.stages[0].key, pool.stages[1].key);
  assert.notEqual(pool.stages[0].id, pool.stages[1].id);

  const advanced = advanceStageCursor(pool);
  assert.equal(advanced.pool.stages[0].status, STAGE_STATUSES.DONE);
  assert.equal(advanced.pool.stages[1].status, STAGE_STATUSES.ENABLED);
});

test('materializePropertyBlockExpiration resuelve offsets de stage, pool, cycle y session', () => {
  const cycle = createCycle({
    id: 2,
    poolOrder: [POOL_KEYS.POOL_CONCEALED, POOL_KEYS.POOL_EXPOSED],
    poolCurrent: POOL_KEYS.POOL_CONCEALED,
    pools: {
      [POOL_KEYS.POOL_CONCEALED]: [
        createStage({
          id: 'stage-current',
          key: STAGE_KEYS.STAGE_01,
          status: STAGE_STATUSES.ENABLED,
          actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
        }),
        createStage({
          id: 'stage-disabled',
          key: STAGE_KEYS.STAGE_02,
          status: STAGE_STATUSES.DISABLED,
          actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
        }),
        createStage({
          id: 'stage-next',
          key: STAGE_KEYS.STAGE_03,
          status: STAGE_STATUSES.ENABLED,
          actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
        })
      ],
      [POOL_KEYS.POOL_EXPOSED]: [
        createStage({
          key: STAGE_KEYS.STAGE_04,
          status: STAGE_STATUSES.ENABLED,
          actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
        })
      ]
    }
  });
  const session = createSession({ ...createBaseSession(), cycle });
  const context = {
    poolKey: POOL_KEYS.POOL_CONCEALED,
    stageId: 'stage-current'
  };

  assert.deepEqual(
    materializePropertyBlockExpiration(
      session,
      {
        unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
        offset: 1,
        boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
      },
      context
    ).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.STAGE_BOUNDARY,
      cycleId: 2,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      stageId: 'stage-next',
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }
  );
  assert.deepEqual(
    materializePropertyBlockExpiration(
      session,
      {
        unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
        offset: 2,
        boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
      },
      context
    ).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY,
      cycleId: 2,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      stageId: null,
      boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
    }
  );
  assert.deepEqual(
    materializePropertyBlockExpiration(
      session,
      {
        unit: PROPERTY_BLOCK_DURATION_UNITS.POOL,
        offset: 1,
        boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
      },
      context
    ).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY,
      cycleId: 2,
      poolKey: POOL_KEYS.POOL_EXPOSED,
      stageId: null,
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }
  );
  assert.deepEqual(
    materializePropertyBlockExpiration(
      session,
      {
        unit: PROPERTY_BLOCK_DURATION_UNITS.POOL,
        offset: 2,
        boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
      },
      context
    ).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY,
      cycleId: 3,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      stageId: null,
      boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
    }
  );
  assert.deepEqual(
    materializePropertyBlockExpiration(session, {
      unit: PROPERTY_BLOCK_DURATION_UNITS.CYCLE,
      offset: 1,
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.CYCLE_BOUNDARY,
      cycleId: 3,
      poolKey: null,
      stageId: null,
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }
  );
  assert.deepEqual(
    materializePropertyBlockExpiration(session, {
      unit: PROPERTY_BLOCK_DURATION_UNITS.SESSION
    }).expiresAt,
    {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION,
      cycleId: null,
      poolKey: null,
      stageId: null,
      boundary: null
    }
  );
  assert.equal(
    materializePropertyBlockExpiration(session, {
      unit: PROPERTY_BLOCK_DURATION_UNITS.POOL,
      offset: 0,
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }).errors[0].code,
    'property-block/invalid-before-current-boundary'
  );
});

test('preparePool evalua availabilityRules all/any y conserva finished', () => {
  const pool = createPool({
    key: POOL_KEYS.POOL_CONCEALED,
    stages: [
      createStage({
        key: 'available_stage',
        status: STAGE_STATUSES.DONE,
        actorIds: ['role-1'],
        availabilityRules: {
          all: [
            { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY },
            { type: AVAILABILITY_RULE_TYPES.HAS_EXECUTABLE_ACTION }
          ],
          any: [
            { type: AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW, firstCycle: 2 },
            { type: AVAILABILITY_RULE_TYPES.ALWAYS_AVAILABLE }
          ]
        },
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: 'finished_stage',
        status: STAGE_STATUSES.FINISHED,
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      })
    ]
  });
  const prepared = preparePool(pool, {
    cycleId: 1,
    poolKey: POOL_KEYS.POOL_CONCEALED,
    roleStates: [{ id: 'role-1', inPlay: true }]
  });

  assert.equal(prepared.ok, true);
  assert.equal(prepared.pool.stages[0].status, STAGE_STATUSES.ENABLED);
  assert.equal(prepared.pool.stages[1].status, STAGE_STATUSES.FINISHED);
});

test('validatePool rechaza pools sin stages ejecutables', () => {
  const pool = createPool({
    key: POOL_KEYS.POOL_EXPOSED,
    stages: [
      createStage({
        key: 'disabled_stage',
        status: STAGE_STATUSES.DISABLED,
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      })
    ]
  });
  const validation = validatePool(pool, Object.values(POOL_LIFECYCLE_OPERATION_TYPES));

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'pool/no-runnable-stages');
});

test('specialStages tiene prioridad inicial sin formar parte de pools', () => {
  const session = createSession({
    currentStageSource: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
    specialStages: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      })
    ],
    cycle: createCycle({
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          })
        ]
      }
    })
  });

  assert.deepEqual(session.cycle.poolOrder, [
    POOL_KEYS.POOL_CONCEALED,
    POOL_KEYS.POOL_EXPOSED
  ]);
  assert.equal(session.currentStageSource, CURRENT_STAGE_SOURCES.SPECIAL_STAGES);
  assert.equal(getCurrentStage(session).stageKey, STAGE_KEYS.STAGE_01);
});

test('specialStages pendientes no interrumpen el pool hasta cambiar currentStageSource', () => {
  const session = createSession({
    cycle: createCycle({
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
          })
        ]
      }
    })
  });
  const queued = appendSpecialStage(
    session,
    createStage({
      key: STAGE_KEYS.STAGE_07,
      status: STAGE_STATUSES.ENABLED,
      actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
    })
  );

  assert.equal(queued.currentStageSource, CURRENT_STAGE_SOURCES.POOL);
  assert.equal(getCurrentStage(queued).stageKey, STAGE_KEYS.STAGE_02);

  const started = startSpecialStages(queued);

  assert.equal(started.currentStageSource, CURRENT_STAGE_SOURCES.SPECIAL_STAGES);
  assert.equal(getCurrentStage(started).stageKey, STAGE_KEYS.STAGE_07);
});

test('stageDefinition define completion y recetas opcionales', () => {
  const stage = createStage({
    key: STAGE_KEYS.STAGE_03,
    status: STAGE_STATUSES.ENABLED,
    actorIds: ['alignment_a_blocker-0'],
    completion: {
      mode: STAGE_COMPLETION_MODES.MANUAL,
      allowedRequesters: [
        STAGE_COMPLETION_REQUESTED_BY.PLAYER,
        STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
        STAGE_COMPLETION_REQUESTED_BY.SYSTEM
      ]
    },
    actions: [
      actionRecipe(restoreRecentOutOfPlayAction, STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      {
        ...actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY),
        optional: true
      }
    ]
  });

  assert.equal(stage.completion.mode, STAGE_COMPLETION_MODES.MANUAL);
  assert.deepEqual(stage.completion.allowedRequesters, [
    STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    STAGE_COMPLETION_REQUESTED_BY.SYSTEM
  ]);
  assert.equal(stage.actions.length, 2);
  assert.equal(stage.actions[0].optional, true);
  assert.equal(stage.actions[1].optional, true);
});

test('stageCatalog define y createStage materializa un stage de control inPlay', () => {
  const stage = createStage({
    ...getCatalogStage(STAGE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, {
      key: STAGE_KEYS.STAGE_03
    }),
    actorIds: ['alignment_a_blocker-0']
  });

  assert.equal(stage.key, STAGE_KEYS.STAGE_03);
  assert.deepEqual(stage.actorIds, ['alignment_a_blocker-0']);
  assert.equal(stage.completion.mode, STAGE_COMPLETION_MODES.MANUAL);
  assert.deepEqual(stage.completion.allowedRequesters, [
    STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    STAGE_COMPLETION_REQUESTED_BY.SYSTEM
  ]);
  assert.deepEqual(
    stage.actions.map((action) => action.key),
    [STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STAGE_ACTION_KEYS.ONE_SHOT_SET_OUT_OF_PLAY]
  );
  assert.equal(stage.actions.every((action) => action.optional === true), true);
  assert.equal(stage.metadata.catalogId, 'role_in_play_control');
});

test('stageCatalog expone los stages mecanicos ya definidos', () => {
  const stages = [
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_INSPECTS, { key: STAGE_KEYS.STAGE_01 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS, { key: STAGE_KEYS.STAGE_02 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_02 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, { key: STAGE_KEYS.STAGE_03 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE, { key: STAGE_KEYS.STAGE_07 }),
    getCatalogStage(STAGE_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_04 }),
    getCatalogStage(STAGE_CATALOG_IDS.GROUP_SELECTION, { key: STAGE_KEYS.STAGE_05 })
  ];

  assert.deepEqual(
    stages.map((stage) => stage.actions.map((action) => action.key)),
    [
      [STAGE_ACTION_KEYS.INSPECT_ROLE],
      [STAGE_ACTION_KEYS.LINK_TARGETS],
      [STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY],
      [STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STAGE_ACTION_KEYS.ONE_SHOT_SET_OUT_OF_PLAY],
      [STAGE_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STAGE_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STAGE_ACTION_KEYS.SET_OUT_OF_PLAY]
    ]
  );
  assert.equal(stages.every((stage) => stage.actorIds === undefined), true);
});

test('roleCatalog declara roles mecanicos y razones de orden', () => {
  const catalog = getCoreRoleCatalog();
  const byKey = Object.fromEntries(catalog.map((roleDefinition) => [roleDefinition.key, roleDefinition]));

  assert.deepEqual(
    [
      byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_INSPECTS].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stageDefinitions[0].poolKey
    ],
    [
      POOL_KEYS.POOL_CONCEALED,
      POOL_KEYS.POOL_CONCEALED,
      POOL_KEYS.POOL_CONCEALED,
      POOL_KEYS.POOL_CONCEALED
    ]
  );
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stageDefinitions[0].order, 5);
  assert.deepEqual(
    byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stageDefinitions[0].availabilityRules.all,
    [
      { type: AVAILABILITY_RULE_TYPES.ACTOR_IN_PLAY, metadata: {} },
      {
        type: AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW,
        firstCycle: 1,
        lastCycle: 1,
        poolKey: POOL_KEYS.POOL_CONCEALED,
        metadata: {}
      }
    ]
  );
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_INSPECTS].stageDefinitions[0].order, 10);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].stageDefinitions[0].order, 20);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stageDefinitions[0].order, 40);
  assert.equal(
    byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stageDefinitions[0].metadata.orderReason.includes(
      'same-cycle inPlay=false'
    ),
    true
  );
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].stageDefinitions.length, 0);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].reactions.length, 1);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].reactions[0].response.stage.poolKey, null);
});

test('groupCatalog declara grupos mecanicos y razones de orden', () => {
  const catalog = getCoreGroupCatalog();
  const group = catalog[0];
  const stageDefinition = group.stageDefinitions[0];

  assert.equal(group.key, GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY);
  assert.equal(group.membershipRule.type, 'alignment');
  assert.equal(group.membershipRule.alignmentId, 'alignment_b');
  assert.equal(stageDefinition.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(stageDefinition.order, 30);
  assert.deepEqual(
    stageDefinition.actions.map((action) => action.key),
    [STAGE_ACTION_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(stageDefinition.metadata.orderReason.includes('after blockers'), true);
});

test('createPool materializa los stages de un pool concreto', () => {
  const pool = createPool({
    key: POOL_KEYS.POOL_CONCEALED,
    stages: [
      getCatalogStage(STAGE_CATALOG_IDS.ROLE_INSPECTS, {
        order: 10
      })
    ]
  });

  assert.equal(pool.stages.length, 1);
  assert.equal(pool.stages[0].poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(pool.stages[0].order, 10);
  assert.equal(pool.stages[0].actions[0].key, STAGE_ACTION_KEYS.INSPECT_ROLE);
});

test('buildPools ensambla stages desde roles y grupos', () => {
  const roleDefinitions = getCoreRoleCatalog().filter(
    (role) => role.key !== ROLE_CATALOG_IDS.ROLE_REACTIVE
  );
  const groupDefinitions = getCoreGroupCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = createSession({
    roles: buildRoles(
      [
        { seat: 0, role: ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS, alignmentId: 'alignment_a' },
        { seat: 1, role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' },
        { seat: 2, role: ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, alignmentId: 'alignment_a' },
        { seat: 3, role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' }
      ],
      roleDefinitionMap
    )
  });
  const sessionWithGroups = {
    ...session,
    groups: buildGroups(session, groupDefinitions)
  };
  const built = buildPools({
    session: sessionWithGroups,
    roleDefinitions,
    groupDefinitions
  });

  assert.equal(built.ok, true);
  assert.equal(built.specialStages.length, 0);
  assert.equal(built.pools.poolConcealed.stages.length, 5);
  assert.deepEqual(
    built.pools.poolConcealed.stages.map((stage) => stage.order),
    [5, 10, 20, 30, 40]
  );
  assert.deepEqual(built.pools.poolConcealed.stages[0].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS}-0`
  ]);
  assert.deepEqual(built.pools.poolConcealed.stages[3].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`
  ]);
});

test('role reactive crea un stage especial al recibir inPlay=false final', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withCycle(
    createSession({
      id: 'reactive-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' },
        { id: 'player-3', displayName: 'Player 3' }
      ],
      roles: buildRoles(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' },
          { seat: 2, playerId: 'player-3', role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      )
    }),
    createCycle({
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_EXPOSED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const firstResolution = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStage(firstResolution.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const specialResolution = resolveCurrentStage(completed.session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`]
  });

  assert.equal(firstResolution.ok, true);
  assert.equal(roleById(firstResolution.session, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`).inPlay, false);
  assert.equal(firstResolution.result.events.length, 1);
  assert.equal(firstResolution.result.eventResponses.length, 1);
  assert.equal(firstResolution.session.specialStages.length, 1);
  assert.deepEqual(firstResolution.session.specialStages[0].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`
  ]);
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.SPECIAL_STAGES);
  assert.equal(specialResolution.ok, true);
  assert.equal(roleById(specialResolution.session, `${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`).inPlay, false);
});

test('specialStages resuelve stages pendientes antes de conclude_play si pueden alterar outcome', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withCycle(
    createSession({
      id: 'reactive-finished-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' }
      ],
      roles: buildRoles(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      ),
      groups: [
        createAlignmentGroup('alignment_b', [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_b_only_group_remains',
          holder: {
            type: 'group',
            id: 'group_alignment_b'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY
          }
        })
      ]
    }),
    createCycle({
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_EXPOSED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.session.status, SESSION_STATUSES.DRAFT);
  assert.equal(resolved.result.objectiveEvaluation, undefined);
  assert.equal(resolved.session.specialStages.length, 1);
  assert.equal(
    resolved.session.specialStages[0].metadata.source.metadata.reactionKey,
    'self_out_of_play_creates_special_stage'
  );
  assert.equal(completed.objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(completed.objectiveEvaluation.reason, 'play_outcome_unstable');
  assert.equal(completed.objectiveEvaluation.playOutcome, null);
  assert.equal(completed.objectiveEvaluation.playOutcomeCandidate.conclusive, true);
  assert.deepEqual(completed.objectiveEvaluation.pendingObjectiveInfluenceStageKeys, [
    STAGE_KEYS.STAGE_07
  ]);
  assert.equal(completed.session.specialStages.length, 1);
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.SPECIAL_STAGES);
  assert.equal(
    completed.stageAdvance.next.stage.metadata.source.metadata.reactionKey,
    'self_out_of_play_creates_special_stage'
  );
});

test('conclude_play se aplica como lifecycleOperation cuando el outcome es estable', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withCycle(
    createSession({
      id: 'stable-finished-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' }
      ],
      roles: buildRoles(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      ),
      groups: [
        createAlignmentGroup('alignment_b', [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_b_only_group_remains',
          holder: {
            type: 'group',
            id: 'group_alignment_b'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY
          }
        })
      ]
    }),
    createCycle({
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_EXPOSED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`]
  });
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(resolved.ok, true);
  assert.equal(completed.objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(completed.objectiveEvaluation.reason, 'single_conclusive_objective');
  assert.equal(completed.session.playOutcome.conclusive, true);
  assert.equal(completed.stageAdvance.next, null);
  assert.equal(completed.session.specialStages.length, 0);
  assert.deepEqual(
    completed.lifecycleResults.map((entry) => entry.key),
    [
      POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS,
      STAGE_ACTION_KEYS.CHECK_OBJECTIVES,
      STAGE_ACTION_KEYS.CONCLUDE_PLAY
    ]
  );
  assert.equal(completed.lifecycleResults[2].result.type, EFFECT_TYPES.CONCLUDE_PLAY);
});

test('cycle inicia un nuevo ciclo antes de entrar en poolConcealed', () => {
  const session = createSession({
    ...createBaseSession(),
    currentStageSource: CURRENT_STAGE_SOURCES.SPECIAL_STAGES,
    specialStages: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
      })
    ],
    cycle: createCycle({
      poolCurrent: POOL_KEYS.POOL_EXPOSED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          })
        ],
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
          })
        ]
      }
    })
  });
  const resolved = resolveCurrentStage(session, {
    actorIds: ['role_inspector-0'],
    targetIds: ['hidden_enemy-0']
  });
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(completed.stageAdvance.reason, 'next-pool');
  assert.equal(completed.stageAdvance.next.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.deepEqual(
    completed.lifecycleResults.map((entry) => entry.key),
    [STAGE_ACTION_KEYS.CHECK_OBJECTIVES]
  );
  assert.equal(completed.lifecycleResults[0].result.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.equal(completed.session.cycle.id, 1);
  assert.equal(completed.session.cycleHistory.at(-1).operation, 'started');
});

test('buildSession crea roles y cycle desde configuracion', () => {
  const selectedRoles = getCoreRoleCatalog().filter((role) =>
    [ROLE_CATALOG_IDS.ROLE_INSPECTS, ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].includes(role.key)
  );
  const built = buildSession({
    id: 'built-session',
    players: [
      { id: 'player-1', displayName: 'Player 1' },
      { id: 'player-2', displayName: 'Player 2' }
    ],
    seats: [
      { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_INSPECTS },
      { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY }
    ],
    roleDefinitions: selectedRoles,
    groupDefinitions: []
  });

  assert.equal(built.ok, true);
  assert.equal(built.session.id, 'built-session');
  assert.equal(built.session.roles.length, 2);
  assert.equal(built.session.roles[0].roleKey, ROLE_CATALOG_IDS.ROLE_INSPECTS);
  assert.equal(built.session.groups.length, 0);
  assert.equal(built.session.specialStages.length, 0);
  assert.equal(built.session.cycle.pools.poolConcealed.stages.length, 2);
});

test('buildSession rechaza stages enabled creados desde grupos sin actores', () => {
  const selectedRoles = getCoreRoleCatalog().filter((role) =>
    [ROLE_CATALOG_IDS.ROLE_INSPECTS].includes(role.key)
  );
  const built = buildSession({
    id: 'empty-group-stage-session',
    players: [{ id: 'player-1', displayName: 'Player 1' }],
    seats: [{ seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_INSPECTS }],
    roleDefinitions: selectedRoles,
    groupDefinitions: getCoreGroupCatalog()
  });

  assert.equal(built.ok, false);
  assert.equal(built.errors[0].code, POOL_DEFINITION_ERRORS.EMPTY_ACTOR_IDS);
  assert.equal(built.errors[0].source.type, 'group');
});

test('buildSession crea grupos con miembros resueltos desde membershipRules', () => {
  const session = createBaseSession();
  const built = buildSession({
    id: 'group-built-session',
    players: session.players,
    roles: session.roles,
    groupDefinitions: [
      defineGroup({
        key: 'all_roles',
        membershipRule: { type: GROUP_MEMBERSHIP_RULE_TYPES.ALL_ROLES }
      }),
      defineGroup({
        key: 'alignment_b_roles',
        membershipRule: {
          type: GROUP_MEMBERSHIP_RULE_TYPES.ALIGNMENT,
          alignmentId: 'alignment_b'
        }
      })
    ]
  });

  const byKey = Object.fromEntries(built.session.groups.map((group) => [group.key, group]));

  assert.equal(built.ok, true);
  assert.equal(byKey.all_roles.membershipRule, undefined);
  assert.equal(byKey.all_roles.roleIds.length, session.roles.length);
  assert.deepEqual(byKey.alignment_b_roles.roleIds.sort(), [
    'alignment_b_attacker-0',
    'alignment_b_target-0',
    'hidden_enemy-0'
  ]);
});

test('groupModel anade y elimina roles de grupos persistentes de sesion', () => {
  const session = createSession({
    id: 'group-runtime-session',
    roles: createBaseSession().roles,
    groups: [
      createGroup({
        key: 'linked_roles',
        roleIds: ['alignment_a_target-0']
      })
    ]
  });
  const withAddedRole = addRoleToGroup(session, 'linked_roles', 'alignment_b_target-0');
  const withRemovedRole = removeRoleFromGroup(
    withAddedRole,
    'linked_roles',
    'alignment_a_target-0'
  );

  assert.deepEqual(
    getGroupRoles(withAddedRole, 'linked_roles').map((role) => role.id).sort(),
    ['alignment_a_target-0', 'alignment_b_target-0']
  );
  assert.deepEqual(withRemovedRole.groups[0].roleIds, ['alignment_b_target-0']);
});

test('resolveCurrentStage exige actionKey cuando un stage ofrece varias acciones', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                {
                  ...setInPlayFalseAction,
                  effect: {
                    ...setInPlayFalseAction.effect,
                    value: true
                  }
                },
                STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const missingActionKey = resolveCurrentStage(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const selectedAction = resolveCurrentStage(session, {
    actionKey: STAGE_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(missingActionKey.ok, false);
  assert.equal(missingActionKey.errors[0].code, 'stage/missing-action-key');
  assert.equal(selectedAction.ok, true);
  assert.equal(selectedAction.session.actionHistory.at(-1).stageKey, STAGE_KEYS.STAGE_03);
  assert.equal(
    selectedAction.session.actionHistory.at(-1).actionKey,
    STAGE_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  assert.equal(roleById(selectedAction.session, 'alignment_a_target-0').inPlay, false);
});

test('resolveCurrentStage ejecuta stage_05 con seleccion y receta set_out_of_play', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [
          {
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            actorIds: [],
            selectionRules: selectionOutOfPlayRules,
            actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0',
      'alignment_a_blocker-0': 'alignment_a_target-0',
      'alignment_a_target-0': 'alignment_a_target-0',
      'alignment_a_plain-0': 'alignment_a_target-0',
      'alignment_b_target-0': 'alignment_a_target-0',
      'role_inspector-0': 'alignment_a_target-0',
      'hidden_enemy-0': 'alignment_a_target-0'
    })
  });
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_selection_stage'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.stage.stageKey, STAGE_KEYS.STAGE_05);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(resolved.stageAdvance, null);
  assert.equal(completed.ok, false);
  assert.equal(
    completed.session.cycle.pools.poolExposed.stages[0].status,
    STAGE_STATUSES.DONE
  );
  assert.equal(completed.stageAdvance.reason, 'next-pool-not-runnable');
  assert.equal(completed.errors[0].code, 'cycle/no-runnable-stages');
});

test('resolveCurrentStage usa actorIds del stage como participantes de seleccion', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [
          {
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
            selectionRules: selectionOutOfPlayRules,
            actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0'
    })
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/missing-required-selections');
  assert.deepEqual(resolved.errors[0].missingSelectorIds, ['alignment_a_blocker-0']);
});

test('resolveCurrentStage ejecuta stage_02 con receta block_out_of_play', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const attackAfterBlocking = resolveAction(blocking.session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.stage.stageKey, STAGE_KEYS.STAGE_02);
  assert.equal(blocking.stageAdvance, null);
  assert.deepEqual(
    roleById(blocking.session, 'alignment_a_target-0').blockedPropertyChanges[0].blockedFor.actorIds,
    ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0']
  );
  const completed = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  assert.equal(completed.ok, false);
  assert.equal(
    completed.session.cycle.pools.poolConcealed.stages[0].status,
    STAGE_STATUSES.DONE
  );
  assert.equal(completed.stageAdvance.reason, 'next-pool-not-runnable');
  assert.equal(completed.errors[0].code, 'cycle/no-runnable-stages');
  assert.deepEqual(
    roleById(completed.session, 'alignment_a_target-0').blockedPropertyChanges,
    []
  );
  assert.equal(attackAfterBlocking.ok, true);
  assert.equal(roleById(attackAfterBlocking.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(attackAfterBlocking.result.proposedEffects.length, 1);
  assert.equal(
    attackAfterBlocking.result.preventedPropertyChanges[0].reason,
    'blocked_property_change'
  );
});

test('resolveCurrentStage ejecuta stage_04 con receta set_out_of_play', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockingCompleted = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const blockedAttempt = resolveCurrentStage(blockingCompleted.session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.stageAdvance, null);
  assert.equal(blockingCompleted.stageAdvance.next.stageKey, STAGE_KEYS.STAGE_04);
  assert.equal(blockedAttempt.ok, true);
  assert.equal(blockedAttempt.stage.stageKey, STAGE_KEYS.STAGE_04);
  assert.equal(roleById(blockedAttempt.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(blockedAttempt.result.proposedEffects.length, 1);
  assert.equal(
    blockedAttempt.result.preventedPropertyChanges[0].reason,
    'blocked_property_change'
  );
  const blockedCompleted = completeCurrentStage(blockedAttempt.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  assert.equal(blockedCompleted.ok, false);
  assert.equal(blockedCompleted.errors[0].code, 'cycle/no-runnable-stages');
  assert.equal(
    blockedCompleted.session.cycle.pools.poolConcealed.stages[1].status,
    STAGE_STATUSES.DONE
  );
});

test('actionHistory registra stage, efectos finales y cambios impedidos', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const historyEntry = resolved.session.actionHistory.at(-1);
  const appliedEntries = findAppliedSetPropertyHistory(resolved.session, {
    cycleId: historyEntry.cycleId,
    property: 'inPlay',
    value: false,
    targetId: 'alignment_a_target-0',
    stageKey: STAGE_KEYS.STAGE_04,
    actionKey: STAGE_ACTION_KEYS.SET_OUT_OF_PLAY
  });

  assert.equal(resolved.ok, true);
  assert.equal(historyEntry.stageId, resolved.stage.stageId);
  assert.equal(historyEntry.stageKey, STAGE_KEYS.STAGE_04);
  assert.equal(historyEntry.actionKey, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY);
  assert.equal(historyEntry.actionId, ACTION_IDS.SET_IN_PLAY);
  assert.equal(historyEntry.result, HISTORY_RESULTS.APPLIED);
  assert.equal(historyEntry.finalEffects[0].property, 'inPlay');
  assert.equal(historyEntry.finalEffects[0].value, false);
  assert.equal(appliedEntries.length, 1);
});

test('restore_recent_out_of_play ejecuta set_in_play(true) solo sobre un set_out_of_play previo', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const setOutOfPlay = resolveCurrentStage(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOutStageClosed = completeCurrentStage(setOutOfPlay.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_set_out_stage'
  });
  const restored = resolveCurrentStage(setOutStageClosed.session, {
    actionKey: STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(setOutOfPlay.ok, true);
  assert.equal(roleById(setOutOfPlay.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(setOutOfPlay.stageAdvance, null);
  assert.equal(setOutStageClosed.ok, true);
  assert.equal(setOutStageClosed.stageAdvance.next.stageKey, STAGE_KEYS.STAGE_03);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(restored.stageAdvance, null);
  assert.equal(
    restored.session.cycle.pools.poolConcealed.stages[1].status,
    STAGE_STATUSES.ENABLED
  );
  assert.equal(restored.session.actionHistory.at(-1).stageKey, STAGE_KEYS.STAGE_03);
  assert.equal(
    restored.session.actionHistory.at(-1).actionKey,
    STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  assert.equal(restored.session.actionHistory.at(-1).finalEffects[0].value, true);
});

test('un stage con recetas opcionales permanece abierto hasta cierre explicito', () => {
  const preStageSetOut = resolveRecipe(
    createBaseSession(),
    actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY),
    {
      actorIds: ['alignment_b_attacker-0'],
      targetIds: ['alignment_a_target-0']
    }
  );
  const optionalSetOutRecipe = actionRecipe(
    {
      ...setInPlayFalseAction,
      constraints: [
        {
          type: CONSTRAINT_TYPES.LIMITED_USES,
          limit: 1,
          window: CONSTRAINT_WINDOWS.SESSION
        }
      ]
    },
    STAGE_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  const session = withCycle(
    preStageSetOut.session,
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              optionalSetOutRecipe
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStage(session, {
    actionKey: STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOut = resolveCurrentStage(restored.session, {
    actionKey: STAGE_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_b_target-0']
  });
  const completed = completeCurrentStage(setOut.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_optional_stage'
  });

  assert.equal(preStageSetOut.ok, true);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(restored.stageAdvance, null);
  assert.equal(
    restored.session.cycle.pools.poolConcealed.stages[0].status,
    STAGE_STATUSES.ENABLED
  );
  assert.equal(setOut.ok, true);
  assert.equal(roleById(setOut.session, 'alignment_b_target-0').inPlay, false);
  assert.equal(setOut.stageAdvance, null);
  assert.equal(completed.ok, false);
  assert.equal(completed.stageAdvance.reason, 'next-pool-not-runnable');
  assert.equal(completed.errors[0].code, 'cycle/no-runnable-stages');
  assert.equal(
    completed.session.cycle.pools.poolConcealed.stages[0].status,
    STAGE_STATUSES.DONE
  );
  assert.equal(completed.completion.requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('completeCurrentStage respeta allowedRequesters del stage', () => {
  const stage = createStage({
    key: STAGE_KEYS.STAGE_03,
    status: STAGE_STATUSES.ENABLED,
    completion: {
      mode: STAGE_COMPLETION_MODES.MANUAL,
      allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
    },
    actions: [actionRecipe(restoreRecentOutOfPlayAction, STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY)]
  });
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [stage]
      }
    })
  );
  const actorClose = completeCurrentStage(session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const directorClose = completeCurrentStage(session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(actorClose.ok, false);
  assert.equal(actorClose.errors[0].code, 'stage/completion-not-allowed');
  assert.deepEqual(actorClose.errors[0].allowedRequesters, [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]);
  assert.equal(directorClose.ok, false);
  assert.equal(directorClose.errors[0].code, 'cycle/no-runnable-stages');
  assert.equal(directorClose.completion.requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('restore_recent_out_of_play rechaza targets sin set_out_of_play aplicado este ciclo', () => {
  const session = withCycle(
    withInPlayState(createBaseSession(), {
      'alignment_a_target-0': false
    }),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              )
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStage(session, {
    actionKey: STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(restored.ok, false);
  assert.equal(restored.errors[0].code, 'constraint/require_recent_set_property');
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, false);
});

test('restore_recent_out_of_play rechaza un set_out_of_play bloqueado', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STAGE_KEYS.STAGE_01,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              )
            ]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockingClosed = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const blockedSetOutOfPlay = resolveCurrentStage(blockingClosed.session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockedSetOutClosed = completeCurrentStage(blockedSetOutOfPlay.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const restored = resolveCurrentStage(blockedSetOutClosed.session, {
    actionKey: STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blockingClosed.ok, true);
  assert.equal(blockedSetOutOfPlay.ok, true);
  assert.deepEqual(blockedSetOutOfPlay.result.finalEffects, []);
  assert.equal(roleById(blockedSetOutOfPlay.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(blockedSetOutClosed.ok, true);
  assert.equal(restored.ok, false);
  assert.equal(restored.errors[0].code, 'constraint/require_recent_set_property');
});

test('limited_uses bloquea una segunda ejecucion de la misma receta por el mismo actor', () => {
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreRecipe = actionRecipe(
    restoreRecentOutOfPlayAction,
    STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const secondSetOut = resolveRecipe(firstRestore.session, setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(firstRestore.ok, true);
  assert.equal(secondSetOut.ok, true);
  assert.equal(secondRestore.ok, false);
  assert.equal(secondRestore.errors[0].code, 'constraint/limited_uses');
  assert.equal(secondRestore.errors[0].window, CONSTRAINT_WINDOWS.SESSION);
  assert.equal(secondRestore.messages[0].key, MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED);
  assert.equal(secondRestore.session.sessionMessageLog.length, 1);
  assert.equal(
    secondRestore.session.sessionMessageLog[0].message.audience.type,
    MESSAGE_AUDIENCE_TYPES.ROLE
  );
});

test('skin presenta gameplayMessage y conserva estructura junto al texto mostrado', () => {
  const skin = defineSkin({
    id: 'test_skin',
    defaultLanguage: 'es',
    entities: {
      roles: {
        alignment_a_blocker: { displayName: 'Bruja' }
      },
      resources: {
        restore_recent_out_of_play: { displayName: 'pocion de restauracion' }
      }
    },
    messages: {
      es: {
        [MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED]: {
          role: '{actor}, la {resource} ya ha sido usada.'
        }
      }
    }
  });
  const session = createBaseSession();
  const message = createMessage({
    id: 'message-1',
    type: MESSAGE_TYPES.GAMEPLAY,
    key: MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED,
    severity: MESSAGE_SEVERITIES.WARNING,
    audience: {
      type: MESSAGE_AUDIENCE_TYPES.ROLE,
      ids: ['alignment_a_blocker-0']
    },
    params: {
      actor: {
        entityType: 'role',
        id: 'alignment_a_blocker-0'
      },
      resource: {
        entityType: 'resource',
        id: 'restore_recent_out_of_play'
      },
      limit: 1,
      used: 1
    }
  });
  const presented = presentMessage({ message, skin, language: 'es', session });

  assert.equal(presented.ok, true);
  assert.equal(
    presented.presentation.text,
    'Bruja, la pocion de restauracion ya ha sido usada.'
  );
  assert.deepEqual(toToastInput(presented.presentation), {
    message: 'Bruja, la pocion de restauracion ya ha sido usada.',
    variant: 'info'
  });

  const routed = routeMessage({
    session,
    message
  }).session;
  const recorded = recordRenderedSessionMessage(
    routed,
    routed.sessionMessageLog[0].id,
    presented.presentation
  );

  assert.equal(recorded.sessionMessageLog[0].message.key, message.key);
  assert.equal(recorded.sessionMessageLog[0].rendered.text, presented.presentation.text);
});

test('skinValidation distingue cobertura obligatoria y opcional', () => {
  const skin = defineSkin({
    id: 'partial_skin',
    defaultLanguage: 'es',
    messages: {
      es: {
        [MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED]: {
          default: 'Recurso consumido.'
        }
      }
    },
    entities: {
      roles: {
        role_required: { displayName: 'Rol requerido' }
      }
    }
  });
  const validation = validateSkinCoverage({
    skin,
    language: 'es',
    requiredMessageKeys: [
      MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED,
      MESSAGE_KEYS.OBJECTIVE_ACHIEVED
    ],
    requiredEntities: {
      roles: {
        required: ['role_required'],
        optional: ['role_optional']
      }
    }
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'skin/missing-required-message');
  assert.equal(validation.warnings[0].code, 'skin/missing-optional-entity');
});

test('applicationMessage se registra fuera de session', () => {
  const session = createBaseSession();
  const message = createMessage({
    type: MESSAGE_TYPES.APPLICATION,
    key: MESSAGE_KEYS.APPLICATION_OPERATION_FAILED,
    severity: MESSAGE_SEVERITIES.ERROR,
    audience: { type: MESSAGE_AUDIENCE_TYPES.SYSTEM },
    params: { code: 'network/offline' }
  });
  const routed = routeMessage({ session, applicationLog: [], message });

  assert.equal(routed.session, session);
  assert.equal(routed.applicationLog.length, 1);
  assert.equal(routed.applicationLog[0].message.params.code, 'network/offline');
});

test('limited_uses con ventana current_cycle permite reutilizar en otro ciclo', () => {
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restorePerCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.CURRENT_CYCLE
      }
    },
    STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restorePerCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = advanceTestCycle(firstRestore.session);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restorePerCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(firstRestore.ok, true);
  assert.equal(secondRestore.ok, true);
  assert.equal(roleById(secondRestore.session, 'alignment_a_plain-0').inPlay, true);
});

test('limited_uses con ventana next_cycle cuenta usos del ciclo anterior', () => {
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreNextCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.NEXT_CYCLE
      }
    },
    STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreNextCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = advanceTestCycle(firstRestore.session);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreNextCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(firstRestore.ok, true);
  assert.equal(secondSetOut.ok, true);
  assert.equal(secondRestore.ok, false);
  assert.equal(secondRestore.errors[0].code, 'constraint/limited_uses');
  assert.equal(secondRestore.errors[0].window, CONSTRAINT_WINDOWS.NEXT_CYCLE);
});

test('limited_uses con ventana current_or_next_cycle cuenta el ciclo actual y el anterior', () => {
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreCurrentOrNextRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
      }
    },
    STAGE_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreCurrentOrNextRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = advanceTestCycle(firstRestore.session);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreCurrentOrNextRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(firstRestore.ok, true);
  assert.equal(secondSetOut.ok, true);
  assert.equal(secondRestore.ok, false);
  assert.equal(secondRestore.errors[0].code, 'constraint/limited_uses');
  assert.equal(secondRestore.errors[0].window, CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE);
});

test('limited_uses cuenta una receta aunque su efecto quede bloqueado', () => {
  const limitedSetOutRecipe = actionRecipe(
    {
      ...setInPlayFalseAction,
      constraints: [
        {
          type: CONSTRAINT_TYPES.LIMITED_USES,
          limit: 1,
          window: CONSTRAINT_WINDOWS.SESSION
        }
      ]
    },
    STAGE_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  const blocking = resolveRecipe(createBaseSession(), blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockedUse = resolveRecipe(blocking.session, limitedSetOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const secondUse = resolveRecipe(blockedUse.session, limitedSetOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(blockedUse.ok, true);
  assert.equal(
    blockedUse.result.preventedPropertyChanges[0].reason,
    'blocked_property_change'
  );
  assert.equal(blockedUse.session.actionHistory.at(-1).result, 'blocked');
  assert.equal(secondUse.ok, false);
  assert.equal(secondUse.errors[0].code, 'constraint/limited_uses');
});

test('set_in_play(false) cambia inPlay solo en el objetivo directo', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
  assert.equal(resolved.result.proposedEffects.length, 1);
  assert.deepEqual(resolved.result.proposedEffects[0].causedBy, {
    type: 'role',
    id: 'alignment_b_attacker-0'
  });
  assert.equal(resolved.result.preventedPropertyChanges.length, 0);
});

test('block_out_of_play bloquea set_in_play(false) solo sobre su target', () => {
  const session = createBaseSession();
  const blocking = resolveRecipe(session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockedTarget = resolveAction(blocking.session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const unblockedTarget = resolveAction(blocking.session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blockedTarget.ok, true);
  assert.equal(roleById(blockedTarget.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(blockedTarget.result.proposedEffects.length, 1);
  assert.deepEqual(blockedTarget.result.finalEffects, []);
  assert.deepEqual(blockedTarget.result.preventedPropertyChanges, [
    {
      property: 'inPlay',
      value: false,
      reason: 'blocked_property_change',
      targetId: 'alignment_a_target-0',
      causedBy: {
        type: 'role',
        id: 'alignment_b_attacker-0'
      }
    }
  ]);

  assert.equal(unblockedTarget.ok, true);
  assert.equal(roleById(unblockedTarget.session, 'alignment_a_plain-0').inPlay, false);
});

test('blockedPropertyChanges vence en stage_boundary.after antes de avanzar', () => {
  const stageBlockRecipe = {
    ...blockOutOfPlayRecipe,
    effect: {
      ...blockOutOfPlayRecipe.effect,
      duration: {
        unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
        offset: 0,
        boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
      }
    }
  };
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: [POOL_KEYS.POOL_CONCEALED],
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          {
            id: 'stage-block-current',
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_a_blocker-0'],
            actions: [actionRecipe(stageBlockRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            id: 'stage-after-block',
            key: STAGE_KEYS.STAGE_01,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['role_inspector-0'],
            actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    targetIds: ['alignment_a_target-0']
  });
  const completed = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER
  });

  assert.equal(
    roleById(blocking.session, 'alignment_a_target-0').blockedPropertyChanges.length,
    1
  );
  assert.equal(
    roleById(completed.session, 'alignment_a_target-0').blockedPropertyChanges.length,
    0
  );
  assert.equal(completed.stageAdvance.next.stageId, 'stage-after-block');
});

test('blockedPropertyChanges vence en stage_boundary.before al entrar en el siguiente stage', () => {
  const nextStageBlockRecipe = {
    ...blockOutOfPlayRecipe,
    effect: {
      ...blockOutOfPlayRecipe.effect,
      duration: {
        unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
        offset: 1,
        boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
      }
    }
  };
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: [POOL_KEYS.POOL_CONCEALED],
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          {
            id: 'stage-block-before-next',
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_a_blocker-0'],
            actions: [
              actionRecipe(nextStageBlockRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)
            ]
          },
          {
            id: 'stage-next-set-out',
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_b_attacker-0'],
            actions: [
              actionRecipe(setInPlayFalseAction, STAGE_ACTION_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    targetIds: ['alignment_a_target-0']
  });
  const completed = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER
  });
  const setOut = resolveCurrentStage(completed.session, {
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(
    roleById(completed.session, 'alignment_a_target-0').blockedPropertyChanges.length,
    1
  );
  assert.equal(roleById(setOut.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(
    roleById(setOut.session, 'alignment_a_target-0').blockedPropertyChanges.length,
    0
  );
});

test('blockedPropertyChanges vence en cycle_boundary.after antes de startCycle', () => {
  const cycleBlockRecipe = {
    ...blockOutOfPlayRecipe,
    effect: {
      ...blockOutOfPlayRecipe.effect,
      duration: {
        unit: PROPERTY_BLOCK_DURATION_UNITS.CYCLE,
        offset: 0,
        boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
      }
    }
  };
  const session = withCycle(
    createBaseSession(),
    createCycle({
      id: 1,
      poolOrder: [POOL_KEYS.POOL_CONCEALED, POOL_KEYS.POOL_EXPOSED],
      poolCurrent: POOL_KEYS.POOL_EXPOSED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          {
            key: STAGE_KEYS.STAGE_01,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['role_inspector-0'],
            actions: [actionRecipe(inspectRoleAction, STAGE_ACTION_KEYS.INSPECT_ROLE)]
          }
        ],
        [POOL_KEYS.POOL_EXPOSED]: [
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_a_blocker-0'],
            actions: [actionRecipe(cycleBlockRecipe, STAGE_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    targetIds: ['alignment_a_target-0']
  });
  const completed = completeCurrentStage(blocking.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.PLAYER
  });

  assert.equal(completed.session.cycle.id, 2);
  assert.equal(
    roleById(completed.session, 'alignment_a_target-0').blockedPropertyChanges.length,
    0
  );
});

test('startCycle solo avanza el ciclo y no modifica estado de roles', () => {
  const cycle = createCycle({ id: 3 });
  const started = startCycle(cycle);

  assert.equal(started.ok, true);
  assert.equal(started.cycle.id, 4);
  assert.equal(started.changes[0].property, 'id');
});

test('no_repeat_target impide repetir el mismo bloqueo sobre el mismo target', () => {
  const session = createBaseSession();
  const firstBlocking = resolveRecipe(session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = advanceTestCycle(firstBlocking.session);
  const repeatedBlocking = resolveRecipe(nextCycle.session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const otherTargetBlocking = resolveRecipe(nextCycle.session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(repeatedBlocking.ok, false);
  assert.equal(repeatedBlocking.errors[0].code, 'constraint/no_repeat_target');
  assert.equal(otherTargetBlocking.ok, true);
});

test('no_repeat_target con ventana session impide repetir target durante toda la partida', () => {
  const sessionOnlyRecipe = {
    ...blockOutOfPlayRecipe,
    constraints: [
      {
        type: CONSTRAINT_TYPES.NO_REPEAT_TARGET,
        window: CONSTRAINT_WINDOWS.SESSION
      }
    ]
  };
  const firstBlocking = resolveRecipe(createBaseSession(), sessionOnlyRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const cycle2 = advanceTestCycle(firstBlocking.session);
  const cycle3 = advanceTestCycle(cycle2.session);
  const repeatedBlocking = resolveRecipe(cycle3.session, sessionOnlyRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const otherTargetBlocking = resolveRecipe(cycle3.session, sessionOnlyRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_plain-0']
  });

  assert.equal(firstBlocking.ok, true);
  assert.equal(repeatedBlocking.ok, false);
  assert.equal(repeatedBlocking.errors[0].code, 'constraint/no_repeat_target');
  assert.equal(repeatedBlocking.errors[0].window, CONSTRAINT_WINDOWS.SESSION);
  assert.equal(otherTargetBlocking.ok, true);
});

test('link_targets crea un grupo linked en la sesion', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });

  assert.equal(linked.ok, true);
  assert.equal(linked.session.groups.length, 1);
  assert.equal(linked.session.groups[0].id, 'linked_alignment_a_plain_0_alignment_a_target_0');
  assert.equal(linked.session.groups[0].type, GROUP_TYPES.LINKED);
  assert.deepEqual(linked.session.groups[0].roleIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
  assert.equal(linked.session.groups[0].groupRules[0].key, 'propagate_out_of_play');
  assert.equal(linked.session.groups[0].groupRules[0].includeOutOfPlay, false);
  assert.equal(
    linked.session.groups[0].selectionRules[0].key,
    'members_cannot_vote_other_members_out_of_play'
  );
  assert.equal(
    linked.session.groups[0].objectiveRules[0].condition.type,
    OBJECTIVE_CONDITIONS.ALL_HOLDER_MEMBERS_ARE_ONLY_ROLES_IN_PLAY
  );
  assert.equal(linked.result.finalEffects[0].type, EFFECT_TYPES.SET_GROUP);
});

test('link_targets consume uso de session aunque la stage solo exista en el primer ciclo', () => {
  const session = createBaseSession();
  const firstLink = resolveRecipe(session, linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const secondLink = resolveRecipe(firstLink.session, linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_b_target-0', 'alignment_a_blocker-0']
  });

  assert.equal(firstLink.ok, true);
  assert.equal(secondLink.ok, false);
  assert.equal(secondLink.errors[0].code, 'constraint/limited_uses');
  assert.equal(secondLink.errors[0].window, CONSTRAINT_WINDOWS.SESSION);
});

test('linked deriva inPlay=false hacia los roles enlazados', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const resolved = resolveAction(linked.session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.equal(resolved.result.finalEffects.length, 2);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: 'group',
    id: 'linked_alignment_a_plain_0_alignment_a_target_0'
  });
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'group_rule',
    groupId: 'linked_alignment_a_plain_0_alignment_a_target_0',
    groupRuleType: 'propagate_property_change',
    sourceTargetId: 'alignment_a_target-0'
  });
});

test('group linked aporta objectiveRule distribuida si sus miembros abarcan varios alignments efectivos', () => {
  const linked = resolveAction(createBaseSession(), linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_b_target-0']
  });
  const session = withInPlayState(linked.session, {
    'alignment_b_attacker-0': false,
    'alignment_a_blocker-0': false,
    'alignment_a_plain-0': false,
    'role_inspector-0': false,
    'hidden_enemy-0': false
  });
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(
    objectiveEvaluation.fulfilledRules[0].condition,
    OBJECTIVE_CONDITIONS.ALL_HOLDER_MEMBERS_ARE_ONLY_ROLES_IN_PLAY
  );
  assert.deepEqual(objectiveEvaluation.fulfilledRules[0].holder, {
    type: 'group',
    id: 'linked_alignment_a_target_0_alignment_b_target_0'
  });
});

test('groupRule usa causedBy del group al comprobar bloqueos derivados', () => {
  const linked = resolveAction(createBaseSession(), linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const linkedGroupId = linked.session.groups[0].id;
  const sessionBlockedForOriginalActor = {
    ...linked.session,
    roles: linked.session.roles.map((role) =>
      role.id === 'alignment_a_plain-0'
        ? addBlockedPropertyChange(role, {
            property: 'inPlay',
            value: false,
            blockedFor: {
              actorIds: ['alignment_b_attacker-0']
            },
            expiresAt: {
              type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
            }
          })
        : role
    )
  };
  const propagatedDespiteOriginalActorBlock = resolveAction(
    sessionBlockedForOriginalActor,
    setInPlayFalseAction,
    {
      actorIds: ['alignment_b_attacker-0'],
      targetIds: ['alignment_a_target-0']
    }
  );
  const sessionBlockedForGroup = {
    ...linked.session,
    roles: linked.session.roles.map((role) =>
      role.id === 'alignment_a_plain-0'
        ? addBlockedPropertyChange(role, {
            property: 'inPlay',
            value: false,
            blockedFor: {
              actorIds: [linkedGroupId]
            },
            expiresAt: {
              type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
            }
          })
        : role
    )
  };
  const blockedPropagation = resolveAction(sessionBlockedForGroup, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(
    roleById(propagatedDespiteOriginalActorBlock.session, 'alignment_a_target-0').inPlay,
    false
  );
  assert.equal(
    roleById(propagatedDespiteOriginalActorBlock.session, 'alignment_a_plain-0').inPlay,
    false
  );
  assert.equal(roleById(blockedPropagation.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(blockedPropagation.session, 'alignment_a_plain-0').inPlay, true);
  assert.deepEqual(blockedPropagation.result.blockedEffects[0].causedBy, {
    type: 'group',
    id: linkedGroupId
  });
});

test('propagate_property_change no depende del type linked', () => {
  const propagationGroup = createGroup({
    id: 'generic-propagation-group',
    type: 'custom',
    roleIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    groupRules: [
      {
        type: 'propagate_property_change',
        when: { property: 'inPlay', value: false },
        apply: { property: 'inPlay', value: false },
        targets: 'other_members'
      }
    ]
  });
  const session = createBaseSession({
    groups: [propagationGroup]
  });
  const resolved = resolveAction(session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: 'group',
    id: 'generic_propagation_group'
  });
});

test('resolver permite otra causa si la primera propagacion queda bloqueada', () => {
  const propagationRule = {
    type: 'propagate_property_change',
    when: { property: 'inPlay', value: false },
    apply: { property: 'inPlay', value: false },
    targets: 'other_members'
  };
  const blockedGroup = createGroup({
    id: 'blocked-propagation-group',
    roleIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    groupRules: [propagationRule]
  });
  const allowedGroup = createGroup({
    id: 'allowed-propagation-group',
    roleIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    groupRules: [propagationRule]
  });
  const baseSession = createBaseSession({
    groups: [blockedGroup, allowedGroup]
  });
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_a_plain-0'
        ? addBlockedPropertyChange(role, {
            property: 'inPlay',
            value: false,
            blockedFor: {
              actorIds: [blockedGroup.id]
            },
            expiresAt: {
              type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
            }
          })
        : role
    )
  };
  const resolved = resolveAction(session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.equal(resolved.result.blockedEffects.length, 1);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: 'group',
    id: allowedGroup.id
  });
});

test('validateSession detecta grupos que apuntan a roles inexistentes', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({
        id: 'broken-link',
        roleIds: ['alignment_a_target-0', 'missing-role-0']
      })
    ]
  });
  const validation = validateSession(session, { requireAssigned: true });

  assert.equal(validation.ok, false);
  assert.equal(
    validation.errors.some((error) => error.code === 'group/missing-role'),
    true
  );
});

test('checkObjectives devuelve ongoing cuando quedan varios alignments en juego', () => {
  const session = createBaseSession();
  const objectiveEvaluation = checkObjectives(session);

  assert.deepEqual(objectiveEvaluation, {
    status: OBJECTIVE_EVALUATION_STATUSES.ONGOING,
    reason: 'no_objective_condition_met',
    fulfilledRules: [],
    achievedObjectives: [],
    playOutcome: null
  });
});

test('checkObjectives aplica regla de group holder_reaches_in_play_parity', () => {
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createAlignmentGroup('alignment_b', [
          'alignment_b_attacker-0',
          'alignment_b_target-0',
          'hidden_enemy-0'
        ])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_b_reaches_threshold',
          holder: {
            type: 'group',
            id: 'group_alignment_b'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY
          }
        })
      ]
    }),
    {
      'alignment_a_plain-0': false,
      'role_inspector-0': false
    }
  );
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(objectiveEvaluation.reason, 'single_conclusive_objective');
  assert.equal(objectiveEvaluation.fulfilledRules[0].condition, OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY);
  assert.equal(objectiveEvaluation.fulfilledRules[0].key, 'alignment_b_reaches_threshold');
  assert.deepEqual(objectiveEvaluation.playOutcome.beneficiaries, [
    {
      type: 'group',
      ids: ['group_alignment_b'],
      roleIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0']
    }
  ]);
  assert.deepEqual(objectiveEvaluation.fulfilledRules[0].details, {
    holderInPlayCount: 3,
    nonHolderInPlayCount: 2,
    totalInPlayCount: 5
  });
});

test('canStageInfluenceObjectiveOutcome detecta stage pendiente que puede romper paridad cumplida', () => {
  const objectiveRule = createConclusiveObjectiveRule({
    key: 'alignment_b_reaches_threshold',
    holder: {
      type: 'group',
      id: 'group_alignment_b'
    },
    condition: {
      type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY
    }
  });
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createAlignmentGroup('alignment_b', [
          'alignment_b_attacker-0',
          'alignment_b_target-0',
          'hidden_enemy-0'
        ])
      ],
      objectiveRules: [objectiveRule]
    }),
    {
      'alignment_a_plain-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const pendingStage = createStage({
    key: STAGE_KEYS.STAGE_08,
    status: STAGE_STATUSES.ENABLED,
    actions: [setInPlayFalseAction],
    influences: [
      {
        subject: INFLUENCE_SUBJECTS.ROLE,
        property: 'inPlay',
        operation: INFLUENCE_OPERATIONS.SET,
        values: [false],
        roleIds: ['alignment_b_attacker-0']
      }
    ]
  });

  assert.equal(
    canStageInfluenceObjectiveOutcome({
      session,
      objectiveRule,
      stage: pendingStage
    }),
    true
  );
});

test('canStageInfluenceObjectiveOutcome ignora stage pendiente que solo refuerza paridad cumplida', () => {
  const objectiveRule = createConclusiveObjectiveRule({
    key: 'alignment_b_reaches_threshold',
    holder: {
      type: 'group',
      id: 'group_alignment_b'
    },
    condition: {
      type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY
    }
  });
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createAlignmentGroup('alignment_b', [
          'alignment_b_attacker-0',
          'alignment_b_target-0',
          'hidden_enemy-0'
        ])
      ],
      objectiveRules: [objectiveRule]
    }),
    {
      'alignment_a_plain-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const pendingStage = createStage({
    key: STAGE_KEYS.STAGE_08,
    status: STAGE_STATUSES.ENABLED,
    actions: [restoreRecentOutOfPlayAction],
    influences: [
      {
        subject: INFLUENCE_SUBJECTS.ROLE,
        property: 'inPlay',
        operation: INFLUENCE_OPERATIONS.SET,
        values: [true],
        roleIds: ['hidden_enemy-0']
      }
    ]
  });

  assert.equal(
    canStageInfluenceObjectiveOutcome({
      session,
      objectiveRule,
      stage: pendingStage
    }),
    false
  );
});

test('checkObjectives no aplica holder_reaches_in_play_parity si el group no alcanza al resto', () => {
  const session = createBaseSession({
    groups: [
      createAlignmentGroup('alignment_b', [
        'alignment_b_attacker-0',
        'alignment_b_target-0',
        'hidden_enemy-0'
      ])
    ],
    objectiveRules: [
      createConclusiveObjectiveRule({
        key: 'alignment_b_reaches_threshold',
        holder: {
          type: 'group',
          id: 'group_alignment_b'
        },
        condition: {
          type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_IN_PLAY_PARITY
        }
      })
    ]
  });
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.deepEqual(objectiveEvaluation.fulfilledRules, []);
});

test('checkObjectives detecta only_holder_group_remains_in_play con group de alignment', () => {
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createAlignmentGroup('alignment_a', [
          'alignment_a_blocker-0',
          'alignment_a_target-0',
          'alignment_a_plain-0',
          'role_inspector-0'
        ])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_a_only_group_remains',
          holder: {
            type: 'group',
            id: 'group_alignment_a'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY
          }
        })
      ]
    }),
    {
      'alignment_b_attacker-0': false,
      'alignment_b_target-0': false,
      'hidden_enemy-0': false
    }
  );
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(objectiveEvaluation.fulfilledRules[0].condition, OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY);
  assert.deepEqual(objectiveEvaluation.fulfilledRules[0].details.holderInPlayRoleIds.sort(), [
    'alignment_a_blocker-0',
    'alignment_a_plain-0',
    'alignment_a_target-0',
    'role_inspector-0'
  ]);
});

test('checkObjectives detecta only_holder_group_remains_in_play con group linked explicito', () => {
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createLinkedGroup({
          id: 'group_linked_finalists',
          roleIds: ['alignment_a_target-0', 'alignment_b_target-0']
        })
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'linked_group_only_group_remains',
          holder: {
            type: 'group',
            id: 'group_linked_finalists'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY
          }
        })
      ]
    }),
    {
      'alignment_b_attacker-0': false,
      'alignment_a_blocker-0': false,
      'alignment_a_plain-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(objectiveEvaluation.fulfilledRules[0].condition, OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY);
  assert.deepEqual(objectiveEvaluation.fulfilledRules[0].details.holderInPlayRoleIds.sort(), [
    'alignment_a_target-0',
    'alignment_b_target-0'
  ]);
});

test('checkObjectives no activa only_holder_group_remains_in_play si queda un tercero en juego', () => {
  const session = withInPlayState(
    createBaseSession({
      groups: [
        createLinkedGroup({
          id: 'group_linked_with_third',
          roleIds: ['alignment_a_target-0', 'alignment_b_target-0']
        })
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'linked_group_only_group_remains',
          holder: {
            type: 'group',
            id: 'group_linked_with_third'
          },
          condition: {
            type: OBJECTIVE_CONDITIONS.ONLY_HOLDER_GROUP_REMAINS_IN_PLAY
          }
        })
      ]
    }),
    {
      'alignment_b_attacker-0': false,
      'alignment_a_blocker-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.deepEqual(objectiveEvaluation.fulfilledRules, []);
});

test('resolveSelectionRound detecta chosen unico por mayoria simple', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.selectionTally, [
    { candidateId: 'alignment_a_target-0', selectionCount: 2 },
    { candidateId: 'alignment_b_target-0', selectionCount: 1 }
  ]);
});

test('resolveSelectionRound rechaza selectores que seleccionan mas de una vez', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/duplicate-selector');
});

test('resolveSelectionRound declara nula una seleccion empatada con null_on_tie', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: { tie: SELECTION_TIE_RULES.NULL_ON_TIE },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'tied_selection');
  assert.deepEqual(resolved.result.tiedCandidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
});

test('resolveSelectionRound acepta chosen si alcanza mayoria sobre selecciones emitidas', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECTION_SUPPORT_THRESHOLD_TYPES.MAJORITY,
        base: SELECTION_SUPPORT_BASES.CAST_SELECTIONS
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectionRound declara null si chosen no alcanza mayoria sobre selectores', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: [
      'alignment_b_attacker-0',
      'alignment_a_blocker-0',
      'alignment_a_target-0',
      'alignment_a_plain-0',
      'alignment_b_target-0',
      'role_inspector-0',
      'hidden_enemy-0'
    ],
    selectionRules: {
      supportThreshold: {
        type: SELECTION_SUPPORT_THRESHOLD_TYPES.MAJORITY,
        base: SELECTION_SUPPORT_BASES.SELECTOR_COUNT
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'insufficient_support');
  assert.deepEqual(resolved.result.support, {
    ok: false,
    requiredSupportCount: 4,
    supportBaseCount: 7
  });
});

test('resolveSelectionRound declara null si chosen no alcanza fraccion exigida', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECTION_SUPPORT_THRESHOLD_TYPES.FRACTION,
        numerator: 2,
        denominator: 3,
        base: SELECTION_SUPPORT_BASES.CAST_SELECTIONS
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'role_inspector-0', candidateId: 'alignment_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'insufficient_support');
  assert.equal(resolved.result.support.requiredSupportCount, 4);
  assert.equal(resolved.result.support.supportBaseCount, 6);
});

test('resolveSelectionRound acepta chosen si alcanza fraccion exigida', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECTION_SUPPORT_THRESHOLD_TYPES.FRACTION,
        numerator: 2,
        denominator: 3,
        base: SELECTION_SUPPORT_BASES.CAST_SELECTIONS
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'role_inspector-0', candidateId: 'alignment_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectionRound pide runoff cuando la politica de empate lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: { tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.TIE);
  assert.equal(resolved.result.reason, 'runoff_required');
  assert.deepEqual(resolved.result.nextRound, {
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
  });
});

test('resolveSelectionRound crea runoff con candidatos empatados por defecto', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECTION_RUNOFF_RULES.TIED_CANDIDATES
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_b_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
});

test('resolveSelectionRound crea runoff con todos los candidatos seleccionados si asi se define', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECTION_RUNOFF_RULES.SELECTED_CANDIDATES
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' },
      { selectorId: 'alignment_a_target-0', candidateId: 'alignment_b_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_b_target-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0',
    'alignment_b_target-0'
  ]);
});

test('resolveSelectionRound crea runoff con los mismos candidatos si asi se define', () => {
  const session = createBaseSession();
  const candidateIds = ['alignment_a_plain-0', 'alignment_a_target-0', 'alignment_b_target-0'];
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECTION_RUNOFF_RULES.SAME_CANDIDATES,
      candidateIds
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, candidateIds);
});

test('resolveSelectionRound limita runoff a los objetivos empatados', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    selectionRules: {
      candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/candidate-not-candidate');
});

test('resolveSelectionRound declara nulo un runoff que vuelve a empatar', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    selectionRules: {
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'runoff_tied');
});

test('resolveSelectionRound no pide otra ronda si ya alcanzo repeatLimit', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    selectionRules: {
      tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE,
      repeatLimit: 1,
      candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'runoff_tied');
  assert.equal(resolved.result.nextRound, undefined);
});

test('resolveSelectionRound puede repetir una seleccion nula si selectionRules lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED,
      nullResult: SELECTION_NULL_RULES.REPEAT_ON_NULL,
      repeatLimit: 1
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'all_abstained');
  assert.deepEqual(resolved.result.nextRound, {
    roundType: SELECTION_ROUND_TYPES.INITIAL,
    roundIndex: 1,
    candidateIds: [
      'alignment_b_attacker-0',
      'alignment_a_blocker-0',
      'alignment_a_target-0',
      'alignment_a_plain-0',
      'alignment_b_target-0',
      'role_inspector-0',
      'hidden_enemy-0'
    ]
  });
});

test('resolveSelectionRound exige seleccion de todos los roles inPlay cuando selectionRules.required es all_selectors', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: { required: SELECTION_REQUIRED_RULES.ALL_SELECTORS },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/missing-required-selections');
  assert.deepEqual(resolved.errors[0].missingSelectorIds.sort(), [
    'alignment_a_blocker-0',
    'alignment_a_plain-0',
    'alignment_a_target-0',
    'alignment_b_target-0',
    'hidden_enemy-0',
    'role_inspector-0'
  ]);
});

test('resolveSelectionRound permite abstencion explicita cuando la politica lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.abstainedSelections, [
    {
      selectorId: 'alignment_a_blocker-0',
      candidateId: null,
      abstain: true,
      value: 1,
      roundId: SELECTION_ROUND_TYPES.INITIAL,
      metadata: {}
    }
  ]);
});

test('resolveSelectionRound rechaza abstencion cuando la politica no la permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: ['alignment_b_attacker-0'],
    selectionRules: { required: SELECTION_REQUIRED_RULES.ALL_SELECTORS },
    selections: [{ selectorId: 'alignment_b_attacker-0', abstain: true }]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/abstain-not-allowed');
});

test('resolveSelectionRound declara nula la seleccion si todos se abstienen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', abstain: true },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'all_abstained');
  assert.deepEqual(resolved.result.selectionTally, []);
});

test('resolveSelectionRound ignora abstenciones por defecto aunque superen al target elegido', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true },
      { selectorId: 'alignment_a_target-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectionRound declara null si la abstencion supera a cualquier target', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED,
      abstainResolution: {
        type: SELECTION_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true },
      { selectorId: 'alignment_a_target-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'abstention_highest');
  assert.equal(resolved.result.abstainSelectionCount, 2);
  assert.deepEqual(resolved.result.finalEffects ?? [], []);
});

test('resolveSelectionRound exige unanimidad cuando selectionRules.unanimous es required', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      unanimous: SELECTION_UNANIMOUS_RULES.REQUIRED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.reason, 'unanimous_candidate');
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectionRound declara nula una decision no unanime', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS,
      unanimous: SELECTION_UNANIMOUS_RULES.REQUIRED,
      abstain: SELECTION_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'not_unanimous');
  assert.equal(resolved.result.chosenId, null);
});

test('resolveSelectionRound rechaza elegir a un member del group linked por linked si la restriccion esta activa', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-restriction' })
    ]
  });
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      groupRestrictions: [
        {
          type: SELECTION_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE,
          groupType: GROUP_TYPES.LINKED
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/restricted-group-member-candidate');
  assert.equal(resolved.errors[0].selectorId, 'alignment_a_plain-0');
  assert.equal(resolved.errors[0].candidateId, 'alignment_a_target-0');
});

test('resolveSelectionRound ignora restricciones de grupo incompletas', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-incomplete-restriction' })
    ]
  });
  const resolved = resolveSelectionRound({
    session,
    selectionRules: {
      groupRestrictions: [
        {
          type: SELECTION_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECTION_OUTCOME_TYPES.CHOSEN);
});

test('selection pura devuelve chosen sin aplicar efectos', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, {
    id: ACTION_IDS.SELECT,
    selectionRules: {
      tie: SELECTION_TIE_RULES.NULL_ON_TIE,
      required: SELECTION_REQUIRED_RULES.ALL_SELECTORS
    },
    visibility: VISIBILITY.ALL
  }, {
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0',
      'alignment_a_blocker-0': 'alignment_a_target-0',
      'alignment_a_target-0': 'alignment_a_target-0',
      'alignment_a_plain-0': 'alignment_a_target-0',
      'alignment_b_target-0': 'alignment_a_target-0',
      'role_inspector-0': 'alignment_a_target-0',
      'hidden_enemy-0': 'alignment_a_target-0'
    })
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
});

test('selection pura no aplica restricciones linked por defecto', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-generic-selection' })
    ]
  });
  const resolved = resolveAction(session, {
    id: ACTION_IDS.SELECT,
    selectionRules: { tie: SELECTION_TIE_RULES.NULL_ON_TIE },
    visibility: VISIBILITY.ALL
  }, {
    selections: [
      {
        selectorId: 'alignment_a_plain-0',
        candidateId: 'alignment_a_target-0'
      }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
});

test('stage con seleccion y set_out_of_play aplica inPlay=false al chosen de la seleccion', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.deepEqual(resolved.session.actionHistory.at(-1).actorIds, []);
  assert.deepEqual(resolved.result.proposedEffects, [
    {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role',
      property: 'inPlay',
      value: false,
      causedBy: null,
      targetId: 'alignment_a_target-0'
    }
  ]);
});

test('stage con seleccion y set_out_of_play no ejecuta receta si chosen no alcanza supportThreshold', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_plain-0',
        'alignment_b_target-0': 'alignment_a_plain-0',
        'role_inspector-0': 'alignment_b_target-0',
        'hidden_enemy-0': 'alignment_b_target-0'
      })
    }),
    {
      selectionRules: createSelectionRules({
        ...selectionOutOfPlayRules,
        supportThreshold: {
          type: SELECTION_SUPPORT_THRESHOLD_TYPES.MAJORITY,
          base: SELECTION_SUPPORT_BASES.SELECTOR_COUNT
        }
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selection.reason, 'insufficient_support');
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
});

test('stage con seleccion y set_out_of_play no ejecuta receta si la abstencion supera al chosen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: [
        { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
        { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
        { selectorId: 'alignment_a_target-0', abstain: true },
        { selectorId: 'alignment_a_plain-0', abstain: true },
        { selectorId: 'alignment_b_target-0', abstain: true },
        { selectorId: 'role_inspector-0', abstain: true },
        { selectorId: 'hidden_enemy-0', abstain: true }
      ]
    }),
    {
      selectionRules: createSelectionRules({
        ...selectionOutOfPlayRules,
        abstain: SELECTION_ABSTAIN_RULES.ALLOWED,
        abstainResolution: {
          type: SELECTION_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST
        }
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selection.reason, 'abstention_highest');
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
});

test('stage con seleccion y set_out_of_play empatado no aplica efecto con null_on_tie', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_plain-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_plain-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_plain-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
});

test('stage con seleccion y set_out_of_play permite cerrar el stage cuando todos se abstienen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: [
        { selectorId: 'alignment_b_attacker-0', abstain: true },
        { selectorId: 'alignment_a_blocker-0', abstain: true },
        { selectorId: 'alignment_a_target-0', abstain: true },
        { selectorId: 'alignment_a_plain-0', abstain: true },
        { selectorId: 'alignment_b_target-0', abstain: true },
        { selectorId: 'role_inspector-0', abstain: true },
        { selectorId: 'hidden_enemy-0', abstain: true }
      ]
    }),
    {
      selectionRules: createSelectionRules({
        ...selectionOutOfPlayRules,
        abstain: SELECTION_ABSTAIN_RULES.ALLOWED
      })
    }
  );
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_null_selection_stage'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selection.reason, 'all_abstained');
  assert.equal(resolved.result.selection.chosenId, null);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(resolved.stageAdvance, null);
  assert.equal(completed.ok, false);
  assert.equal(completed.stageAdvance.reason, 'next-pool-not-runnable');
  assert.equal(completed.errors[0].code, 'cycle/no-runnable-stages');
});

test('stage con seleccion y set_out_of_play trata un empate sin regla especial como null', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_plain-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_plain-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_plain-0'
      })
    }),
    {
      selectionRules: createSelectionRules({
        required: SELECTION_REQUIRED_RULES.ALL_SELECTORS
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selection.reason, 'tied_selection');
  assert.equal(resolved.result.selection.chosenId, null);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
});

test('stage con seleccion y set_out_of_play puede pedir runoff limitado por empate', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_plain-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_plain-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_plain-0'
      })
    }),
    {
      selectionRules: createSelectionRules({
        ...selectionOutOfPlayRules,
        tie: SELECTION_TIE_RULES.RUNOFF_ON_TIE
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.TIE);
  assert.equal(resolved.result.selection.reason, 'runoff_required');
  assert.equal(resolved.result.selection.chosenId, null);
  assert.deepEqual(resolved.result.selection.nextRound, {
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
  });
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
});

test('stage con seleccion y set_out_of_play ejecuta receta si el runoff produce chosen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(session, {
    roundType: SELECTION_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0'],
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0',
      'alignment_a_blocker-0': 'alignment_a_target-0',
      'alignment_a_target-0': 'alignment_a_target-0',
      'alignment_a_plain-0': 'alignment_a_target-0',
      'alignment_b_target-0': 'alignment_a_target-0',
      'role_inspector-0': 'alignment_a_target-0',
      'hidden_enemy-0': 'alignment_a_target-0'
    })
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
});

test('stage con seleccion y set_out_of_play propaga inPlay=false por linked cuando el chosen esta enlazado', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-target' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_b_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.equal(resolved.result.finalEffects.length, 2);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: 'group',
    id: 'linked_selection_target'
  });
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'group_rule',
    groupId: 'linked_selection_target',
    groupRuleType: 'propagate_property_change',
    sourceTargetId: 'alignment_a_target-0'
  });
});

test('stage con seleccion y set_out_of_play rechaza la ronda si falta una seleccion obligatoria', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/missing-required-selections');
});

test('stage con seleccion y set_out_of_play rechaza elegir a un role linked', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-out-of-play' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/restricted-group-member-candidate');
  assert.equal(resolved.errors[0].selectorId, 'alignment_a_plain-0');
  assert.equal(resolved.errors[0].candidateId, 'alignment_a_target-0');
});

test('stage con seleccion recoge restricciones aportadas por groups activos', () => {
  const linked = resolveAction(createBaseSession(), linkTargetsAction, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const resolved = resolveSelectionOutOfPlayStage(
    linked.session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_plain-0',
        'alignment_a_plain-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      selectionRules: {
        ...selectionOutOfPlayRules,
        groupRestrictions: []
      }
    }
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/restricted-group-member-candidate');
  assert.equal(resolved.errors[0].selectorId, 'alignment_a_target-0');
  assert.equal(resolved.errors[0].candidateId, 'alignment_a_plain-0');
  assert.equal(resolved.errors[0].groupId, 'linked_alignment_a_plain_0_alignment_a_target_0');
});

test('stage con seleccion y set_out_of_play no permite desactivar restricciones estructurales desde input', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-input-override' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      groupRestrictions: [],
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/restricted-group-member-candidate');
});

test('catalogo basico usa formula mecanica anonima para distribuir alignments', () => {
  assert.deepEqual(getBasicAlignmentDistribution(8), {
    [ALIGNMENT_IDS.ALIGNMENT_A]: 6,
    [ALIGNMENT_IDS.ALIGNMENT_B]: 2,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  });
  assert.deepEqual(getBasicAlignmentDistribution(12), {
    [ALIGNMENT_IDS.ALIGNMENT_A]: 9,
    [ALIGNMENT_IDS.ALIGNMENT_B]: 3,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  });
  assert.deepEqual(getBasicAlignmentDistribution(18), {
    [ALIGNMENT_IDS.ALIGNMENT_A]: 14,
    [ALIGNMENT_IDS.ALIGNMENT_B]: 4,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  });
  assert.equal(getBasicAlignmentDistribution(7), null);
});

test('ruleSet basico declara roles listos y bloquea mecanicas incompletas', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const options = Object.fromEntries(
    selectedRuleSet.availableRoles.map((option) => [option.roleKey, option])
  );

  assert.equal(options[BASIC_ROLE_OPTION_KEYS.PLAIN].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.deepEqual(options[BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS].instanceRule, {
    min: 0,
    max: 1,
    step: 1
  });
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE].support, RULE_SET_SUPPORT_STATUSES.PENDING);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.OBSERVES_SELECTION].selectable, false);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.SELECTION_AUTHORITY].selectable, false);
});

test('buildRuleSet ensambla solo roles mecanicamente listos', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.COLLECTIVE_SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS,
      BASIC_ROLE_OPTION_KEYS.INSPECTS,
      BASIC_ROLE_OPTION_KEYS.REACTIVE,
      BASIC_ROLE_OPTION_KEYS.IN_PLAY_CONTROL,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });

  assert.equal(built.ok, true);
  assert.equal(built.ruleSet.roles.baseRoles.length, 6);
  assert.equal(built.ruleSet.groups.length, 2);
  assert.equal(built.ruleSet.rules.objectiveRules.length, 3);
  assert.deepEqual(
    built.ruleSet.roles.baseRoles.map((role) => role.alignmentId),
    ['alignment_b', 'alignment_a', 'alignment_a', 'alignment_a', 'alignment_a', 'alignment_a']
  );
  assert.deepEqual(
    built.ruleSet.roles.baseRoles.find(
      (role) => role.key === ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL
    ).resources,
    [
      { key: 'restore_in_play', count: 1, metadata: {} },
      { key: 'set_out_of_play', count: 1, metadata: {} }
    ]
  );
});

test('buildRuleSet rechaza un role pendiente con sus requisitos pendientes', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE],
    roleCatalog: ROLE_CATALOG
  });

  assert.equal(built.ok, false);
  assert.equal(built.errors[0].code, 'ruleset/role-not-ready');
  assert.deepEqual(built.errors[0].missingMechanics, [
    'role_choice_set',
    'assume_role'
  ]);
});

test('buildSession consume directamente un ruleSet ya construido', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.COLLECTIVE_SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.INSPECTS,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'basic-ruleset-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      {
        seat: 0,
        playerId: 'player-1',
        role: BASIC_ROLE_OPTION_KEYS.COLLECTIVE_SET_OUT_OF_PLAY
      },
      {
        seat: 1,
        playerId: 'player-2',
        role: BASIC_ROLE_OPTION_KEYS.INSPECTS
      },
      {
        seat: 2,
        playerId: 'player-3',
        role: BASIC_ROLE_OPTION_KEYS.PLAIN
      }
    ],
    validate: false
  });

  assert.equal(builtSession.ok, true);
  assert.equal(
    builtSession.session.settings.ruleSetId,
    RULE_SET_CATALOG_IDS.BASIC_RULE_SET
  );
  assert.equal(builtSession.session.groups.length, 2);
  assert.equal(builtSession.session.objectiveRules.length, 3);
  assert.deepEqual(builtSession.session.cycle.poolOrder, [
    POOL_KEYS.POOL_CONCEALED,
    POOL_KEYS.POOL_EXPOSED
  ]);
});

test('catalogo de mensajes distingue keys implementadas y planificadas con audiencia', () => {
  assert.equal(
    MESSAGE_CATALOG[MESSAGE_KEYS.RESOURCE_ALREADY_CONSUMED].status,
    MESSAGE_IMPLEMENTATION_STATUSES.IMPLEMENTED
  );
  assert.equal(
    MESSAGE_CATALOG[MESSAGE_KEYS.INSPECTION_REVEALED].defaultAudience,
    MESSAGE_AUDIENCE_TYPES.ROLE
  );
  assert.equal(
    MESSAGE_CATALOG[MESSAGE_KEYS.SELECTION_AUTHORITY_ASSIGNED].status,
    MESSAGE_IMPLEMENTATION_STATUSES.PLANNED
  );
});

async function runTests() {
  let passed = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passed += 1;
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`\n${passed}/${tests.length} domain tests passed`);
}

await runTests();

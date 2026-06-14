import assert from 'node:assert/strict';

import {
  ACTION_IDS,
  EFFECT_TYPES,
  HISTORY_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  GROUP_TYPES,
  VISIBILITY,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_EVALUATION_STATUSES,
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
  buildInitialGroups,
  buildRolesFromSeats,
  buildSession,
  buildStepPool,
  completeCurrentStep,
  createPool,
  organizePoolSteps,
  createSelectionRules,
  createSession,
  createGroup,
  addRoleToGroup,
  getCoreGroupCatalog,
  getGroupRoles,
  getCoreRoleCatalog,
  removeRoleFromGroup,
  createStep,
  checkObjectives,
  findAppliedSetPropertyHistory,
  getActionBlockKey,
  STEP_STATUSES,
  POOL_DEFINITION_ERRORS,
  POOL_KEYS,
  GROUP_CATALOG_IDS,
  GROUP_MEMBERSHIP_RULE_TYPES,
  ROLE_CATALOG_IDS,
  RECIPE_KEYS,
  resolveSelectionRound,
  resolveAction,
  resolveCurrentStep,
  resolveRecipe,
  STEP_ACTION_KEYS,
  STEP_CATALOG_IDS,
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY,
  STEP_KEYS,
  SPECIAL_STEP_PRIORITIES,
  SESSION_STATUSES,
  getCatalogRecipe,
  getCatalogStep,
  validateSession
} from '../index.js';

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
// - stepModel conecta el step actual con actionModel y avanza el cursor.
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
const closeCycleAction = getCatalogRecipe(RECIPE_KEYS.CLOSE_CYCLE);

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
  sessionObjectiveRules = [],
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
  const roles = buildRolesFromSeats(
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
    sessionObjectiveRules,
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
  sourceActionId = ACTION_IDS.LINK_TARGETS
} = {}) {
  return createGroup({
    id,
    key: id,
    type: GROUP_TYPES.LINKED,
    roleIds,
    active,
    sourceActionId
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

function withStepPools(session, stepPools) {
  return {
    ...session,
    stepPools
  };
}

function createSelectionOutOfPlayStep(overrides = {}) {
  return createStep({
    key: STEP_KEYS.STEP_05,
    status: STEP_STATUSES.ENABLED,
    actorIds: [],
    selectionRules: selectionOutOfPlayRules,
    actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)],
    ...overrides
  });
}

function resolveSelectionOutOfPlayStep(session, input = {}, stepOverrides = {}) {
  const sessionWithSelectionStep = withStepPools(
    session,
    createPool({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [createSelectionOutOfPlayStep(stepOverrides)]
      }
    })
  );

  return resolveCurrentStep(sessionWithSelectionStep, input);
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

test('resolveCurrentStep ejecuta receta y completeCurrentStep avanza el cursor', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolDeployment'],
      poolCurrent: 'poolDeployment',
      poolNext: 'poolDeployment',
      pools: {
        poolDeployment: [
          {
            key: STEP_KEYS.STEP_01,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(inspectRoleAction, STEP_ACTION_KEYS.INSPECT_ROLE)]
          },
          {
            key: STEP_KEYS.STEP_02,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(linkTargetsAction, STEP_ACTION_KEYS.LINK_TARGETS)]
          }
        ]
      }
    })
  );
  const inspectedAction = resolveCurrentStep(session, {
    actorIds: ['role_inspector-0'],
    targetIds: ['hidden_enemy-0']
  });
  const inspected = completeCurrentStep(inspectedAction.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['role_inspector-0'],
    reason: 'player_finished_step'
  });
  const linkedAction = resolveCurrentStep(inspected.session, {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const linked = completeCurrentStep(linkedAction.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_finished_step'
  });

  assert.equal(inspectedAction.ok, true);
  assert.equal(inspectedAction.step.stepKey, STEP_KEYS.STEP_01);
  assert.equal(inspectedAction.result.reveals[0].value, 'hidden_enemy');
  assert.equal(inspectedAction.stepAdvance, null);
  assert.equal(inspected.ok, true);
  assert.equal(
    inspected.session.stepPools.pools.poolDeployment[0].status,
    STEP_STATUSES.DONE
  );
  assert.equal(inspected.stepAdvance.reason, 'next-step-in-current-pool');
  assert.equal(inspected.stepAdvance.next.stepKey, STEP_KEYS.STEP_02);
  assert.equal(linkedAction.ok, true);
  assert.equal(linkedAction.session.groups[0].type, GROUP_TYPES.LINKED);
  assert.equal(linkedAction.stepAdvance, null);
  assert.equal(linked.ok, true);
  assert.equal(linked.stepAdvance.reason, 'no-runnable-step');
  assert.equal(linked.session.stepHistory.length, 2);
  assert.equal(linked.session.stepHistory[0].requestedBy, STEP_COMPLETION_REQUESTED_BY.PLAYER);
  assert.equal(linked.session.stepHistory[1].requestedBy, STEP_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('resolveCurrentStep rechaza un step ejecutable sin action declarada', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolDeployment'],
      poolCurrent: 'poolDeployment',
      poolNext: 'poolDeployment',
      pools: {
        poolDeployment: [
          {
            key: 'stepMissingAction',
            status: STEP_STATUSES.ENABLED
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {});

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'step/missing-action');
  assert.equal(
    resolved.session.stepPools.pools.poolDeployment[0].status,
    STEP_STATUSES.ENABLED
  );
});

test('poolDefinition organiza steps construidos por stepDefinition', () => {
  const lateStep = createStep({
    key: STEP_KEYS.STEP_02,
    status: STEP_STATUSES.ENABLED,
    order: 20,
    actorIds: ['role_inspector-0'],
    actions: [actionRecipe(inspectRoleAction, STEP_ACTION_KEYS.INSPECT_ROLE)]
  });
  const earlyStep = createStep({
    key: STEP_KEYS.STEP_01,
    status: STEP_STATUSES.ENABLED,
    order: 10,
    actorIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
  });
  const created = organizePoolSteps({
    poolOrder: ['poolExposed'],
    poolCurrent: 'poolExposed',
    pools: {
      poolExposed: [lateStep, earlyStep]
    }
  });
  const duplicated = organizePoolSteps({
    poolOrder: ['poolExposed'],
    pools: {
      poolExposed: [
        { ...earlyStep, order: 10 },
        { ...lateStep, order: 10 }
      ]
    }
  });

  assert.equal(created.ok, true);
  assert.equal(created.stepPools.pools.poolExposed[0].key, STEP_KEYS.STEP_01);
  assert.deepEqual(created.stepPools.pools.poolExposed[0].actorIds, [
    'alignment_a_target-0',
    'alignment_a_plain-0'
  ]);
  assert.equal(created.stepPools.pools.poolExposed[1].key, STEP_KEYS.STEP_02);
  assert.equal(duplicated.ok, false);
  assert.equal(duplicated.errors[0].code, POOL_DEFINITION_ERRORS.DUPLICATE_ORDER);
});

test('stepDefinition define completion y recetas opcionales', () => {
  const step = createStep({
    key: STEP_KEYS.STEP_03,
    status: STEP_STATUSES.ENABLED,
    actorIds: ['alignment_a_blocker-0'],
    completion: {
      mode: STEP_COMPLETION_MODES.MANUAL,
      allowedRequesters: [
        STEP_COMPLETION_REQUESTED_BY.PLAYER,
        STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
        STEP_COMPLETION_REQUESTED_BY.SYSTEM
      ]
    },
    actions: [
      actionRecipe(restoreRecentOutOfPlayAction, STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      {
        ...actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY),
        optional: true
      }
    ]
  });

  assert.equal(step.completion.mode, STEP_COMPLETION_MODES.MANUAL);
  assert.deepEqual(step.completion.allowedRequesters, [
    STEP_COMPLETION_REQUESTED_BY.PLAYER,
    STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    STEP_COMPLETION_REQUESTED_BY.SYSTEM
  ]);
  assert.equal(step.actions.length, 2);
  assert.equal(step.actions[0].optional, true);
  assert.equal(step.actions[1].optional, true);
});

test('stepCatalog crea un step reutilizable de control inPlay', () => {
  const step = getCatalogStep(STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, {
    key: STEP_KEYS.STEP_03,
    actorIds: ['alignment_a_blocker-0']
  });

  assert.equal(step.key, STEP_KEYS.STEP_03);
  assert.deepEqual(step.actorIds, ['alignment_a_blocker-0']);
  assert.equal(step.completion.mode, STEP_COMPLETION_MODES.MANUAL);
  assert.deepEqual(step.completion.allowedRequesters, [
    STEP_COMPLETION_REQUESTED_BY.PLAYER,
    STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    STEP_COMPLETION_REQUESTED_BY.SYSTEM
  ]);
  assert.deepEqual(
    step.actions.map((action) => action.key),
    [STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STEP_ACTION_KEYS.ONE_SHOT_SET_OUT_OF_PLAY]
  );
  assert.equal(step.actions.every((action) => action.optional === true), true);
  assert.equal(step.metadata.catalogId, 'role_in_play_control');
});

test('stepCatalog expone los steps mecanicos ya definidos', () => {
  const steps = [
    getCatalogStep(STEP_CATALOG_IDS.ROLE_INSPECTS, { key: STEP_KEYS.STEP_01 }),
    getCatalogStep(STEP_CATALOG_IDS.ROLE_LINKS_TARGETS, { key: STEP_KEYS.STEP_02 }),
    getCatalogStep(STEP_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, { key: STEP_KEYS.STEP_02 }),
    getCatalogStep(STEP_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, { key: STEP_KEYS.STEP_03 }),
    getCatalogStep(STEP_CATALOG_IDS.ROLE_REACTIVE_RESPONSE, { key: STEP_KEYS.STEP_07 }),
    getCatalogStep(STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY, { key: STEP_KEYS.STEP_04 }),
    getCatalogStep(STEP_CATALOG_IDS.GROUP_SELECTION, { key: STEP_KEYS.STEP_05 }),
    getCatalogStep(STEP_CATALOG_IDS.SYSTEM_CLOSES_CYCLE, { key: STEP_KEYS.STEP_06 })
  ];

  assert.deepEqual(
    steps.map((step) => step.actions.map((action) => action.key)),
    [
      [STEP_ACTION_KEYS.INSPECT_ROLE],
      [STEP_ACTION_KEYS.LINK_TARGETS],
      [STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STEP_ACTION_KEYS.ONE_SHOT_SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.CLOSE_CYCLE]
    ]
  );
  assert.deepEqual(steps.map((step) => step.actorIds), [[], [], [], [], [], [], [], []]);
  assert.deepEqual(steps[7].completion.allowedRequesters, [STEP_COMPLETION_REQUESTED_BY.SYSTEM]);
});

test('roleCatalog declara roles mecanicos y razones de orden', () => {
  const catalog = getCoreRoleCatalog();
  const byKey = Object.fromEntries(catalog.map((roleDefinition) => [roleDefinition.key, roleDefinition]));

  assert.deepEqual(
    [
      byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stepDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_INSPECTS].stepDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].stepDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stepDefinitions[0].poolKey
    ],
    [
      POOL_KEYS.POOL_DEPLOYMENT,
      POOL_KEYS.POOL_CONCEALED,
      POOL_KEYS.POOL_CONCEALED,
      POOL_KEYS.POOL_CONCEALED
    ]
  );
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stepDefinitions[0].order, null);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_INSPECTS].stepDefinitions[0].order, 10);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].stepDefinitions[0].order, 20);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stepDefinitions[0].order, 40);
  assert.equal(
    byKey[ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL].stepDefinitions[0].metadata.orderReason.includes(
      'same-cycle inPlay=false'
    ),
    true
  );
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].stepDefinitions.length, 0);
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].reactions.length, 1);
  assert.equal(
    byKey[ROLE_CATALOG_IDS.ROLE_REACTIVE].reactions[0].response.step.poolKey,
    POOL_KEYS.POOL_SPECIAL
  );
});

test('groupCatalog declara grupos mecanicos y razones de orden', () => {
  const catalog = getCoreGroupCatalog();
  const group = catalog[0];
  const stepDefinition = group.stepDefinitions[0];

  assert.equal(group.key, GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY);
  assert.equal(group.membershipRule.type, 'alignment');
  assert.equal(group.membershipRule.alignmentId, 'alignment_b');
  assert.equal(stepDefinition.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(stepDefinition.order, 30);
  assert.deepEqual(
    stepDefinition.actions.map((action) => action.key),
    [STEP_ACTION_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(stepDefinition.metadata.orderReason.includes('after blockers'), true);
});

test('buildStepPool construye steps asociados a un pool concreto', () => {
  const steps = buildStepPool({
    poolKey: POOL_KEYS.POOL_CONCEALED,
    steps: [
      getCatalogStep(STEP_CATALOG_IDS.ROLE_INSPECTS, {
        order: 10
      })
    ]
  });

  assert.equal(steps.length, 1);
  assert.equal(steps[0].poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(steps[0].order, 10);
  assert.equal(steps[0].actions[0].key, STEP_ACTION_KEYS.INSPECT_ROLE);
});

test('buildPools ensambla steps desde roles y grupos', () => {
  const roleDefinitions = getCoreRoleCatalog().filter(
    (role) => role.key !== ROLE_CATALOG_IDS.ROLE_REACTIVE
  );
  const groupDefinitions = getCoreGroupCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = createSession({
    roles: buildRolesFromSeats(
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
    groups: buildInitialGroups(session, groupDefinitions)
  };
  const built = buildPools({
    session: sessionWithGroups,
    roleDefinitions,
    groupDefinitions
  });

  assert.equal(built.ok, true);
  assert.equal(built.stepPools.pools.poolDeployment.length, 1);
  assert.equal(built.stepPools.pools.poolConcealed.length, 4);
  assert.deepEqual(built.stepPools.pools.poolDeployment[0].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS}-0`
  ]);
  assert.deepEqual(
    built.stepPools.pools.poolConcealed.map((step) => step.order),
    [10, 20, 30, 40]
  );
  assert.deepEqual(built.stepPools.pools.poolConcealed[2].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`
  ]);
});

test('role reactive crea un step especial al recibir inPlay=false final', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withStepPools(
    createSession({
      id: 'reactive-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' },
        { id: 'player-3', displayName: 'Player 3' }
      ],
      roles: buildRolesFromSeats(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' },
          { seat: 2, playerId: 'player-3', role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      )
    }),
    createPool({
      poolOrder: [POOL_KEYS.POOL_CONCEALED, POOL_KEYS.POOL_SPECIAL],
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_SPECIAL,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStep({
            key: STEP_KEYS.STEP_04,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          })
        ],
        [POOL_KEYS.POOL_SPECIAL]: []
      }
    })
  );
  const firstResolution = resolveCurrentStep(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStep(firstResolution.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const specialResolution = resolveCurrentStep(completed.session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`]
  });

  assert.equal(firstResolution.ok, true);
  assert.equal(roleById(firstResolution.session, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`).inPlay, false);
  assert.equal(firstResolution.result.events.length, 1);
  assert.equal(firstResolution.result.eventResponses.length, 1);
  assert.equal(firstResolution.session.stepPools.pools.poolSpecial.length, 1);
  assert.deepEqual(firstResolution.session.stepPools.pools.poolSpecial[0].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`
  ]);
  assert.equal(completed.stepAdvance.reason, 'next-pool');
  assert.equal(completed.stepAdvance.next.poolKey, POOL_KEYS.POOL_SPECIAL);
  assert.equal(specialResolution.ok, true);
  assert.equal(roleById(specialResolution.session, `${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`).inPlay, false);
});

test('poolSpecial prioriza conclude_play aunque existan otros steps especiales pendientes', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withStepPools(
    createSession({
      id: 'reactive-finished-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' }
      ],
      roles: buildRolesFromSeats(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      ),
      groups: [
        createAlignmentGroup('alignment_b', [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`])
      ],
      sessionObjectiveRules: [
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
    createPool({
      poolOrder: [POOL_KEYS.POOL_CONCEALED, POOL_KEYS.POOL_SPECIAL],
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_SPECIAL,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStep({
            key: STEP_KEYS.STEP_04,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          })
        ],
        [POOL_KEYS.POOL_SPECIAL]: []
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_PLAY_CONTROL}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStep(resolved.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const finished = resolveCurrentStep(completed.session);

  assert.equal(resolved.ok, true);
  assert.equal(resolved.session.status, SESSION_STATUSES.DRAFT);
  assert.equal(resolved.result.objectiveEvaluation, undefined);
  assert.equal(resolved.session.stepPools.pools.poolSpecial.length, 1);
  assert.equal(
    resolved.session.stepPools.pools.poolSpecial[0].metadata.source.metadata.reactionKey,
    'self_out_of_play_creates_special_step'
  );
  assert.equal(completed.objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(completed.session.stepPools.pools.poolSpecial.length, 2);
  assert.equal(
    completed.session.stepPools.pools.poolSpecial[1].metadata.specialPriority,
    SPECIAL_STEP_PRIORITIES.CONCLUDE_PLAY
  );
  assert.equal(completed.stepAdvance.next.poolKey, POOL_KEYS.POOL_SPECIAL);
  assert.equal(
    completed.stepAdvance.next.step.metadata.specialPriority,
    SPECIAL_STEP_PRIORITIES.CONCLUDE_PLAY
  );
  assert.equal(finished.ok, true);
  assert.equal(finished.session.status, SESSION_STATUSES.DRAFT);
  assert.equal(finished.result.type, EFFECT_TYPES.CONCLUDE_PLAY);
  assert.equal(finished.session.playOutcome.conclusive, true);
  assert.equal(finished.session.stepPools.pools.poolSpecial.length, 2);
});

test('buildSession crea roles y stepPools desde configuracion', () => {
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
  assert.equal(built.session.stepPools.pools.poolDeployment.length, 0);
  assert.equal(built.session.stepPools.pools.poolConcealed.length, 2);
});

test('buildSession rechaza steps enabled creados desde grupos sin actores', () => {
  const selectedRoles = getCoreRoleCatalog().filter((role) =>
    [ROLE_CATALOG_IDS.ROLE_INSPECTS].includes(role.key)
  );
  const built = buildSession({
    id: 'empty-group-step-session',
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
      createGroup({
        key: 'all_roles',
        membershipRule: { type: GROUP_MEMBERSHIP_RULE_TYPES.ALL_ROLES }
      }),
      createGroup({
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

test('resolveCurrentStep exige actionKey cuando un step ofrece varias acciones', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: STEP_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                {
                  ...setInPlayFalseAction,
                  effect: {
                    ...setInPlayFalseAction.effect,
                    value: true
                  }
                },
                STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const missingActionKey = resolveCurrentStep(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const selectedAction = resolveCurrentStep(session, {
    actionKey: STEP_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(missingActionKey.ok, false);
  assert.equal(missingActionKey.errors[0].code, 'step/missing-action-key');
  assert.equal(selectedAction.ok, true);
  assert.equal(selectedAction.session.actionHistory.at(-1).stepKey, STEP_KEYS.STEP_03);
  assert.equal(
    selectedAction.session.actionHistory.at(-1).actionKey,
    STEP_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  assert.equal(roleById(selectedAction.session, 'alignment_a_target-0').inPlay, false);
});

test('resolveCurrentStep ejecuta step_05 con seleccion y receta set_out_of_play', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [
          {
            key: STEP_KEYS.STEP_05,
            status: STEP_STATUSES.ENABLED,
            actorIds: [],
            selectionRules: selectionOutOfPlayRules,
            actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
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
  const completed = completeCurrentStep(resolved.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_selection_step'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.step.stepKey, STEP_KEYS.STEP_05);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.CHOSEN);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(resolved.stepAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(
    completed.session.stepPools.pools.poolExposed[0].status,
    STEP_STATUSES.DONE
  );
  assert.equal(completed.stepAdvance.reason, 'no-runnable-step');
});

test('resolveCurrentStep usa actorIds del step como participantes de seleccion', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [
          {
            key: STEP_KEYS.STEP_05,
            status: STEP_STATUSES.ENABLED,
            actorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
            selectionRules: selectionOutOfPlayRules,
            actions: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0'
    })
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/missing-required-selections');
  assert.deepEqual(resolved.errors[0].missingSelectorIds, ['alignment_a_blocker-0']);
});

test('resolveCurrentStep ejecuta step_02 con receta block_out_of_play', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStep(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const attackAfterBlocking = resolveAction(blocking.session, setInPlayFalseAction, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.step.stepKey, STEP_KEYS.STEP_02);
  assert.equal(blocking.stepAdvance, null);
  const completed = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  assert.equal(completed.ok, true);
  assert.equal(
    completed.session.stepPools.pools.poolConcealed[0].status,
    STEP_STATUSES.DONE
  );
  assert.equal(completed.stepAdvance.reason, 'no-runnable-step');
  assert.equal(attackAfterBlocking.ok, true);
  assert.equal(roleById(attackAfterBlocking.session, 'alignment_a_target-0').inPlay, true);
  assert.deepEqual(attackAfterBlocking.result.proposedEffects, []);
  assert.equal(attackAfterBlocking.result.blockedActions[0].reason, 'blocked_action');
});

test('resolveCurrentStep ejecuta step_04 con receta set_out_of_play', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_04,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStep(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockingCompleted = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const blockedAttempt = resolveCurrentStep(blockingCompleted.session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.stepAdvance, null);
  assert.equal(blockingCompleted.stepAdvance.next.stepKey, STEP_KEYS.STEP_04);
  assert.equal(blockedAttempt.ok, true);
  assert.equal(blockedAttempt.step.stepKey, STEP_KEYS.STEP_04);
  assert.equal(roleById(blockedAttempt.session, 'alignment_a_target-0').inPlay, true);
  assert.deepEqual(blockedAttempt.result.proposedEffects, []);
  assert.equal(blockedAttempt.result.blockedActions[0].reason, 'blocked_action');
  const blockedCompleted = completeCurrentStep(blockedAttempt.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  assert.equal(blockedCompleted.ok, true);
  assert.equal(
    blockedCompleted.session.stepPools.pools.poolConcealed[1].status,
    STEP_STATUSES.DONE
  );
});

test('actionHistory registra step, efectos finales y acciones bloqueadas', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_04,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const historyEntry = resolved.session.actionHistory.at(-1);
  const appliedEntries = findAppliedSetPropertyHistory(resolved.session, {
    cycleId: historyEntry.cycleId,
    property: 'inPlay',
    value: false,
    targetId: 'alignment_a_target-0',
    stepKey: STEP_KEYS.STEP_04,
    actionKey: STEP_ACTION_KEYS.SET_OUT_OF_PLAY
  });

  assert.equal(resolved.ok, true);
  assert.equal(historyEntry.stepKey, STEP_KEYS.STEP_04);
  assert.equal(historyEntry.actionKey, STEP_ACTION_KEYS.SET_OUT_OF_PLAY);
  assert.equal(historyEntry.actionId, ACTION_IDS.SET_IN_PLAY);
  assert.equal(historyEntry.result, HISTORY_RESULTS.APPLIED);
  assert.equal(historyEntry.finalEffects[0].property, 'inPlay');
  assert.equal(historyEntry.finalEffects[0].value, false);
  assert.equal(appliedEntries.length, 1);
});

test('restore_recent_out_of_play ejecuta set_in_play(true) solo sobre un set_out_of_play previo', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_03,
            status: STEP_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const setOutOfPlay = resolveCurrentStep(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOutStepClosed = completeCurrentStep(setOutOfPlay.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_set_out_step'
  });
  const restored = resolveCurrentStep(setOutStepClosed.session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(setOutOfPlay.ok, true);
  assert.equal(roleById(setOutOfPlay.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(setOutOfPlay.stepAdvance, null);
  assert.equal(setOutStepClosed.ok, true);
  assert.equal(setOutStepClosed.stepAdvance.next.stepKey, STEP_KEYS.STEP_03);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(restored.stepAdvance, null);
  assert.equal(
    restored.session.stepPools.pools.poolConcealed[1].status,
    STEP_STATUSES.ENABLED
  );
  assert.equal(restored.session.actionHistory.at(-1).stepKey, STEP_KEYS.STEP_03);
  assert.equal(
    restored.session.actionHistory.at(-1).actionKey,
    STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  assert.equal(restored.session.actionHistory.at(-1).finalEffects[0].value, true);
});

test('un step con recetas opcionales permanece abierto hasta cierre explicito', () => {
  const preStepSetOut = resolveRecipe(
    createBaseSession(),
    actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY),
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
    STEP_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  const session = withStepPools(
    preStepSetOut.session,
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: STEP_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              optionalSetOutRecipe
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStep(session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOut = resolveCurrentStep(restored.session, {
    actionKey: STEP_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_b_target-0']
  });
  const completed = completeCurrentStep(setOut.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_optional_step'
  });

  assert.equal(preStepSetOut.ok, true);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(restored.stepAdvance, null);
  assert.equal(
    restored.session.stepPools.pools.poolConcealed[0].status,
    STEP_STATUSES.ENABLED
  );
  assert.equal(setOut.ok, true);
  assert.equal(roleById(setOut.session, 'alignment_b_target-0').inPlay, false);
  assert.equal(setOut.stepAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(completed.stepAdvance.reason, 'no-runnable-step');
  assert.equal(
    completed.session.stepPools.pools.poolConcealed[0].status,
    STEP_STATUSES.DONE
  );
  assert.equal(completed.completion.requestedBy, STEP_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('completeCurrentStep respeta allowedRequesters del step', () => {
  const step = createStep({
    key: STEP_KEYS.STEP_03,
    status: STEP_STATUSES.ENABLED,
    completion: {
      mode: STEP_COMPLETION_MODES.MANUAL,
      allowedRequesters: [STEP_COMPLETION_REQUESTED_BY.DIRECTOR]
    },
    actions: [actionRecipe(restoreRecentOutOfPlayAction, STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY)]
  });
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [step]
      }
    })
  );
  const actorClose = completeCurrentStep(session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const directorClose = completeCurrentStep(session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(actorClose.ok, false);
  assert.equal(actorClose.errors[0].code, 'step/completion-not-allowed');
  assert.deepEqual(actorClose.errors[0].allowedRequesters, [STEP_COMPLETION_REQUESTED_BY.DIRECTOR]);
  assert.equal(directorClose.ok, true);
  assert.equal(directorClose.completion.requestedBy, STEP_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('restore_recent_out_of_play rechaza targets sin set_out_of_play aplicado este ciclo', () => {
  const session = withStepPools(
    withInPlayState(createBaseSession(), {
      'alignment_a_target-0': false
    }),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: STEP_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              )
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStep(session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(restored.ok, false);
  assert.equal(restored.errors[0].code, 'constraint/require_recent_set_property');
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, false);
});

test('restore_recent_out_of_play rechaza un set_out_of_play bloqueado', () => {
  const session = withStepPools(
    createBaseSession(),
    createPool({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_01,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_02,
            status: STEP_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_03,
            status: STEP_STATUSES.ENABLED,
            actions: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              )
            ]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStep(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockingClosed = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorIds: ['alignment_a_blocker-0']
  });
  const blockedSetOutOfPlay = resolveCurrentStep(blockingClosed.session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const blockedSetOutClosed = completeCurrentStep(blockedSetOutOfPlay.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const restored = resolveCurrentStep(blockedSetOutClosed.session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreRecipe = actionRecipe(
    restoreRecentOutOfPlayAction,
    STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
});

test('limited_uses con ventana current_cycle permite reutilizar en otro ciclo', () => {
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restorePerCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      constraints: restoreRecentOutOfPlayAction.constraints.map((constraint) =>
        constraint.type === CONSTRAINT_TYPES.LIMITED_USES
          ? {
              ...constraint,
              window: CONSTRAINT_WINDOWS.CURRENT_CYCLE
            }
          : constraint
      )
    },
    STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restorePerCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreNextCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      constraints: restoreRecentOutOfPlayAction.constraints.map((constraint) =>
        constraint.type === CONSTRAINT_TYPES.LIMITED_USES
          ? {
              ...constraint,
              window: CONSTRAINT_WINDOWS.NEXT_CYCLE
            }
          : constraint
      )
    },
    STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreNextCycleRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY);
  const restoreCurrentOrNextRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      constraints: restoreRecentOutOfPlayAction.constraints.map((constraint) =>
        constraint.type === CONSTRAINT_TYPES.LIMITED_USES
          ? {
              ...constraint,
              window: CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
            }
          : constraint
      )
    },
    STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  const firstSetOut = resolveRecipe(createBaseSession(), setOutRecipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreCurrentOrNextRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
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
    STEP_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  const blocking = resolveAction(createBaseSession(), blockOutOfPlayRecipe, {
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
  assert.equal(blockedUse.result.blockedActions[0].reason, 'blocked_action');
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
  assert.equal(resolved.result.blockedActions.length, 0);
});

test('block_out_of_play bloquea set_in_play(false) solo sobre su target', () => {
  const session = createBaseSession();
  const blocking = resolveAction(session, blockOutOfPlayRecipe, {
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
  assert.deepEqual(blockedTarget.result.proposedEffects, []);
  assert.deepEqual(blockedTarget.result.finalEffects, []);
  assert.deepEqual(blockedTarget.result.blockedActions, [
    {
      actionId: ACTION_IDS.SET_IN_PLAY,
      reason: 'blocked_action',
      targetId: 'alignment_a_target-0'
    }
  ]);

  assert.equal(unblockedTarget.ok, true);
  assert.equal(roleById(unblockedTarget.session, 'alignment_a_plain-0').inPlay, false);
});

test('close_cycle limpia bloqueos temporales y avanza ciclo', () => {
  const session = createBaseSession();
  const blockingKey = getActionBlockKey(blockOutOfPlayRecipe.effect.blocks);
  const blocking = resolveAction(session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const closed = resolveAction(blocking.session, closeCycleAction);

  assert.equal(
    roleById(blocking.session, 'alignment_a_target-0').flags.blockedActions[blockingKey],
    true
  );
  assert.equal(roleById(closed.session, 'alignment_a_target-0').flags.blockedActions, undefined);
  assert.equal(closed.result.nextCycleId, 2);
});

test('no_repeat_target impide repetir el mismo bloqueo sobre el mismo target', () => {
  const session = createBaseSession();
  const firstBlocking = resolveRecipe(session, blockOutOfPlayRecipe, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const nextCycle = resolveAction(firstBlocking.session, closeCycleAction);
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
  const cycle2 = resolveAction(firstBlocking.session, closeCycleAction);
  const cycle3 = resolveAction(cycle2.session, closeCycleAction);
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
  assert.deepEqual(linked.session.groups[0], {
    id: 'linked_alignment_a_plain_0_alignment_a_target_0',
    key: 'linked_alignment_a_plain_0_alignment_a_target_0',
    type: GROUP_TYPES.LINKED,
    active: true,
    createdCycleId: 1,
    sourceActionId: ACTION_IDS.LINK_TARGETS,
    roleIds: ['alignment_a_plain-0', 'alignment_a_target-0'],
    groupRules: [],
    stepDefinitions: [],
    metadata: {}
  });
  assert.equal(linked.result.finalEffects[0].type, EFFECT_TYPES.SET_GROUP);
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
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'group',
    groupType: GROUP_TYPES.LINKED,
    sourceTargetId: 'alignment_a_target-0'
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
      sessionObjectiveRules: [
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

test('checkObjectives no aplica holder_reaches_in_play_parity si el group no alcanza al resto', () => {
  const session = createBaseSession({
    groups: [
      createAlignmentGroup('alignment_b', [
        'alignment_b_attacker-0',
        'alignment_b_target-0',
        'hidden_enemy-0'
      ])
    ],
    sessionObjectiveRules: [
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
      sessionObjectiveRules: [
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
      sessionObjectiveRules: [
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
      sessionObjectiveRules: [
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

test('step con seleccion y set_out_of_play aplica inPlay=false al chosen de la seleccion', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(
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
      targetId: 'alignment_a_target-0'
    }
  ]);
});

test('step con seleccion y set_out_of_play no ejecuta receta si chosen no alcanza supportThreshold', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play no ejecuta receta si la abstencion supera al chosen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play empatado no aplica efecto con null_on_tie', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play permite cerrar el step cuando todos se abstienen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(
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
  const completed = completeCurrentStep(resolved.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_null_selection_step'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECTION_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selection.reason, 'all_abstained');
  assert.equal(resolved.result.selection.chosenId, null);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(resolved.stepAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(completed.stepAdvance.reason, 'no-runnable-step');
});

test('step con seleccion y set_out_of_play trata un empate sin regla especial como null', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play puede pedir runoff limitado por empate', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play ejecuta receta si el runoff produce chosen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(session, {
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

test('step con seleccion y set_out_of_play propaga inPlay=false por linked cuando el chosen esta enlazado', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-target' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStep(
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
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'group',
    groupType: GROUP_TYPES.LINKED,
    sourceTargetId: 'alignment_a_target-0'
  });
});

test('step con seleccion y set_out_of_play rechaza la ronda si falta una seleccion obligatoria', () => {
  const session = createBaseSession();
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play rechaza elegir a un role linked', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-out-of-play' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStep(
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

test('step con seleccion y set_out_of_play no permite desactivar restricciones estructurales desde input', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-input-override' })
    ]
  });
  const resolved = resolveSelectionOutOfPlayStep(
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

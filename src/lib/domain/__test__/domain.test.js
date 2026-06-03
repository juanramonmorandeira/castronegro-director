import assert from 'node:assert/strict';

import {
  ACTION_IDS,
  ACTOR_SCOPE_TYPES,
  EFFECT_TYPES,
  HISTORY_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  RELATION_TYPES,
  VISIBILITY,
  VICTORY_RULE_TYPES,
  VICTORY_STATUSES,
  VICTORY_TYPES,
  VOTE_OUTCOME_TYPES,
  VOTE_REQUIRED_POLICIES,
  VOTE_RESTRICTION_TYPES,
  VOTE_ROUND_TYPES,
  VOTE_TIE_POLICIES,
  buildRoleInstancesFromSeats,
  completeCurrentStep,
  createPhasePools,
  createPhasePoolsFromSkinDefinition,
  createGameSession,
  createRelation,
  getCoreGroupCatalog,
  getCoreRoleCatalog,
  createStep,
  evaluateVictory,
  findAppliedSetPropertyHistory,
  getActionBlockKey,
  PHASE_STATUSES,
  PHASE_DEFINITION_ERRORS,
  POOL_KEYS,
  GROUP_CATALOG_IDS,
  ROLE_CATALOG_IDS,
  RECIPE_KEYS,
  resolveVoteRound,
  resolveAction,
  resolveCurrentStep,
  resolveRecipe,
  STEP_ACTION_KEYS,
  STEP_CATALOG_IDS,
  STEP_COMPLETION_MODES,
  STEP_COMPLETION_REQUESTED_BY,
  STEP_KEYS,
  getCatalogRecipe,
  getCatalogStep,
  validateGameSession
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
// - victoryModel detecta victoria generica y victoria especial linked.
// - voteModel cuenta votos y resuelve empates configurables.
// - stepModel conecta el step actual con actionModel y avanza el cursor.
//
// No usan Svelte, Firebase, i18n ni navegador.
// ---------------------------------------------------------------------------

const inspectRoleAction = getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE);
const setInPlayFalseAction = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY);
const restoreRecentOutOfPlayAction = getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY);
const blockOutOfPlayRecipe = getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY);
const linkTargetsAction = getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS);
const voteOutOfPlayAction = getCatalogRecipe(RECIPE_KEYS.VOTE_OUT_OF_PLAY);
const closeCycleAction = getCatalogRecipe(RECIPE_KEYS.CLOSE_CYCLE);

function createBaseSession({ relations = [], settings = {} } = {}) {
  const roleDefinitions = {
    team_b_attacker: {
      alignmentId: 'team_b'
    },
    team_a_blocker: {
      alignmentId: 'team_a'
    },
    team_a_target: {
      alignmentId: 'team_a'
    },
    team_a_plain: {
      alignmentId: 'team_a'
    },
    team_b_target: {
      alignmentId: 'team_b'
    },
    role_inspector: {
      alignmentId: 'team_a'
    },
    hidden_enemy: {
      alignmentId: 'team_b'
    }
  };
  const roleInstances = buildRoleInstancesFromSeats(
    [
      { seat: 0, playerId: 'player-1', role: 'team_b_attacker' },
      { seat: 1, playerId: 'player-2', role: 'team_a_blocker' },
      { seat: 2, playerId: 'player-3', role: 'team_a_target' },
      { seat: 3, playerId: 'player-4', role: 'team_a_plain' },
      { seat: 4, playerId: 'player-5', role: 'team_b_target' },
      { seat: 5, playerId: 'player-6', role: 'role_inspector' },
      { seat: 6, playerId: 'player-7', role: 'hidden_enemy' }
    ],
    roleDefinitions
  );

  return createGameSession({
    id: 'domain-test-session',
    definitionId: 'domain-test',
    players: Array.from({ length: 7 }, (_, index) => ({
      id: `player-${index + 1}`,
      displayName: `Player ${index + 1}`,
      connected: true,
      ready: true
    })),
    roleInstances,
    relations,
    settings
  });
}

function roleById(session, roleInstanceId) {
  return session.roleInstances.find((role) => role.id === roleInstanceId);
}

function withPhasePools(session, phasePools) {
  return {
    ...session,
    phasePools
  };
}

function withInPlayState(session, inPlayByRoleInstanceId = {}) {
  return {
    ...session,
    roleInstances: session.roleInstances.map((role) => ({
      ...role,
      inPlay: inPlayByRoleInstanceId[role.id] ?? role.inPlay
    }))
  };
}

function createVotes(votesByActorRoleInstanceId = {}) {
  return Object.entries(votesByActorRoleInstanceId).map(
    ([actorRoleInstanceId, targetRoleInstanceId]) => ({
      actorRoleInstanceId,
      targetRoleInstanceId
    })
  );
}

function actionRecipe(action, key) {
  return {
    ...action,
    key
  };
}

function collectiveVoteInput(input = {}) {
  return {
    ...input,
    actorScope: {
      type: ACTOR_SCOPE_TYPES.ALL_ROLES
    }
  };
}

test('inspect_role revela roleId sin modificar la sesion', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, inspectRoleAction, {
    actorRoleInstanceId: 'role_inspector-0',
    targetRoleInstanceIds: ['hidden_enemy-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.session, session);
  assert.deepEqual(resolved.result.reveals, [
    {
      targetRoleInstanceId: 'hidden_enemy-0',
      property: 'roleId',
      value: 'hidden_enemy'
    }
  ]);
});

test('resolveCurrentStep ejecuta receta y completeCurrentStep avanza el cursor', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolDeployment'],
      poolCurrent: 'poolDeployment',
      poolNext: 'poolDeployment',
      pools: {
        poolDeployment: [
          {
            key: STEP_KEYS.STEP_01,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(inspectRoleAction, STEP_ACTION_KEYS.INSPECT_ROLE)]
          },
          {
            key: STEP_KEYS.STEP_02,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(linkTargetsAction, STEP_ACTION_KEYS.LINK_TARGETS)]
          }
        ]
      }
    })
  );
  const inspectedAction = resolveCurrentStep(session, {
    actorRoleInstanceId: 'role_inspector-0',
    targetRoleInstanceIds: ['hidden_enemy-0']
  });
  const inspected = completeCurrentStep(inspectedAction.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorRoleInstanceId: 'role_inspector-0',
    reason: 'player_finished_step'
  });
  const linkedAction = resolveCurrentStep(inspected.session, {
    actorRoleInstanceId: 'role_inspector-0',
    targetRoleInstanceIds: ['team_a_target-0', 'team_a_plain-0']
  });
  const linked = completeCurrentStep(linkedAction.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_finished_step'
  });

  assert.equal(inspectedAction.ok, true);
  assert.equal(inspectedAction.step.phaseKey, STEP_KEYS.STEP_01);
  assert.equal(inspectedAction.result.reveals[0].value, 'hidden_enemy');
  assert.equal(inspectedAction.phaseAdvance, null);
  assert.equal(inspected.ok, true);
  assert.equal(
    inspected.session.phasePools.pools.poolDeployment[0].status,
    PHASE_STATUSES.DONE
  );
  assert.equal(inspected.phaseAdvance.reason, 'next-phase-in-current-pool');
  assert.equal(inspected.phaseAdvance.next.phaseKey, STEP_KEYS.STEP_02);
  assert.equal(linkedAction.ok, true);
  assert.equal(linkedAction.session.relations[0].type, RELATION_TYPES.LINKED);
  assert.equal(linkedAction.phaseAdvance, null);
  assert.equal(linked.ok, true);
  assert.equal(linked.phaseAdvance.reason, 'no-runnable-phase');
  assert.equal(linked.session.stepCompletionHistory.length, 2);
  assert.equal(linked.session.stepCompletionHistory[0].requestedBy, STEP_COMPLETION_REQUESTED_BY.PLAYER);
  assert.equal(linked.session.stepCompletionHistory[1].requestedBy, STEP_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('resolveCurrentStep rechaza un step ejecutable sin action declarada', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolDeployment'],
      poolCurrent: 'poolDeployment',
      poolNext: 'poolDeployment',
      pools: {
        poolDeployment: [
          {
            key: 'stepMissingAction',
            status: PHASE_STATUSES.ENABLED
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {});

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'step/missing-action');
  assert.equal(
    resolved.session.phasePools.pools.poolDeployment[0].status,
    PHASE_STATUSES.ENABLED
  );
});

test('phaseDefinition organiza steps construidos por stepDefinition', () => {
  const lateStep = createStep({
    key: STEP_KEYS.STEP_02,
    status: PHASE_STATUSES.ENABLED,
    order: 20,
    actorScope: {
      type: ACTOR_SCOPE_TYPES.ROLE,
      roleInstanceId: 'role_inspector-0'
    },
    actions: [actionRecipe(inspectRoleAction, STEP_ACTION_KEYS.INSPECT_ROLE)]
  });
  const earlyStep = createStep({
    key: STEP_KEYS.STEP_01,
    status: PHASE_STATUSES.ENABLED,
    order: 10,
    actorScope: {
      type: ACTOR_SCOPE_TYPES.ALL_ROLES
    },
    actions: [actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY)]
  });
  const created = createPhasePoolsFromSkinDefinition({
    poolOrder: ['poolExposed'],
    poolCurrent: 'poolExposed',
    pools: {
      poolExposed: [lateStep, earlyStep]
    }
  });
  const duplicated = createPhasePoolsFromSkinDefinition({
    poolOrder: ['poolExposed'],
    pools: {
      poolExposed: [
        { ...earlyStep, order: 10 },
        { ...lateStep, order: 10 }
      ]
    }
  });

  assert.equal(created.ok, true);
  assert.equal(created.phasePools.pools.poolExposed[0].key, STEP_KEYS.STEP_01);
  assert.equal(created.phasePools.pools.poolExposed[0].actorScope.type, ACTOR_SCOPE_TYPES.ALL_ROLES);
  assert.equal(created.phasePools.pools.poolExposed[1].key, STEP_KEYS.STEP_02);
  assert.equal(duplicated.ok, false);
  assert.equal(duplicated.errors[0].code, PHASE_DEFINITION_ERRORS.DUPLICATE_ORDER);
});

test('stepDefinition define completion y recetas opcionales', () => {
  const step = createStep({
    key: STEP_KEYS.STEP_03,
    status: PHASE_STATUSES.ENABLED,
    actorScope: {
      type: ACTOR_SCOPE_TYPES.ROLE,
      roleInstanceId: 'team_a_blocker-0'
    },
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
    actorScope: {
      type: ACTOR_SCOPE_TYPES.ROLE,
      roleInstanceId: 'team_a_blocker-0'
    }
  });

  assert.equal(step.key, STEP_KEYS.STEP_03);
  assert.equal(step.actorScope.type, ACTOR_SCOPE_TYPES.ROLE);
  assert.equal(step.actorScope.roleInstanceId, 'team_a_blocker-0');
  assert.equal(step.completion.mode, STEP_COMPLETION_MODES.MANUAL);
  assert.deepEqual(step.completion.allowedRequesters, [
    STEP_COMPLETION_REQUESTED_BY.PLAYER,
    STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    STEP_COMPLETION_REQUESTED_BY.SYSTEM
  ]);
  assert.deepEqual(
    step.actions.map((action) => action.key),
    [STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STEP_ACTION_KEYS.SET_OUT_OF_PLAY]
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
    getCatalogStep(STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY, { key: STEP_KEYS.STEP_04 }),
    getCatalogStep(STEP_CATALOG_IDS.GROUP_VOTE_OUT_OF_PLAY, { key: STEP_KEYS.STEP_05 }),
    getCatalogStep(STEP_CATALOG_IDS.SYSTEM_CLOSES_CYCLE, { key: STEP_KEYS.STEP_06 })
  ];

  assert.deepEqual(
    steps.map((step) => step.actions.map((action) => action.key)),
    [
      [STEP_ACTION_KEYS.INSPECT_ROLE],
      [STEP_ACTION_KEYS.LINK_TARGETS],
      [STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STEP_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.SET_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY],
      [STEP_ACTION_KEYS.CLOSE_CYCLE]
    ]
  );
  assert.equal(steps[0].actorScope.type, ACTOR_SCOPE_TYPES.ROLE);
  assert.equal(steps[1].actorScope.type, ACTOR_SCOPE_TYPES.ROLE);
  assert.equal(steps[2].actorScope.type, ACTOR_SCOPE_TYPES.ROLE);
  assert.equal(steps[3].actorScope.type, ACTOR_SCOPE_TYPES.ROLE);
  assert.equal(steps[4].actorScope.type, ACTOR_SCOPE_TYPES.ROLE_GROUP);
  assert.equal(steps[5].actorScope.type, ACTOR_SCOPE_TYPES.ALL_ROLES);
  assert.equal(steps[6].actorScope.type, 'system');
  assert.deepEqual(steps[6].completion.allowedRequesters, [STEP_COMPLETION_REQUESTED_BY.SYSTEM]);
});

test('roleCatalog declara roles mecanicos y razones de orden', () => {
  const catalog = getCoreRoleCatalog();
  const byKey = Object.fromEntries(catalog.map((roleDefinition) => [roleDefinition.key, roleDefinition]));

  assert.deepEqual(
    catalog.map((roleDefinition) => roleDefinition.stepDefinitions[0].poolKey),
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
});

test('groupCatalog declara grupos mecanicos y razones de orden', () => {
  const catalog = getCoreGroupCatalog();
  const group = catalog[0];
  const stepDefinition = group.stepDefinitions[0];

  assert.equal(group.key, GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY);
  assert.equal(group.selector.type, 'alignment');
  assert.equal(group.selector.alignmentId, 'alignment_b');
  assert.equal(stepDefinition.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(stepDefinition.order, 30);
  assert.deepEqual(
    stepDefinition.actions.map((action) => action.key),
    [STEP_ACTION_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(stepDefinition.metadata.orderReason.includes('after blockers'), true);
});

test('resolveCurrentStep exige actionKey cuando un step ofrece varias acciones', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: PHASE_STATUSES.ENABLED,
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const selectedAction = resolveCurrentStep(session, {
    actionKey: STEP_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(missingActionKey.ok, false);
  assert.equal(missingActionKey.errors[0].code, 'step/missing-action-key');
  assert.equal(selectedAction.ok, true);
  assert.equal(selectedAction.session.actionHistory.at(-1).stepKey, STEP_KEYS.STEP_03);
  assert.equal(
    selectedAction.session.actionHistory.at(-1).actionKey,
    STEP_ACTION_KEYS.SET_OUT_OF_PLAY
  );
  assert.equal(roleById(selectedAction.session, 'team_a_target-0').inPlay, false);
});

test('resolveCurrentStep ejecuta step_05 con receta vote_out_of_play', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolExposed'],
      poolCurrent: 'poolExposed',
      poolNext: 'poolExposed',
      pools: {
        poolExposed: [
          {
            key: STEP_KEYS.STEP_05,
            status: PHASE_STATUSES.ENABLED,
            actorScope: {
              type: ACTOR_SCOPE_TYPES.ALL_ROLES
            },
            actions: [actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
    votes: createVotes({
      'team_b_attacker-0': 'team_a_target-0',
      'team_a_blocker-0': 'team_a_target-0',
      'team_a_target-0': 'team_a_target-0',
      'team_a_plain-0': 'team_a_target-0',
      'team_b_target-0': 'team_a_target-0',
      'role_inspector-0': 'team_a_target-0',
      'hidden_enemy-0': 'team_a_target-0'
    })
  });
  const completed = completeCurrentStep(resolved.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_vote_step'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.step.phaseKey, STEP_KEYS.STEP_05);
  assert.equal(resolved.result.vote.type, VOTE_OUTCOME_TYPES.WINNER);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, false);
  assert.equal(resolved.phaseAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(
    completed.session.phasePools.pools.poolExposed[0].status,
    PHASE_STATUSES.DONE
  );
  assert.equal(completed.phaseAdvance.reason, 'no-runnable-phase');
});

test('resolveCurrentStep ejecuta step_02 con receta block_out_of_play', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStep(session, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const attackAfterBlocking = resolveAction(blocking.session, setInPlayFalseAction, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.step.phaseKey, STEP_KEYS.STEP_02);
  assert.equal(blocking.phaseAdvance, null);
  const completed = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorRoleInstanceId: 'team_a_blocker-0'
  });
  assert.equal(completed.ok, true);
  assert.equal(
    completed.session.phasePools.pools.poolConcealed[0].status,
    PHASE_STATUSES.DONE
  );
  assert.equal(completed.phaseAdvance.reason, 'no-runnable-phase');
  assert.equal(attackAfterBlocking.ok, true);
  assert.equal(roleById(attackAfterBlocking.session, 'team_a_target-0').inPlay, true);
  assert.deepEqual(attackAfterBlocking.result.proposedEffects, []);
  assert.equal(attackAfterBlocking.result.blockedActions[0].reason, 'blocked_action');
});

test('resolveCurrentStep ejecuta step_04 con receta set_out_of_play', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_04,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStep(session, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const blockingCompleted = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorRoleInstanceId: 'team_a_blocker-0'
  });
  const blockedAttempt = resolveCurrentStep(blockingCompleted.session, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blocking.phaseAdvance, null);
  assert.equal(blockingCompleted.phaseAdvance.next.phaseKey, STEP_KEYS.STEP_04);
  assert.equal(blockedAttempt.ok, true);
  assert.equal(blockedAttempt.step.phaseKey, STEP_KEYS.STEP_04);
  assert.equal(roleById(blockedAttempt.session, 'team_a_target-0').inPlay, true);
  assert.deepEqual(blockedAttempt.result.proposedEffects, []);
  assert.equal(blockedAttempt.result.blockedActions[0].reason, 'blocked_action');
  const blockedCompleted = completeCurrentStep(blockedAttempt.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  assert.equal(blockedCompleted.ok, true);
  assert.equal(
    blockedCompleted.session.phasePools.pools.poolConcealed[1].status,
    PHASE_STATUSES.DONE
  );
});

test('actionHistory registra step, efectos finales y acciones bloqueadas', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_04,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const resolved = resolveCurrentStep(session, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const historyEntry = resolved.session.actionHistory.at(-1);
  const appliedEntries = findAppliedSetPropertyHistory(resolved.session, {
    cycleId: historyEntry.cycleId,
    property: 'inPlay',
    value: false,
    targetId: 'team_a_target-0',
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
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_02,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_03,
            status: PHASE_STATUSES.ENABLED,
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const setOutStepClosed = completeCurrentStep(setOutOfPlay.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_set_out_step'
  });
  const restored = resolveCurrentStep(setOutStepClosed.session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(setOutOfPlay.ok, true);
  assert.equal(roleById(setOutOfPlay.session, 'team_a_target-0').inPlay, false);
  assert.equal(setOutOfPlay.phaseAdvance, null);
  assert.equal(setOutStepClosed.ok, true);
  assert.equal(setOutStepClosed.phaseAdvance.next.phaseKey, STEP_KEYS.STEP_03);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'team_a_target-0').inPlay, true);
  assert.equal(restored.phaseAdvance, null);
  assert.equal(
    restored.session.phasePools.pools.poolConcealed[1].status,
    PHASE_STATUSES.ENABLED
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
      actorRoleInstanceId: 'team_b_attacker-0',
      targetRoleInstanceIds: ['team_a_target-0']
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
  const session = withPhasePools(
    preStepSetOut.session,
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: PHASE_STATUSES.ENABLED,
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
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const setOut = resolveCurrentStep(restored.session, {
    actionKey: STEP_ACTION_KEYS.SET_OUT_OF_PLAY,
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_b_target-0']
  });
  const completed = completeCurrentStep(setOut.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_optional_step'
  });

  assert.equal(preStepSetOut.ok, true);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'team_a_target-0').inPlay, true);
  assert.equal(restored.phaseAdvance, null);
  assert.equal(
    restored.session.phasePools.pools.poolConcealed[0].status,
    PHASE_STATUSES.ENABLED
  );
  assert.equal(setOut.ok, true);
  assert.equal(roleById(setOut.session, 'team_b_target-0').inPlay, false);
  assert.equal(setOut.phaseAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(completed.phaseAdvance.reason, 'no-runnable-phase');
  assert.equal(
    completed.session.phasePools.pools.poolConcealed[0].status,
    PHASE_STATUSES.DONE
  );
  assert.equal(completed.completion.requestedBy, STEP_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('completeCurrentStep respeta allowedRequesters del step', () => {
  const step = createStep({
    key: STEP_KEYS.STEP_03,
    status: PHASE_STATUSES.ENABLED,
    completion: {
      mode: STEP_COMPLETION_MODES.MANUAL,
      allowedRequesters: [STEP_COMPLETION_REQUESTED_BY.DIRECTOR]
    },
    actions: [actionRecipe(restoreRecentOutOfPlayAction, STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY)]
  });
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
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
    actorRoleInstanceId: 'team_a_blocker-0'
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
  const session = withPhasePools(
    withInPlayState(createBaseSession(), {
      'team_a_target-0': false
    }),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_03,
            status: PHASE_STATUSES.ENABLED,
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
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(restored.ok, false);
  assert.equal(restored.errors[0].code, 'constraint/require_recent_set_property');
  assert.equal(roleById(restored.session, 'team_a_target-0').inPlay, false);
});

test('restore_recent_out_of_play rechaza un set_out_of_play bloqueado', () => {
  const session = withPhasePools(
    createBaseSession(),
    createPhasePools({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          {
            key: STEP_KEYS.STEP_01,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(blockOutOfPlayRecipe, STEP_ACTION_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_02,
            status: PHASE_STATUSES.ENABLED,
            actions: [actionRecipe(setInPlayFalseAction, STEP_ACTION_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STEP_KEYS.STEP_03,
            status: PHASE_STATUSES.ENABLED,
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
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const blockingClosed = completeCurrentStep(blocking.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.PLAYER,
    actorRoleInstanceId: 'team_a_blocker-0'
  });
  const blockedSetOutOfPlay = resolveCurrentStep(blockingClosed.session, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const blockedSetOutClosed = completeCurrentStep(blockedSetOutOfPlay.session, {
    requestedBy: STEP_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const restored = resolveCurrentStep(blockedSetOutClosed.session, {
    actionKey: STEP_ACTION_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blockingClosed.ok, true);
  assert.equal(blockedSetOutOfPlay.ok, true);
  assert.deepEqual(blockedSetOutOfPlay.result.finalEffects, []);
  assert.equal(roleById(blockedSetOutOfPlay.session, 'team_a_target-0').inPlay, true);
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const secondSetOut = resolveRecipe(firstRestore.session, setOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restorePerCycleRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restorePerCycleRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });

  assert.equal(firstRestore.ok, true);
  assert.equal(secondRestore.ok, true);
  assert.equal(roleById(secondRestore.session, 'team_a_plain-0').inPlay, true);
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreNextCycleRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreNextCycleRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const firstRestore = resolveRecipe(firstSetOut.session, restoreCurrentOrNextRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const nextCycle = resolveAction(firstRestore.session, closeCycleAction);
  const secondSetOut = resolveRecipe(nextCycle.session, setOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });
  const secondRestore = resolveRecipe(secondSetOut.session, restoreCurrentOrNextRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
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
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const blockedUse = resolveRecipe(blocking.session, limitedSetOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const secondUse = resolveRecipe(blockedUse.session, limitedSetOutRecipe, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
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
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'team_a_plain-0').inPlay, true);
  assert.equal(resolved.result.proposedEffects.length, 1);
  assert.equal(resolved.result.blockedActions.length, 0);
});

test('block_out_of_play bloquea set_in_play(false) solo sobre su target', () => {
  const session = createBaseSession();
  const blocking = resolveAction(session, blockOutOfPlayRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const blockedTarget = resolveAction(blocking.session, setInPlayFalseAction, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const unblockedTarget = resolveAction(blocking.session, setInPlayFalseAction, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });

  assert.equal(blocking.ok, true);
  assert.equal(blockedTarget.ok, true);
  assert.equal(roleById(blockedTarget.session, 'team_a_target-0').inPlay, true);
  assert.deepEqual(blockedTarget.result.proposedEffects, []);
  assert.deepEqual(blockedTarget.result.finalEffects, []);
  assert.deepEqual(blockedTarget.result.blockedActions, [
    {
      actionId: ACTION_IDS.SET_IN_PLAY,
      reason: 'blocked_action',
      targetId: 'team_a_target-0'
    }
  ]);

  assert.equal(unblockedTarget.ok, true);
  assert.equal(roleById(unblockedTarget.session, 'team_a_plain-0').inPlay, false);
});

test('close_cycle limpia bloqueos temporales y avanza ciclo', () => {
  const session = createBaseSession();
  const blockingKey = getActionBlockKey(blockOutOfPlayRecipe.effect.blocks);
  const blocking = resolveAction(session, blockOutOfPlayRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const closed = resolveAction(blocking.session, closeCycleAction);

  assert.equal(
    roleById(blocking.session, 'team_a_target-0').flags.blockedActions[blockingKey],
    true
  );
  assert.equal(roleById(closed.session, 'team_a_target-0').flags.blockedActions, undefined);
  assert.equal(closed.result.nextCycleId, 2);
});

test('no_repeat_target impide repetir el mismo bloqueo sobre el mismo target', () => {
  const session = createBaseSession();
  const firstBlocking = resolveRecipe(session, blockOutOfPlayRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const nextCycle = resolveAction(firstBlocking.session, closeCycleAction);
  const repeatedBlocking = resolveRecipe(nextCycle.session, blockOutOfPlayRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const otherTargetBlocking = resolveRecipe(nextCycle.session, blockOutOfPlayRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
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
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const cycle2 = resolveAction(firstBlocking.session, closeCycleAction);
  const cycle3 = resolveAction(cycle2.session, closeCycleAction);
  const repeatedBlocking = resolveRecipe(cycle3.session, sessionOnlyRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });
  const otherTargetBlocking = resolveRecipe(cycle3.session, sessionOnlyRecipe, {
    actorRoleInstanceId: 'team_a_blocker-0',
    targetRoleInstanceIds: ['team_a_plain-0']
  });

  assert.equal(firstBlocking.ok, true);
  assert.equal(repeatedBlocking.ok, false);
  assert.equal(repeatedBlocking.errors[0].code, 'constraint/no_repeat_target');
  assert.equal(repeatedBlocking.errors[0].window, CONSTRAINT_WINDOWS.SESSION);
  assert.equal(otherTargetBlocking.ok, true);
});

test('link_targets crea una relacion linked en la sesion', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, linkTargetsAction, {
    actorRoleInstanceId: 'role_inspector-0',
    targetRoleInstanceIds: ['team_a_target-0', 'team_a_plain-0']
  });

  assert.equal(linked.ok, true);
  assert.equal(linked.session.relations.length, 1);
  assert.deepEqual(linked.session.relations[0], {
    id: 'linked-team_a_plain-0-team_a_target-0',
    type: RELATION_TYPES.LINKED,
    roleInstanceIds: ['team_a_plain-0', 'team_a_target-0'],
    active: true,
    createdCycleId: 1,
    sourceActionId: ACTION_IDS.LINK_TARGETS,
    metadata: {}
  });
  assert.equal(linked.result.finalEffects[0].type, EFFECT_TYPES.SET_RELATION);
});

test('linked deriva inPlay=false hacia los roleInstances enlazados', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, linkTargetsAction, {
    actorRoleInstanceId: 'role_inspector-0',
    targetRoleInstanceIds: ['team_a_target-0', 'team_a_plain-0']
  });
  const resolved = resolveAction(linked.session, setInPlayFalseAction, {
    actorRoleInstanceId: 'team_b_attacker-0',
    targetRoleInstanceIds: ['team_a_target-0']
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'team_a_plain-0').inPlay, false);
  assert.equal(resolved.result.finalEffects.length, 2);
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'relation',
    relationType: RELATION_TYPES.LINKED,
    sourceTargetId: 'team_a_target-0'
  });
});

test('validateGameSession detecta relaciones que apuntan a roles inexistentes', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'broken-link',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'missing-role-0']
      })
    ]
  });
  const validation = validateGameSession(session, { requireAssigned: true });

  assert.equal(validation.ok, false);
  assert.equal(
    validation.errors.some((error) => error.code === 'relation/missing-role-instance'),
    true
  );
});

test('evaluateVictory devuelve ongoing cuando quedan varios alignments en juego', () => {
  const session = createBaseSession();
  const victory = evaluateVictory(session);

  assert.deepEqual(victory, {
    status: VICTORY_STATUSES.ONGOING,
    type: VICTORY_TYPES.NONE,
    reason: 'no_victory_condition_met',
    winnerAlignmentId: null,
    winnerRoleInstanceIds: []
  });
});

test('evaluateVictory aplica regla neutral de alignment at_least_remaining', () => {
  const session = withInPlayState(
    createBaseSession({
      settings: {
        victory: {
          alignmentRules: [
            {
              id: 'team_b_reaches_threshold',
              alignmentId: 'team_b',
              condition: VICTORY_RULE_TYPES.AT_LEAST_REMAINING
            }
          ]
        }
      }
    }),
    {
      'team_a_plain-0': false,
      'role_inspector-0': false
    }
  );
  const victory = evaluateVictory(session);

  assert.equal(victory.status, VICTORY_STATUSES.FINISHED);
  assert.equal(victory.type, VICTORY_TYPES.ALIGNMENT_RULE);
  assert.equal(victory.reason, 'alignment_rule_at_least_remaining_met');
  assert.equal(victory.winnerAlignmentId, 'team_b');
  assert.equal(victory.ruleId, 'team_b_reaches_threshold');
  assert.deepEqual(victory.counts, {
    alignmentInPlay: 3,
    remainingInPlay: 2,
    totalInPlay: 5
  });
});

test('evaluateVictory no aplica at_least_remaining si el alignment no alcanza al resto', () => {
  const session = createBaseSession({
    settings: {
      victory: {
        alignmentRules: [
          {
            id: 'team_b_reaches_threshold',
            alignmentId: 'team_b',
            condition: VICTORY_RULE_TYPES.AT_LEAST_REMAINING
          }
        ]
      }
    }
  });
  const victory = evaluateVictory(session);

  assert.equal(victory.status, VICTORY_STATUSES.ONGOING);
  assert.equal(victory.type, VICTORY_TYPES.NONE);
});

test('evaluateVictory detecta victoria generica cuando solo queda un alignment', () => {
  const session = withInPlayState(createBaseSession(), {
    'team_b_attacker-0': false,
    'team_b_target-0': false,
    'hidden_enemy-0': false
  });
  const victory = evaluateVictory(session);

  assert.equal(victory.status, VICTORY_STATUSES.FINISHED);
  assert.equal(victory.type, VICTORY_TYPES.SINGLE_ALIGNMENT);
  assert.equal(victory.winnerAlignmentId, 'team_a');
  assert.deepEqual(victory.winnerRoleInstanceIds.sort(), [
    'role_inspector-0',
    'team_a_blocker-0',
    'team_a_plain-0',
    'team_a_target-0'
  ]);
});

test('evaluateVictory detecta victoria linked si solo quedan linked de alignments distintos', () => {
  const session = withInPlayState(
    createBaseSession({
      relations: [
        createRelation({
          id: 'linked-mixed-finalists',
          type: RELATION_TYPES.LINKED,
          roleInstanceIds: ['team_a_target-0', 'team_b_target-0'],
          active: true,
          sourceActionId: ACTION_IDS.LINK_TARGETS
        })
      ]
    }),
    {
      'team_b_attacker-0': false,
      'team_a_blocker-0': false,
      'team_a_plain-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const victory = evaluateVictory(session);

  assert.equal(victory.status, VICTORY_STATUSES.FINISHED);
  assert.equal(victory.type, VICTORY_TYPES.LINKED_EXCLUSIVE_SURVIVORS);
  assert.equal(victory.winnerAlignmentId, null);
  assert.deepEqual(victory.winnerRoleInstanceIds.sort(), ['team_a_target-0', 'team_b_target-0']);
  assert.equal(victory.relationId, 'linked-mixed-finalists');
});

test('evaluateVictory no activa linked si queda un tercero en juego', () => {
  const session = withInPlayState(
    createBaseSession({
      relations: [
        createRelation({
          id: 'linked-with-third-player',
          type: RELATION_TYPES.LINKED,
          roleInstanceIds: ['team_a_target-0', 'team_b_target-0'],
          active: true,
          sourceActionId: ACTION_IDS.LINK_TARGETS
        })
      ]
    }),
    {
      'team_b_attacker-0': false,
      'team_a_blocker-0': false,
      'role_inspector-0': false,
      'hidden_enemy-0': false
    }
  );
  const victory = evaluateVictory(session);

  assert.equal(victory.status, VICTORY_STATUSES.ONGOING);
  assert.equal(victory.type, VICTORY_TYPES.NONE);
});

test('resolveVoteRound detecta ganador unico por mayoria simple', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_a_blocker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_a_plain-0', targetRoleInstanceId: 'team_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, VOTE_OUTCOME_TYPES.WINNER);
  assert.equal(resolved.result.winnerRoleInstanceId, 'team_a_target-0');
  assert.deepEqual(resolved.result.tally, [
    { targetRoleInstanceId: 'team_a_target-0', voteCount: 2 },
    { targetRoleInstanceId: 'team_b_target-0', voteCount: 1 }
  ]);
});

test('resolveVoteRound rechaza actores que votan mas de una vez', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/duplicate-actor');
});

test('resolveVoteRound declara nula una votacion empatada con null_on_tie', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    tiePolicy: VOTE_TIE_POLICIES.NULL_ON_TIE,
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_a_blocker-0', targetRoleInstanceId: 'team_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, VOTE_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'tied_vote');
  assert.deepEqual(resolved.result.tiedTargetRoleInstanceIds, [
    'team_a_plain-0',
    'team_a_target-0'
  ]);
});

test('resolveVoteRound pide runoff cuando la politica de empate lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    tiePolicy: VOTE_TIE_POLICIES.RUNOFF_ON_TIE,
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_a_blocker-0', targetRoleInstanceId: 'team_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, VOTE_OUTCOME_TYPES.TIE);
  assert.equal(resolved.result.reason, 'runoff_required');
  assert.deepEqual(resolved.result.nextRound, {
    roundType: VOTE_ROUND_TYPES.RUNOFF,
    allowedTargetRoleInstanceIds: ['team_a_plain-0', 'team_a_target-0']
  });
});

test('resolveVoteRound limita runoff a los objetivos empatados', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    roundType: VOTE_ROUND_TYPES.RUNOFF,
    allowedTargetRoleInstanceIds: ['team_a_plain-0', 'team_a_target-0'],
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/target-not-allowed');
});

test('resolveVoteRound declara nulo un runoff que vuelve a empatar', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    roundType: VOTE_ROUND_TYPES.RUNOFF,
    tiePolicy: VOTE_TIE_POLICIES.RUNOFF_ON_TIE,
    allowedTargetRoleInstanceIds: ['team_a_plain-0', 'team_a_target-0'],
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' },
      { actorRoleInstanceId: 'team_a_blocker-0', targetRoleInstanceId: 'team_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, VOTE_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'runoff_tied');
});

test('resolveVoteRound exige voto de todos los roleInstances inPlay cuando requiredVotes es all_in_play', () => {
  const session = createBaseSession();
  const resolved = resolveVoteRound({
    session,
    requiredVotes: VOTE_REQUIRED_POLICIES.ALL_IN_PLAY,
    votes: [
      { actorRoleInstanceId: 'team_b_attacker-0', targetRoleInstanceId: 'team_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/missing-required-votes');
  assert.deepEqual(resolved.errors[0].missingActorRoleInstanceIds.sort(), [
    'hidden_enemy-0',
    'role_inspector-0',
    'team_a_blocker-0',
    'team_a_plain-0',
    'team_a_target-0',
    'team_b_target-0'
  ]);
});

test('resolveVoteRound rechaza votar a un target relacionado por linked si la restriccion esta activa', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-vote-restriction',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveVoteRound({
    session,
    relationRestrictions: [
      {
        type: VOTE_RESTRICTION_TYPES.EXCLUDE_RELATED_TARGET,
        relationType: RELATION_TYPES.LINKED
      }
    ],
    votes: [
      { actorRoleInstanceId: 'team_a_plain-0', targetRoleInstanceId: 'team_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/restricted-related-target');
  assert.equal(resolved.errors[0].actorRoleInstanceId, 'team_a_plain-0');
  assert.equal(resolved.errors[0].targetRoleInstanceId, 'team_a_target-0');
});

test('resolveVoteRound ignora restricciones de relacion incompletas', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-incomplete-restriction',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveVoteRound({
    session,
    relationRestrictions: [
      {
        type: VOTE_RESTRICTION_TYPES.EXCLUDE_RELATED_TARGET
      }
    ],
    votes: [
      { actorRoleInstanceId: 'team_a_plain-0', targetRoleInstanceId: 'team_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, VOTE_OUTCOME_TYPES.WINNER);
});

test('vote puro devuelve ganador sin aplicar efectos', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, {
    id: ACTION_IDS.VOTE,
    tiePolicy: VOTE_TIE_POLICIES.NULL_ON_TIE,
    requiredVotes: VOTE_REQUIRED_POLICIES.ALL_IN_PLAY,
    visibility: VISIBILITY.ALL
  }, {
    votes: createVotes({
      'team_b_attacker-0': 'team_a_target-0',
      'team_a_blocker-0': 'team_a_target-0',
      'team_a_target-0': 'team_a_target-0',
      'team_a_plain-0': 'team_a_target-0',
      'team_b_target-0': 'team_a_target-0',
      'role_inspector-0': 'team_a_target-0',
      'hidden_enemy-0': 'team_a_target-0'
    })
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.vote.type, VOTE_OUTCOME_TYPES.WINNER);
  assert.equal(resolved.result.vote.winnerRoleInstanceId, 'team_a_target-0');
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, true);
});

test('vote puro no aplica restricciones linked por defecto', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-generic-vote',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveAction(session, {
    id: ACTION_IDS.VOTE,
    tiePolicy: VOTE_TIE_POLICIES.NULL_ON_TIE,
    visibility: VISIBILITY.ALL
  }, {
    votes: [
      {
        actorRoleInstanceId: 'team_a_plain-0',
        targetRoleInstanceId: 'team_a_target-0'
      }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.vote.type, VOTE_OUTCOME_TYPES.WINNER);
  assert.equal(resolved.result.vote.winnerRoleInstanceId, 'team_a_target-0');
});

test('vote_out_of_play aplica inPlay=false al ganador de la votacion', () => {
  const session = createBaseSession();
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_target-0',
        'team_a_target-0': 'team_a_target-0',
        'team_a_plain-0': 'team_a_target-0',
        'team_b_target-0': 'team_a_target-0',
        'role_inspector-0': 'team_a_target-0',
        'hidden_enemy-0': 'team_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.vote.type, VOTE_OUTCOME_TYPES.WINNER);
  assert.equal(resolved.result.vote.winnerRoleInstanceId, 'team_a_target-0');
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, false);
  assert.equal(resolved.session.actionHistory.at(-1).actorRoleInstanceId, null);
  assert.equal(resolved.session.actionHistory.at(-1).actorScope.type, ACTOR_SCOPE_TYPES.ALL_ROLES);
  assert.deepEqual(resolved.result.proposedEffects, [
    {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: 'role_instance',
      property: 'inPlay',
      value: false,
      targetId: 'team_a_target-0'
    }
  ]);
});

test('vote_out_of_play empatado no aplica efecto con null_on_tie', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_plain-0',
        'team_a_target-0': 'team_a_target-0',
        'team_a_plain-0': 'team_a_plain-0',
        'team_b_target-0': 'team_a_target-0',
        'role_inspector-0': 'team_a_plain-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.vote.type, VOTE_OUTCOME_TYPES.NULL);
  assert.deepEqual(resolved.result.proposedEffects, []);
  assert.deepEqual(resolved.result.finalEffects, []);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, true);
  assert.equal(roleById(resolved.session, 'team_a_plain-0').inPlay, true);
});

test('vote_out_of_play propaga inPlay=false por linked cuando el ganador esta enlazado', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-vote-target',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_target-0',
        'team_a_target-0': 'team_a_target-0',
        'team_a_plain-0': 'team_b_target-0',
        'team_b_target-0': 'team_a_target-0',
        'role_inspector-0': 'team_a_target-0',
        'hidden_enemy-0': 'team_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'team_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'team_a_plain-0').inPlay, false);
  assert.equal(resolved.result.finalEffects.length, 2);
  assert.deepEqual(resolved.result.finalEffects[1].derivedFrom, {
    type: 'relation',
    relationType: RELATION_TYPES.LINKED,
    sourceTargetId: 'team_a_target-0'
  });
});

test('vote_out_of_play rechaza la ronda si falta un voto obligatorio', () => {
  const session = createBaseSession();
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/missing-required-votes');
});

test('vote_out_of_play rechaza votar a un roleInstance linked', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-vote-out-of-play',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_target-0',
        'team_a_target-0': 'team_a_target-0',
        'team_a_plain-0': 'team_a_target-0',
        'team_b_target-0': 'team_a_target-0',
        'role_inspector-0': 'team_a_target-0',
        'hidden_enemy-0': 'team_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/restricted-related-target');
  assert.equal(resolved.errors[0].actorRoleInstanceId, 'team_a_plain-0');
  assert.equal(resolved.errors[0].targetRoleInstanceId, 'team_a_target-0');
});

test('vote_out_of_play no permite desactivar restricciones estructurales desde input', () => {
  const session = createBaseSession({
    relations: [
      createRelation({
        id: 'linked-vote-input-override',
        type: RELATION_TYPES.LINKED,
        roleInstanceIds: ['team_a_target-0', 'team_a_plain-0'],
        active: true,
        sourceActionId: ACTION_IDS.LINK_TARGETS
      })
    ]
  });
  const resolved = resolveRecipe(
    session,
    actionRecipe(voteOutOfPlayAction, STEP_ACTION_KEYS.VOTE_OUT_OF_PLAY),
    collectiveVoteInput({
      relationRestrictions: [],
      votes: createVotes({
        'team_b_attacker-0': 'team_a_target-0',
        'team_a_blocker-0': 'team_a_target-0',
        'team_a_target-0': 'team_a_target-0',
        'team_a_plain-0': 'team_a_target-0',
        'team_b_target-0': 'team_a_target-0',
        'role_inspector-0': 'team_a_target-0',
        'hidden_enemy-0': 'team_a_target-0'
      })
    })
  );

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'vote/restricted-related-target');
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

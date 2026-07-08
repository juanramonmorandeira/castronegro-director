import assert from 'node:assert/strict';

import {
  ACTION_IDS,
  ALIGNMENT_IDS,
  AVAILABILITY_RULE_TYPES,
  BASIC_AVAILABLE_RULE_KEYS,
  BASIC_ROLE_OPTION_KEYS,
  MECHANICAL_ENTITY_TYPES,
  EFFECT_TYPES,
  HISTORY_RESULTS,
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  DOUBLE_SELECTOR_ERRORS,
  DOUBLE_SELECTOR_STAGE_KEYS,
  GROUP_TYPES,
  VISIBILITY,
  OBJECTIVE_BENEFICIARY_TYPES,
  OBJECTIVE_CONDITIONS,
  OBJECTIVE_EVALUATION_STATUSES,
  OBJECTIVE_HOLDER_TYPES,
  INFLUENCE_OPERATIONS,
  INFLUENCE_SUBJECTS,
  SELECT_ABSTAIN_RESOLUTION_TYPES,
  SELECT_ABSTAIN_RULES,
  SELECT_UNANIMOUS_RULES,
  SELECT_NULL_RULES,
  SELECT_OUTCOME_TYPES,
  SELECT_REQUIRED_RULES,
  SELECT_RESTRICTION_TYPES,
  SELECT_RUNOFF_RULES,
  SELECT_ROUND_TYPES,
  SELECT_SELECTOR_SOURCES,
  SELECT_SUPPORT_BASES,
  SELECT_SUPPORT_THRESHOLD_TYPES,
  SELECT_TIE_RULES,
  SELECT_TIE_BREAKER_TYPES,
  SELECT_VALUE_RULE_TYPES,
  buildPools,
  buildGroups,
  buildRoles,
  buildSession,
  defineRole,
  advanceStageCursor,
  completeCurrentStage,
  createCycle,
  createPool,
  preparePool,
  startCycle,
  startInterPoolQueue,
  startInterPoolQueueForWindow,
  completeInterPoolStageForWindow,
  validatePool,
  organizePoolStages,
  createSelectRules,
  createSession,
  createRole,
  createGroup,
  defineGroup,
  addRoleToGroup,
  addBlockedPropertyChange,
  appendRecipeHistory,
  appendInterPoolStage,
  getCoreGroupCatalog,
  getCurrentStage,
  getGroupRoles,
  getCoreRoleCatalog,
  processActionResultEvents,
  removeRoleFromGroup,
  requestSelectDoubleSelectorStage,
  createStage,
  canStageInfluenceObjectiveOutcome,
  checkObjectives,
  findAppliedSetPropertyHistory,
  STAGE_STATUSES,
  CURRENT_STAGE_SOURCES,
  INTER_POOL_QUEUE_ERRORS,
  INTER_POOL_QUEUE_HISTORY_OPERATIONS,
  INTER_POOL_QUEUE_EVENT_WINDOWS,
  SURFACE_FLOW_STEPS,
  SURFACE_EFFECT_REASONS,
  SURFACE_ITEM_TYPES,
  SURFACE_MESSAGE_EXPIRATIONS,
  SURFACE_SCREEN_MODES,
  POOL_DEFINITION_ERRORS,
  POOL_KEYS,
  GROUP_CATALOG_IDS,
  GROUP_MEMBERSHIP_RULE_TYPES,
  ROLE_CATALOG_IDS,
  ROLE_CATALOG,
  RULE_SET_CATALOG_IDS,
  RULE_SET_SUPPORT_STATUSES,
  RECIPE_KEYS,
  RECIPE_ACTOR_TYPES,
  TARGET_FILTER_TYPES,
  validateActionTargets,
  resolveSelectRound,
  resolveAction,
  resolveCurrentStage,
  resolveRecipe,
  buildRuleSet,
  getBasicAlignmentDistribution,
  getCatalogRuleSet,
  PEEK_WARNING_CONFIRMATION_RULES,
  PEEK_WARNING_TIMINGS,
  PEEK_RECIPE_KEYS,
  STAGE_RECIPE_KEYS,
  STAGE_CATALOG_IDS,
  STAGE_KEYS,
  STAGE_COMPLETION_MODES,
  STAGE_COMPLETION_REQUESTED_BY,
  POOL_LIFECYCLE_OPERATION_TYPES,
  PROPERTY_BLOCK_BOUNDARIES,
  PROPERTY_BLOCK_DURATION_UNITS,
  PROPERTY_BLOCK_EXPIRATION_TYPES,
  SESSION_STATUSES,
  materializePropertyBlockExpiration,
  createConcealedSelectionDraftItem,
  createConcealedSelectionSubmissionItem,
  createExposedSelectionSubmissionItem,
  getCatalogRecipe,
  getCatalogStage,
  getActionFromRecipe,
  getActionActors,
  resolveRecipeActor,
  HISTORY_COLLECTIONS,
  HISTORY_EVENTS,
  getHistoryCollection,
  createEffectResultItem,
  createPublicTableStateItem,
  createSelectionTallyItem,
  createSelectionResultItem,
  createSurfaceMessage,
  getSurfaceFlowOrder,
  validateRecipeContract,
  validateSession,
  validateEffect,
  resolveEffects,
  applyEffects
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

function history(session, collectionName) {
  return getHistoryCollection(session, collectionName);
}

function recipeHistory(session) {
  return history(session, HISTORY_COLLECTIONS.RECIPE);
}

function finishedRecipeHistory(session) {
  return recipeHistory(session).filter((entry) => entry.event === HISTORY_EVENTS.FINISHED);
}

function lastFinishedRecipeHistory(session) {
  return finishedRecipeHistory(session).at(-1);
}

function stageHistory(session) {
  return history(session, HISTORY_COLLECTIONS.STAGE);
}

function interPoolQueueHistory(session) {
  return history(session, HISTORY_COLLECTIONS.INTER_POOL_QUEUE);
}

function cycleHistory(session) {
  return history(session, HISTORY_COLLECTIONS.CYCLE);
}

function createFinishedRecipeHistoryEntry({
  cycleId = 0,
  recipeKey = null,
  actorIds = [],
  targetIds = [],
  result = HISTORY_RESULTS.APPLIED,
  finalEffects = []
} = {}) {
  return {
    id: `${recipeKey ?? 'recipe'}-fixture-${cycleId}`,
    sequence: 0,
    timestamp: new Date().toISOString(),
    event: HISTORY_EVENTS.FINISHED,
    actor: { authority: 'system' },
    payload: {
      recipeKey,
      result,
      actorIds,
      targetIds,
      finalEffects
    },
    metadata: {
      context: {
        cycleId,
        poolKey: null,
        stageId: null,
        stageKey: null,
        stageCatalogId: null,
        eventWindow: null
      }
    }
  };
}

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
// - actionModel cuenta selecciones y resuelve empates configurables.
// - stageModel conecta el stage actual con actionModel y avanza el cursor.
//
// No usan Svelte, Firebase, i18n ni navegador.
// ---------------------------------------------------------------------------

test('validateEffect exige forma minima para set_property', () => {
  const validation = validateEffect({
    type: EFFECT_TYPES.SET_PROPERTY,
    targetType: MECHANICAL_ENTITY_TYPES.ROLE,
    property: 'inPlay',
    value: false
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'effect/missing-target-id');
});

test('resolveEffects y applyEffects resuelven y aplican un set_property final', () => {
  const session = createSession({
    roles: [
      createRole({
        id: 'role_plain-0',
        roleKey: 'role_plain',
        inPlay: true
      })
    ]
  });
  const proposedEffects = [
    {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      targetId: 'role_plain-0',
      property: 'inPlay',
      value: false
    }
  ];

  const resolution = resolveEffects({ session, proposedEffects });
  const applied = applyEffects({ session, effects: resolution.finalEffects });

  assert.deepEqual(resolution.errors, []);
  assert.equal(resolution.finalEffects.length, 1);
  assert.equal(applied.roles[0].inPlay, false);
});

test('actorModel resuelve un actor role desde input.actorIds', () => {
  const session = createSession({
    roles: [
      createRole({ id: 'role_inspects-0', roleKey: ROLE_CATALOG_IDS.ROLE_INSPECTS })
    ]
  });
  const actorContext = resolveRecipeActor({
    session,
    recipe: { actor: { type: RECIPE_ACTOR_TYPES.ROLE } },
    input: { actorIds: ['role_inspects-0'] }
  });

  assert.equal(actorContext.ok, true);
  assert.equal(actorContext.actorType, RECIPE_ACTOR_TYPES.ROLE);
  assert.deepEqual(actorContext.actorIds, ['role_inspects-0']);
  assert.equal(actorContext.primaryActor.id, 'role_inspects-0');
});

test('actorModel resuelve actores group desde stage.actorIds si input no los declara', () => {
  const session = createSession({
    roles: [
      createRole({ id: 'role_set_out_of_play-0', roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY }),
      createRole({ id: 'role_set_out_of_play-1', roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY })
    ]
  });
  const actorContext = resolveRecipeActor({
    session,
    recipe: { actor: { type: RECIPE_ACTOR_TYPES.GROUP } },
    stage: {
      actorIds: ['role_set_out_of_play-0', 'role_set_out_of_play-1']
    }
  });

  assert.equal(actorContext.ok, true);
  assert.equal(actorContext.actorType, RECIPE_ACTOR_TYPES.GROUP);
  assert.deepEqual(actorContext.actorIds, ['role_set_out_of_play-0', 'role_set_out_of_play-1']);
  assert.equal(actorContext.actors.length, 2);
  assert.equal(actorContext.primaryActor.id, 'role_set_out_of_play-0');
});

test('actorModel no materializa role actors para system', () => {
  const session = createSession({
    roles: [
      createRole({ id: 'role_plain-0', roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN })
    ]
  });
  const actorContext = resolveRecipeActor({
    session,
    recipe: { actor: { type: RECIPE_ACTOR_TYPES.SYSTEM } },
    input: { actorIds: ['role_plain-0'] }
  });

  assert.equal(actorContext.ok, true);
  assert.equal(actorContext.actorType, RECIPE_ACTOR_TYPES.SYSTEM);
  assert.deepEqual(actorContext.actorIds, []);
  assert.deepEqual(actorContext.actors, []);
  assert.equal(actorContext.primaryActor, null);
});

test('getActionActors conserva el orden de actorIds unicos', () => {
  const session = createSession({
    roles: [
      createRole({ id: 'role_plain-0', roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN }),
      createRole({ id: 'role_plain-1', roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN })
    ]
  });

  assert.deepEqual(
    getActionActors(session, ['role_plain-1', 'role_plain-1', 'role_plain-0']).map((role) => role.id),
    ['role_plain-1', 'role_plain-0']
  );
});

const inspectRoleAction = getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE);
const setInPlayFalseAction = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY);
const restoreRecentOutOfPlayAction = getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY);
const blockOutOfPlayRecipe = getCatalogRecipe(RECIPE_KEYS.BLOCK_OUT_OF_PLAY);
const linkTargetsAction = getCatalogRecipe(RECIPE_KEYS.LINK_TARGETS);
const setOutOfPlayAfterSelectionRecipe = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
  target: {
    type: MECHANICAL_ENTITY_TYPES.ROLE,
    count: 1,
    filters: [TARGET_FILTER_TYPES.IN_PLAY]
  },
  visibility: VISIBILITY.ALL
});
const selectionOutOfPlayRules = createSelectRules({
  required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
  abstain: SELECT_ABSTAIN_RULES.NOT_ALLOWED,
  unanimous: SELECT_UNANIMOUS_RULES.NOT_REQUIRED,
  tie: SELECT_TIE_RULES.NULL_ON_TIE
});

function createBaseSession({
  groups = [],
  objectiveRules = [],
  selectionRules = [],
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
    selectionRules,
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
  ],
  selectionRules = [
    {
      key: 'members_cannot_vote_other_members_out_of_play',
      type: 'exclude_other_group_members',
      scope: {
        methods: ['vote'],
        recipeKeys: [RECIPE_KEYS.SET_OUT_OF_PLAY]
      }
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
    groupRules,
    selectionRules
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
          type: OBJECTIVE_BENEFICIARY_TYPES.HOLDER
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
    recipes: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)],
    ...overrides
  });
}

function resolveSelectionOutOfPlayStage(session, input = {}, stageOverrides = {}) {
  const poolKey = stageOverrides.poolKey ?? 'poolExposed';
  const sessionWithSelectionStage = withCycle(
    session,
    createCycle({
      poolOrder: [poolKey],
      poolCurrent: poolKey,
      poolNext: poolKey,
      pools: {
        [poolKey]: [createSelectionOutOfPlayStage(stageOverrides)]
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

function withPeekRole(session, { inPlay = true } = {}) {
  return {
    ...session,
    roles: [
      ...session.roles,
      createRole({
        id: 'role_peek-0',
        roleKey: ROLE_CATALOG_IDS.ROLE_PEEK,
        alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
        playerId: 'player-peek',
        seat: 7,
        inPlay,
        stageRules: ROLE_CATALOG[ROLE_CATALOG_IDS.ROLE_PEEK].stageRules
      })
    ]
  };
}

function createGroupHolder(id) {
  return {
    type: OBJECTIVE_HOLDER_TYPES.GROUP,
    id
  };
}

function createStableParityObjectiveRule() {
  return createConclusiveObjectiveRule({
    key: 'alignment_b_reaches_stable_threshold',
    holder: createGroupHolder('group_alignment_b'),
    condition: {
      type: OBJECTIVE_CONDITIONS.HOLDER_REACHES_STABLE_IN_PLAY_PARITY
    }
  });
}

function createStableParitySession(roles = [], { recipeHistory = [] } = {}) {
  const players = roles.map((role, index) => ({
    id: role.playerId ?? `stable-player-${index}`,
    displayName: `Stable Player ${index + 1}`,
    connected: true,
    ready: true
  }));

  return createSession({
    id: 'stable-parity-session',
    definitionId: 'stable-parity',
    players,
    roles,
    groups: [
      createAlignmentGroup(
        ALIGNMENT_IDS.ALIGNMENT_B,
        roles.filter((role) => role.alignmentId === ALIGNMENT_IDS.ALIGNMENT_B).map((role) => role.id)
      )
    ],
    objectiveRules: [createStableParityObjectiveRule()],
    history: {
      recipeHistory
    }
  });
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

function withPrimaryActionEffect(recipe = {}, effect = {}) {
  return {
    ...recipe,
    actions: (recipe.actions ?? []).map((action, index) =>
      index === 0
        ? {
            ...action,
            effect: {
              ...(action.effect ?? {}),
              ...effect
            }
          }
        : action
    )
  };
}

function collectiveSelectionInput(input = {}) {
  return {
    ...input
  };
}

test('validateActionTargets rechaza filtros desconocidos', () => {
  const session = createBaseSession();
  const actor = roleById(session, 'alignment_a_blocker-0');
  const target = roleById(session, 'alignment_a_target-0');
  const validation = validateActionTargets({
    session,
    actor,
    targets: [target],
    action: {
      target: {
        count: 1,
        filters: ['not_a_filter']
      }
    }
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'target/unknown-filter');
  assert.equal(validation.errors[0].filter, 'not_a_filter');
});

test('validateActionTargets aplica filtros not_in_play y same_alignment', () => {
  const session = withInPlayState(createBaseSession(), {
    'alignment_a_target-0': false
  });
  const actor = roleById(session, 'alignment_a_blocker-0');
  const target = roleById(session, 'alignment_a_target-0');
  const validation = validateActionTargets({
    session,
    actor,
    targets: [target],
    action: {
      target: {
        count: 1,
        filters: [TARGET_FILTER_TYPES.NOT_IN_PLAY, TARGET_FILTER_TYPES.SAME_ALIGNMENT]
      }
    }
  });

  assert.equal(validation.ok, true);
});

test('validateActionTargets aplica filtro recently_out_of_play en el ciclo actual', () => {
  const session = appendRecipeHistory(
    withInPlayState(createBaseSession(), {
      'alignment_a_target-0': false
    }),
    {
      cycleId: 0,
      recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
      actionId: ACTION_IDS.SET_IN_PLAY,
      actorIds: ['alignment_b_attacker-0'],
      targetIds: ['alignment_a_target-0'],
      finalEffects: [
        {
          type: EFFECT_TYPES.SET_PROPERTY,
          targetType: MECHANICAL_ENTITY_TYPES.ROLE,
          targetId: 'alignment_a_target-0',
          property: 'inPlay',
          value: false
        }
      ],
      result: HISTORY_RESULTS.APPLIED
    }
  );
  const validation = validateActionTargets({
    session,
    actor: roleById(session, 'alignment_a_blocker-0'),
    targets: [roleById(session, 'alignment_a_target-0')],
    action: {
      target: {
        count: 1,
        filters: [TARGET_FILTER_TYPES.RECENTLY_OUT_OF_PLAY]
      }
    }
  });

  assert.equal(validation.ok, true);
});

test('inspect_role revela roleKey sin modificar la sesion', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, getActionFromRecipe(inspectRoleAction), {
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
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    interPoolQueue: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: STAGE_KEYS.STAGE_02,
        status: STAGE_STATUSES.ENABLED,
        recipes: [actionRecipe(linkTargetsAction, STAGE_RECIPE_KEYS.LINK_TARGETS)]
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
    inspected.session.interPoolQueue[0].key,
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
  assert.equal(linked.session.interPoolQueue.length, 0);
  assert.deepEqual(
    interPoolQueueHistory(linked.session).map((entry) => entry.event),
    ['queued', 'started', 'queued', 'completed', 'started', 'completed']
  );
  assert.equal(stageHistory(linked.session).length, 2);
  assert.equal(stageHistory(linked.session)[0].payload.requestedBy, STAGE_COMPLETION_REQUESTED_BY.PLAYER);
  assert.equal(stageHistory(linked.session)[1].payload.requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('resolveCurrentStage rechaza un stage ejecutable sin recipe declarada', () => {
  const session = createSession({
    ...createBaseSession(),
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    interPoolQueue: [
      createStage({
        key: 'stageMissingAction',
        status: STAGE_STATUSES.ENABLED
      })
    ]
  });
  const resolved = resolveCurrentStage(session, {});

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'stage/missing-recipe');
  assert.equal(
    resolved.session.interPoolQueue[0].status,
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
    recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
  });
  const earlyStage = createStage({
    key: STAGE_KEYS.STAGE_01,
    status: STAGE_STATUSES.ENABLED,
    order: 10,
    actorIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
    recipes: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
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
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        actorIds: ['role-1'],
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      })
    ]
  });

  assert.equal(pool.stages[0].key, pool.stages[1].key);
  assert.notEqual(pool.stages[0].id, pool.stages[1].id);

  const advanced = advanceStageCursor(pool);
  assert.equal(advanced.pool.stages[0].status, STAGE_STATUSES.DONE);
  assert.equal(advanced.pool.stages[1].status, STAGE_STATUSES.ENABLED);
});

test('surfaceModel expone el flujo publico aceptado', () => {
  assert.equal(SURFACE_SCREEN_MODES.HIDDEN, 'screenHidden');
  assert.equal(SURFACE_SCREEN_MODES.READONLY, 'screenReadonly');
  assert.equal(SURFACE_SCREEN_MODES.INTERACTIVE, 'screenInteractive');
  assert.deepEqual(getSurfaceFlowOrder(), [
    SURFACE_FLOW_STEPS.BEFORE_CONCEALED,
    SURFACE_FLOW_STEPS.POOL_CONCEALED,
    SURFACE_FLOW_STEPS.AFTER_CONCEALED,
    SURFACE_FLOW_STEPS.PUBLIC_REVEAL,
    SURFACE_FLOW_STEPS.BEFORE_EXPOSED,
    SURFACE_FLOW_STEPS.POOL_EXPOSED,
    SURFACE_FLOW_STEPS.AFTER_EXPOSED,
    SURFACE_FLOW_STEPS.PRIVATE_HIDE
  ]);
});

test('surfaceModel crea items estructurados para publicReveal', () => {
  const item = createPublicTableStateItem({
    roles: [
      { id: 'role_c-0', playerId: 'player-3', seat: 2, inPlay: true },
      { id: 'role_a-0', playerId: 'player-1', seat: 0, inPlay: false },
      { id: 'role_b-0', playerId: 'player-2', seat: 1, inPlay: true }
    ]
  });

  assert.equal(item.type, SURFACE_ITEM_TYPES.PUBLIC_TABLE_STATE);
  assert.deepEqual(item.recipientRoleIds, ['role_a-0', 'role_b-0', 'role_c-0']);
  assert.deepEqual(item.payload.seats, [
    { seat: 0, roleId: 'role_a-0', playerId: 'player-1', inPlay: false },
    { seat: 1, roleId: 'role_b-0', playerId: 'player-2', inPlay: true },
    { seat: 2, roleId: 'role_c-0', playerId: 'player-3', inPlay: true }
  ]);
});

test('surfaceModel crea mensajes temporales y resultados de efecto', () => {
  const message = createSurfaceMessage({
    messageKey: MESSAGE_KEYS.ROLE_STATE_REVEALED,
    audience: 'public',
    payload: { role: 'role_reactive-0', property: 'inPlay', value: false },
    expiresOn: SURFACE_MESSAGE_EXPIRATIONS.FINISH_STAGE
  });
  const item = createEffectResultItem({
    recipientRoleIds: ['role_a-0', 'role_b-0'],
    sourceId: 'role_reactive-0',
    targetId: 'role_b-0',
    reason: SURFACE_EFFECT_REASONS.REACTIVE_RESPONSE,
    effect: {
      property: 'inPlay',
      value: false
    }
  });

  assert.deepEqual(message, {
    messageKey: 'role_state_revealed',
    audience: 'public',
    payload: { role: 'role_reactive-0', property: 'inPlay', value: false },
    expiresOn: 'finish_stage'
  });
  assert.deepEqual(item, {
    type: SURFACE_ITEM_TYPES.EFFECT_RESULT,
    recipientRoleIds: ['role_a-0', 'role_b-0'],
    payload: {
      sourceId: 'role_reactive-0',
      targetId: 'role_b-0',
      reason: 'reactive_response',
      effect: {
        property: 'inPlay',
        value: false
      }
    }
  });
});

test('surfaceModel crea items para seleccion concealed', () => {
  const recipientRoleIds = ['role_set_out_of_play-0', 'role_set_out_of_play-1'];
  const draft = createConcealedSelectionDraftItem({
    recipientRoleIds,
    selectorRoleId: 'role_set_out_of_play-0',
    candidateRoleId: 'role_plain-0'
  });
  const submission = createConcealedSelectionSubmissionItem({
    recipientRoleIds,
    selectorRoleId: 'role_set_out_of_play-0',
    candidateRoleId: 'role_plain-0'
  });
  const result = createSelectionResultItem({
    recipientRoleIds: ['role_set_out_of_play-0'],
    outcome: 'null',
    candidateRoleId: null,
    reason: 'no_unanimity'
  });

  assert.deepEqual(draft, {
    type: SURFACE_ITEM_TYPES.CONCEALED_SELECTION_DRAFT,
    recipientRoleIds,
    payload: {
      selectorRoleId: 'role_set_out_of_play-0',
      candidateRoleId: 'role_plain-0'
    }
  });
  assert.deepEqual(submission, {
    type: SURFACE_ITEM_TYPES.CONCEALED_SELECTION_SUBMISSION,
    recipientRoleIds,
    payload: {
      selectorRoleId: 'role_set_out_of_play-0',
      candidateRoleId: 'role_plain-0',
      editable: false
    }
  });
  assert.deepEqual(result, {
    type: SURFACE_ITEM_TYPES.SELECTION_RESULT,
    recipientRoleIds: ['role_set_out_of_play-0'],
    payload: {
      outcome: 'null',
      candidateRoleId: null,
      reason: 'no_unanimity'
    }
  });
});

test('surfaceModel crea items para seleccion exposed publica', () => {
  const recipientRoleIds = ['role_a-0', 'role_b-0', 'role_c-0'];
  const submission = createExposedSelectionSubmissionItem({
    recipientRoleIds,
    selectorRoleId: 'role_a-0',
    candidateRoleId: 'role_b-0',
    weight: 2
  });
  const tally = createSelectionTallyItem({
    recipientRoleIds,
    counts: [
      { candidateRoleId: 'role_b-0', count: 2 },
      { candidateRoleId: 'role_c-0', count: 1 }
    ],
    pendingSelectorRoleIds: ['role_c-0'],
    resolvedByRule: 'selection_counts_double',
    doubleSelectorRoleId: 'role_a-0'
  });
  const result = createSelectionResultItem({
    recipientRoleIds,
    outcome: 'candidate',
    candidateRoleId: 'role_b-0',
    reason: 'selection_counts_double'
  });

  assert.deepEqual(submission, {
    type: SURFACE_ITEM_TYPES.EXPOSED_SELECTION_SUBMISSION,
    recipientRoleIds,
    payload: {
      selectorRoleId: 'role_a-0',
      candidateRoleId: 'role_b-0',
      weight: 2
    }
  });
  assert.deepEqual(tally, {
    type: SURFACE_ITEM_TYPES.SELECTION_TALLY,
    recipientRoleIds,
    payload: {
      counts: [
        { candidateRoleId: 'role_b-0', count: 2 },
        { candidateRoleId: 'role_c-0', count: 1 }
      ],
      pendingSelectorRoleIds: ['role_c-0'],
      resolvedByRule: 'selection_counts_double',
      doubleSelectorRoleId: 'role_a-0'
    }
  });
  assert.deepEqual(result, {
    type: SURFACE_ITEM_TYPES.SELECTION_RESULT,
    recipientRoleIds,
    payload: {
      outcome: 'candidate',
      candidateRoleId: 'role_b-0',
      reason: 'selection_counts_double'
    }
  });
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
          recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
        }),
        createStage({
          id: 'stage-disabled',
          key: STAGE_KEYS.STAGE_02,
          status: STAGE_STATUSES.DISABLED,
          recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
        }),
        createStage({
          id: 'stage-next',
          key: STAGE_KEYS.STAGE_03,
          status: STAGE_STATUSES.ENABLED,
          recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
        })
      ],
      [POOL_KEYS.POOL_EXPOSED]: [
        createStage({
          key: STAGE_KEYS.STAGE_04,
          status: STAGE_STATUSES.ENABLED,
          recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
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
            { type: AVAILABILITY_RULE_TYPES.HAS_EXECUTABLE_RECIPE }
          ],
          any: [
            { type: AVAILABILITY_RULE_TYPES.WITHIN_EXECUTION_WINDOW, firstCycle: 2 },
            { type: AVAILABILITY_RULE_TYPES.ALWAYS_AVAILABLE }
          ]
        },
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      }),
      createStage({
        key: 'finished_stage',
        status: STAGE_STATUSES.FINISHED,
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
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
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      })
    ]
  });
  const validation = validatePool(pool, Object.values(POOL_LIFECYCLE_OPERATION_TYPES));

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'pool/no-runnable-stages');
});

test('interPoolQueue tiene prioridad inicial sin formar parte de pools', () => {
  const session = createSession({
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    interPoolQueue: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
      })
    ],
    cycle: createCycle({
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            recipes: [actionRecipe(blockOutOfPlayRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          })
        ]
      }
    })
  });

  assert.deepEqual(session.cycle.poolOrder, [
    POOL_KEYS.POOL_CONCEALED,
    POOL_KEYS.POOL_EXPOSED
  ]);
  assert.equal(session.currentStageSource, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(getCurrentStage(session).stageKey, STAGE_KEYS.STAGE_01);
});

test('interPoolQueue pendientes no interrumpen el pool hasta cambiar currentStageSource', () => {
  const session = createSession({
    cycle: createCycle({
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
          })
        ]
      }
    })
  });
  const queued = appendInterPoolStage(
    session,
    createStage({
      key: STAGE_KEYS.ROLE_STATE_REVEALED,
      status: STAGE_STATUSES.ENABLED,
      recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
    })
  );

  assert.equal(queued.currentStageSource, CURRENT_STAGE_SOURCES.POOL);
  assert.equal(getCurrentStage(queued).stageKey, STAGE_KEYS.STAGE_02);

  const started = startInterPoolQueue(queued);

  assert.equal(started.currentStageSource, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(getCurrentStage(started).stageKey, STAGE_KEYS.ROLE_STATE_REVEALED);
});

test('interPoolQueue por window se comporta como colas FIFO virtuales', () => {
  const session = createSession();
  const queuedBeforeA = appendInterPoolStage(
    session,
    createStage({
      key: 'stage_before_a',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED }
    })
  );
  const queuedAfter = appendInterPoolStage(
    queuedBeforeA,
    createStage({
      key: 'stage_after',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED }
    })
  );
  const queuedBeforeC = appendInterPoolStage(
    queuedAfter,
    createStage({
      key: 'stage_before_c',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED }
    })
  );
  const startedBefore = startInterPoolQueueForWindow(
    queuedBeforeC,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  const completedBeforeA = completeInterPoolStageForWindow(
    startedBefore.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  const completedBeforeC = completeInterPoolStageForWindow(
    completedBeforeA.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  const startedAfter = startInterPoolQueueForWindow(
    completedBeforeC.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );

  assert.equal(startedBefore.ok, true);
  assert.equal(startedBefore.stage.key, 'stage_before_a');
  assert.equal(getCurrentStage(startedBefore.session).stageKey, 'stage_before_a');
  assert.equal(completedBeforeA.nextStage.key, 'stage_before_c');
  assert.equal(getCurrentStage(completedBeforeA.session).stageKey, 'stage_before_c');
  assert.deepEqual(
    completedBeforeC.session.interPoolQueue.map((stage) => stage.key),
    ['stage_after']
  );
  assert.equal(completedBeforeC.session.currentStageSource, CURRENT_STAGE_SOURCES.POOL);
  assert.equal(startedAfter.stage.key, 'stage_after');
});

test('interPoolQueue por window rechaza stages sin eventWindow', () => {
  const session = appendInterPoolStage(
    createSession(),
    createStage({
      key: 'stage_without_window',
      status: STAGE_STATUSES.ENABLED
    })
  );
  const started = startInterPoolQueueForWindow(
    session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );

  assert.equal(started.ok, false);
  assert.equal(started.errors[0].code, INTER_POOL_QUEUE_ERRORS.MISSING_EVENT_WINDOW);
  assert.equal(interPoolQueueHistory(started.session).at(-1).event, INTER_POOL_QUEUE_HISTORY_OPERATIONS.FAILED);
  assert.equal(
    interPoolQueueHistory(started.session).at(-1).metadata.error.code,
    INTER_POOL_QUEUE_ERRORS.MISSING_EVENT_WINDOW
  );
});

test('selection_counts_double permite al director encolar la interPoolStage inicial una sola vez', () => {
  const disabledSession = createBaseSession();
  const rejected = requestSelectDoubleSelectorStage(disabledSession);
  const enabledSession = createBaseSession({
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    }
  });
  const requested = requestSelectDoubleSelectorStage(enabledSession);
  const repeated = requestSelectDoubleSelectorStage(requested.session);

  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, DOUBLE_SELECTOR_ERRORS.RULE_NOT_ENABLED);
  assert.equal(requested.ok, true);
  assert.equal(requested.session.interPoolQueue.length, 1);
  assert.equal(
    requested.session.interPoolQueue[0].metadata.requestKey,
    DOUBLE_SELECTOR_STAGE_KEYS.SELECT_DOUBLE_SELECTOR
  );
  assert.equal(repeated.ok, false);
  assert.equal(repeated.errors[0].code, DOUBLE_SELECTOR_ERRORS.INITIAL_STAGE_ALREADY_REQUESTED);
});

test('select_double_selector setea doubleSelector=true en el chosen', () => {
  const requested = requestSelectDoubleSelectorStage(
    createBaseSession({
      settings: {
        selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
      }
    })
  );
  const started = startInterPoolQueue(requested.session);
  const resolved = resolveCurrentStage(started, {
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
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').doubleSelector, true);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
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
    recipes: [
      actionRecipe(restoreRecentOutOfPlayAction, STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
      {
        ...actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY),
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
  assert.equal(stage.recipes.length, 2);
  assert.equal(stage.recipes[0].optional, true);
  assert.equal(stage.recipes[1].optional, true);
});

test('getCatalogRecipe materializa solo campos publicos de recipe catalogada', () => {
  const recipe = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
    id: ACTION_IDS.INSPECT_ROLE,
    actor: { type: RECIPE_ACTOR_TYPES.ROLE },
    target: {
      type: MECHANICAL_ENTITY_TYPES.ROLE,
      count: 1,
      filters: [TARGET_FILTER_TYPES.IN_PLAY]
    },
    usage: {
      limit: 1,
      window: CONSTRAINT_WINDOWS.SESSION
    },
    effect: {
      type: EFFECT_TYPES.SET_PROPERTY,
      targetType: MECHANICAL_ENTITY_TYPES.ROLE,
      property: 'inPlay',
      value: true
    },
    unexpected: true
  });

  assert.equal(recipe.actions[0].id, ACTION_IDS.SET_IN_PLAY);
  assert.deepEqual(recipe.actor, { type: RECIPE_ACTOR_TYPES.ROLE });
  assert.deepEqual(recipe.target.filters, [TARGET_FILTER_TYPES.IN_PLAY]);
  assert.equal(recipe.usage.limit, 1);
  assert.deepEqual(recipe.actions[0].effect, {
    type: EFFECT_TYPES.SET_PROPERTY,
    targetType: MECHANICAL_ENTITY_TYPES.ROLE,
    property: 'inPlay',
    value: false
  });
  assert.equal(recipe.key, RECIPE_KEYS.SET_OUT_OF_PLAY);
  assert.equal(recipe.effect, undefined);
  assert.equal(recipe.unexpected, undefined);
  assert.deepEqual(recipe.diagnostics, []);
});

test('validateRecipeContract acepta una recipe valida', () => {
  const validation = validateRecipeContract({
    recipe: getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE),
    input: {
      actorIds: ['role_inspector-0'],
      targetIds: ['hidden_enemy-0']
    }
  });

  assert.equal(validation.ok, true);
});

test('validateRecipeContract rechaza actor role multiple e invalid actor type', () => {
  const multipleRoleActors = validateRecipeContract({
    recipe: getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE),
    input: {
      actorIds: ['role_inspector-0', 'alignment_a_blocker-0'],
      targetIds: ['hidden_enemy-0']
    }
  });
  const invalidActor = validateRecipeContract({
    recipe: {
      ...getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE),
      actor: { type: 'not_actor' }
    },
    input: {
      actorIds: ['role_inspector-0'],
      targetIds: ['hidden_enemy-0']
    }
  });

  assert.equal(multipleRoleActors.ok, false);
  assert.equal(multipleRoleActors.errors[0].code, 'recipe/invalid-role-actor-count');
  assert.equal(invalidActor.ok, false);
  assert.equal(invalidActor.errors[0].code, 'recipe/invalid-actor-type');
});

test('validateRecipeContract rechaza target invalido y filtro desconocido', () => {
  const invalidTarget = validateRecipeContract({
    recipe: {
      ...getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE),
      target: {
        type: 'not_target',
        count: 1,
        filters: [TARGET_FILTER_TYPES.IN_PLAY]
      }
    }
  });
  const invalidFilter = validateRecipeContract({
    recipe: {
      ...getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE),
      target: {
        type: MECHANICAL_ENTITY_TYPES.ROLE,
        count: 1,
        filters: ['not_a_filter']
      }
    }
  });

  assert.equal(invalidTarget.ok, false);
  assert.equal(invalidTarget.errors[0].code, 'recipe/invalid-target-type');
  assert.equal(invalidFilter.ok, false);
  assert.equal(invalidFilter.errors[0].code, 'recipe/unknown-target-filter');
});

test('validateRecipeContract exige count 0 para target session', () => {
  const validation = validateRecipeContract({
    recipe: {
      ...getCatalogRecipe(RECIPE_KEYS.CONCLUDE_PLAY),
      target: {
        type: MECHANICAL_ENTITY_TYPES.SESSION,
        count: 1
      }
    }
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.errors[0].code, 'recipe/invalid-session-target-count');
});

test('getCatalogRecipe ignora campos ajenos sin alterar la recipe catalogada', () => {
  const recipe = getCatalogRecipe(RECIPE_KEYS.SET_OUT_OF_PLAY, {
    id: ACTION_IDS.INSPECT_ROLE,
    effect: { type: EFFECT_TYPES.REVEAL_PROPERTY },
    actions: [getCatalogRecipe(RECIPE_KEYS.INSPECT_ROLE)?.actions?.[0]],
    unexpected: true
  });
  const resolved = resolveRecipe(createBaseSession(), recipe, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(recipe.actions[0].id, ACTION_IDS.SET_IN_PLAY);
  assert.equal(recipe.effect, undefined);
  assert.equal(recipe.unexpected, undefined);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.finalEffects[0].type, EFFECT_TYPES.SET_PROPERTY);
});

test('stageCatalog define y createStage materializa un stage de in-out-of-play', () => {
  const stage = createStage({
    ...getCatalogStage(STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, {
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
    stage.recipes.map((action) => action.key),
    [STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(stage.recipes.every((action) => action.optional === true), true);
  assert.deepEqual(stage.recipes[0].actor, { type: RECIPE_ACTOR_TYPES.ROLE });
  assert.deepEqual(stage.recipes[0].target, {
    type: MECHANICAL_ENTITY_TYPES.ROLE,
    count: 1,
    filters: []
  });
  assert.deepEqual(stage.recipes[0].usage, {
    limit: 1,
    window: CONSTRAINT_WINDOWS.SESSION
  });
  assert.deepEqual(stage.recipes[0].constraints[0], {
    type: CONSTRAINT_TYPES.REQUIRE_SELF_TARGET_WHEN_ACTOR_OUT
  });
  assert.deepEqual(stage.recipes[0].constraints[1], {
    type: CONSTRAINT_TYPES.REQUIRE_RECENT_SET_PROPERTY,
    window: CONSTRAINT_WINDOWS.CURRENT_CYCLE,
    property: 'inPlay',
    value: false,
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
    stageCatalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
  });
  assert.deepEqual(stage.recipes[1].actor, { type: RECIPE_ACTOR_TYPES.ROLE });
  assert.deepEqual(stage.recipes[1].target, {
    type: MECHANICAL_ENTITY_TYPES.ROLE,
    count: 1,
    filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SELF]
  });
  assert.deepEqual(stage.recipes[1].constraints[0], {
    type: CONSTRAINT_TYPES.REQUIRE_ACTOR_IN_PLAY
  });
  assert.deepEqual(stage.recipes[1].usage, {
    limit: 1,
    window: CONSTRAINT_WINDOWS.SESSION
  });
  assert.equal(stage.metadata.catalogId, 'role_in_out_of_play');
});

test('stageCatalog expone los stages mecanicos ya definidos', () => {
  const stages = [
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_INSPECTS, { key: STAGE_KEYS.STAGE_01 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS, { key: STAGE_KEYS.STAGE_02 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_02 }),
    getCatalogStage(STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_03 }),
    getCatalogStage(STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_04 }),
    getCatalogStage(STAGE_CATALOG_IDS.DELIBERATION, { key: STAGE_KEYS.DELIBERATION }),
    getCatalogStage(STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_05 })
  ];

  assert.deepEqual(
    stages.map((stage) => stage.recipes.map((action) => action.key)),
    [
      [STAGE_RECIPE_KEYS.INSPECT_ROLE],
      [STAGE_RECIPE_KEYS.LINK_TARGETS],
      [STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY],
      [STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY],
      [STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY],
      [],
      [STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY]
    ]
  );
  assert.equal(stages.every((stage) => Array.isArray(stage.actorIds)), true);
});

test('stageCatalog deja exposed_set_out_of_play sin restricciones linked implicitas', () => {
  const stage = getCatalogStage(STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY, { key: STAGE_KEYS.STAGE_05 });

  assert.equal(stage.selectionRules.selectorSource, SELECT_SELECTOR_SOURCES.IN_PLAY_ROLES);
  assert.equal(stage.metadata.interaction.participants, SELECT_SELECTOR_SOURCES.IN_PLAY_ROLES);
  assert.equal(stage.metadata.interaction.selectionMethod, 'vote');
  assert.deepEqual(stage.selectionRules.groupRestrictions, []);
});

test('stageCatalog define deliberation como stage publica sin recetas', () => {
  const stage = getCatalogStage(STAGE_CATALOG_IDS.DELIBERATION);

  assert.equal(stage.key, STAGE_KEYS.DELIBERATION);
  assert.deepEqual(stage.recipes, []);
  assert.equal(stage.metadata.catalogId, STAGE_CATALOG_IDS.DELIBERATION);
  assert.equal(stage.metadata.interaction.participants, SELECT_SELECTOR_SOURCES.IN_PLAY_ROLES);
  assert.equal(stage.metadata.interaction.mode, 'deliberation');
  assert.deepEqual(stage.completion.allowedRequesters, [
    STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  ]);
});

test('stageCatalog define concealed_set_out_of_play como seleccion unanime del group actor', () => {
  const stage = getCatalogStage(STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, {
    key: STAGE_KEYS.STAGE_04
  });

  assert.equal(stage.selectionRules.required, SELECT_REQUIRED_RULES.ALL_SELECTORS);
  assert.equal(stage.selectionRules.abstain, SELECT_ABSTAIN_RULES.NOT_ALLOWED);
  assert.equal(stage.selectionRules.unanimous, SELECT_UNANIMOUS_RULES.REQUIRED);
  assert.equal(stage.selectionRules.tie, SELECT_TIE_RULES.NULL_ON_TIE);
});

test('stageCatalog define role_state_revealed como stage informativa de interPoolQueue', () => {
  const stage = getCatalogStage(STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);

  assert.equal(stage.key, STAGE_KEYS.ROLE_STATE_REVEALED);
  assert.deepEqual(stage.recipes, []);
  assert.deepEqual(stage.completion.allowedRequesters, [
    STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  ]);
  assert.equal(stage.metadata.catalogId, STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);
});

test('roleCatalog declara roles mecanicos y razones de orden', () => {
  const catalog = getCoreRoleCatalog();
  const byKey = Object.fromEntries(catalog.map((roleDefinition) => [roleDefinition.key, roleDefinition]));

  assert.deepEqual(
    [
      byKey[ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_INSPECTS].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_BLOCKS_OUT_OF_PLAY].stageDefinitions[0].poolKey,
      byKey[ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY].stageDefinitions[0].poolKey
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
  assert.equal(byKey[ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY].stageDefinitions[0].order, 40);
  assert.equal(
    byKey[ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY].stageDefinitions[0].metadata.orderReason.includes(
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
  const concealedGroup = catalog.find(
    (groupDefinition) => groupDefinition.key === GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
  );
  const exposedGroup = catalog.find(
    (groupDefinition) => groupDefinition.key === GROUP_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY
  );
  const concealedStageDefinition = concealedGroup.stageDefinitions[0];
  const deliberationStageDefinition = exposedGroup.stageDefinitions[0];
  const exposedStageDefinition = exposedGroup.stageDefinitions[1];

  assert.equal(concealedGroup.membershipRule.type, 'alignment');
  assert.equal(concealedGroup.membershipRule.alignmentId, 'alignment_b');
  assert.equal(concealedStageDefinition.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(concealedStageDefinition.order, 30);
  assert.deepEqual(
    concealedStageDefinition.recipes.map((action) => action.key),
    [STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(
    concealedStageDefinition.metadata.orderReason.includes('same-cycle restore'),
    true
  );
  assert.equal(exposedGroup.membershipRule.type, 'all_roles');
  assert.equal(deliberationStageDefinition.metadata.catalogId, STAGE_CATALOG_IDS.DELIBERATION);
  assert.equal(deliberationStageDefinition.poolKey, POOL_KEYS.POOL_EXPOSED);
  assert.equal(deliberationStageDefinition.order, 5);
  assert.deepEqual(deliberationStageDefinition.recipes, []);
  assert.equal(exposedStageDefinition.poolKey, POOL_KEYS.POOL_EXPOSED);
  assert.equal(exposedStageDefinition.order, 10);
  assert.equal(exposedStageDefinition.metadata.catalogId, STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY);
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
  assert.equal(pool.stages[0].recipes[0].key, STAGE_RECIPE_KEYS.INSPECT_ROLE);
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
        { seat: 3, role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' }
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
  assert.equal(built.interPoolQueue.length, 0);
  assert.equal(built.pools.poolConcealed.stages.length, 5);
  assert.deepEqual(
    built.pools.poolConcealed.stages.map((stage) => stage.order),
    [5, 10, 20, 30, 40]
  );
  assert.deepEqual(built.pools.poolConcealed.stages[0].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_LINKS_TARGETS}-0`
  ]);
  assert.deepEqual(built.pools.poolConcealed.stages[3].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`
  ]);
});

test('role reactive crea un stage de interPoolQueue al recibir inPlay=false desde concealed_set_out_of_play', () => {
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
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' },
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
            metadata: {
              catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
            },
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const firstResolution = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStage(firstResolution.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const reactiveRevealCompleted = completeCurrentStage(completed.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const specialResolution = resolveCurrentStage(reactiveRevealCompleted.session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`]
  });

  assert.equal(firstResolution.ok, true);
  assert.equal(roleById(firstResolution.session, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`).inPlay, false);
  assert.equal(firstResolution.result.events.length, 1);
  assert.equal(firstResolution.result.eventResponses.length, 2);
  assert.equal(firstResolution.session.interPoolQueue.length, 2);
  assert.equal(
    firstResolution.session.interPoolQueue[0].metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(
    firstResolution.session.interPoolQueue[0].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  assert.equal(firstResolution.session.interPoolQueue[0].metadata.reveal.roleId, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`);
  assert.deepEqual(firstResolution.session.interPoolQueue[1].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`
  ]);
  assert.equal(
    firstResolution.session.interPoolQueue[1].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(reactiveRevealCompleted.stageAdvance.reason, 'next-special-stage');
  assert.equal(specialResolution.ok, true);
  assert.equal(roleById(specialResolution.session, `${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`).inPlay, false);
  assert.equal(specialResolution.session.interPoolQueue.at(-1).metadata.catalogId, STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);
  assert.equal(specialResolution.session.interPoolQueue.at(-1).metadata.reveal.roleId, `${ROLE_CATALOG_IDS.ROLE_INSPECTS}-0`);
});

test('role reactive crea un stage de interPoolQueue al recibir inPlay=false desde exposed_set_out_of_play', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withCycle(
    createSession({
      id: 'reactive-exposed-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' },
        { id: 'player-3', displayName: 'Player 3' }
      ],
      roles: buildRoles(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' },
          { seat: 2, playerId: 'player-3', role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      )
    }),
    createCycle({
      poolCurrent: POOL_KEYS.POOL_EXPOSED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            metadata: {
              catalogId: STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY
            },
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`).inPlay, false);
  assert.equal(resolved.result.events.length, 1);
  assert.equal(resolved.result.eventResponses.length, 2);
  assert.equal(resolved.session.interPoolQueue.length, 2);
  assert.equal(resolved.session.interPoolQueue[0].metadata.catalogId, STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);
  assert.equal(resolved.session.interPoolQueue[0].metadata.reveal.roleId, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`);
  assert.deepEqual(resolved.session.interPoolQueue[1].actorIds, [
    `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`
  ]);
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
});

test('role reactive no reacciona a inPlay=false desde otra stage catalogada', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const session = withCycle(
    createSession({
      id: 'reactive-private-stage-test-session',
      players: [
        { id: 'player-1', displayName: 'Player 1' },
        { id: 'player-2', displayName: 'Player 2' }
      ],
      roles: buildRoles(
        [
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' }
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
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            metadata: {
              catalogId: STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
            },
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`).inPlay, false);
  assert.equal(resolved.result.events.length, 1);
  assert.equal(resolved.result.eventResponses.length, 1);
  assert.equal(resolved.session.interPoolQueue.length, 1);
  assert.equal(resolved.session.interPoolQueue[0].metadata.catalogId, STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);
  assert.equal(resolved.session.interPoolQueue[0].metadata.reveal.roleId, `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`);
});

test('selection_counts_double encola sucesion cuando el holder queda out_of_play', () => {
  const baseSession = createBaseSession({
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    }
  });
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_a_target-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
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
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(resolved.session.interPoolQueue.length, 2);
  assert.equal(
    resolved.session.interPoolQueue[0].metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(resolved.session.interPoolQueue[0].metadata.reveal.roleId, 'alignment_a_target-0');
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.requestKey,
    DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR
  );
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
  assert.deepEqual(resolved.session.interPoolQueue[1].actorIds, ['alignment_a_target-0']);
  assert.equal(
    resolved.session.interPoolQueue[1].selectionRules.selectorEligibility.requireInPlay,
    false
  );
});

test('after_exposed ordena reveal reactive linked y sucesion doubleSelector', () => {
  const roleDefinitions = getCoreRoleCatalog();
  const roleDefinitionMap = Object.fromEntries(roleDefinitions.map((role) => [role.key, role]));
  const baseSession = createSession({
    id: 'after-exposed-order-session',
    players: [
      { id: 'player-1', displayName: 'Player 1' },
      { id: 'player-2', displayName: 'Player 2' },
      { id: 'player-3', displayName: 'Player 3' }
    ],
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    },
    roles: buildRoles(
      [
        { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY, alignmentId: 'alignment_b' },
        { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' },
        { seat: 2, playerId: 'player-3', role: ROLE_CATALOG_IDS.ROLE_PLAIN, alignmentId: 'alignment_a' }
      ],
      roleDefinitionMap
    )
  });
  const session = withCycle(
    {
      ...baseSession,
      roles: baseSession.roles.map((role) =>
        role.id === `${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`
          ? { ...role, doubleSelector: true }
          : role
      ),
      groups: [
        createLinkedGroup({
          id: 'linked-reactive-plain',
          roleIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`, `${ROLE_CATALOG_IDS.ROLE_PLAIN}-0`],
          selectionRules: []
        })
      ]
    },
    createCycle({
      poolCurrent: POOL_KEYS.POOL_EXPOSED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            metadata: {
              catalogId: STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY
            },
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });

  assert.equal(resolved.ok, true);
  assert.deepEqual(
    resolved.session.interPoolQueue.map((stage) => stage.metadata.catalogId ?? stage.metadata.requestKey),
    [
      STAGE_CATALOG_IDS.ROLE_STATE_REVEALED,
      STAGE_CATALOG_IDS.ROLE_REACTIVE_RESPONSE,
      STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT,
      DOUBLE_SELECTOR_STAGE_KEYS.PICK_NEXT_DOUBLE_SELECTOR
    ]
  );
  assert.equal(
    resolved.session.interPoolQueue[0].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
  assert.equal(
    resolved.session.interPoolQueue[2].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
  assert.equal(
    resolved.session.interPoolQueue[3].metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED
  );
});

test('selection_counts_double cancela sucesion pendiente si el holder vuelve inPlay=true', () => {
  const baseSession = createBaseSession({
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    }
  });
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_a_target-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
  const setOut = resolveSelectionOutOfPlayStage(
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
  const restored = resolveAction(setOut.session, getActionFromRecipe(restoreRecentOutOfPlayAction), {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const eventState = processActionResultEvents({
    previousSession: setOut.session,
    session: restored.session,
    actionResult: restored.result
  });

  assert.equal(setOut.session.interPoolQueue.length, 2);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(eventState.session.interPoolQueue.length, 0);
  assert.equal(
    interPoolQueueHistory(eventState.session).at(-1).event,
    'canceled'
  );
});

test('interPoolQueue resuelve stages pendientes antes de conclude_play si pueden alterar outcome', () => {
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
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_REACTIVE, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      ),
      groups: [
        createAlignmentGroup('alignment_b', [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_b_only_group_remains',
          holder: createGroupHolder('group_alignment_b'),
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
            metadata: {
              catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
            },
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`],
    targetIds: [`${ROLE_CATALOG_IDS.ROLE_REACTIVE}-0`]
  });
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.session.status, SESSION_STATUSES.DRAFT);
  assert.equal(resolved.result.objectiveEvaluation, undefined);
  assert.equal(resolved.session.interPoolQueue.length, 2);
  assert.equal(
    resolved.session.interPoolQueue[0].metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.source.metadata.reactionKey,
    'self_out_of_play_creates_special_stage'
  );
  assert.equal(completed.objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(completed.objectiveEvaluation.reason, 'play_outcome_unstable');
  assert.equal(completed.objectiveEvaluation.playOutcome, null);
  assert.equal(completed.objectiveEvaluation.playOutcomeCandidate.conclusive, true);
  assert.deepEqual(completed.objectiveEvaluation.pendingObjectiveInfluenceStageKeys, [
    STAGE_KEYS.ROLE_REACTIVE_RESPONSE
  ]);
  assert.equal(completed.session.interPoolQueue.length, 2);
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(
    completed.stageAdvance.next.stage.metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
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
          { seat: 0, playerId: 'player-1', role: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY, alignmentId: 'alignment_b' },
          { seat: 1, playerId: 'player-2', role: ROLE_CATALOG_IDS.ROLE_INSPECTS, alignmentId: 'alignment_a' }
        ],
        roleDefinitionMap
      ),
      groups: [
        createAlignmentGroup('alignment_b', [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`])
      ],
      objectiveRules: [
        createConclusiveObjectiveRule({
          key: 'alignment_b_only_group_remains',
          holder: createGroupHolder('group_alignment_b'),
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
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: [`${ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY}-0`],
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
  assert.equal(completed.session.interPoolQueue.length, 0);
  assert.deepEqual(
    completed.lifecycleResults.map((entry) => entry.key),
    [
      POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS,
      STAGE_RECIPE_KEYS.CHECK_OBJECTIVES,
      STAGE_RECIPE_KEYS.CONCLUDE_PLAY
    ]
  );
  assert.equal(completed.lifecycleResults[2].result.type, EFFECT_TYPES.CONCLUDE_PLAY);
});

test('cycle inicia un nuevo ciclo antes de entrar en poolConcealed', () => {
  const session = createSession({
    ...createBaseSession(),
    currentStageSource: CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE,
    interPoolQueue: [
      createStage({
        key: STAGE_KEYS.STAGE_01,
        status: STAGE_STATUSES.ENABLED,
        recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
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
            recipes: [actionRecipe(blockOutOfPlayRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          })
        ],
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
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
    [STAGE_RECIPE_KEYS.CHECK_OBJECTIVES]
  );
  assert.equal(completed.lifecycleResults[0].result.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.equal(completed.session.cycle.id, 1);
  assert.equal(cycleHistory(completed.session).at(-1).event, 'started');
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
  assert.equal(built.session.interPoolQueue.length, 0);
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

test('resolveCurrentStage exige recipeKey cuando un stage ofrece varias recipes', () => {
  const session = withCycle(
    createBaseSession({
      groups: [
        createGroup({
          key: GROUP_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
          roleIds: ['alignment_b_attacker-0', 'hidden_enemy-0']
        })
      ]
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
            recipes: [
              actionRecipe(
                {
                  ...setInPlayFalseAction,
                  effect: {
                    ...setInPlayFalseAction.effect,
                    value: true
                  }
                },
                STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)
            ]
          }
        ]
      }
    })
  );
  const missingRecipeKey = resolveCurrentStage(session, {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const selectedAction = resolveCurrentStage(session, {
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(missingRecipeKey.ok, false);
  assert.equal(missingRecipeKey.errors[0].code, 'stage/missing-recipe-key');
  assert.equal(selectedAction.ok, true);
  assert.equal(lastFinishedRecipeHistory(selectedAction.session).metadata.context.stageKey, STAGE_KEYS.STAGE_03);
  assert.equal(
    lastFinishedRecipeHistory(selectedAction.session).payload.recipeKey,
    STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY
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
            recipes: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(resolved.stageAdvance, null);
  assert.equal(completed.ok, true);
  assert.equal(
    completed.session.cycle.pools.poolExposed.stages[0].status,
    STAGE_STATUSES.DONE
  );
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(
    completed.stageAdvance.next.stage.metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
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
            recipes: [actionRecipe(setOutOfPlayAfterSelectionRecipe, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
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
            recipes: [actionRecipe(blockOutOfPlayRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          }
        ]
      }
    })
  );
  const blocking = resolveCurrentStage(session, {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const attackAfterBlocking = resolveAction(blocking.session, getActionFromRecipe(setInPlayFalseAction), {
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
            recipes: [actionRecipe(blockOutOfPlayRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
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

test('recipeHistory registra stage, efectos finales y cambios impedidos', () => {
  const session = withCycle(
    createBaseSession(),
    createCycle({
      poolOrder: ['poolConcealed'],
      poolCurrent: 'poolConcealed',
      poolNext: 'poolConcealed',
      pools: {
        poolConcealed: [
          getCatalogStage(STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, {
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_b_attacker-0', 'hidden_enemy-0'],
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          })
        ]
      }
    })
  );
  const resolved = resolveCurrentStage(session, {
    actorIds: ['alignment_b_attacker-0', 'hidden_enemy-0'],
    selections: createSelections({
      'alignment_b_attacker-0': 'alignment_a_target-0',
      'hidden_enemy-0': 'alignment_a_target-0'
    })
  });

  assert.equal(resolved.ok, true);

  const historyEntry = lastFinishedRecipeHistory(resolved.session);
  const appliedEntries = findAppliedSetPropertyHistory(resolved.session, {
    cycleId: historyEntry.metadata.context.cycleId,
    property: 'inPlay',
    value: false,
    targetId: 'alignment_a_target-0',
    stageCatalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY
  });

  assert.equal(historyEntry.metadata.context.stageId, resolved.stage.stageId);
  assert.equal(historyEntry.metadata.context.stageKey, STAGE_KEYS.STAGE_04);
  assert.equal(historyEntry.metadata.context.stageCatalogId, STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY);
  assert.equal(historyEntry.payload.recipeKey, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY);
  assert.equal(historyEntry.payload.result, HISTORY_RESULTS.APPLIED);
  assert.deepEqual(historyEntry.payload.actorContract, { type: RECIPE_ACTOR_TYPES.GROUP });
  assert.deepEqual(historyEntry.payload.targetContract, {
    type: MECHANICAL_ENTITY_TYPES.ROLE,
    count: 1,
    filters: [TARGET_FILTER_TYPES.IN_PLAY, TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT]
  });
  assert.equal(historyEntry.payload.finalEffects[0].property, 'inPlay');
  assert.equal(historyEntry.payload.finalEffects[0].value, false);
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
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            recipes: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)
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
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
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
  assert.equal(lastFinishedRecipeHistory(restored.session).metadata.context.stageKey, STAGE_KEYS.STAGE_03);
  assert.equal(
    lastFinishedRecipeHistory(restored.session).payload.recipeKey,
    STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
  );
  assert.equal(lastFinishedRecipeHistory(restored.session).payload.finalEffects[0].value, true);
});

test('un stage con recetas opcionales permanece abierto hasta cierre explicito', () => {
  const preStageSetOut = resolveRecipe(
    createBaseSession(),
    actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY),
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
    STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY
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
            recipes: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              ),
              optionalSetOutRecipe
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStage(session, {
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOut = resolveCurrentStage(restored.session, {
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
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
  assert.equal(completed.ok, true);
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(
    completed.stageAdvance.next.stage.metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(
    completed.session.cycle.pools.poolConcealed.stages[0].status,
    STAGE_STATUSES.DONE
  );
  assert.equal(completed.completion.payload.requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
});

test('completeCurrentStage al terminar poolExposed arranca solo after_exposed', () => {
  const session = withCycle(
    createSession(),
    createCycle({
      poolOrder: [POOL_KEYS.POOL_EXPOSED, POOL_KEYS.POOL_CONCEALED],
      poolCurrent: POOL_KEYS.POOL_EXPOSED,
      poolNext: POOL_KEYS.POOL_CONCEALED,
      pools: {
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            recipes: []
          })
        ],
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_01,
            status: STAGE_STATUSES.ENABLED,
            recipes: []
          })
        ]
      }
    })
  );
  const queuedBeforeConcealed = appendInterPoolStage(
    session,
    createStage({
      key: 'stage_before_concealed_test',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_CONCEALED }
    })
  );
  const queuedAfterExposed = appendInterPoolStage(
    queuedBeforeConcealed,
    createStage({
      key: 'stage_after_exposed_test',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED }
    })
  );
  const completed = completeCurrentStage(queuedAfterExposed, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.source, CURRENT_STAGE_SOURCES.INTER_POOL_QUEUE);
  assert.equal(completed.stageAdvance.next.stage.key, 'stage_after_exposed_test');
  assert.equal(completed.session.currentInterPoolWindow, INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED);
  assert.deepEqual(
    completed.session.interPoolQueue.map((stage) => stage.key),
    ['stage_before_concealed_test', 'stage_after_exposed_test']
  );

  const afterExposedCompleted = completeCurrentStage(completed.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(afterExposedCompleted.ok, true);
  assert.equal(afterExposedCompleted.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(afterExposedCompleted.stageAdvance.next.stage.key, 'stage_before_concealed_test');
  assert.equal(
    afterExposedCompleted.session.currentInterPoolWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_CONCEALED
  );
  assert.deepEqual(
    afterExposedCompleted.session.interPoolQueue.map((stage) => stage.key),
    ['stage_before_concealed_test']
  );
  assert.deepEqual(
    afterExposedCompleted.lifecycleResults.find((entry) => entry.key === 'surface_transition'),
    {
      key: 'surface_transition',
      ok: true,
      result: { step: 'privateHide' },
      errors: [],
      metadata: {
        from: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_EXPOSED,
        to: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_CONCEALED
      }
    }
  );
});

test('completeCurrentStage al terminar poolConcealed encadena after_concealed publicReveal y before_exposed', () => {
  const session = withCycle(
    createSession(),
    createCycle({
      poolOrder: [POOL_KEYS.POOL_CONCEALED, POOL_KEYS.POOL_EXPOSED],
      poolCurrent: POOL_KEYS.POOL_CONCEALED,
      poolNext: POOL_KEYS.POOL_EXPOSED,
      pools: {
        [POOL_KEYS.POOL_CONCEALED]: [
          createStage({
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            recipes: []
          })
        ],
        [POOL_KEYS.POOL_EXPOSED]: [
          createStage({
            key: STAGE_KEYS.STAGE_05,
            status: STAGE_STATUSES.ENABLED,
            recipes: []
          })
        ]
      }
    })
  );
  const queuedBeforeExposed = appendInterPoolStage(
    session,
    createStage({
      key: 'stage_before_exposed_test',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED }
    })
  );
  const queuedAfterConcealed = appendInterPoolStage(
    queuedBeforeExposed,
    createStage({
      key: 'stage_after_concealed_test',
      status: STAGE_STATUSES.ENABLED,
      metadata: { eventWindow: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED }
    })
  );
  const completed = completeCurrentStage(queuedAfterConcealed, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(completed.ok, true);
  assert.equal(completed.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(completed.stageAdvance.next.stage.key, 'stage_after_concealed_test');
  assert.equal(completed.session.currentInterPoolWindow, INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED);
  assert.deepEqual(
    completed.session.interPoolQueue.map((stage) => stage.key),
    ['stage_before_exposed_test', 'stage_after_concealed_test']
  );

  const afterConcealedCompleted = completeCurrentStage(completed.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });

  assert.equal(afterConcealedCompleted.ok, true);
  assert.equal(afterConcealedCompleted.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(afterConcealedCompleted.stageAdvance.next.stage.key, 'stage_before_exposed_test');
  assert.equal(
    afterConcealedCompleted.session.currentInterPoolWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
  );
  assert.deepEqual(
    afterConcealedCompleted.session.interPoolQueue.map((stage) => stage.key),
    ['stage_before_exposed_test']
  );
  assert.deepEqual(
    afterConcealedCompleted.lifecycleResults.find((entry) => entry.key === 'surface_transition'),
    {
      key: 'surface_transition',
      ok: true,
      result: { step: 'publicReveal' },
      errors: [],
      metadata: {
        from: INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED,
        to: INTER_POOL_QUEUE_EVENT_WINDOWS.BEFORE_EXPOSED
      }
    }
  );
});

test('completeCurrentStage respeta allowedRequesters del stage', () => {
  const stage = createStage({
    key: STAGE_KEYS.STAGE_03,
    status: STAGE_STATUSES.ENABLED,
    completion: {
      mode: STAGE_COMPLETION_MODES.MANUAL,
      allowedRequesters: [STAGE_COMPLETION_REQUESTED_BY.DIRECTOR]
    },
    recipes: [actionRecipe(restoreRecentOutOfPlayAction, STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY)]
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
  assert.equal(directorClose.completion.payload.requestedBy, STAGE_COMPLETION_REQUESTED_BY.DIRECTOR);
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
            recipes: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
              )
            ]
          }
        ]
      }
    })
  );
  const restored = resolveCurrentStage(session, {
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
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
            recipes: [actionRecipe(blockOutOfPlayRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            recipes: [actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)]
          },
          {
            key: STAGE_KEYS.STAGE_03,
            status: STAGE_STATUSES.ENABLED,
            recipes: [
              actionRecipe(
                restoreRecentOutOfPlayAction,
                STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY);
  const restoreRecipe = actionRecipe(
    restoreRecentOutOfPlayAction,
    STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
  assert.equal(secondRestore.messages[0].key, MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED);
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
        alignment_a_blocker: { displayName: 'Role in out of play' }
      },
      recipes: {
        restore_recent_out_of_play: { displayName: 'pocion de restauracion' }
      }
    },
    messages: {
      es: {
        [MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED]: {
          role: '{actor}, la {recipe} ya ha sido usada.'
        }
      }
    }
  });
  const session = createBaseSession();
  const message = createMessage({
    id: 'message-1',
    type: MESSAGE_TYPES.GAMEPLAY,
    key: MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED,
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
      recipe: {
        entityType: 'recipe',
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
    'Role in out of play, la pocion de restauracion ya ha sido usada.'
  );
  assert.deepEqual(toToastInput(presented.presentation), {
    message: 'Role in out of play, la pocion de restauracion ya ha sido usada.',
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
        [MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED]: {
          default: 'Uso de accion agotado.'
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
      MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED,
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY);
  const restorePerCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.CURRENT_CYCLE
      }
    },
    STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY);
  const restoreNextCycleRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.NEXT_CYCLE
      }
    },
    STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
  const setOutRecipe = actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY);
  const restoreCurrentOrNextRecipe = actionRecipe(
    {
      ...restoreRecentOutOfPlayAction,
      usage: {
        ...restoreRecentOutOfPlayAction.usage,
        window: CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
      }
    },
    STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY
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
    STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY
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
  assert.equal(lastFinishedRecipeHistory(blockedUse.session).payload.result, 'blocked');
  assert.equal(secondUse.ok, false);
  assert.equal(secondUse.errors[0].code, 'constraint/limited_uses');
});

test('set_in_play(false) cambia inPlay solo en el objetivo directo', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, getActionFromRecipe(setInPlayFalseAction), {
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
  const blockedTarget = resolveAction(blocking.session, getActionFromRecipe(setInPlayFalseAction), {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const unblockedTarget = resolveAction(blocking.session, getActionFromRecipe(setInPlayFalseAction), {
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
  const stageBlockRecipe = withPrimaryActionEffect(blockOutOfPlayRecipe, {
    duration: {
      unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
      offset: 0,
      boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
    }
  });
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
            recipes: [actionRecipe(stageBlockRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
          },
          {
            id: 'stage-after-block',
            key: STAGE_KEYS.STAGE_01,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['role_inspector-0'],
            recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
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
  const nextStageBlockRecipe = withPrimaryActionEffect(blockOutOfPlayRecipe, {
    duration: {
      unit: PROPERTY_BLOCK_DURATION_UNITS.STAGE,
      offset: 1,
      boundary: PROPERTY_BLOCK_BOUNDARIES.BEFORE
    }
  });
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
            recipes: [
              actionRecipe(nextStageBlockRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)
            ]
          },
          {
            id: 'stage-next-set-out',
            key: STAGE_KEYS.STAGE_04,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_b_attacker-0'],
            recipes: [
              actionRecipe(setInPlayFalseAction, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY)
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
  const cycleBlockRecipe = withPrimaryActionEffect(blockOutOfPlayRecipe, {
    duration: {
      unit: PROPERTY_BLOCK_DURATION_UNITS.CYCLE,
      offset: 0,
      boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
    }
  });
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
            recipes: [actionRecipe(inspectRoleAction, STAGE_RECIPE_KEYS.INSPECT_ROLE)]
          }
        ],
        [POOL_KEYS.POOL_EXPOSED]: [
          {
            key: STAGE_KEYS.STAGE_02,
            status: STAGE_STATUSES.ENABLED,
            actorIds: ['alignment_a_blocker-0'],
            recipes: [actionRecipe(cycleBlockRecipe, STAGE_RECIPE_KEYS.BLOCK_OUT_OF_PLAY)]
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
  const linked = resolveAction(session, getActionFromRecipe(linkTargetsAction), {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const eventProcessing = processActionResultEvents({
    previousSession: session,
    session: linked.session,
    actionResult: linked.result,
    context: {
      recipeKey: RECIPE_KEYS.LINK_TARGETS,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      stageCatalogId: STAGE_CATALOG_IDS.ROLE_LINKS_TARGETS
    }
  });
  const recognition = eventProcessing.session.interPoolQueue.find(
    (stage) => stage.metadata?.catalogId === STAGE_CATALOG_IDS.LINKED_TARGET_RECOGNITION
  );

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
  assert.equal(recognition.key, 'stage_linked_target_recognition');
  assert.equal(recognition.metadata.eventWindow, INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED);
  assert.equal(recognition.metadata.visibility, 'linked_members');
  assert.equal(recognition.metadata.directorVisible, true);
  assert.deepEqual(recognition.actorIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
  assert.deepEqual(recognition.metadata.audienceRoleIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
  assert.deepEqual(recognition.metadata.reveals, {
    groupId: 'linked_alignment_a_plain_0_alignment_a_target_0',
    memberRoleIds: [
      'alignment_a_plain-0',
      'alignment_a_target-0'
    ]
  });
  assert.deepEqual(recognition.metadata.causedBy, {
    recipeKey: RECIPE_KEYS.LINK_TARGETS,
    actionId: ACTION_IDS.LINK_TARGETS,
    actorIds: ['role_inspector-0'],
    groupId: 'linked_alignment_a_plain_0_alignment_a_target_0'
  });
});

test('link_targets no registra reconocimiento si no crea group linked', () => {
  const session = createBaseSession();
  const failedLink = resolveAction(session, getActionFromRecipe(linkTargetsAction), {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(failedLink.ok, false);
  assert.equal(failedLink.session.interPoolQueue.length, 0);
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

test('linked encola interPoolStage para propagar inPlay=false hacia roles enlazados', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, getActionFromRecipe(linkTargetsAction), {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const resolved = resolveAction(linked.session, getActionFromRecipe(setInPlayFalseAction), {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  }, {
    poolKey: POOL_KEYS.POOL_CONCEALED
  });
  const eventProcessing = processActionResultEvents({
    previousSession: linked.session,
    session: resolved.session,
    actionResult: resolved.result,
    context: {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  });
  const linkedStage = eventProcessing.session.interPoolQueue.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  const specialStarted = startInterPoolQueueForWindow(
    eventProcessing.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  const propagated = completeCurrentStage(specialStarted.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagatedHistory = lastFinishedRecipeHistory(propagated.session);

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
  assert.equal(resolved.result.finalEffects.length, 1);
  assert.equal(eventProcessing.session.interPoolQueue.length, 2);
  assert.equal(
    linkedStage.metadata.catalogId,
    STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  assert.equal(
    linkedStage.metadata.eventWindow,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  assert.equal(propagated.ok, true);
  assert.equal(propagated.stageAdvance.reason, 'special-stages-before-next-pool');
  assert.equal(
    propagated.session.interPoolQueue.some(
      (stage) =>
        stage.metadata.catalogId === STAGE_CATALOG_IDS.ROLE_STATE_REVEALED &&
        stage.metadata.reveal.roleId === 'alignment_a_plain-0'
    ),
    true
  );
  assert.equal(roleById(propagated.session, 'alignment_a_plain-0').inPlay, false);
  assert.equal(propagatedHistory.payload.recipeKey, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(propagatedHistory.payload.result, HISTORY_RESULTS.APPLIED);
  assert.deepEqual(propagatedHistory.payload.finalEffects[0].causedBy, {
    type: MECHANICAL_ENTITY_TYPES.GROUP,
    id: 'linked_alignment_a_plain_0_alignment_a_target_0'
  });
  assert.deepEqual(propagatedHistory.payload.finalEffects[0].derivedFrom, {
    type: 'group_rule',
    groupId: 'linked_alignment_a_plain_0_alignment_a_target_0',
    groupRuleType: 'propagate_property_change',
    sourceTargetId: 'alignment_a_target-0'
  });
});

test('linked no propaga si el role causal fue restaurado antes de la interPoolStage', () => {
  const session = createBaseSession();
  const linked = resolveAction(session, getActionFromRecipe(linkTargetsAction), {
    actorIds: ['role_inspector-0'],
    targetIds: ['alignment_a_target-0', 'alignment_a_plain-0']
  });
  const setOut = resolveAction(linked.session, getActionFromRecipe(setInPlayFalseAction), {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const setOutEvents = processActionResultEvents({
    previousSession: linked.session,
    session: setOut.session,
    actionResult: setOut.result,
    context: {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  });
  const restored = resolveAction(setOutEvents.session, getActionFromRecipe(restoreRecentOutOfPlayAction), {
    actorIds: ['alignment_a_blocker-0'],
    targetIds: ['alignment_a_target-0']
  });
  const specialStarted = startInterPoolQueueForWindow(
    restored.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  const propagated = completeCurrentStage(
    specialStarted.session,
    {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
    }
  );
  const propagatedHistory = lastFinishedRecipeHistory(propagated.session);

  assert.equal(setOutEvents.session.interPoolQueue.length, 2);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(roleById(propagated.session, 'alignment_a_plain-0').inPlay, true);
  assert.equal(propagatedHistory.payload.recipeKey, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(propagatedHistory.payload.result, HISTORY_RESULTS.NO_EFFECT);
  assert.equal(propagatedHistory.metadata.reason, 'causal_condition_not_met');
});

test('linked_propagated_effect transporta payload dinamico de set_property', () => {
  const baseSession = createBaseSession();
  const session = {
    ...baseSession,
    groups: [
      ...baseSession.groups,
      createLinkedGroup({
        id: 'linked-dynamic-payload',
        roleIds: ['alignment_a_target-0', 'alignment_a_plain-0'],
        groupRules: [
          {
            type: 'propagate_property_change',
            when: { property: 'doubleSelector', value: true },
            apply: { property: 'doubleSelector', value: true },
            targets: 'other_members'
          }
        ],
        selectionRules: []
      })
    ]
  };
  const setDoubleSelector = resolveAction(
    session,
    {
      id: ACTION_IDS.SET_PROPERTY,
      target: {
        type: MECHANICAL_ENTITY_TYPES.ROLE,
        count: 1,
        filters: []
      },
      effect: {
        type: EFFECT_TYPES.SET_PROPERTY,
        targetType: MECHANICAL_ENTITY_TYPES.ROLE,
        property: 'doubleSelector',
        value: true
      }
    },
    {
      actorIds: ['alignment_a_blocker-0'],
      targetIds: ['alignment_a_target-0']
    }
  );
  const setDoubleSelectorEvents = processActionResultEvents({
    previousSession: session,
    session: setDoubleSelector.session,
    actionResult: setDoubleSelector.result,
    context: {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  });
  const interPoolStage = setDoubleSelectorEvents.session.interPoolQueue.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  const specialStarted = startInterPoolQueueForWindow(
    setDoubleSelectorEvents.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  const propagated = completeCurrentStage(specialStarted.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagatedHistory = lastFinishedRecipeHistory(propagated.session);

  assert.equal(setDoubleSelector.ok, true);
  assert.equal(roleById(setDoubleSelector.session, 'alignment_a_target-0').doubleSelector, true);
  assert.notEqual(roleById(setDoubleSelector.session, 'alignment_a_plain-0').doubleSelector, true);
  assert.equal(interPoolStage.metadata.catalogId, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(interPoolStage.metadata.propagatedEffect.property, 'doubleSelector');
  assert.equal(propagated.ok, true);
  assert.equal(roleById(propagated.session, 'alignment_a_plain-0').doubleSelector, true);
  assert.equal(propagatedHistory.payload.recipeKey, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(propagatedHistory.payload.finalEffects[0].property, 'doubleSelector');
  assert.equal(propagatedHistory.payload.result, HISTORY_RESULTS.APPLIED);
});

test('group linked aporta objectiveRule distribuida si sus miembros abarcan varios alignments efectivos', () => {
  const linked = resolveAction(createBaseSession(), getActionFromRecipe(linkTargetsAction), {
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
    type: MECHANICAL_ENTITY_TYPES.GROUP,
    id: 'linked_alignment_a_target_0_alignment_b_target_0'
  });
});

test('groupRule usa causedBy del group al comprobar bloqueos derivados', () => {
  const linked = resolveAction(createBaseSession(), getActionFromRecipe(linkTargetsAction), {
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
    getActionFromRecipe(setInPlayFalseAction),
    {
      actorIds: ['alignment_b_attacker-0'],
      targetIds: ['alignment_a_target-0']
    },
    {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  );
  const propagatedDespiteOriginalActorBlockEvents = processActionResultEvents({
    previousSession: sessionBlockedForOriginalActor,
    session: propagatedDespiteOriginalActorBlock.session,
    actionResult: propagatedDespiteOriginalActorBlock.result,
    context: {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  });
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
  const blockedPropagation = resolveAction(
    sessionBlockedForGroup,
    getActionFromRecipe(setInPlayFalseAction),
    {
      actorIds: ['alignment_b_attacker-0'],
      targetIds: ['alignment_a_target-0']
    },
    {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  );
  const blockedPropagationEvents = processActionResultEvents({
    previousSession: sessionBlockedForGroup,
    session: blockedPropagation.session,
    actionResult: blockedPropagation.result,
    context: {
      poolKey: POOL_KEYS.POOL_CONCEALED
    }
  });
  const propagatedDespiteOriginalActorBlockStarted = startInterPoolQueueForWindow(
    propagatedDespiteOriginalActorBlockEvents.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  const blockedPropagationStarted = startInterPoolQueueForWindow(
    blockedPropagationEvents.session,
    INTER_POOL_QUEUE_EVENT_WINDOWS.AFTER_CONCEALED
  );
  const propagatedDespiteOriginalActorBlockSpecial = completeCurrentStage(
    propagatedDespiteOriginalActorBlockStarted.session,
    { requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR }
  );
  const blockedPropagationSpecial = completeCurrentStage(
    blockedPropagationStarted.session,
    { requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR }
  );

  assert.equal(
    roleById(propagatedDespiteOriginalActorBlock.session, 'alignment_a_target-0').inPlay,
    false
  );
  assert.equal(
    roleById(propagatedDespiteOriginalActorBlockSpecial.session, 'alignment_a_plain-0').inPlay,
    false
  );
  assert.equal(roleById(blockedPropagation.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(blockedPropagationSpecial.session, 'alignment_a_plain-0').inPlay, true);
  assert.deepEqual(lastFinishedRecipeHistory(blockedPropagationSpecial.session).payload.blockedEffects[0].causedBy, {
    type: MECHANICAL_ENTITY_TYPES.GROUP,
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
  const resolved = resolveAction(session, getActionFromRecipe(setInPlayFalseAction), {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: MECHANICAL_ENTITY_TYPES.GROUP,
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
  const resolved = resolveAction(session, getActionFromRecipe(setInPlayFalseAction), {
    actorIds: ['alignment_b_attacker-0'],
    targetIds: ['alignment_a_target-0']
  });

  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.equal(resolved.result.blockedEffects.length, 1);
  assert.deepEqual(resolved.result.finalEffects[1].causedBy, {
    type: MECHANICAL_ENTITY_TYPES.GROUP,
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
          holder: createGroupHolder('group_alignment_b'),
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
      type: MECHANICAL_ENTITY_TYPES.GROUP,
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
    holder: createGroupHolder('group_alignment_b'),
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
    recipes: [setInPlayFalseAction],
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
    holder: createGroupHolder('group_alignment_b'),
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
    recipes: [restoreRecentOutOfPlayAction],
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
        holder: createGroupHolder('group_alignment_b'),
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

test('checkObjectives aplica stable parity si holder supera al resto aunque doubleSelector este fuera', () => {
  const session = createStableParitySession([
    createRole({
      id: 'role_set_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-1'
    }),
    createRole({
      id: 'alignment_b_support-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-2'
    }),
    createRole({
      id: 'alignment_a_double-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      playerId: 'stable-player-a-1',
      metadata: {},
      counters: {},
      flags: {}
    })
  ]);
  const sessionWithDoubleSelector = {
    ...session,
    roles: session.roles.map((role) =>
      role.id === 'alignment_a_double-0' ? { ...role, doubleSelector: true } : role
    )
  };
  const objectiveEvaluation = checkObjectives(sessionWithDoubleSelector);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(
    objectiveEvaluation.fulfilledRules[0].condition,
    OBJECTIVE_CONDITIONS.HOLDER_REACHES_STABLE_IN_PLAY_PARITY
  );
  assert.deepEqual(objectiveEvaluation.fulfilledRules[0].details, {
    holderInPlayCount: 2,
    nonHolderInPlayCount: 1,
    totalInPlayCount: 3,
    stable: true
  });
});

test('checkObjectives no aplica stable parity en igualdad si doubleSelector esta fuera del holder', () => {
  const session = createStableParitySession([
    createRole({
      id: 'role_set_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-1'
    }),
    createRole({
      id: 'alignment_a_double-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      playerId: 'stable-player-a-1'
    })
  ]);
  const sessionWithDoubleSelector = {
    ...session,
    roles: session.roles.map((role) =>
      role.id === 'alignment_a_double-0' ? { ...role, doubleSelector: true } : role
    )
  };
  const objectiveEvaluation = checkObjectives(sessionWithDoubleSelector);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.deepEqual(objectiveEvaluation.fulfilledRules, []);
});

test('checkObjectives aplica stable parity en igualdad si doubleSelector esta en holder', () => {
  const session = createStableParitySession([
    createRole({
      id: 'role_set_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-1'
    }),
    createRole({
      id: 'alignment_a_plain-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_PLAIN,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      playerId: 'stable-player-a-1'
    })
  ]);
  const sessionWithDoubleSelector = {
    ...session,
    roles: session.roles.map((role) =>
      role.id === 'role_set_out_of_play-0' ? { ...role, doubleSelector: true } : role
    )
  };
  const objectiveEvaluation = checkObjectives(sessionWithDoubleSelector);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(
    objectiveEvaluation.fulfilledRules[0].condition,
    OBJECTIVE_CONDITIONS.HOLDER_REACHES_STABLE_IN_PLAY_PARITY
  );
});

test('checkObjectives no aplica stable parity en uno contra uno con role_reactive fuera del holder', () => {
  const session = createStableParitySession([
    createRole({
      id: 'role_set_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-1'
    }),
    createRole({
      id: 'role_reactive-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_REACTIVE,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      playerId: 'stable-player-a-1'
    })
  ]);
  const objectiveEvaluation = checkObjectives(session);

  assert.equal(objectiveEvaluation.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.deepEqual(objectiveEvaluation.fulfilledRules, []);
});

test('checkObjectives aplica stable parity contra role_in_out_of_play salvo que conserve ambas recipes', () => {
  const roles = [
    createRole({
      id: 'role_set_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_SET_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_B,
      playerId: 'stable-player-b-1'
    }),
    createRole({
      id: 'role_in_out_of_play-0',
      roleKey: ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY,
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      playerId: 'stable-player-a-1'
    })
  ];
  const bothRecipesAvailable = checkObjectives(createStableParitySession(roles));
  const restoreAlreadyUsed = checkObjectives(
    createStableParitySession(roles, {
      recipeHistory: [
        createFinishedRecipeHistoryEntry({
          cycleId: 1,
          recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
          actorIds: ['role_in_out_of_play-0'],
          result: HISTORY_RESULTS.APPLIED
        })
      ]
    })
  );
  const setOutAlreadyUsed = checkObjectives(
    createStableParitySession(roles, {
      recipeHistory: [
        createFinishedRecipeHistoryEntry({
          cycleId: 1,
          recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
          actorIds: ['role_in_out_of_play-0'],
          result: HISTORY_RESULTS.APPLIED
        })
      ]
    })
  );

  assert.equal(bothRecipesAvailable.status, OBJECTIVE_EVALUATION_STATUSES.ONGOING);
  assert.equal(restoreAlreadyUsed.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
  assert.equal(setOutAlreadyUsed.status, OBJECTIVE_EVALUATION_STATUSES.FULFILLED);
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
          holder: createGroupHolder('group_alignment_a'),
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
          holder: createGroupHolder('group_linked_finalists'),
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
          holder: createGroupHolder('group_linked_with_third'),
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

test('resolveSelectRound detecta chosen unico por mayoria simple', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_b_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.selectionTally, [
    { candidateId: 'alignment_a_target-0', selectionCount: 2 },
    { candidateId: 'alignment_b_target-0', selectionCount: 1 }
  ]);
});

test('resolveSelectRound rechaza selectores que seleccionan mas de una vez', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/duplicate-selector');
});

test('resolveSelectRound declara nula una seleccion empatada con null_on_tie', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: { tie: SELECT_TIE_RULES.NULL_ON_TIE },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'tied_selection');
  assert.deepEqual(resolved.result.tiedCandidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
});

test('resolveSelectRound aplica peso de selection derivado por selector', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      selectionWeights: [
        {
          selectorId: 'alignment_b_attacker-0',
          value: 2
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.selectionTally, [
    { candidateId: 'alignment_a_target-0', selectionCount: 2 },
    { candidateId: 'alignment_a_plain-0', selectionCount: 1 }
  ]);
});

test('resolveSelectRound calcula supportThreshold con peso efectivo', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0', 'alignment_a_plain-0'],
    selectionRules: {
      selectionWeights: [
        {
          selectorId: 'alignment_b_attacker-0',
          value: 2
        }
      ],
      supportThreshold: {
        type: SELECT_SUPPORT_THRESHOLD_TYPES.MAJORITY,
        base: SELECT_SUPPORT_BASES.SELECTOR_COUNT
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.support, {
    ok: true,
    requiredSupportCount: 3,
    supportBaseCount: 4
  });
});

test('resolveSelectRound desempata por propiedad del selector si eligio un candidate empatado', () => {
  const baseSession = createBaseSession();
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_a_blocker-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      tieBreakers: [
        {
          type: SELECT_TIE_BREAKER_TYPES.SELECTOR_PROPERTY,
          property: 'doubleSelector',
          value: true
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.reason, 'tie_break_selector_property');
  assert.equal(resolved.result.chosenId, 'alignment_a_plain-0');
  assert.deepEqual(resolved.result.tieBreaker, {
    type: SELECT_TIE_BREAKER_TYPES.SELECTOR_PROPERTY,
    selectorId: 'alignment_a_blocker-0',
    candidateId: 'alignment_a_plain-0',
    property: 'doubleSelector',
    value: true
  });
  assert.deepEqual(resolved.result.tiedCandidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
});

test('resolveSelectRound aplica valor de selection derivado de propiedad del selector', () => {
  const baseSession = createBaseSession();
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_b_attacker-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      selectionValueRules: [
        {
          type: SELECT_VALUE_RULE_TYPES.SELECTOR_PROPERTY,
          property: 'doubleSelector',
          value: true,
          selectionValue: 2
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.selectionTally, [
    { candidateId: 'alignment_a_target-0', selectionCount: 2 },
    { candidateId: 'alignment_a_plain-0', selectionCount: 1 }
  ]);
});

test('resolveSelectRound acepta chosen si alcanza mayoria sobre selecciones emitidas', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECT_SUPPORT_THRESHOLD_TYPES.MAJORITY,
        base: SELECT_SUPPORT_BASES.CAST_SELECTIONS
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectRound declara null si chosen no alcanza mayoria sobre selectores', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
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
        type: SELECT_SUPPORT_THRESHOLD_TYPES.MAJORITY,
        base: SELECT_SUPPORT_BASES.SELECTOR_COUNT
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'insufficient_support');
  assert.deepEqual(resolved.result.support, {
    ok: false,
    requiredSupportCount: 4,
    supportBaseCount: 7
  });
});

test('resolveSelectRound declara null si chosen no alcanza fraccion exigida', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECT_SUPPORT_THRESHOLD_TYPES.FRACTION,
        numerator: 2,
        denominator: 3,
        base: SELECT_SUPPORT_BASES.CAST_SELECTIONS
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'insufficient_support');
  assert.equal(resolved.result.support.requiredSupportCount, 4);
  assert.equal(resolved.result.support.supportBaseCount, 6);
});

test('resolveSelectRound acepta chosen si alcanza fraccion exigida', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      supportThreshold: {
        type: SELECT_SUPPORT_THRESHOLD_TYPES.FRACTION,
        numerator: 2,
        denominator: 3,
        base: SELECT_SUPPORT_BASES.CAST_SELECTIONS
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectRound pide runoff cuando la politica de empate lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: { tie: SELECT_TIE_RULES.RUNOFF_ON_TIE },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.TIE);
  assert.equal(resolved.result.reason, 'runoff_required');
  assert.deepEqual(resolved.result.nextRound, {
    roundType: SELECT_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
  });
});

test('resolveSelectRound crea runoff con candidatos empatados por defecto', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECT_RUNOFF_RULES.TIED_CANDIDATES
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0'
  ]);
});

test('resolveSelectRound crea runoff con todos los candidatos seleccionados si asi se define', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECT_RUNOFF_RULES.SELECTED_CANDIDATES
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
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, [
    'alignment_a_plain-0',
    'alignment_a_target-0',
    'alignment_b_target-0'
  ]);
});

test('resolveSelectRound crea runoff con los mismos candidatos si asi se define', () => {
  const session = createBaseSession();
  const candidateIds = ['alignment_a_plain-0', 'alignment_a_target-0', 'alignment_b_target-0'];
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      runoff: SELECT_RUNOFF_RULES.SAME_CANDIDATES,
      candidateIds
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.TIE);
  assert.deepEqual(resolved.result.nextRound.candidateIds, candidateIds);
});

test('resolveSelectRound limita runoff a los objetivos empatados', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    roundType: SELECT_ROUND_TYPES.RUNOFF,
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

test('resolveSelectRound declara nulo un runoff que vuelve a empatar', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    roundType: SELECT_ROUND_TYPES.RUNOFF,
    selectionRules: {
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'runoff_tied');
});

test('resolveSelectRound no pide otra ronda si ya alcanzo repeatLimit', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    roundType: SELECT_ROUND_TYPES.RUNOFF,
    roundIndex: 1,
    selectionRules: {
      tie: SELECT_TIE_RULES.RUNOFF_ON_TIE,
      repeatLimit: 1,
      candidateIds: ['alignment_a_plain-0', 'alignment_a_target-0']
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_plain-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'runoff_tied');
  assert.equal(resolved.result.nextRound, undefined);
});

test('resolveSelectRound puede repetir una seleccion nula si selectionRules lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      abstain: SELECT_ABSTAIN_RULES.ALLOWED,
      nullResult: SELECT_NULL_RULES.REPEAT_ON_NULL,
      repeatLimit: 1
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'all_abstained');
  assert.deepEqual(resolved.result.nextRound, {
    roundType: SELECT_ROUND_TYPES.INITIAL,
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

test('resolveSelectRound exige seleccion de todos los roles inPlay cuando selectionRules.required es all_selectors', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: { required: SELECT_REQUIRED_RULES.ALL_SELECTORS },
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

test('resolveSelectRound permite abstencion explicita cuando la politica lo permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECT_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
  assert.deepEqual(resolved.result.abstainedSelections, [
    {
      selectorId: 'alignment_a_blocker-0',
      candidateId: null,
      abstain: true,
      value: 1,
      roundId: SELECT_ROUND_TYPES.INITIAL,
      metadata: {}
    }
  ]);
});

test('resolveSelectRound rechaza abstencion cuando la politica no la permite', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0'],
    selectionRules: { required: SELECT_REQUIRED_RULES.ALL_SELECTORS },
    selections: [{ selectorId: 'alignment_b_attacker-0', abstain: true }]
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.errors[0].code, 'selection/abstain-not-allowed');
});

test('resolveSelectRound declara nula la seleccion si todos se abstienen', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      abstain: SELECT_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', abstain: true },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'all_abstained');
  assert.deepEqual(resolved.result.selectionTally, []);
});

test('resolveSelectRound ignora abstenciones por defecto aunque superen al target elegido', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      abstain: SELECT_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true },
      { selectorId: 'alignment_a_target-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectRound declara null si la abstencion supera a cualquier target', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      abstain: SELECT_ABSTAIN_RULES.ALLOWED,
      abstainResolution: {
        type: SELECT_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST
      }
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true },
      { selectorId: 'alignment_a_target-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'abstention_highest');
  assert.equal(resolved.result.abstainSelectionCount, 2);
  assert.deepEqual(resolved.result.finalEffects ?? [], []);
});

test('resolveSelectRound exige unanimidad cuando selectionRules.unanimous es required', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      unanimous: SELECT_UNANIMOUS_RULES.REQUIRED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.reason, 'unanimous_candidate');
  assert.equal(resolved.result.chosenId, 'alignment_a_target-0');
});

test('resolveSelectRound declara nula una decision no unanime', () => {
  const session = createBaseSession();
  const resolved = resolveSelectRound({
    session,
    selectorIds: ['alignment_b_attacker-0', 'alignment_a_blocker-0'],
    selectionRules: {
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS,
      unanimous: SELECT_UNANIMOUS_RULES.REQUIRED,
      abstain: SELECT_ABSTAIN_RULES.ALLOWED
    },
    selections: [
      { selectorId: 'alignment_b_attacker-0', candidateId: 'alignment_a_target-0' },
      { selectorId: 'alignment_a_blocker-0', abstain: true }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.reason, 'not_unanimous');
  assert.equal(resolved.result.chosenId, null);
});

test('resolveSelectRound rechaza elegir a un member del group linked por linked si la restriccion esta activa', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-selection-restriction' })
    ]
  });
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      groupRestrictions: [
        {
          type: SELECT_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE,
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

test('resolveSelectRound ignora restricciones de grupo incompletas', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({ id: 'linked-incomplete-restriction' })
    ]
  });
  const resolved = resolveSelectRound({
    session,
    selectionRules: {
      groupRestrictions: [
        {
          type: SELECT_RESTRICTION_TYPES.EXCLUDE_GROUP_MEMBER_CANDIDATE
        }
      ]
    },
    selections: [
      { selectorId: 'alignment_a_plain-0', candidateId: 'alignment_a_target-0' }
    ]
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.type, SELECT_OUTCOME_TYPES.CHOSEN);
});

test('selection pura devuelve chosen sin aplicar efectos', () => {
  const session = createBaseSession();
  const resolved = resolveAction(session, {
    id: ACTION_IDS.SELECT,
    selectionRules: {
      tie: SELECT_TIE_RULES.NULL_ON_TIE,
      required: SELECT_REQUIRED_RULES.ALL_SELECTORS
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
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
    selectionRules: { tie: SELECT_TIE_RULES.NULL_ON_TIE },
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.deepEqual(lastFinishedRecipeHistory(resolved.session).payload.actorIds, []);
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

test('stage exposed_set_out_of_play usa roles inPlay como selectors aunque el grupo conserve todos los actorIds', () => {
  const session = withInPlayState(createBaseSession(), {
    'hidden_enemy-0': false
  });
  const allRoleIds = session.roles.map((role) => role.id);
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    {
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_target-0',
        'alignment_a_plain-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'role_inspector-0': 'alignment_a_target-0'
      })
    },
    {
      actorIds: allRoleIds,
      metadata: { catalogId: STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY },
      selectionRules: createSelectRules({
        ...selectionOutOfPlayRules,
        selectorSource: SELECT_SELECTOR_SOURCES.IN_PLAY_ROLES
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
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
      selectionRules: createSelectRules({
        ...selectionOutOfPlayRules,
        supportThreshold: {
          type: SELECT_SUPPORT_THRESHOLD_TYPES.MAJORITY,
          base: SELECT_SUPPORT_BASES.SELECTOR_COUNT
        }
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
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
      selectionRules: createSelectRules({
        ...selectionOutOfPlayRules,
        abstain: SELECT_ABSTAIN_RULES.ALLOWED,
        abstainResolution: {
          type: SELECT_ABSTAIN_RESOLUTION_TYPES.NULL_IF_HIGHEST
        }
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
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
      selectionRules: createSelectRules({
        ...selectionOutOfPlayRules,
        abstain: SELECT_ABSTAIN_RULES.ALLOWED
      })
    }
  );
  const completed = completeCurrentStage(resolved.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR,
    reason: 'director_closed_null_selection_stage'
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
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
      selectionRules: createSelectRules({
        required: SELECT_REQUIRED_RULES.ALL_SELECTORS
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
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
      selectionRules: createSelectRules({
        ...selectionOutOfPlayRules,
        tie: SELECT_TIE_RULES.RUNOFF_ON_TIE
      })
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.TIE);
  assert.equal(resolved.result.selection.reason, 'runoff_required');
  assert.equal(resolved.result.selection.chosenId, null);
  assert.deepEqual(resolved.result.selection.nextRound, {
    roundType: SELECT_ROUND_TYPES.RUNOFF,
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
    roundType: SELECT_ROUND_TYPES.RUNOFF,
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
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
});

test('stage con seleccion y set_out_of_play encola propagacion linked cuando el chosen esta enlazado', () => {
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
  const revealCompleted = completeCurrentStage(startInterPoolQueue(resolved.session), {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagated = completeCurrentStage(revealCompleted.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagatedHistory = lastFinishedRecipeHistory(propagated.session);

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
  assert.equal(resolved.result.finalEffects.length, 1);
  assert.equal(resolved.session.interPoolQueue.length, 2);
  assert.equal(
    resolved.session.interPoolQueue[0].metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(
    resolved.session.interPoolQueue[1].metadata.catalogId,
    STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  assert.equal(resolved.session.interPoolQueue[0].metadata.reveal.roleId, 'alignment_a_target-0');
  assert.equal(revealCompleted.ok, true);
  assert.equal(
    revealCompleted.stageAdvance.next.stage.metadata.catalogId,
    STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  assert.equal(propagated.ok, true);
  assert.equal(propagated.stageAdvance.next.stage.metadata.catalogId, STAGE_CATALOG_IDS.ROLE_STATE_REVEALED);
  assert.equal(roleById(propagated.session, 'alignment_a_plain-0').inPlay, false);
  assert.deepEqual(propagatedHistory.payload.finalEffects[0].causedBy, {
    type: MECHANICAL_ENTITY_TYPES.GROUP,
    id: 'linked_selection_target'
  });
  assert.deepEqual(propagatedHistory.payload.finalEffects[0].derivedFrom, {
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

test('stage con seleccion y set_out_of_play no restringe linked sin selectionRules de grupo', () => {
  const session = createBaseSession({
    groups: [
      createLinkedGroup({
        id: 'linked-selection-no-rules',
        selectionRules: []
      })
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

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.CHOSEN);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
});

test('stage con seleccion recoge restricciones aportadas por groups activos', () => {
  const linked = resolveAction(createBaseSession(), getActionFromRecipe(linkTargetsAction), {
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

test('role_peek registra peekAttempt privado durante la stage observada', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekAttempt: {
        roleId: 'role_peek-0',
        count: 2,
        timestamps: ['2026-07-03T10:00:00.000Z', '2026-07-03T10:00:02.000Z'],
        durationMs: 4000,
        revealedRoleIds: ['alignment_b_attacker-0', 'hidden_enemy-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  const peekAttempt = recipeHistory(resolved.session).find(
    (entry) =>
      entry.event === HISTORY_EVENTS.FINISHED &&
      entry.payload.recipeKey === PEEK_RECIPE_KEYS.PEEK_ATTEMPT
  );
  assert.equal(peekAttempt.payload.actorIds[0], 'role_peek-0');
  assert.equal(peekAttempt.payload.result, HISTORY_RESULTS.NO_EFFECT);
  assert.deepEqual(peekAttempt.payload.finalEffects, []);
  assert.equal(peekAttempt.metadata.visibility, 'private');
  assert.equal(peekAttempt.metadata.stageRuleKey, 'peek_concealed_set_out_of_play');
  assert.equal(peekAttempt.metadata.stageRuleType, 'peek_warning_override');
  assert.equal(peekAttempt.metadata.count, 2);
  assert.deepEqual(peekAttempt.metadata.timestamps, [
    '2026-07-03T10:00:00.000Z',
    '2026-07-03T10:00:02.000Z'
  ]);
  assert.equal(peekAttempt.metadata.durationMs, 4000);
  assert.deepEqual(peekAttempt.metadata.revealedRoleIds, [
    'alignment_b_attacker-0',
    'hidden_enemy-0'
  ]);
});

test('role_peek warning confirmado sustituye el candidate final de set_out_of_play', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-1',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.AFTER_SELECTION,
        confirmingRoleIds: ['alignment_b_target-0', 'hidden_enemy-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(resolved.result.selectedCandidateOverride.candidateRoleId, 'alignment_a_plain-0');
  assert.equal(resolved.result.selectedCandidateOverride.previousCandidateRoleId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, true);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
  assert.deepEqual(resolved.result.finalEffects[0].causedBy, {
    type: PEEK_RECIPE_KEYS.PEEK_WARNING,
    id: 'peek-warning-1'
  });
});

test('role_peek warning confirmado fuerza candidate aunque la seleccion sea nula', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0'],
      peekWarning: {
        id: 'peek-warning-null',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.SELECTION_NULL,
        confirmingRoleIds: ['alignment_b_target-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_plain-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY },
      selectionRules: {
        ...selectionOutOfPlayRules,
        required: SELECT_REQUIRED_RULES.OPTIONAL
      }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.type, SELECT_OUTCOME_TYPES.NULL);
  assert.equal(resolved.result.selectedCandidateOverride.candidateRoleId, 'alignment_a_plain-0');
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
});

test('role_peek warning sin confirmar no sustituye candidate', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-unconfirmed',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.AFTER_SELECTION,
        confirmingRoleIds: ['alignment_b_target-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selectedCandidateOverride, null);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, true);
});

test('role_peek warning confirmado antes de seleccionar resuelve candidate directamente', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-before',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.BEFORE_SELECTION,
        confirmingRoleIds: ['alignment_b_target-0', 'hidden_enemy-0']
      }
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection, null);
  assert.equal(resolved.result.selectedCandidateOverride.candidateRoleId, 'alignment_a_plain-0');
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
});

test('role_peek warning acepta mayoria simple configurable', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-majority',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.AFTER_SELECTION,
        confirmationRule: PEEK_WARNING_CONFIRMATION_RULES.SIMPLE_MAJORITY,
        confirmingRoleIds: ['alignment_b_target-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selectedCandidateOverride.candidateRoleId, 'alignment_a_plain-0');
});

test('role_peek warning no puede apuntar a un target miembro del group', () => {
  const session = withPeekRole(createBaseSession());
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-group-member',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_b_target-0',
        timing: PEEK_WARNING_TIMINGS.AFTER_SELECTION,
        confirmingRoleIds: ['alignment_b_target-0', 'hidden_enemy-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selectedCandidateOverride, null);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_b_target-0').inPlay, true);
});

test('role_peek warning no puede apuntar a un target fuera de juego', () => {
  const session = withInPlayState(withPeekRole(createBaseSession()), {
    'alignment_a_plain-0': false
  });
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      actorIds: ['alignment_b_attacker-0', 'alignment_b_target-0', 'hidden_enemy-0'],
      peekWarning: {
        id: 'peek-warning-out-target',
        issuerRoleId: 'alignment_b_attacker-0',
        targetRoleId: 'alignment_a_plain-0',
        timing: PEEK_WARNING_TIMINGS.AFTER_SELECTION,
        confirmingRoleIds: ['alignment_b_target-0', 'hidden_enemy-0']
      },
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_b_target-0': 'alignment_a_target-0',
        'hidden_enemy-0': 'alignment_a_target-0'
      })
    }),
    {
      key: STAGE_KEYS.STAGE_04,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      metadata: { catalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY }
    }
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selectedCandidateOverride, null);
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
  assert.equal(roleById(resolved.session, 'alignment_a_plain-0').inPlay, false);
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

test('stage con seleccion recoge selection_counts_double desde las reglas de sesion', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.PLAIN],
    selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE],
    roleCatalog: ROLE_CATALOG
  });
  const baseSession = createBaseSession({
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    },
    selectionRules: built.ruleSet.rules.selectionRules
  });
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_b_attacker-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_plain-0',
        'alignment_a_target-0': 'alignment_a_plain-0',
        'alignment_a_plain-0': 'alignment_b_target-0',
        'alignment_b_target-0': 'role_inspector-0',
        'role_inspector-0': 'hidden_enemy-0',
        'hidden_enemy-0': 'alignment_b_target-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.reason, 'tie_break_selector_property');
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
});

test('selection_counts_double cuenta doble aunque no haya empate', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.PLAIN],
    selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE],
    roleCatalog: ROLE_CATALOG
  });
  const baseSession = createBaseSession({
    settings: {
      selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE]
    },
    selectionRules: built.ruleSet.rules.selectionRules
  });
  const session = {
    ...baseSession,
    roles: baseSession.roles.map((role) =>
      role.id === 'alignment_b_attacker-0'
        ? { ...role, doubleSelector: true }
        : role
    )
  };
  const resolved = resolveSelectionOutOfPlayStage(
    session,
    collectiveSelectionInput({
      selections: createSelections({
        'alignment_b_attacker-0': 'alignment_a_target-0',
        'alignment_a_blocker-0': 'alignment_a_target-0',
        'alignment_a_target-0': 'alignment_a_plain-0',
        'alignment_a_plain-0': 'alignment_a_plain-0',
        'alignment_b_target-0': 'alignment_b_target-0',
        'role_inspector-0': 'role_inspector-0',
        'hidden_enemy-0': 'hidden_enemy-0'
      })
    })
  );

  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.selection.reason, 'single_highest_selection_count');
  assert.equal(resolved.result.selection.chosenId, 'alignment_a_target-0');
  assert.equal(roleById(resolved.session, 'alignment_a_target-0').inPlay, false);
});

test('catalogo basico usa formula mecanica anonima para distribuir alignments', () => {
  assert.deepEqual(getBasicAlignmentDistribution(5), {
    [ALIGNMENT_IDS.ALIGNMENT_A]: 4,
    [ALIGNMENT_IDS.ALIGNMENT_B]: 1,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  });
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
  assert.deepEqual(getBasicAlignmentDistribution(20), {
    [ALIGNMENT_IDS.ALIGNMENT_A]: 16,
    [ALIGNMENT_IDS.ALIGNMENT_B]: 4,
    [ALIGNMENT_IDS.ALIGNMENT_UNDEFINED]: 0,
    [ALIGNMENT_IDS.ALIGNMENT_INDEPENDENT]: 0
  });
  assert.equal(getBasicAlignmentDistribution(4), null);
  assert.equal(getBasicAlignmentDistribution(21), null);
});

test('ruleSet basico declara roles listos y bloquea mecanicas incompletas', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const options = Object.fromEntries(
    selectedRuleSet.availableRoles.map((option) => [option.roleKey, option])
  );
  const availableRules = Object.fromEntries(
    selectedRuleSet.availableRules.map((option) => [option.key, option])
  );

  assert.equal(options[BASIC_ROLE_OPTION_KEYS.PLAIN].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.deepEqual(options[BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS].instanceRule, {
    min: 0,
    max: 1,
    step: 1
  });
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE].selectable, true);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.PEEK].support, RULE_SET_SUPPORT_STATUSES.READY);
  assert.equal(options[BASIC_ROLE_OPTION_KEYS.PEEK].selectable, true);
  assert.equal(
    availableRules[BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE].support,
    RULE_SET_SUPPORT_STATUSES.READY
  );
  assert.equal(availableRules[BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE].selectable, true);
  assert.equal(availableRules[BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE].type, 'selectionrule');
});

test('buildRuleSet ensambla solo roles mecanicamente listos', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS,
      BASIC_ROLE_OPTION_KEYS.INSPECTS,
      BASIC_ROLE_OPTION_KEYS.REACTIVE,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });

  assert.equal(built.ok, true);
  assert.equal(built.ruleSet.roles.baseRoles.length, 6);
  assert.equal(built.ruleSet.groups.length, 4);
  assert.equal(built.ruleSet.rules.objectiveRules.length, 3);
  assert.equal(
    built.ruleSet.rules.objectiveRules.find(
      (rule) => rule.key === 'alignment_b_reaches_stable_in_play_parity'
    )?.condition?.type,
    OBJECTIVE_CONDITIONS.HOLDER_REACHES_STABLE_IN_PLAY_PARITY
  );
  assert.deepEqual(
    built.ruleSet.roles.baseRoles.map((role) => role.alignmentId),
    ['alignment_b', 'alignment_a', 'alignment_a', 'alignment_a', 'alignment_a', 'alignment_a']
  );
  const inPlayControl = built.ruleSet.roles.baseRoles.find(
    (role) => role.key === ROLE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
  );
  assert.equal(inPlayControl.stageDefinitions[0].recipes[0].usage.limit, 1);
  assert.equal(inPlayControl.stageDefinitions[0].recipes[1].usage.limit, 1);
});

test('buildSession materializa role_in_out_of_play en poolConcealed despues de set_out_of_play colectivo', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-of-play-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN }
    ],
    validate: false
  });
  const concealedStages = builtSession.session.cycle.pools[POOL_KEYS.POOL_CONCEALED].stages;
  const collectiveSetOutStage = concealedStages.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY
  );
  const inPlayControlStage = concealedStages.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
  );

  assert.equal(builtRuleSet.ok, true);
  assert.equal(builtSession.ok, true);
  assert.deepEqual(
    concealedStages.map((stage) => stage.metadata.catalogId),
    [STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY, STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY]
  );
  assert.deepEqual(collectiveSetOutStage.actorIds, ['role_set_out_of_play-0']);
  assert.deepEqual(inPlayControlStage.actorIds, ['role_in_out_of_play-0']);
  assert.equal(collectiveSetOutStage.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(inPlayControlStage.poolKey, POOL_KEYS.POOL_CONCEALED);
  assert.equal(collectiveSetOutStage.order, 30);
  assert.equal(inPlayControlStage.order, 40);
  assert.deepEqual(
    inPlayControlStage.recipes.map((action) => action.key),
    [STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY, STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY]
  );
});

test('role_in_out_of_play conserva su stage si el concealed set_out_of_play lo acaba de sacar', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-self-restore-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN }
    ],
    validate: false
  });
  const concealedSetOut = resolveCurrentStage(builtSession.session, {
    actorIds: ['role_set_out_of_play-0'],
    selections: createSelections({
      'role_set_out_of_play-0': 'role_in_out_of_play-0'
    })
  });
  const stageReady = completeCurrentStage(concealedSetOut.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const privateSetOutWhileOut = resolveCurrentStage(stageReady.session, {
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
    targetIds: ['role_plain-0']
  });
  const restored = resolveCurrentStage(privateSetOutWhileOut.session, {
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    targetIds: ['role_in_out_of_play-0']
  });
  const privateSetOutAfterRestore = resolveCurrentStage(restored.session, {
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
    targetIds: ['role_plain-0']
  });

  assert.equal(concealedSetOut.ok, true);
  assert.equal(roleById(concealedSetOut.session, 'role_in_out_of_play-0').inPlay, false);
  assert.equal(stageReady.ok, true);
  assert.equal(
    stageReady.stageAdvance.next.stage.metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
  );
  assert.equal(privateSetOutWhileOut.ok, false);
  assert.equal(privateSetOutWhileOut.errors[0].code, 'constraint/require_actor_in_play');
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'role_in_out_of_play-0').inPlay, true);
  assert.equal(privateSetOutAfterRestore.ok, true);
  assert.equal(roleById(privateSetOutAfterRestore.session, 'role_plain-0').inPlay, false);
});

test('role_in_out_of_play fuera de juego solo puede restaurarse a si mismo', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-self-only-restore-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN }
    ],
    validate: false
  });
  const concealedSetOut = resolveCurrentStage(builtSession.session, {
    actorIds: ['role_set_out_of_play-0'],
    selections: createSelections({
      'role_set_out_of_play-0': 'role_in_out_of_play-0'
    })
  });
  const sessionWithAnotherRecentOut = appendRecipeHistory(
    withInPlayState(concealedSetOut.session, {
      'role_plain-0': false
    }),
    {
      cycleId: concealedSetOut.session.cycle.id,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      stageKey: STAGE_KEYS.STAGE_04,
      stageCatalogId: STAGE_CATALOG_IDS.CONCEALED_SET_OUT_OF_PLAY,
      recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
      actionId: ACTION_IDS.SET_IN_PLAY,
      actorIds: ['role_set_out_of_play-0'],
      targetIds: ['role_plain-0'],
      finalEffects: [
        {
          type: EFFECT_TYPES.SET_PROPERTY,
          targetType: MECHANICAL_ENTITY_TYPES.ROLE,
          targetId: 'role_plain-0',
          property: 'inPlay',
          value: false
        }
      ],
      result: HISTORY_RESULTS.APPLIED
    }
  );
  const stageReady = completeCurrentStage(sessionWithAnotherRecentOut, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const restoreOther = resolveCurrentStage(stageReady.session, {
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    targetIds: ['role_plain-0']
  });

  assert.equal(concealedSetOut.ok, true);
  assert.equal(stageReady.stageAdvance.next.stage.metadata.catalogId, STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY);
  assert.equal(restoreOther.ok, false);
  assert.equal(restoreOther.errors[0].code, 'constraint/require_self_target_when_actor_out');
  assert.equal(roleById(restoreOther.session, 'role_plain-0').inPlay, false);
});

test('role_in_out_of_play no habilita su stage si esta out_of_play sin historial concealed propio', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-disabled-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN }
    ],
    validate: false
  });
  const sessionWithActorOut = withInPlayState(builtSession.session, {
    'role_in_out_of_play-0': false
  });
  const prepared = preparePool(
    sessionWithActorOut.cycle.pools[POOL_KEYS.POOL_CONCEALED],
    {
      cycleId: sessionWithActorOut.cycle.id,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      roleStates: sessionWithActorOut.roles,
      session: sessionWithActorOut
    }
  );
  const inOutStage = prepared.pool.stages.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
  );

  assert.equal(prepared.ok, true);
  assert.equal(inOutStage.status, STAGE_STATUSES.DISABLED);
});

test('role_in_out_of_play no habilita su stage por un set_out_of_play de otro stage catalog', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-wrong-stage-history-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN }
    ],
    validate: false
  });
  const sessionWithActorOut = withInPlayState(builtSession.session, {
    'role_in_out_of_play-0': false
  });
  const sessionWithExposedHistory = appendRecipeHistory(sessionWithActorOut, {
    cycleId: sessionWithActorOut.cycle.id,
    poolKey: POOL_KEYS.POOL_EXPOSED,
    stageKey: STAGE_KEYS.STAGE_05,
    stageCatalogId: STAGE_CATALOG_IDS.EXPOSED_SET_OUT_OF_PLAY,
    recipeKey: STAGE_RECIPE_KEYS.SET_OUT_OF_PLAY,
    actionId: ACTION_IDS.SET_IN_PLAY,
    actorIds: ['role_set_out_of_play-0'],
    targetIds: ['role_in_out_of_play-0'],
    finalEffects: [
      {
        type: EFFECT_TYPES.SET_PROPERTY,
        targetType: MECHANICAL_ENTITY_TYPES.ROLE,
        targetId: 'role_in_out_of_play-0',
        property: 'inPlay',
        value: false
      }
    ],
    result: HISTORY_RESULTS.APPLIED
  });
  const prepared = preparePool(
    sessionWithExposedHistory.cycle.pools[POOL_KEYS.POOL_CONCEALED],
    {
      cycleId: sessionWithExposedHistory.cycle.id,
      poolKey: POOL_KEYS.POOL_CONCEALED,
      roleStates: sessionWithExposedHistory.roles,
      session: sessionWithExposedHistory
    }
  );
  const inOutStage = prepared.pool.stages.find(
    (stage) => stage.metadata.catalogId === STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY
  );

  assert.equal(prepared.ok, true);
  assert.equal(inOutStage.status, STAGE_STATUSES.DISABLED);
});

test('role_in_out_of_play restaura el target causal y cancela la propagacion linked pendiente', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY,
      BASIC_ROLE_OPTION_KEYS.PLAIN,
      BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'in-out-linked-cancel-session',
    ruleSet: builtRuleSet.ruleSet,
    seats: [
      { seat: 0, playerId: 'player-1', role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { seat: 1, playerId: 'player-2', role: BASIC_ROLE_OPTION_KEYS.IN_OUT_OF_PLAY },
      { seat: 2, playerId: 'player-3', role: BASIC_ROLE_OPTION_KEYS.PLAIN },
      { seat: 3, playerId: 'player-4', role: BASIC_ROLE_OPTION_KEYS.LINKS_TARGETS }
    ],
    validate: false
  });
  const linkedSession = {
    ...builtSession.session,
    groups: [
      ...builtSession.session.groups,
      createLinkedGroup({
        id: 'linked-in-out-cancel',
        roleIds: ['role_in_out_of_play-0', 'role_plain-0'],
        selectionRules: []
      })
    ]
  };
  const linkedSetupClosed = completeCurrentStage(linkedSession, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const concealedSetOut = resolveCurrentStage(linkedSetupClosed.session, {
    actorIds: ['role_set_out_of_play-0'],
    selections: createSelections({
      'role_set_out_of_play-0': 'role_in_out_of_play-0'
    })
  });
  const inOutStageReady = completeCurrentStage(concealedSetOut.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const restored = resolveCurrentStage(inOutStageReady.session, {
    recipeKey: STAGE_RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY,
    targetIds: ['role_in_out_of_play-0']
  });
  const completedInOutStage = completeCurrentStage(restored.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagated = completeCurrentStage(completedInOutStage.session, {
    requestedBy: STAGE_COMPLETION_REQUESTED_BY.DIRECTOR
  });
  const propagatedHistory = lastFinishedRecipeHistory(propagated.session);

  assert.equal(linkedSetupClosed.ok, true);
  assert.equal(concealedSetOut.ok, true);
  assert.equal(concealedSetOut.session.interPoolQueue.length, 2);
  assert.equal(
    concealedSetOut.session.interPoolQueue[0].metadata.catalogId,
    STAGE_CATALOG_IDS.ROLE_STATE_REVEALED
  );
  assert.equal(
    concealedSetOut.session.interPoolQueue[1].metadata.catalogId,
    STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT
  );
  assert.equal(roleById(concealedSetOut.session, 'role_in_out_of_play-0').inPlay, false);
  assert.equal(inOutStageReady.stageAdvance.next.stage.metadata.catalogId, STAGE_CATALOG_IDS.ROLE_IN_OUT_OF_PLAY);
  assert.equal(restored.ok, true);
  assert.equal(roleById(restored.session, 'role_in_out_of_play-0').inPlay, true);
  assert.equal(restored.session.interPoolQueue.length, 1);
  assert.equal(completedInOutStage.stageAdvance.next.stage.metadata.catalogId, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(roleById(propagated.session, 'role_plain-0').inPlay, true);
  assert.equal(propagatedHistory.payload.recipeKey, STAGE_CATALOG_IDS.LINKED_PROPAGATED_EFFECT);
  assert.equal(propagatedHistory.payload.result, HISTORY_RESULTS.NO_EFFECT);
  assert.equal(propagatedHistory.metadata.reason, 'causal_condition_not_met');
});

test('buildRuleSet materializa selection_counts_double solo si se selecciona la regla', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const withoutRule = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.PLAIN],
    roleCatalog: ROLE_CATALOG
  });
  const withRule = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.PLAIN],
    selectedRuleKeys: [BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE],
    roleCatalog: ROLE_CATALOG
  });

  assert.equal(withoutRule.ok, true);
  assert.deepEqual(withoutRule.ruleSet.rules.selectionRules, []);
  assert.equal(withRule.ok, true);
  assert.deepEqual(withRule.ruleSet.metadata.selectedRuleKeys, [
    BASIC_AVAILABLE_RULE_KEYS.SELECTION_COUNTS_DOUBLE
  ]);
  assert.equal(withRule.ruleSet.rules.selectionRules.length, 1);
  assert.equal(
    withRule.ruleSet.rules.selectionRules[0].key,
    'double_selector_counts_double_in_exposed_vote'
  );
});

test('buildRuleSet materializa role_assumes_role como mecanica lista', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const built = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE],
    roleCatalog: ROLE_CATALOG
  });

  assert.equal(built.ok, true);
  assert.equal(built.ruleSet.roles.baseRoles[0].key, BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE);
  assert.equal(built.ruleSet.roles.baseRoles[0].metadata.extraRoles[0].roleKey, BASIC_ROLE_OPTION_KEYS.PLAIN);
  assert.equal(built.ruleSet.roles.baseRoles[0].metadata.extraRoles[0].count, 2);
});

test('buildSession consume directamente un ruleSet ya construido', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY,
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
        role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY
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
  assert.equal(builtSession.session.groups.length, 4);
  assert.equal(builtSession.session.objectiveRules.length, 3);
  assert.deepEqual(builtSession.session.cycle.poolOrder, [
    POOL_KEYS.POOL_CONCEALED,
    POOL_KEYS.POOL_EXPOSED
  ]);
});

test('buildSession anade dos role_plain assumable cuando juega role_assumes_role', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'assumable-roles-session',
    ruleSet: builtRuleSet.ruleSet,
    players: [{ id: 'player-1', displayName: 'Player 1' }],
    seats: [
      {
        seat: 0,
        playerId: 'player-1',
        role: BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE
      }
    ],
    groupDefinitions: []
  });

  assert.equal(builtSession.ok, true);
  assert.equal(builtSession.session.roles.length, 3);
  assert.equal(builtSession.session.assumableRoles.length, 2);
  assert.deepEqual(
    builtSession.session.assumableRoles.map((roleId) => roleById(builtSession.session, roleId).roleKey),
    [BASIC_ROLE_OPTION_KEYS.PLAIN, BASIC_ROLE_OPTION_KEYS.PLAIN]
  );
  assert.equal(roleById(builtSession.session, builtSession.session.assumableRoles[0]).inPlay, false);
});

test('buildSession crea ids unicos para assumableRoles declarados por varios roles', () => {
  const roleDefinitions = [
    defineRole({
      key: 'assumer_a',
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      metadata: {
        extraRoles: [
          { roleKey: BASIC_ROLE_OPTION_KEYS.PLAIN, count: 1, assumable: true }
        ]
      }
    }),
    defineRole({
      key: 'assumer_b',
      alignmentId: ALIGNMENT_IDS.ALIGNMENT_A,
      metadata: {
        extraRoles: [
          { roleKey: BASIC_ROLE_OPTION_KEYS.PLAIN, count: 1, assumable: true }
        ]
      }
    }),
    ROLE_CATALOG[BASIC_ROLE_OPTION_KEYS.PLAIN]
  ];
  const builtSession = buildSession({
    id: 'multi-assumable-session',
    players: [
      { id: 'player-1', displayName: 'Player 1' },
      { id: 'player-2', displayName: 'Player 2' }
    ],
    seats: [
      { seat: 0, playerId: 'player-1', role: 'assumer_a' },
      { seat: 1, playerId: 'player-2', role: 'assumer_b' }
    ],
    roleDefinitions,
    groupDefinitions: []
  });

  assert.equal(builtSession.ok, true);
  assert.deepEqual(builtSession.session.assumableRoles, ['role_plain-0', 'role_plain-1']);
});

test('assume_role reemplaza totalmente la identidad por un role assumable elegido', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'assume-role-session',
    ruleSet: builtRuleSet.ruleSet,
    players: [{ id: 'player-1', displayName: 'Player 1' }],
    seats: [
      {
        seat: 0,
        playerId: 'player-1',
        role: BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE
      }
    ],
    cycle: { id: 1 },
    groupDefinitions: []
  });
  const targetId = builtSession.session.assumableRoles[1];
  const resolved = resolveCurrentStage(builtSession.session, {
    targetIds: [targetId]
  });

  assert.equal(resolved.ok, true);
  assert.equal(roleById(resolved.session, targetId).roleKey, BASIC_ROLE_OPTION_KEYS.PLAIN);
  assert.equal(roleById(resolved.session, targetId).playerId, 'player-1');
  assert.equal(roleById(resolved.session, targetId).seat, 0);
  assert.equal(roleById(resolved.session, targetId).inPlay, true);
  assert.equal(roleById(resolved.session, `${BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE}-0`).playerId, null);
  assert.equal(roleById(resolved.session, `${BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE}-0`).inPlay, false);
  assert.deepEqual(resolved.session.assumableRoles, [builtSession.session.assumableRoles[0]]);
  assert.equal(resolved.result.finalEffects[0].type, EFFECT_TYPES.REPLACE_ROLE_IDENTITY);
});

test('assume_role fuerza role_set_out_of_play si las dos sobrantes son set_out_of_play', () => {
  const selectedRuleSet = getCatalogRuleSet(RULE_SET_CATALOG_IDS.BASIC_RULE_SET);
  const builtRuleSet = buildRuleSet({
    selectedRuleSet,
    selectedRoleKeys: [
      BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE,
      BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY
    ],
    roleCatalog: ROLE_CATALOG
  });
  const builtSession = buildSession({
    id: 'forced-assume-role-session',
    ruleSet: builtRuleSet.ruleSet,
    players: [{ id: 'player-1', displayName: 'Player 1' }],
    seats: [
      {
        seat: 0,
        playerId: 'player-1',
        role: BASIC_ROLE_OPTION_KEYS.ASSUMES_ROLE
      }
    ],
    unassignedRoles: [
      { role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY },
      { role: BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY }
    ],
    cycle: { id: 1 }
  });
  const resolved = resolveCurrentStage(builtSession.session, {
    acknowledged: true
  });

  assert.equal(builtSession.ok, true);
  assert.deepEqual(
    builtSession.session.assumableRoles.map((roleId) => roleById(builtSession.session, roleId).roleKey),
    [BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY, BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY]
  );
  assert.equal(resolved.ok, true);
  assert.equal(resolved.result.forced, true);
  assert.equal(roleById(resolved.session, builtSession.session.assumableRoles[0]).playerId, 'player-1');
  assert.equal(roleById(resolved.session, builtSession.session.assumableRoles[0]).roleKey, BASIC_ROLE_OPTION_KEYS.SET_OUT_OF_PLAY);
  assert.deepEqual(resolved.session.assumableRoles, [builtSession.session.assumableRoles[1]]);
});

test('catalogo de mensajes distingue keys implementadas y planificadas con audiencia', () => {
  assert.equal(
    MESSAGE_CATALOG[MESSAGE_KEYS.RECIPE_USAGE_LIMIT_REACHED].status,
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

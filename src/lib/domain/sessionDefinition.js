// sessionDefinition.js
// -----------------------------------------------------------------------------
// Constructor de sesiones de juego.
//
// La sesion es el estado vivo de una partida. Agrupa players, roles,
// grupos, pools e historiales. No guarda en disco ni toca UI.
// -----------------------------------------------------------------------------

import { createPlayer } from './playerDefinition.js';
import { buildPools } from './poolDefinition.js';
import { createCycle } from './cycleModel.js';
import { createGroup } from './groupDefinition.js';
import { buildGroups } from './groupModel.js';
import { buildRoles, createRole } from './roleDefinition.js';
import { assignUniqueStageIds, createStage } from './stageDefinition.js';
import { CURRENT_STAGE_SOURCES, SESSION_STATUSES, normalizeId } from './sessionModel.js';
import { validateSession } from './sessionValidation.js';

function getAssumableRoleIds(roles = []) {
  return (roles ?? [])
    .filter((role) =>
      role?.metadata?.assumable === true &&
      !role?.playerId &&
      role?.seat === null
    )
    .map((role) => role.id);
}

function createSessionGroup(groupInput = {}) {
  const group = createGroup(groupInput);

  return {
    id: group.id,
    key: group.key,
    ...(group.type ? { type: group.type } : {}),
    active: group.active,
    createdCycleId: group.createdCycleId,
    sourceActionId: group.sourceActionId,
    roleIds: group.roleIds,
    groupRules: group.groupRules,
    selectionRules: group.selectionRules,
    objectiveRules: group.objectiveRules,
    metadata: { ...group.metadata }
  };
}

export function createSession({
  id,
  definitionId = null,
  status = SESSION_STATUSES.DRAFT,
  settings = {},
  players = [],
  roles = [],
  groups = [],
  cycle = createCycle(),
  specialStages = [],
  currentStageSource = specialStages.length > 0
    ? CURRENT_STAGE_SOURCES.SPECIAL_STAGES
    : CURRENT_STAGE_SOURCES.POOL,
  objectiveRules = [],
  selectionRules = [],
  assumableRoles = null,
  achievedObjectives = [],
  playOutcome = null,
  recipeHistory = [],
  cycleHistory = [],
  poolHistory = [],
  stageHistory = [],
  specialStagesHistory = [],
  sessionMessageLog = [],
  errorLog = [],
  log = [],
  metadata = {}
} = {}) {
  const normalizedSpecialStages = assignUniqueStageIds(
    specialStages.map((stage) => createStage(stage))
  );
  const normalizedSpecialStagesHistory =
    specialStagesHistory.length > 0
      ? [...specialStagesHistory]
      : normalizedSpecialStages.flatMap((stage, index) => [
          {
            id: `special-stage-${stage.key ?? 'stage'}-queued-${index}`,
            cycleId: cycle?.id ?? 0,
            stageId: stage.id,
            stageKey: stage.key ?? null,
            operation: 'queued',
            metadata: { initial: true }
          },
          ...(currentStageSource === CURRENT_STAGE_SOURCES.SPECIAL_STAGES && index === 0
            ? [
                {
                  id: `special-stage-${stage.key ?? 'stage'}-started-${index}`,
                  cycleId: cycle?.id ?? 0,
                  stageId: stage.id,
                  stageKey: stage.key ?? null,
                  operation: 'started',
                  metadata: { initial: true }
                }
              ]
            : [])
        ]);

  const normalizedRoles = roles.map(createRole);

  return {
    id: id || `session-${Date.now()}`,
    definitionId: definitionId ? normalizeId(definitionId) : null,
    status,
    settings: { ...settings },
    players: players.map(createPlayer),
    roles: normalizedRoles,
    groups: groups.map(createSessionGroup),
    cycle: createCycle(cycle),
    specialStages: normalizedSpecialStages,
    currentStageSource,
    objectiveRules: [...objectiveRules],
    selectionRules: [...selectionRules],
    assumableRoles: assumableRoles ? [...assumableRoles] : getAssumableRoleIds(normalizedRoles),
    achievedObjectives: [...achievedObjectives],
    playOutcome,
    recipeHistory: [...recipeHistory],
    cycleHistory: [...cycleHistory],
    poolHistory: [...poolHistory],
    stageHistory: [...stageHistory],
    specialStagesHistory: normalizedSpecialStagesHistory,
    sessionMessageLog: [...sessionMessageLog],
    errorLog: [...errorLog],
    log: [...log],
    metadata: { ...metadata }
  };
}

function getRoleDefinitionMap(roleDefinitions = {}) {
  if (Array.isArray(roleDefinitions)) {
    return Object.fromEntries(roleDefinitions.map((role) => [normalizeId(role?.key), role]));
  }

  return Object.fromEntries(
    Object.entries(roleDefinitions ?? {}).map(([key, role]) => [
      normalizeId(role?.key ?? key),
      role
    ])
  );
}

function getDefinitionList(definitions = []) {
  if (Array.isArray(definitions)) return definitions;
  return Object.values(definitions ?? {});
}

function getNextRoleCount(roles = [], roleKey = null) {
  const normalizedRoleKey = normalizeId(roleKey);
  return (roles ?? []).filter((role) => role.roleKey === normalizedRoleKey).length;
}

function getCounterValue(counters, key) {
  return counters.get(key) ?? 0;
}

function consumeRoleCount(counters, roleKey, baseCount = 0) {
  const normalizedRoleKey = normalizeId(roleKey);
  const count = baseCount + getCounterValue(counters, normalizedRoleKey);
  counters.set(normalizedRoleKey, getCounterValue(counters, normalizedRoleKey) + 1);
  return count;
}

function buildAssumableRole({
  ownerRole,
  roleKey,
  roleDefinition,
  count
}) {
  const normalizedRoleKey = normalizeId(roleKey);

  return createRole({
    id: `${normalizedRoleKey}-${count}`,
    roleKey: normalizedRoleKey,
    alignmentId: roleDefinition?.alignmentId ?? null,
    playerId: null,
    seat: null,
    inPlay: false,
    reactions: roleDefinition?.reactions ?? [],
    stageRules: roleDefinition?.stageRules ?? [],
    flags: roleDefinition?.defaultFlags ?? {},
    counters: roleDefinition?.defaultCounters ?? {},
    metadata: {
      source: 'assumable_role',
      assumable: true,
      ownerRoleId: ownerRole.id,
      ownerRoleKey: ownerRole.roleKey
    }
  });
}

function buildDeclaredAssumableRoles(assignedRoles = [], roleDefinitionMap = {}) {
  const counters = new Map();

  return assignedRoles.flatMap((ownerRole) => {
    const ownerDefinition = roleDefinitionMap[ownerRole.roleKey] ?? {};
    const extraRoles = ownerDefinition.metadata?.extraRoles ?? [];

    return extraRoles.flatMap((extraRole) => {
      const count = Number.isInteger(extraRole.count) && extraRole.count > 0
        ? extraRole.count
        : 0;
      const roleKey = normalizeId(extraRole.roleKey);
      const roleDefinition = roleDefinitionMap[roleKey] ?? {};

      return Array.from({ length: count }, () =>
        buildAssumableRole({
          ownerRole,
          roleKey,
          roleDefinition,
          count: consumeRoleCount(counters, roleKey, getNextRoleCount(assignedRoles, roleKey))
        })
      );
    });
  });
}

function buildInputAssumableRoles(unassignedRoles = [], roleDefinitionMap = {}, assignedRoles = []) {
  const counters = new Map();

  return (unassignedRoles ?? []).map((roleInput = {}) => {
    const roleKey = normalizeId(roleInput.roleKey ?? roleInput.role ?? roleInput.name);
    const roleDefinition = roleDefinitionMap[roleKey] ?? {};
    const count = consumeRoleCount(counters, roleKey, getNextRoleCount(assignedRoles, roleKey));

    return createRole({
      id: roleInput.id ?? `${roleKey}-${count}`,
      roleKey,
      alignmentId: roleInput.alignmentId ?? roleDefinition.alignmentId ?? null,
      playerId: null,
      seat: null,
      inPlay: false,
      reactions: roleDefinition.reactions ?? [],
      stageRules: roleDefinition.stageRules ?? [],
      flags: roleDefinition.defaultFlags ?? {},
      counters: roleDefinition.defaultCounters ?? {},
      metadata: {
        source: 'assumable_role',
        ...(roleInput.metadata ?? {}),
        assumable: true
      }
    });
  });
}

// Ensambla una sesion desde definiciones ya escogidas.
//
// createSession solo normaliza un estado de sesion. buildSession hace el paso
// superior: asientos -> roles y role/group stages -> cycle.pools.
export function buildSession({
  seats = [],
  ruleSet = null,
  roleDefinitions = null,
  groupDefinitions = null,
  cycle = null,
  roles = [],
  unassignedRoles = [],
  validate = true,
  validationOptions = { requireAssigned: true },
  ...sessionInput
} = {}) {
  const effectiveRoleDefinitions =
    roleDefinitions ?? ruleSet?.roles?.baseRoles ?? {};
  const effectiveGroupDefinitions =
    groupDefinitions ?? ruleSet?.groups ?? [];
  const effectiveObjectiveRules =
    sessionInput.objectiveRules ?? ruleSet?.rules?.objectiveRules ?? [];
  const effectiveSelectionRules =
    sessionInput.selectionRules ?? ruleSet?.rules?.selectionRules ?? [];
  const effectiveSettings = {
    ...(sessionInput.settings ?? {}),
    ...(ruleSet
      ? {
          ruleSetId: ruleSet.id,
          ruleSetVersion: ruleSet.version,
          selectedRuleKeys: [...(ruleSet.metadata?.selectedRuleKeys ?? [])]
        }
      : {})
  };
  const roleDefinitionMap = getRoleDefinitionMap(effectiveRoleDefinitions);
  const builtRoles =
    roles.length > 0
      ? roles.map(createRole)
      : buildRoles(seats, roleDefinitionMap);
  const inputAssumableRoles = buildInputAssumableRoles(unassignedRoles, roleDefinitionMap, builtRoles);
  const declaredAssumableRoles = inputAssumableRoles.length > 0
    ? []
    : buildDeclaredAssumableRoles(builtRoles, roleDefinitionMap);
  const sessionRoles = [
    ...builtRoles,
    ...inputAssumableRoles,
    ...declaredAssumableRoles
  ];
  const sessionBeforePools = createSession({
    ...sessionInput,
    settings: effectiveSettings,
    objectiveRules: effectiveObjectiveRules,
    selectionRules: effectiveSelectionRules,
    roles: sessionRoles,
    groups: []
  });
  const groups = buildGroups(
    sessionBeforePools,
    getDefinitionList(effectiveGroupDefinitions)
  );
  const sessionWithGroups = {
    ...sessionBeforePools,
    groups
  };
  const poolBuild = cycle?.pools
    ? { ok: true, errors: [], pools: cycle.pools, specialStages: sessionInput.specialStages ?? [] }
    : buildPools({
        session: sessionWithGroups,
        roleDefinitions: Object.values(roleDefinitionMap),
        groupDefinitions: effectiveGroupDefinitions
      });

  if (!poolBuild.ok) {
    return {
      ok: false,
      errors: poolBuild.errors,
      session: null
    };
  }

  const sessionWithPools = {
    ...sessionWithGroups,
    cycle: createCycle({
      ...(cycle ?? {}),
      poolOrder:
        cycle?.poolOrder ??
        ruleSet?.poolOrder ??
        sessionWithGroups.cycle?.poolOrder,
      pools: poolBuild.pools
    }),
    specialStages: [...(poolBuild.specialStages ?? [])],
    currentStageSource: (poolBuild.specialStages ?? []).length > 0
      ? CURRENT_STAGE_SOURCES.SPECIAL_STAGES
      : CURRENT_STAGE_SOURCES.POOL
  };
  const validation = validate
    ? validateSession(sessionWithPools, validationOptions)
    : { ok: true, errors: [] };

  return {
    ok: validation.ok,
    errors: validation.errors,
    session: sessionWithPools
  };
}

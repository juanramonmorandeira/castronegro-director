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
import { createQueueOrder } from './queueCatalog.js';
import { validateSession } from './sessionValidation.js';
import {
  HISTORY_COLLECTIONS,
  createSessionHistory
} from './historyModel.js';

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

function createQueues(stages = [], queues = {}, queueOrder = []) {
  const initialQueues = queueOrder.reduce((acc, queueKey) => {
    acc[queueKey] = [];
    return acc;
  }, {});
  const queueEntries = [
    ...Object.entries(queues ?? {}).flatMap(([queueKey, queueStages]) =>
      Array.isArray(queueStages)
        ? queueStages.map((stage) => ({
            queueKey,
            stage: createStage({
              ...stage,
              metadata: {
                ...(stage?.metadata ?? {}),
                queueKey: stage?.metadata?.queueKey ?? queueKey
              }
            })
          }))
        : []
    ),
    ...stages.map((stage) => ({
      queueKey: stage.metadata?.queueKey ?? null,
      stage
    }))
  ];
  const uniqueStages = assignUniqueStageIds(queueEntries.map((entry) => entry.stage));

  return queueEntries.reduce((acc, entry, index) => {
    acc[entry.queueKey] = [...(acc[entry.queueKey] ?? []), uniqueStages[index]];
    return acc;
  }, initialQueues);
}

function getAllQueueStages(queues = {}) {
  return Object.values(queues ?? {}).flatMap((stages) => stages ?? []);
}

function hasDeclaredQueues(queues = {}) {
  return Object.values(queues ?? {}).some((stages) => Array.isArray(stages) && stages.length > 0);
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
  queues = {},
  currentStageSource = null,
  objectiveRules = [],
  selectionRules = [],
  assumableRoles = null,
  achievedObjectives = [],
  playOutcome = null,
  history = {},
  sessionMessageLog = [],
  errorLog = [],
  log = [],
  metadata = {}
} = {}) {
  const normalizedCycleInput = createCycle(cycle);
  const normalizedQueueOrder = normalizedCycleInput.queueOrder ?? createQueueOrder(normalizedCycleInput.poolOrder);
  const normalizedQueues = createQueues(
    [],
    hasDeclaredQueues(queues) ? queues : cycle?.queues ?? {},
    normalizedQueueOrder
  );
  const allQueueStages = getAllQueueStages(normalizedQueues);
  const normalizedCurrentStageSource = currentStageSource
    ?? (allQueueStages.length > 0 ? CURRENT_STAGE_SOURCES.QUEUE : CURRENT_STAGE_SOURCES.POOL);
  const normalizedHistory = createSessionHistory(history);
  const normalizedQueueStageHistory =
    normalizedHistory[HISTORY_COLLECTIONS.QUEUE].length > 0
      ? normalizedHistory[HISTORY_COLLECTIONS.QUEUE]
      : allQueueStages.flatMap((stage, index) => [
          {
            id: `queue-${stage.key ?? 'stage'}-queued-${index}`,
            sequence: index,
            timestamp: new Date().toISOString(),
            event: 'queued',
            actor: { authority: 'system' },
            payload: {
              stageId: stage.id,
              stageKey: stage.key ?? null
            },
            metadata: {
              initial: true,
              context: {
                cycleId: normalizedCycleInput?.id ?? 0,
                poolKey: null,
                stageId: stage.id,
                stageKey: stage.key ?? null,
                stageCatalogId: stage.metadata?.catalogId ?? null,
                queueKey: stage.metadata?.queueKey ?? null
              }
            }
          },
          ...(normalizedCurrentStageSource === CURRENT_STAGE_SOURCES.QUEUE && index === 0
            ? [
                {
                  id: `queue-${stage.key ?? 'stage'}-started-${index}`,
                  sequence: index + allQueueStages.length,
                  timestamp: new Date().toISOString(),
                  event: 'started',
                  actor: { authority: 'system' },
                  payload: {
                    stageId: stage.id,
                    stageKey: stage.key ?? null
                  },
                  metadata: {
                    initial: true,
                    context: {
                      cycleId: normalizedCycleInput?.id ?? 0,
                      poolKey: null,
                      stageId: stage.id,
                      stageKey: stage.key ?? null,
                      stageCatalogId: stage.metadata?.catalogId ?? null,
                      queueKey: stage.metadata?.queueKey ?? null
                    }
                  }
                }
              ]
            : [])
        ]);
  const sessionHistory = {
    ...normalizedHistory,
    [HISTORY_COLLECTIONS.QUEUE]: normalizedQueueStageHistory
  };

  const normalizedRoles = roles.map(createRole);

  return {
    id: id || `session-${Date.now()}`,
    definitionId: definitionId ? normalizeId(definitionId) : null,
    status,
    settings: { ...settings },
    players: players.map(createPlayer),
    roles: normalizedRoles,
    groups: groups.map(createSessionGroup),
    cycle: createCycle({
      ...cycle,
      queues: normalizedQueues,
      queueOrder: normalizedQueueOrder
    }),
    currentStageSource: normalizedCurrentStageSource,
    objectiveRules: [...objectiveRules],
    selectionRules: [...selectionRules],
    assumableRoles: assumableRoles ? [...assumableRoles] : getAssumableRoleIds(normalizedRoles),
    achievedObjectives: [...achievedObjectives],
    playOutcome,
    history: sessionHistory,
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
    ? { ok: true, errors: [], pools: cycle.pools, queues: cycle.queues ?? sessionInput.queues ?? {} }
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
      pools: poolBuild.pools,
      queues: poolBuild.queues
    }),
    currentStageSource: getAllQueueStages(poolBuild.queues ?? {}).length > 0
      ? CURRENT_STAGE_SOURCES.QUEUE
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

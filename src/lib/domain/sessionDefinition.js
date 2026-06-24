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
  achievedObjectives = [],
  playOutcome = null,
  actionHistory = [],
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

  return {
    id: id || `session-${Date.now()}`,
    definitionId: definitionId ? normalizeId(definitionId) : null,
    status,
    settings: { ...settings },
    players: players.map(createPlayer),
    roles: roles.map(createRole),
    groups: groups.map(createSessionGroup),
    cycle: createCycle(cycle),
    specialStages: normalizedSpecialStages,
    currentStageSource,
    objectiveRules: [...objectiveRules],
    selectionRules: [...selectionRules],
    achievedObjectives: [...achievedObjectives],
    playOutcome,
    actionHistory: [...actionHistory],
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
  const sessionBeforePools = createSession({
    ...sessionInput,
    settings: effectiveSettings,
    objectiveRules: effectiveObjectiveRules,
    selectionRules: effectiveSelectionRules,
    roles: builtRoles,
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

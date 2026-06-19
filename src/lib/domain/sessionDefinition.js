// sessionDefinition.js
// -----------------------------------------------------------------------------
// Constructor de sesiones de juego.
//
// La sesion es el estado vivo de una partida. Agrupa players, roles,
// grupos, pools e historiales. No guarda en disco ni toca UI.
// -----------------------------------------------------------------------------

import { createPlayer } from './playerDefinition.js';
import { buildPools, createPool } from './poolDefinition.js';
import { createGroup } from './groupDefinition.js';
import { buildInitialGroups } from './groupModel.js';
import { buildRolesFromSeats, createSessionRole } from './roleDefinition.js';
import { SESSION_STATUSES, normalizeId } from './sessionModel.js';
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
    stageDefinitions: group.stageDefinitions,
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
  stagePools = createPool(),
  specialStages = [],
  specialStagesActive = specialStages.length > 0,
  objectiveRules = [],
  achievedObjectives = [],
  playOutcome = null,
  actionHistory = [],
  stageHistory = [],
  specialStagesHistory = [],
  log = [],
  metadata = {}
} = {}) {
  const normalizedSpecialStagesHistory =
    specialStagesHistory.length > 0
      ? [...specialStagesHistory]
      : specialStages.flatMap((stage, index) => [
          {
            id: `special-stage-${stage.key ?? 'stage'}-queued-${index}`,
            cycleId: metadata?.currentCycleId ?? 0,
            stageKey: stage.key ?? null,
            operation: 'queued',
            metadata: { initial: true }
          },
          ...(specialStagesActive && index === 0
            ? [
                {
                  id: `special-stage-${stage.key ?? 'stage'}-started-${index}`,
                  cycleId: metadata?.currentCycleId ?? 0,
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
    roles: roles.map(createSessionRole),
    groups: groups.map(createSessionGroup),
    stagePools,
    specialStages: [...specialStages],
    specialStagesActive: specialStagesActive === true,
    objectiveRules: [...objectiveRules],
    achievedObjectives: [...achievedObjectives],
    playOutcome,
    actionHistory: [...actionHistory],
    stageHistory: [...stageHistory],
    specialStagesHistory: normalizedSpecialStagesHistory,
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
// superior: asientos -> roles y role/group/default stages -> stagePools.
export function buildSession({
  seats = [],
  roleDefinitions = {},
  groupDefinitions = [],
  defaultStages = [],
  systemStages = [],
  stagePools = null,
  roles = [],
  validate = true,
  validationOptions = { requireAssigned: true },
  ...sessionInput
} = {}) {
  const roleDefinitionMap = getRoleDefinitionMap(roleDefinitions);
  const builtRoles =
    roles.length > 0
      ? roles.map(createSessionRole)
      : buildRolesFromSeats(seats, roleDefinitionMap);
  const sessionBeforePools = createSession({
    ...sessionInput,
    roles: builtRoles,
    groups: []
  });
  const groups = buildInitialGroups(sessionBeforePools, getDefinitionList(groupDefinitions));
  const sessionWithGroups = {
    ...sessionBeforePools,
    groups
  };
  const poolBuild = stagePools
    ? { ok: true, errors: [], stagePools, specialStages: sessionInput.specialStages ?? [] }
    : buildPools({
        session: sessionWithGroups,
        roleDefinitions: Object.values(roleDefinitionMap),
        groupDefinitions,
        defaultStages,
        systemStages
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
    stagePools: poolBuild.stagePools,
    specialStages: [...(poolBuild.specialStages ?? [])],
    specialStagesActive: (poolBuild.specialStages ?? []).length > 0
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

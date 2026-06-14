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
    stepDefinitions: group.stepDefinitions,
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
  stepPools = createPool(),
  sessionObjectiveRules = [],
  achievedObjectives = [],
  playOutcome = null,
  actionHistory = [],
  stepHistory = [],
  log = [],
  metadata = {}
} = {}) {
  return {
    id: id || `session-${Date.now()}`,
    definitionId: definitionId ? normalizeId(definitionId) : null,
    status,
    settings: { ...settings },
    players: players.map(createPlayer),
    roles: roles.map(createSessionRole),
    groups: groups.map(createSessionGroup),
    stepPools,
    sessionObjectiveRules: [...sessionObjectiveRules],
    achievedObjectives: [...achievedObjectives],
    playOutcome,
    actionHistory: [...actionHistory],
    stepHistory: [...stepHistory],
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
// superior: asientos -> roles y role/group/default steps -> stepPools.
export function buildSession({
  seats = [],
  roleDefinitions = {},
  groupDefinitions = [],
  defaultSteps = [],
  systemSteps = [],
  stepPools = null,
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
  const poolBuild = stepPools
    ? { ok: true, errors: [], stepPools }
    : buildPools({
        session: sessionWithGroups,
        roleDefinitions: Object.values(roleDefinitionMap),
        groupDefinitions,
        defaultSteps,
        systemSteps
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
    stepPools: poolBuild.stepPools
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

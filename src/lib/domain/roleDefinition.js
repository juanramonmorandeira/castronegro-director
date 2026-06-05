// roleDefinition.js
// -----------------------------------------------------------------------------
// Constructor y adaptadores de roles.
//
// createRole define un tipo mecanico de rol:
// - a que alignment mecanico pertenece por defecto;
// - que stepDefinitions puede proponer;
// - si necesita estar inPlay para actuar.
//
// createSessionRole crea el estado de ese rol dentro de una sesion concreta.
// Lo mantenemos en este archivo porque no queremos multiplicar archivos
// "InstanceDefinition" para cada objeto del motor.
// -----------------------------------------------------------------------------

import { createActionToken } from './actionTokenDefinition.js';
import { normalizeId } from './sessionModel.js';
import { createStep } from './stepDefinition.js';

export const ROLE_DEFINITION_TYPES = Object.freeze({
  ROLE: 'role',
  SYSTEM: 'system'
});

export function createRole({
  key,
  type = ROLE_DEFINITION_TYPES.ROLE,
  alignmentId = null,
  stepDefinitions = [],
  metadata = {}
} = {}) {
  const normalizedKey = normalizeId(key);

  return {
    key: normalizedKey,
    type: normalizeId(type),
    alignmentId: alignmentId ? normalizeId(alignmentId) : null,
    stepDefinitions: (stepDefinitions ?? []).map(createStep),
    metadata: { ...metadata }
  };
}

export function createSessionRole({
  id,
  roleKey,
  alignmentId = null,
  playerId = null,
  seat = null,
  inPlay = true,
  revealed = false,
  actionTokens = [],
  flags = {},
  counters = {},
  metadata = {}
} = {}) {
  const normalizedRoleKey = normalizeId(roleKey);

  return {
    id: id || `${normalizedRoleKey || 'role'}-0`,
    roleKey: normalizedRoleKey,
    alignmentId: alignmentId ? normalizeId(alignmentId) : null,
    playerId,
    seat,
    inPlay: !!inPlay,
    revealed: !!revealed,
    actionTokens: actionTokens.map(createActionToken),
    flags: { ...flags },
    counters: { ...counters },
    metadata: { ...metadata }
  };
}

// Construye estados de rol a partir de asientos.
//
// Esta funcion traduce una configuracion externa de seating al formato mecanico
// de session.roles. No crea un tipo nuevo de objeto: convierte roles ya
// definidos en roles concretos de sesion.
export function buildRolesFromSeats(seats = [], roleDefinitions = {}) {
  const counters = new Map();

  return (seats ?? []).map((seatEntry = {}, index) => {
    const roleKey = normalizeId(seatEntry.roleKey ?? seatEntry.role ?? seatEntry.name);
    const count = counters.get(roleKey) ?? 0;
    if (roleKey) counters.set(roleKey, count + 1);

    const roleId = seatEntry.id || (roleKey ? `${roleKey}-${count}` : `empty-${index}`);
    const definition = roleDefinitions[roleKey] ?? {};
    const actionTokens = (definition.actionTokens ?? []).map((token, tokenIndex) => ({
      ...token,
      id: token.id || `${roleId}-${normalizeId(token.actionId)}-${tokenIndex}`,
      ownerRoleId: token.ownerRoleId ?? roleId
    }));

    return createSessionRole({
      id: roleId,
      roleKey,
      alignmentId: seatEntry.alignmentId ?? definition.alignmentId ?? null,
      playerId: seatEntry.playerId ?? seatEntry.player_id ?? null,
      seat: Number.isFinite(seatEntry.seat) ? seatEntry.seat : index,
      actionTokens,
      flags: definition.defaultFlags ?? {},
      counters: definition.defaultCounters ?? {},
      metadata: {
        source: 'seating',
        label: seatEntry.label ?? definition.label ?? null
      }
    });
  });
}

// sessionValidation.js
// -----------------------------------------------------------------------------
// Este archivo comprueba si los datos del nucleo tienen sentido.
//
// No crea datos nuevos y no arregla nada automaticamente.
// Solo responde:
// - esta completo?
// - que errores hay?
//
// La idea es que antes de empezar una partida podamos detectar problemas claros:
// - roles sin jugador;
// - roles sin asiento;
// - IDs duplicados;
// - dos roles en el mismo asiento.
// -----------------------------------------------------------------------------

import { CURRENT_STAGE_SOURCES } from './sessionModel.js';
import { DEFAULT_QUEUE_ORDER } from './queueCatalog.js';

// Comprueba si el Match esta completo.
//
// En este nucleo, "Match completo" significa:
// - existe al menos un rol de sesion;
// - cada rol tiene id;
// - cada rol tiene roleKey;
// - cada rol tiene playerId;
// - cada rol tiene seat.
//
// Esto equivale a decir: cada carta/rol en juego esta asignada a un jugador y a
// una posicion de mesa.
export function isMatchComplete(roles = []) {
  const assignedRoles = (roles ?? []).filter((role) => role?.metadata?.assumable !== true);

  return (
    Array.isArray(roles) &&
    assignedRoles.length > 0 &&
    assignedRoles.every(
      (role) =>
        role?.id &&
        role?.roleKey &&
        role?.playerId &&
        role?.seat !== null &&
        role?.seat !== undefined
    )
  );
}

// Comprueba que una lista de objetos no tenga IDs vacios ni duplicados.
//
// "label" sirve para construir mensajes de error mas claros.
//
// Ejemplo:
// validateUniqueIds(players, 'player')
//
// puede devolver:
// [{ code: 'player/duplicate-id', id: 'player-1', ... }]
export function validateUniqueIds(items = [], label = 'item') {
  const seen = new Set();
  const errors = [];

  (items ?? []).forEach((item, index) => {
    if (!item?.id) {
      errors.push({
        code: `${label}/missing-id`,
        message: `${label} at index ${index} has no id`,
        index
      });
      return;
    }
    if (seen.has(item.id)) {
      errors.push({
        code: `${label}/duplicate-id`,
        message: `${label} id "${item.id}" is duplicated`,
        id: item.id,
        index
      });
      return;
    }
    seen.add(item.id);
  });

  return errors;
}

// Valida los roles de sesion.
//
// Comprueba:
// - IDs duplicados;
// - roleKey ausente;
// - playerId ausente, si requireAssigned es true;
// - seat ausente, si requireAssigned es true;
// - seats duplicados.
//
// requireAssigned permite usar la misma funcion en dos momentos distintos:
// - durante configuracion: puede haber roles todavia sin jugador;
// - antes de empezar partida: todo debe estar asignado.
export function validateRoles(roles = [], options = {}) {
  const requireAssigned = options.requireAssigned ?? false;
  const errors = [...validateUniqueIds(roles, 'role')];
  const usedSeats = new Map();

  (roles ?? []).forEach((role, index) => {
    const allowUnassigned =
      role?.metadata?.assumable === true ||
      !!role?.metadata?.replacedByRoleId;

    if (!role?.roleKey) {
      errors.push({
        code: 'role/missing-role',
        message: `role at index ${index} has no roleKey`,
        id: role?.id ?? null,
        index
      });
    }

    if (requireAssigned && !allowUnassigned && !role?.playerId) {
      errors.push({
        code: 'role/missing-player',
        message: `role "${role?.id ?? index}" has no playerId`,
        id: role?.id ?? null,
        index
      });
    }

    if (requireAssigned && !allowUnassigned && (role?.seat === null || role?.seat === undefined)) {
      errors.push({
        code: 'role/missing-seat',
        message: `role "${role?.id ?? index}" has no seat`,
        id: role?.id ?? null,
        index
      });
    }

    if (role?.seat !== null && role?.seat !== undefined) {
      if (usedSeats.has(role.seat)) {
        errors.push({
          code: 'role/duplicate-seat',
          message: `seat "${role.seat}" is used by more than one role`,
          seat: role.seat,
          ids: [usedSeats.get(role.seat), role.id].filter(Boolean),
          index
        });
      } else {
        usedSeats.set(role.seat, role.id);
      }
    }
  });

  return errors;
}

// Valida grupos de sesion.
//
// Un grupo puede estar vacio: linked o flags pueden llenarse mas tarde.
// Lo que si validamos es que, si declara miembros, esos roleIds existan.
export function validateGroups(groups = [], roles = []) {
  const errors = [...validateUniqueIds(groups, 'group')];
  const roleIds = new Set((roles ?? []).map((role) => role.id));

  (groups ?? []).forEach((group, index) => {
    if (!group?.key) {
      errors.push({
        code: 'group/missing-key',
        message: `group at index ${index} has no key`,
        id: group?.id ?? null,
        index
      });
    }

    (group.roleIds ?? []).forEach((roleId) => {
      if (!roleIds.has(roleId)) {
        errors.push({
          code: 'group/missing-role',
          message: `group "${group?.key ?? index}" references missing role "${roleId}"`,
          groupKey: group?.key ?? null,
          roleId,
          index
        });
      }
    });
  });

  return errors;
}

// Valida una sesion completa.
//
// Por ahora solo valida lo esencial:
// - la sesion tiene id;
// - los jugadores no tienen IDs duplicados;
// - las roles son coherentes.
// - los grupos apuntan a roles existentes.
//
// Devuelve siempre un objeto con esta forma:
// {
//   ok: true/false,
//   errors: []
// }
//
// Esto es mas comodo que lanzar errores, porque la UI puede mostrar una lista de
// problemas al usuario en vez de romper la pantalla.
export function validateSession(session = {}, options = {}) {
  const errors = [];

  if (!session?.id) {
    errors.push({
      code: 'session/missing-id',
      message: 'session has no id'
    });
  }

  errors.push(...validateUniqueIds(session.players ?? [], 'player'));
  errors.push(...validateRoles(session.roles ?? [], options));
  errors.push(...validateGroups(session.groups ?? [], session.roles ?? []));

  if (!Object.values(CURRENT_STAGE_SOURCES).includes(session.currentStageSource)) {
    errors.push({
      code: 'session/invalid-current-stage-source',
      message: `session has invalid currentStageSource "${session.currentStageSource}"`
    });
  }

  if (
    session.currentStageSource === CURRENT_STAGE_SOURCES.QUEUE &&
    (session.cycle?.queueOrder ?? DEFAULT_QUEUE_ORDER)
      .every((queueKey) => (session.cycle?.queues?.[queueKey] ?? []).length === 0)
  ) {
    errors.push({
      code: 'session/missing-current-queue-stage',
      message: 'session points to queue but all queues are empty'
    });
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

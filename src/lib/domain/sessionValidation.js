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

// Comprueba si el Match esta completo.
//
// En este nucleo, "Match completo" significa:
// - existe al menos una instancia de rol;
// - cada instancia tiene id;
// - cada instancia tiene roleId;
// - cada instancia tiene playerId;
// - cada instancia tiene seat.
//
// Esto equivale a decir: cada carta/rol en juego esta asignada a un jugador y a
// una posicion de mesa.
export function isMatchComplete(roleInstances = []) {
  return (
    Array.isArray(roleInstances) &&
    roleInstances.length > 0 &&
    roleInstances.every(
      (role) =>
        role?.id &&
        role?.roleId &&
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

// Valida las instancias de rol.
//
// Comprueba:
// - IDs duplicados;
// - roleId ausente;
// - playerId ausente, si requireAssigned es true;
// - seat ausente, si requireAssigned es true;
// - seats duplicados.
//
// requireAssigned permite usar la misma funcion en dos momentos distintos:
// - durante configuracion: puede haber roles todavia sin jugador;
// - antes de empezar partida: todo debe estar asignado.
export function validateRoleInstances(roleInstances = [], options = {}) {
  const requireAssigned = options.requireAssigned ?? false;
  const errors = [...validateUniqueIds(roleInstances, 'role-instance')];
  const usedSeats = new Map();

  (roleInstances ?? []).forEach((role, index) => {
    if (!role?.roleId) {
      errors.push({
        code: 'role-instance/missing-role',
        message: `role instance at index ${index} has no roleId`,
        id: role?.id ?? null,
        index
      });
    }

    if (requireAssigned && !role?.playerId) {
      errors.push({
        code: 'role-instance/missing-player',
        message: `role instance "${role?.id ?? index}" has no playerId`,
        id: role?.id ?? null,
        index
      });
    }

    if (requireAssigned && (role?.seat === null || role?.seat === undefined)) {
      errors.push({
        code: 'role-instance/missing-seat',
        message: `role instance "${role?.id ?? index}" has no seat`,
        id: role?.id ?? null,
        index
      });
    }

    if (role?.seat !== null && role?.seat !== undefined) {
      if (usedSeats.has(role.seat)) {
        errors.push({
          code: 'role-instance/duplicate-seat',
          message: `seat "${role.seat}" is used by more than one role instance`,
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

// Valida relaciones entre instancias de rol.
//
// Comprueba:
// - IDs duplicados;
// - type ausente;
// - que cada relacion apunte a instancias existentes;
// - que una relacion tenga al menos dos participantes.
export function validateRelations(relations = [], roleInstances = []) {
  const errors = [...validateUniqueIds(relations, 'relation')];
  const roleInstanceIds = new Set((roleInstances ?? []).map((role) => role.id));

  (relations ?? []).forEach((relation, index) => {
    if (!relation?.type) {
      errors.push({
        code: 'relation/missing-type',
        message: `relation at index ${index} has no type`,
        id: relation?.id ?? null,
        index
      });
    }

    if (!Array.isArray(relation?.roleInstanceIds) || relation.roleInstanceIds.length < 2) {
      errors.push({
        code: 'relation/not-enough-members',
        message: `relation "${relation?.id ?? index}" needs at least two roleInstanceIds`,
        id: relation?.id ?? null,
        index
      });
      return;
    }

    relation.roleInstanceIds.forEach((roleInstanceId) => {
      if (!roleInstanceIds.has(roleInstanceId)) {
        errors.push({
          code: 'relation/missing-role-instance',
          message: `relation "${relation?.id ?? index}" references missing role instance "${roleInstanceId}"`,
          id: relation?.id ?? null,
          roleInstanceId,
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
// - las roleInstances son coherentes.
// - las relaciones apuntan a roleInstances existentes.
//
// Devuelve siempre un objeto con esta forma:
// {
//   ok: true/false,
//   errors: []
// }
//
// Esto es mas comodo que lanzar errores, porque la UI puede mostrar una lista de
// problemas al usuario en vez de romper la pantalla.
export function validateGameSession(session = {}, options = {}) {
  const errors = [];

  if (!session?.id) {
    errors.push({
      code: 'session/missing-id',
      message: 'session has no id'
    });
  }

  errors.push(...validateUniqueIds(session.players ?? [], 'player'));
  errors.push(...validateRoleInstances(session.roleInstances ?? [], options));
  errors.push(...validateRelations(session.relations ?? [], session.roleInstances ?? []));

  return {
    ok: errors.length === 0,
    errors
  };
}

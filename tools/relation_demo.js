import {
  RELATION_TYPES,
  buildRoleInstancesFromSeats,
  createGameSession,
  createRelation,
  findRelationsForRole,
  getRelatedRoleInstanceIds,
  hasRelation,
  validateGameSession
} from '../src/lib/domain/index.js';

// ---------------------------------------------------------------------------
// Demo de session.relations
// ---------------------------------------------------------------------------
//
// Esta demo muestra por que linked vive en la sesion y no como flag duplicado
// dentro de cada roleInstance.
//
// La relacion existe una sola vez:
//
//   session.relations -> linked [role_a-0, role_b-0]
//
// Desde ahi podemos preguntar:
// - role_a esta linked?
// - con quien?
// - la relacion sigue activa?
// ---------------------------------------------------------------------------

const roleDefinitions = {
  role_a: {
    factionId: 'team_a'
  },
  role_b: {
    factionId: 'team_b'
  },
  role_c: {
    factionId: 'team_a'
  }
};

const roleInstances = buildRoleInstancesFromSeats(
  [
    { seat: 0, playerId: 'player-1', role: 'role_a' },
    { seat: 1, playerId: 'player-2', role: 'role_b' },
    { seat: 2, playerId: 'player-3', role: 'role_c' }
  ],
  roleDefinitions
);

const linkedRelation = createRelation({
  id: 'linked-role-a-role-b',
  type: RELATION_TYPES.LINKED,
  roleInstanceIds: ['role_a-0', 'role_b-0'],
  active: true,
  createdCycleId: 1,
  sourceActionId: 'link_targets'
});

const session = createGameSession({
  id: 'relation-demo',
  definitionId: 'generic-relation-demo',
  players: [
    { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
    { id: 'player-2', displayName: 'Player 2', connected: true, ready: true },
    { id: 'player-3', displayName: 'Player 3', connected: true, ready: true }
  ],
  roleInstances,
  relations: [linkedRelation]
});

console.log('\n=== relation demo ===\n');

console.log('Role instances');
console.table(
  session.roleInstances.map(({ id, roleId, factionId, playerId, seat, inPlay }) => ({
    id,
    roleId,
    factionId,
    playerId,
    seat,
    inPlay
  }))
);

console.log('\nRelations');
console.table(
  session.relations.map(({ id, type, roleInstanceIds, active, createdCycleId, sourceActionId }) => ({
    id,
    type,
    roleInstanceIds: roleInstanceIds.join(', '),
    active,
    createdCycleId,
    sourceActionId
  }))
);

console.log('\nQueries');
console.table(
  ['role_a-0', 'role_b-0', 'role_c-0'].map((roleInstanceId) => ({
    roleInstanceId,
    linked: hasRelation(session, roleInstanceId, RELATION_TYPES.LINKED),
    linkedWith: getRelatedRoleInstanceIds(session, roleInstanceId, RELATION_TYPES.LINKED).join(', ')
  }))
);

console.log('\nRaw relation lookup for role_a-0');
console.log(findRelationsForRole(session, 'role_a-0', RELATION_TYPES.LINKED));

console.log('\nValidation');
console.log(validateGameSession(session, { requireAssigned: true }));

console.log('\nDemo terminada. No se uso Svelte, Firebase, i18n, imagenes ni navegador.\n');

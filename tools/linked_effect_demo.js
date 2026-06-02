import {
  ACTION_IDS,
  EFFECT_TYPES,
  RELATION_TYPES,
  VISIBILITY,
  buildRoleInstancesFromSeats,
  createGameSession,
  resolveAction
} from '../src/lib/domain/index.js';

// ---------------------------------------------------------------------------
// Demo de efecto derivado por linked
// ---------------------------------------------------------------------------
//
// Objetivo:
// demostrar las tres capas separadas:
// - accion: link_targets;
// - estado: relacion linked en session.relations;
// - consecuencia: linked propaga set_property inPlay=false.
//
// Regla que probamos:
// - Una accion propone set_property inPlay=false sobre role_a-0.
// - role_a-0 esta linked con role_b-0.
// - El resolver acepta el primer efecto y deriva otro set_property inPlay=false
//   para role_b-0.
//
// Esta demo no usa nombres narrativos como "enamorados" o "maldicion". Solo
// prueba la mecanica anonima.
// ---------------------------------------------------------------------------

const setInPlayAction = {
  id: ACTION_IDS.SET_IN_PLAY,
  phase: 'each_night',
  actor: {
    type: 'faction_group',
    factionId: 'team_c'
  },
  target: {
    type: 'role_instance',
    count: 1,
    filters: ['in_play', 'not_same_faction']
  },
  effect: {
    type: EFFECT_TYPES.SET_PROPERTY,
    targetType: 'role_instance',
    property: 'inPlay',
    value: false
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: VISIBILITY.STORYTELLER_ONLY
};

const linkTargetsAction = {
  id: ACTION_IDS.LINK_TARGETS,
  phase: 'first_night',
  actor: { type: 'role_holder' },
  target: {
    type: 'role_instance',
    count: 2,
    filters: ['in_play', 'distinct']
  },
  effect: {
    type: EFFECT_TYPES.SET_RELATION,
    targetType: 'relation',
    relationType: RELATION_TYPES.LINKED,
    active: true
  },
  visibility: VISIBILITY.STORYTELLER_ONLY
};

const roleDefinitions = {
  attacker: {
    factionId: 'team_c'
  },
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
    { seat: 0, playerId: 'player-1', role: 'attacker' },
    { seat: 1, playerId: 'player-2', role: 'role_a' },
    { seat: 2, playerId: 'player-3', role: 'role_b' },
    { seat: 3, playerId: 'player-4', role: 'role_c' }
  ],
  roleDefinitions
);

const session = createGameSession({
  id: 'linked-effect-demo',
  definitionId: 'generic-linked-effect-demo',
  players: [
    { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
    { id: 'player-2', displayName: 'Player 2', connected: true, ready: true },
    { id: 'player-3', displayName: 'Player 3', connected: true, ready: true },
    { id: 'player-4', displayName: 'Player 4', connected: true, ready: true }
  ],
  roleInstances
});

console.log('\n=== linked effect demo ===\n');

console.log('Estado inicial');
console.table(
  session.roleInstances.map(({ id, roleId, factionId, inPlay }) => ({
    id,
    roleId,
    factionId,
    inPlay
  }))
);

console.log('\nAccion 1: role_c-0 enlaza role_a-0 y role_b-0');
const linkResolution = resolveAction(session, linkTargetsAction, {
  actorRoleInstanceId: 'role_c-0',
  targetRoleInstanceIds: ['role_a-0', 'role_b-0']
});

console.log('ok:', linkResolution.ok);
console.log('Efecto final de link_targets');
console.log(linkResolution.result.finalEffects);

console.log('\nRelacion activa despues de link_targets');
console.table(
  linkResolution.session.relations.map(({ id, type, roleInstanceIds, active }) => ({
    id,
    type,
    roleInstanceIds: roleInstanceIds.join(', '),
    active
  }))
);

console.log('\nAccion 2: attacker-0 intenta poner role_a-0 fuera de juego');
const resolution = resolveAction(linkResolution.session, setInPlayAction, {
  actorRoleInstanceId: 'attacker-0',
  targetRoleInstanceIds: ['role_a-0']
});

console.log('ok:', resolution.ok);
console.log('Efectos propuestos');
console.log(resolution.result.proposedEffects);
console.log('Efectos finales');
console.log(resolution.result.finalEffects);
console.log('Efectos bloqueados');
console.log(resolution.result.blockedEffects);

console.log('\nEstado despues de aplicar efectos finales');
console.table(
  resolution.session.roleInstances.map(({ id, roleId, factionId, inPlay }) => ({
    id,
    roleId,
    factionId,
    inPlay
  }))
);

console.log('\nLectura esperada');
console.log('- role_a-0 queda fuera de juego porque fue el objetivo directo.');
console.log('- role_b-0 queda fuera de juego porque estaba linked con role_a-0.');
console.log('- role_c-0 sigue en juego porque no estaba linked ni fue objetivo.');

console.log('\nDemo terminada. No se uso Svelte, Firebase, i18n, imagenes ni navegador.\n');

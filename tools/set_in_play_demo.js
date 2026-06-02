import {
  ACTION_IDS,
  EFFECT_TYPES,
  VISIBILITY,
  buildRoleInstancesFromSeats,
  createGameSession,
  resolveAction
} from '../src/lib/domain/index.js';

// ---------------------------------------------------------------------------
// Demo de set_in_play
// ---------------------------------------------------------------------------
//
// Esta demo muestra una accion generica que cambia participacion principal.
//
// No estamos diciendo "hombres lobo atacan", "policia arresta" o "nave eyecta".
// Estamos diciendo que un actor intenta poner inPlay=false sobre un objetivo.
// ---------------------------------------------------------------------------

// Definicion mecanica de la accion.
//
// Esta estructura es lo que el motor necesita saber:
// - quien actua: una faccion;
// - cuando actua: cada noche;
// - a quien puede elegir: una instancia de rol en juego y de otra faccion;
// - que efecto final intenta producir: set_property inPlay=false;
// - quien ve el resultado: por ahora, el narrador.
const setInPlayAction = {
  id: ACTION_IDS.SET_IN_PLAY,
  phase: 'each_night',
  actor: {
    type: 'faction_group',
    factionId: 'team_b'
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

// Roles anonimos de prueba.
//
// Usamos nombres genericos para no atar el motor a una ambientacion concreta.
// En una skin podrian convertirse en lobos vs aldea, aliens vs humanos, etc.
const roleDefinitions = {
  team_b_attacker: {
    factionId: 'team_b',
    actionTokens: [{ actionId: ACTION_IDS.SET_IN_PLAY }]
  },
  team_b_support: {
    factionId: 'team_b'
  },
  team_a_target: {
    factionId: 'team_a'
  },
  team_a_plain: {
    factionId: 'team_a'
  }
};

// Instancias reales de rol dentro de esta partida de prueba.
//
// buildRoleInstancesFromSeats convierte una lista de asientos del Match en
// "cartas jugables" concretas, por ejemplo team_b_attacker-0.
const roleInstances = buildRoleInstancesFromSeats(
  [
    { seat: 0, playerId: 'player-1', role: 'team_b_attacker' },
    { seat: 1, playerId: 'player-2', role: 'team_b_support' },
    { seat: 2, playerId: 'player-3', role: 'team_a_target' },
    { seat: 3, playerId: 'player-4', role: 'team_a_plain' }
  ],
  roleDefinitions
);

// Sesion minima para poder ejecutar la accion sin Svelte ni Firebase.
const session = createGameSession({
  id: 'set-in-play-demo',
  definitionId: 'generic-set-in-play-demo',
  players: [
    { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
    { id: 'player-2', displayName: 'Player 2', connected: true, ready: true },
    { id: 'player-3', displayName: 'Player 3', connected: true, ready: true },
    { id: 'player-4', displayName: 'Player 4', connected: true, ready: true }
  ],
  roleInstances
});

// Ids que reutilizamos en los casos de prueba.
const actorRoleInstanceId = 'team_b_attacker-0';
const validTargetId = 'team_a_target-0';
const sameFactionTargetId = 'team_b_support-0';

// Variante de la sesion con un objetivo fuera de juego.
//
// Sirve para demostrar que el filtro "in_play" impide elegir a alguien que ya
// tiene inPlay=false.
const outOfPlayTargetSession = {
  ...session,
  roleInstances: session.roleInstances.map((role) =>
    role.id === validTargetId ? { ...role, inPlay: false } : role
  )
};

// Casos que queremos demostrar.
//
// El primer caso debe funcionar.
// Los demas deben fallar con errores claros, porque el motor tambien debe
// explicar por que una accion no es valida.
const demoCases = [
  {
    title: 'set_in_play valido',
    description: 'El actor actua sobre un objetivo en juego de otra faccion.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: [validTargetId]
    }
  },
  {
    title: 'objetivo fuera de juego rechazado',
    description: 'La accion tiene el filtro in_play, por eso un objetivo con inPlay=false no es valido.',
    session: outOfPlayTargetSession,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: [validTargetId]
    }
  },
  {
    title: 'objetivo de la misma faccion rechazado',
    description: 'La accion tiene el filtro not_same_faction.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: [sameFactionTargetId]
    }
  },
  {
    title: 'actor inexistente rechazado',
    description: 'El motor no puede resolver la accion si el actor no existe.',
    session,
    input: {
      actorRoleInstanceId: 'missing-attacker-0',
      targetRoleInstanceIds: [validTargetId]
    }
  },
  {
    title: 'objetivo inexistente rechazado',
    description: 'El id elegido como objetivo debe existir dentro de roleInstances.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: ['missing-target-0']
    }
  },
  {
    title: 'numero incorrecto de objetivos rechazado',
    description: 'set_in_play espera exactamente un objetivo.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: [validTargetId, 'team_a_plain-0']
    }
  }
];

console.log('\n=== set_in_play demo ===\n');

console.log('Definicion de la accion');
console.log(JSON.stringify(setInPlayAction, null, 2));

console.log('\nInstancias de rol antes de la accion');
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

console.log('\nCasos');
demoCases.forEach((demoCase, index) => {
  const result = resolveAction(demoCase.session, setInPlayAction, demoCase.input);
  console.log(`\nCASE ${index + 1}: ${demoCase.title}`);
  console.log(demoCase.description);
  console.log('Input:', demoCase.input);
  console.log('ok:', result.ok);

  if (result.ok) {
    console.log('Resultado:', result.result);
    console.log('Instancias de rol despues de la accion');
    console.table(
      result.session.roleInstances.map(({ id, roleId, factionId, inPlay }) => ({
        id,
        roleId,
        factionId,
        inPlay
      }))
    );
  } else {
    console.table(
      result.errors.map((error) => ({
        code: error.code,
        message: error.message,
        targetId: error.targetId ?? '',
        filter: error.filter ?? ''
      }))
    );
  }
});

console.log('\nDemo terminada. No se uso Svelte, Firebase, i18n, imagenes ni navegador.\n');

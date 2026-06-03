import {
  ACTION_IDS,
  EFFECT_TYPES,
  CONSTRAINT_TYPES,
  CONSTRAINT_WINDOWS,
  VISIBILITY,
  buildRoleInstancesFromSeats,
  createGameSession,
  getActionBlockKey,
  resolveRecipe
} from '../src/lib/domain/index.js';

// ---------------------------------------------------------------------------
// Demo de block_out_of_play + close_cycle
// ---------------------------------------------------------------------------
//
// Esta demo muestra el primer ciclo nocturno completo del nucleo:
//
//   1. block_out_of_play crea un bloqueo anticipado.
//   2. set_in_play se produce como intento.
//   3. si el objetivo tenia esa accion bloqueada, el intento falla.
//   4. close_cycle cierra el ciclo y limpia bloqueos temporales.
//   5. La restriccion no_repeat_target usa actionHistory para impedir
//      repetir objetivo en dos ciclos consecutivos.
//
// Seguimos usando nombres anonimos. Esto no es "lobo, medico, aldea".
// Es una mecanica generica que luego una skin podra vestir como quiera.
// ---------------------------------------------------------------------------

// Accion generica de cambio de participacion.
//
// Si no queda bloqueado, su salida final es un efecto generico:
// set_property inPlay=false.
const setInPlayAction = {
  id: ACTION_IDS.SET_IN_PLAY,
  phase: 'each_night',
  actor: {
    type: 'alignment_group',
    alignmentId: 'team_b'
  },
  target: {
    type: 'role_instance',
    count: 1,
    filters: ['in_play', 'not_same_alignment']
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

// Receta generica: bloquea set_in_play inPlay=false durante este ciclo.
//
// La primitiva es block_action. Esta receta concreta expresa "no puede quedar
// fuera del juego principal por una accion set_in_play(false)".
const blockOutOfPlayAction = {
  id: ACTION_IDS.BLOCK_ACTION,
  phase: 'each_night',
  actor: {
    type: 'role_holder'
  },
  target: {
    type: 'role_instance',
    count: 1,
    filters: ['in_play', 'not_self']
  },
  constraints: [
    {
      type: CONSTRAINT_TYPES.NO_REPEAT_TARGET,
      window: CONSTRAINT_WINDOWS.CURRENT_OR_NEXT_CYCLE
    }
  ],
  effect: {
    type: EFFECT_TYPES.BLOCK_ACTION,
    blocks: {
      actionId: ACTION_IDS.SET_IN_PLAY,
      params: {
        property: 'inPlay',
        value: false
      }
    },
    duration: 'current_cycle'
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: VISIBILITY.STORYTELLER_ONLY
};

// Accion automatica de cierre de ciclo.
//
// No la elige un jugador. La ejecutara el sistema cuando toque resolver las
// consecuencias acumuladas de la noche.
const closeCycleAction = {
  id: ACTION_IDS.CLOSE_CYCLE,
  phase: 'daybreak',
  actor: {
    type: 'system'
  },
  target: {
    type: 'all_role_instances',
    count: 'automatic'
  },
  effect: {
    type: EFFECT_TYPES.CLOSE_CYCLE
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: VISIBILITY.ALL
};

// Roles anonimos usados por la demo.
const roleDefinitions = {
  team_b_attacker: {
    alignmentId: 'team_b',
    actionTokens: [{ actionId: ACTION_IDS.SET_IN_PLAY }]
  },
  team_a_blocker: {
    alignmentId: 'team_a',
    actionTokens: [{ actionId: ACTION_IDS.BLOCK_ACTION }]
  },
  team_a_target: {
    alignmentId: 'team_a'
  },
  team_a_plain: {
    alignmentId: 'team_a'
  }
};

// Crea una sesion limpia para cada caso de la demo.
//
// Esto evita que un caso contamine al siguiente: cada demostracion empieza con
// los mismos jugadores en juego y sin flags temporales.
function createDemoSession() {
  const roleInstances = buildRoleInstancesFromSeats(
    [
      { seat: 0, playerId: 'player-1', role: 'team_b_attacker' },
      { seat: 1, playerId: 'player-2', role: 'team_a_blocker' },
      { seat: 2, playerId: 'player-3', role: 'team_a_target' },
      { seat: 3, playerId: 'player-4', role: 'team_a_plain' }
    ],
    roleDefinitions
  );

  return createGameSession({
    id: 'block-cycle-demo',
    definitionId: 'generic-block-demo',
    players: [
      { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
      { id: 'player-2', displayName: 'Player 2', connected: true, ready: true },
      { id: 'player-3', displayName: 'Player 3', connected: true, ready: true },
      { id: 'player-4', displayName: 'Player 4', connected: true, ready: true }
    ],
    roleInstances
  });
}

// Ids estables de las instancias de rol de la demo.
const attackerId = 'team_b_attacker-0';
const blockerId = 'team_a_blocker-0';
const targetId = 'team_a_target-0';
const otherTargetId = 'team_a_plain-0';
const blockSetInPlayFalseKey = getActionBlockKey(blockOutOfPlayAction.effect.blocks);

// Resume la parte importante de la sesion para verla en terminal.
function printRoleState(session, title) {
  console.log(`\n${title} | ciclo actual: ${session.metadata?.currentCycleId ?? 1}`);
  console.table(
    session.roleInstances.map(({ id, roleId, alignmentId, inPlay, flags }) => ({
      id,
      roleId,
      alignmentId,
      inPlay,
      blockedSetInPlayFalse: flags?.blockedActions?.[blockSetInPlayFalseKey] === true
    }))
  );
}

// Muestra el historial mecanico de acciones de la sesion.
//
// Nos interesa verlo porque la restriccion no_repeat_target se basa en
// actionHistory, no en flags del actor ni del objetivo.
function printActionHistory(session, title) {
  console.log(`\n${title}`);
  console.table(
    (session.actionHistory ?? []).map(
      ({ cycleId, actionId, actorRoleInstanceId, targetRoleInstanceIds, result }) => ({
        cycleId,
        actionId,
        actorRoleInstanceId,
        targetRoleInstanceIds: targetRoleInstanceIds.join(', '),
        result
      })
    )
  );
}

// Ejecuta una receta/accion y muestra solo lo esencial.
function runStep(session, title, action, input = {}) {
  const result = resolveRecipe(session, action, input);
  console.log(`\n${title}`);
  console.log('ok:', result.ok);

  if (result.ok) {
    console.log('Resultado:', result.result);
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

  return result;
}

console.log('\n=== block cycle demo ===\n');

console.log('Acciones usadas');
console.log(
  JSON.stringify(
    {
      setInPlayAction,
      blockOutOfPlayAction,
      closeCycleAction
    },
    null,
    2
  )
);

// ---------------------------------------------------------------------------
// Caso 1: set_in_play sin bloqueo.
// Resultado esperado: el objetivo recibe set_property inPlay=false.
// ---------------------------------------------------------------------------
{
  let session = createDemoSession();
  console.log('\n\nCASE 1: set_in_play sin bloqueo');
  printRoleState(session, 'Estado inicial');

  let result = runStep(session, '1. El actor intenta set_in_play(false)', setInPlayAction, {
    actorRoleInstanceId: attackerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;
  printRoleState(session, 'Despues de la accion');

  result = runStep(session, '2. El sistema cierra efectos pendientes', closeCycleAction);
  session = result.session;
  printRoleState(session, 'Despues de cerrar efectos pendientes');
}

// ---------------------------------------------------------------------------
// Caso 2: set_in_play y despues bloqueo.
// Resultado esperado: block_out_of_play no puede aplicarse sobre alguien que
// ya no esta en juego. Prevenir no es restaurar inPlay=true.
// ---------------------------------------------------------------------------
{
  let session = createDemoSession();
  console.log('\n\nCASE 2: set_in_play y despues intento de bloqueo');
  printRoleState(session, 'Estado inicial');

  let result = runStep(session, '1. El actor intenta set_in_play(false)', setInPlayAction, {
    actorRoleInstanceId: attackerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;

  result = runStep(session, '2. El bloqueador intenta bloquear demasiado tarde', blockOutOfPlayAction, {
    actorRoleInstanceId: blockerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;
  printRoleState(session, 'Despues del intento tardio de bloqueo');

  result = runStep(session, '3. El sistema cierra efectos pendientes', closeCycleAction);
  session = result.session;
  printRoleState(session, 'Despues de cerrar efectos pendientes');
}

// ---------------------------------------------------------------------------
// Caso 3: bloqueo antes de set_in_play.
// Resultado esperado: set_in_play se intenta, pero falla automaticamente
// porque el objetivo ya tenia esa accion bloqueada.
// ---------------------------------------------------------------------------
{
  let session = createDemoSession();
  console.log('\n\nCASE 3: bloqueo antes de set_in_play');
  printRoleState(session, 'Estado inicial');

  let result = runStep(session, '1. El bloqueador bloquea set_in_play(false) sobre el objetivo', blockOutOfPlayAction, {
    actorRoleInstanceId: blockerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;

  result = runStep(session, '2. El actor intenta set_in_play(false)', setInPlayAction, {
    actorRoleInstanceId: attackerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;
  printRoleState(session, 'Despues de la accion fallida por bloqueo');

  result = runStep(session, '3. El sistema cierra efectos pendientes', closeCycleAction);
  session = result.session;
  printRoleState(session, 'Despues de cerrar efectos pendientes');
  printActionHistory(session, 'Historial de acciones tras el ciclo 1');
}

// ---------------------------------------------------------------------------
// Caso 4: no se puede bloquear al mismo objetivo dos ciclos consecutivos.
// Resultado esperado: despues de bloquear al objetivo en el ciclo 1, el mismo
// actor no puede bloquear al mismo objetivo en el ciclo 2.
// ---------------------------------------------------------------------------
{
  let session = createDemoSession();
  console.log('\n\nCASE 4: no repetir bloqueo sobre el mismo objetivo');
  printRoleState(session, 'Estado inicial');

  let result = runStep(session, '1. Ciclo 1: el bloqueador bloquea sobre el objetivo', blockOutOfPlayAction, {
    actorRoleInstanceId: blockerId,
    targetRoleInstanceIds: [targetId]
  });
  session = result.session;

  result = runStep(session, '2. Ciclo 1: el sistema cierra la noche', closeCycleAction);
  session = result.session;
  printActionHistory(session, 'Historial despues del ciclo 1');
  printRoleState(session, 'Inicio del ciclo 2');

  result = runStep(
    session,
    '3. Ciclo 2: el bloqueador intenta repetir el mismo objetivo',
    blockOutOfPlayAction,
    {
      actorRoleInstanceId: blockerId,
      targetRoleInstanceIds: [targetId]
    }
  );
  session = result.session;

  result = runStep(
    session,
    '4. Ciclo 2: el bloqueador elige otro objetivo y si puede bloquear',
    blockOutOfPlayAction,
    {
      actorRoleInstanceId: blockerId,
      targetRoleInstanceIds: [otherTargetId]
    }
  );
  session = result.session;
  printActionHistory(session, 'Historial despues de elegir otro objetivo');
  printRoleState(session, 'Despues de bloquear otro objetivo');
}

// ---------------------------------------------------------------------------
// Caso 5: objetivo invalido para block_out_of_play.
// Resultado esperado: el motor explica por que la accion no puede hacerse.
// ---------------------------------------------------------------------------
{
  const session = createDemoSession();
  console.log('\n\nCASE 5: el bloqueador intenta elegirse a si mismo');

  runStep(session, '1. block_out_of_play falla por filtro not_self', blockOutOfPlayAction, {
    actorRoleInstanceId: blockerId,
    targetRoleInstanceIds: [blockerId]
  });
}

console.log('\nDemo terminada. No se uso Svelte, Firebase, i18n, imagenes ni navegador.\n');

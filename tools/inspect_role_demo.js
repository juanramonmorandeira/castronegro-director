import {
  ACTION_IDS,
  EFFECT_TYPES,
  VISIBILITY,
  buildRoleInstancesFromSeats,
  createGameSession,
  resolveAction
} from '../src/lib/domain/index.js';

const inspectRoleAction = {
  id: ACTION_IDS.INSPECT_ROLE,
  phase: 'each_night',
  actor: {
    type: 'role_holder'
  },
  target: {
    type: 'role_instance',
    count: 1,
    filters: ['in_play', 'not_self']
  },
  effect: {
    type: EFFECT_TYPES.REVEAL_PROPERTY,
    property: 'roleId'
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: VISIBILITY.ACTOR_ONLY
};

const roleDefinitions = {
  role_inspector: {
    factionId: 'team_a',
    actionTokens: [{ actionId: ACTION_IDS.INSPECT_ROLE }]
  },
  hidden_enemy: {
    factionId: 'team_b'
  },
  plain_role: {
    factionId: 'team_a'
  }
};

const roleInstances = buildRoleInstancesFromSeats(
  [
    { seat: 0, playerId: 'player-1', role: 'role_inspector' },
    { seat: 1, playerId: 'player-2', role: 'hidden_enemy' },
    { seat: 2, playerId: 'player-3', role: 'plain_role' }
  ],
  roleDefinitions
);

const session = createGameSession({
  id: 'inspect-role-demo',
  definitionId: 'generic-inspection-demo',
  players: [
    { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
    { id: 'player-2', displayName: 'Player 2', connected: true, ready: true },
    { id: 'player-3', displayName: 'Player 3', connected: true, ready: true }
  ],
  roleInstances
});

const actorRoleInstanceId = 'role_inspector-0';
const targetRoleInstanceIds = ['hidden_enemy-0'];

const outOfPlayTargetSession = {
  ...session,
  roleInstances: session.roleInstances.map((role) =>
    role.id === 'hidden_enemy-0' ? { ...role, inPlay: false } : role
  )
};

const demoCases = [
  {
    title: 'valid inspection',
    description: 'The actor inspects one in-play target that is not itself.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds
    }
  },
  {
    title: 'self inspection is rejected',
    description: 'The action has filter not_self, so the actor cannot inspect itself.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: [actorRoleInstanceId]
    }
  },
  {
    title: 'out-of-play target is rejected',
    description: 'The action has filter in_play, so out-of-play targets are not valid.',
    session: outOfPlayTargetSession,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds
    }
  },
  {
    title: 'missing actor is rejected',
    description: 'The engine cannot resolve an action if the actor role instance does not exist.',
    session,
    input: {
      actorRoleInstanceId: 'missing-actor-0',
      targetRoleInstanceIds
    }
  },
  {
    title: 'missing target is rejected',
    description: 'The selected target id must exist in roleInstances.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: ['missing-target-0']
    }
  },
  {
    title: 'wrong target count is rejected',
    description: 'inspect_role expects exactly one target.',
    session,
    input: {
      actorRoleInstanceId,
      targetRoleInstanceIds: ['hidden_enemy-0', 'plain_role-0']
    }
  }
];

console.log('\n=== inspect_role demo ===\n');

console.log('Action definition');
console.log(JSON.stringify(inspectRoleAction, null, 2));

console.log('\nRole instances');
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

console.log('\nCases');
demoCases.forEach((demoCase, index) => {
  const result = resolveAction(demoCase.session, inspectRoleAction, demoCase.input);
  console.log(`\nCASE ${index + 1}: ${demoCase.title}`);
  console.log(demoCase.description);
  console.log('Input:', demoCase.input);
  console.log('ok:', result.ok);

  if (result.ok) {
    const reveal = result.result.reveals[0];
    console.log(
      'Result:',
      `${result.result.actorRoleInstanceId} learned ${reveal.targetRoleInstanceId}.${reveal.property} = ${reveal.value}`
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

console.log('\nDemo finished. No Svelte, Firebase, i18n, images or browser were used.\n');

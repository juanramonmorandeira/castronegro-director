import {
  PHASE_STATUSES,
  advancePhaseCursor,
  buildRoleInstancesFromSeats,
  createGameSession,
  createPhasePoolsFromDefinition,
  hydratePhasePools,
  isMatchComplete,
  validateGameSession
} from '../src/lib/domain/index.js';

const roleDefinitions = {
  observer: {
    factionId: 'team_a',
    actionTokens: [{ actionId: 'inspect' }]
  },
  hunter: {
    factionId: 'team_b',
    actionTokens: [{ actionId: 'attack' }]
  }
};

const players = [
  { id: 'player-1', displayName: 'Player 1', connected: true, ready: true },
  { id: 'player-2', displayName: 'Player 2', connected: true, ready: true }
];

const seats = [
  { seat: 0, playerId: 'player-1', role: 'Observer' },
  { seat: 1, playerId: 'player-2', role: 'Hunter' }
];

const roleInstances = buildRoleInstancesFromSeats(seats, roleDefinitions);

const phasePools = createPhasePoolsFromDefinition({
  poolOrder: ['poolPreparation', 'poolOpeningNight', 'poolDay'],
  pools: {
    poolPreparation: [
      { key: 'prepare_characters', status: PHASE_STATUSES.ENABLED },
      { key: 'prepare_locations', status: PHASE_STATUSES.DISABLED }
    ],
    poolOpeningNight: [
      { key: 'observer_inspects', status: PHASE_STATUSES.DISABLED },
      { key: 'hunter_attacks', status: PHASE_STATUSES.DISABLED }
    ],
    poolDay: [
      { key: 'reveal_results', status: PHASE_STATUSES.ENABLED },
      { key: 'vote', status: PHASE_STATUSES.ENABLED }
    ]
  }
});

const session = createGameSession({
  id: 'demo-session',
  definitionId: 'anonymous-demo',
  players,
  roleInstances,
  phasePools
});

const sessionState = {
  rolesInPlay: new Set(session.roleInstances.filter((role) => role.inPlay).map((role) => role.roleId))
};

const phaseRules = {
  poolPreparation: {
    prepare_characters: () => true,
    prepare_locations: () => false
  },
  poolOpeningNight: {
    observer_inspects: (state) => state.rolesInPlay.has('observer'),
    hunter_attacks: (state) => state.rolesInPlay.has('hunter')
  },
  poolDay: {
    reveal_results: () => true,
    vote: () => true
  }
};

let currentPhasePools = hydratePhasePools(session.phasePools, phaseRules, sessionState);

console.log('\n=== Domain demo ===\n');

console.log('1. Players');
console.table(session.players.map(({ id, displayName, connected, ready }) => ({ id, displayName, connected, ready })));

console.log('\n2. Role instances');
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

console.log('\n3. Match validation');
console.log('Match complete:', isMatchComplete(session.roleInstances));
console.log('Session validation:', validateGameSession(session, { requireAssigned: true }));

console.log('\n4. Enabled phases after hydration');
for (const poolKey of currentPhasePools.poolOrder) {
  const enabled = currentPhasePools.pools[poolKey]
    .filter((phase) => phase.status === PHASE_STATUSES.ENABLED)
    .map((phase) => phase.key);
  console.log(`${poolKey}:`, enabled.length ? enabled.join(' -> ') : '(none)');
}

console.log('\n5. Phase cursor');
for (let step = 1; step <= 6; step += 1) {
  const result = advancePhaseCursor(currentPhasePools);
  currentPhasePools = result.phasePools;

  console.log(
    `Step ${step}:`,
    result.current
      ? `${result.current.poolKey}/${result.current.phaseKey} -> ${result.next?.poolKey ?? 'end'}/${result.next?.phaseKey ?? 'end'}`
      : result.reason
  );

  if (!result.next) break;
}

console.log('\nDemo finished. This did not use Svelte, Firebase, i18n or the browser.\n');

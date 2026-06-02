# Modelo objetivo de sesion

Este documento define el modelo objetivo para retomar la migracion de la pantalla de sesion. La decision base es que la partida debe tener una unica fuente de verdad para el estado de roles y una unica fuente de verdad para el avance de fases.

## Objetivo

La sesion en curso debe estar dirigida por:

- `role_instances`: estado mecanico de cada carta/personaje en partida.
- `phase_pools`: estado mecanico del flujo de fases.
- `session_log`: registro narrativo y tecnico de decisiones relevantes.

`tokens`, `session_phases` y otros arrays auxiliares pueden existir durante la migracion, pero no deben decidir el flujo principal una vez completado el cambio.

## Principios

- La logica de partida no debe depender de nombres visuales, posiciones de fichas o textos traducidos.
- Cada jugador/carta en juego debe existir como una instancia identificable, incluso si hay roles repetidos.
- Las fases deben calcularse desde el estado real de la partida, no desde una lista fija construida al inicio.
- Los efectos del tablero deben terminar escribiendo en `role_instances`.
- La interfaz debe renderizar el estado derivado, no mantener una segunda realidad paralela.
- Las sesiones antiguas deben poder abrirse mediante una migracion controlada desde `session_phases` y `tokens`.

## Estado de sesion recomendado

Campos principales del documento `sessions/{sessionId}`:

```js
{
  status: 'draft' | 'shared' | 'waiting' | 'in_progress' | 'paused' | 'finished' | 'cancelled',
  settings: {
    rulesets: 'thepact',
    players_expected: 8,
    language: 'es',
    storyteller: 'human' | 'human-AI' | 'AI',
    include_sheriff: true,
    include_town_crier: false,
    include_buildings: false,
    roles: {},
    actor_roles: [],
    thief_roles: [],
    actor_exclusions: [],
    thief_exclusions: []
  },
  players: {},
  player_roles: {},
  seating_order: [],
  role_instances: [],
  building_instances: [],
  phase_pools: {},
  session_log: [],
  created_at: Timestamp,
  updated_at: Timestamp
}
```

## `role_instances`

`role_instances` representa las cartas/personajes reales en mesa. Debe ser la fuente de verdad para saber si un rol sigue en juego, esta infectado, enlazado, protegido, transformado, agotado o asignado a un jugador.

Forma recomendada:

```js
{
  id: 'seer-0',
  name: 'seer',
  alignment: 'villagers',
  playerId: 'uid-or-test-player-id',
  seat: 3,
  inPlay: true,
  revealed: false,
  powerConsumed: false,
  tokens: [
    { name: 'fox_senses', consumed: false }
  ],
  professions: [
    { name: 'baker', consumed: false }
  ],
  sheriff: false,
  townCrier: false,
  medium: false,
  inLove: false,
  infected: false,
  charmed: false,
  defended: false,
  childModel: false,
  manipulated: null,
  accused: false,
  pendingDeath: false,
  votingRight: true
}
```

Reglas:

- `id` debe ser estable dentro de la partida.
- `name` debe ser un slug canonico, por ejemplo `seer`, `werewolf`, `father`.
- `playerId` puede apuntar a un usuario real o a un jugador offline/test.
- `seat` es la posicion alrededor de la mesa, no la posicion visual del token.
- `inPlay` decide si el rol participa en reglas futuras.
- `tokens` representa poderes consumibles ligados al rol.
- Estados como `infected`, `charmed`, `inLove`, `defended` deben vivir aqui, no solo en arrays externos.

Durante la migracion se pueden mantener arrays como `infected_targets`, `charmed_targets` o `deadCharacters`, pero deben considerarse compatibilidad temporal heredada.

## `building_instances`

`building_instances` representa edificios/profesiones disponibles cuando `settings.include_buildings` esta activo.

Forma recomendada:

```js
{
  id: 'bakery-0',
  name: 'baker',
  building: {
    name: 'Bakery',
    image: '/buildings/bakery.png'
  },
  roleInstanceId: 'baker-0',
  available: true,
  burned: false,
  consumed: false
}
```

Los edificios deben ligarse a `role_instances` cuando una profesion queda asignada. No deben calcularse solo desde assets visuales.

## `phase_pools`

`phase_pools` debe sustituir a `session_phases` como motor de avance. Un pool agrupa fases que se evalua en conjunto y permite rehidratar que pasos estan activos segun el estado actual.

Forma recomendada:

```js
{
  poolCurrent: 'poolPreparation',
  poolPrevious: null,
  poolNext: 'poolFirstNight',
  poolCurrentPhaseIndex: 0,
  poolPreparation: [
    { key: 'hydratePreparation', status: 'enabled' },
    { key: 'phaseCharacters', status: 'enabled' },
    { key: 'phaseBuildings', status: 'disabled' }
  ],
  poolFirstNight: [],
  poolEachDay: [],
  poolEachNight: [],
  poolSpecialEvents: []
}
```

Pools previstos:

- `poolPreparation`: preparacion antes de la primera noche.
- `poolFirstNight`: llamadas y acciones de primera noche.
- `poolEachDay`: resolucion diurna.
- `poolEachNight`: ciclo nocturno recurrente.
- `poolSpecialEvents`: interrupciones y resoluciones pendientes, como Cazador, Caballero, Alguacil o final.

Estados de fase:

- `enabled`: la fase debe ejecutarse.
- `disabled`: la fase no aplica ahora.
- `done`: la fase ya fue completada en este ciclo.
- `blocked`: la fase requiere una decision antes de avanzar.

La version actual usa sobre todo `enabled` y `disabled`; `done` y `blocked` quedan como objetivo recomendado.

## Avance de fases

El avance objetivo debe seguir este flujo:

1. Leer `phase_pools.poolCurrent` y `poolCurrentPhaseIndex`.
2. Resolver la fase actual mediante handlers de dominio.
3. Persistir cambios en `role_instances`, `building_instances`, contadores y log.
4. Marcar la fase actual como `done`.
5. Rehidratar el pool actual si la fase era de tipo `hydrate*`.
6. Buscar la siguiente fase `enabled` en el pool actual.
7. Si no hay siguiente fase, calcular el siguiente pool.
8. Antes de entrar en el siguiente pool, evaluar `poolSpecialEvents`.
9. Persistir `phase_pools`.

Pseudo-flujo:

```js
async function advanceCurrentPhase(session) {
  const current = getCurrentPhase(session.phase_pools);
  const result = resolvePhase(current, session);

  const nextSession = applyPhaseResult(session, result);
  const hydratedPools = hydrateRelevantPools(nextSession);
  const nextPools = moveCursor(hydratedPools);

  await updateSession(session.id, {
    role_instances: nextSession.role_instances,
    building_instances: nextSession.building_instances,
    phase_pools: nextPools,
    session_log: nextSession.session_log
  });
}
```

## Relacion con `session_phases`

`session_phases` es el sistema antiguo. Debe quedar en una de estas dos situaciones:

- Eliminado del flujo principal.
- Mantenido solo como compatibilidad de lectura para sesiones antiguas.

Mientras exista compatibilidad, la migracion debe ser explicita:

```js
if (!session.phase_pools && session.session_phases) {
  phase_pools = migrateSessionPhasesToPhasePools(session.session_phases);
}
```

Despues de migrar, la UI y el avance no deben seguir escribiendo en ambos modelos salvo durante un periodo temporal muy acotado.

## Relacion con `tokens`

`tokens` debe representar la capa visual del tablero:

- imagen;
- posicion;
- tipo visual;
- relacion con `roleInstanceId` o token de accion.

No debe ser la fuente de verdad para saber si un rol sigue en juego o si un poder esta consumido. Esa informacion debe estar en `role_instances`.

Forma recomendada para tokens visuales:

```js
{
  id: 'visual-seer-0',
  roleInstanceId: 'seer-0',
  tokenType: 'character' | 'action' | 'marker',
  image: '/roles/villagers/seer.png',
  position: { x: 50, y: 50 }
}
```

## Eventos y log

El log objetivo debe registrar decisiones de partida, no solo notas libres.

Forma recomendada:

```js
{
  id: 'log-001',
  at: Timestamp,
  type: 'phase' | 'action' | 'system' | 'note',
  phaseKey: 'phaseWitch',
  actorRoleInstanceId: 'witch-0',
  targetRoleInstanceIds: ['werewolf-0'],
  messageKey: 'session.logbook.witch_poison',
  messageParams: {},
  text: 'La bruja usa veneno.'
}
```

Esto permite reconstruir la historia de la partida y depurar errores de avance.

## Invariantes

Antes de iniciar `poolPreparation/phaseCharacters`:

- `role_instances.length` debe coincidir con los roles seleccionados.
- Cada instancia debe tener `name`, `alignment`, `playerId` y `seat`.
- No debe haber dos instancias con el mismo `seat`.
- Los roles repetidos deben tener IDs distintos.

Durante la partida:

- Un rol muerto no debe activar fases futuras, salvo fases especiales de muerte.
- Un poder consumido no debe volver a habilitarse salvo regla explicita.
- `poolSpecialEvents` debe tener prioridad sobre el siguiente pool normal cuando haya eventos pendientes.
- Los contadores `day_number` y `night_number` deben avanzar al entrar en pools diurnos/nocturnos, no en fases internas.

Al terminar:

- `status` debe ser `finished`.
- `phase_pools.poolCurrent` debe apuntar a `poolSpecialEvents` o a una fase final equivalente.
- Debe existir un resultado de victoria persistido.

## Plan de migracion recomendado

1. Congelar el contrato de `role_instances`.
2. Hacer que Match siempre cree `role_instances` completos.
3. Migrar `evaluatePhase()` para leer y avanzar solo `phase_pools`.
4. Convertir handlers de efectos para que escriban en `role_instances`.
5. Derivar los tokens visuales desde `role_instances` donde sea posible.
6. Mantener `session_phases` solo como entrada de migracion.
7. Eliminar escrituras duplicadas cuando el flujo nuevo este verificado.
8. Anadir pruebas unitarias para reglas de fases y migracion.

## Pendientes abiertos

- Definir si Actor y Ladron cambian `name` de la instancia o si guardan una transformacion temporal.
- Definir si Sheriff, Medium y Town Crier son flags de `role_instances` o entidades honorificas separadas.
- Definir como se persistira la posicion visual de tokens: dentro de `tokens`, en local storage o en un subdocumento.
- Definir resultado de victoria: campo unico recomendado `victory_result`.
- Definir una funcion pura para `hydratePhasePool(poolKey, sessionState)` que pueda probarse sin Svelte ni Firebase.

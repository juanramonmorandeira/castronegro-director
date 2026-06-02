# Lenguaje de reglas del nucleo

Este documento define como queremos describir reglas de juego sin depender de una ambientacion concreta.

El alcance del motor esta separado en:

```text
src/lib/domain/ENGINE_SCOPE.md
```

Este archivo se centra en el lenguaje de reglas. `ENGINE_SCOPE.md` define donde
termina la resolucion de acciones, donde empieza la aplicacion de efectos y como
encajan las consecuencias globales.

La idea principal:

> El motor no sabe que es "La Vidente". El motor sabe que existe una accion llamada `inspect_role`.

Despues, una capa de contenido puede presentar esa accion como:

- Vidente;
- Oraculo;
- Operador de periscopio;
- Escaner alienigena;
- Agente de inteligencia.

El comportamiento mecanico es el mismo. Cambian el nombre, la historia, la imagen y las traducciones.

## Capas

### Motor

El motor contiene reglas abstractas:

- fases;
- jugadores;
- roles genericos;
- acciones;
- objetivos validos;
- efectos;
- restricciones;
- condiciones de victoria.

El motor no contiene:

- texto visible;
- imagenes;
- nombres tematicos;
- traducciones;
- componentes Svelte;
- Firebase;
- CSS.

### Skin / tema / contenido

La capa de contenido contiene:

- nombres visibles;
- descripciones;
- imagenes;
- traducciones;
- ambientacion;
- nombres de facciones;
- nombres de roles.

Ejemplo:

```js
{
  skinRoleId: 'seer',
  baseRoleId: 'role_inspector',
  name: 'The Seer',
  actionLabels: {
    inspect_role: 'Inspect a card'
  }
}
```

El motor solo necesita `role_inspector` e `inspect_role`.

## Conceptos basicos

### Role template

Un `role template` describe comportamiento generico.

Ejemplo:

```js
{
  id: 'role_inspector',
  defaultFactionId: 'village',
  actions: ['inspect_role']
}
```

Este rol podria representarse luego como Vidente, Oraculo o Scanner.

### Role instance

Una `role instance` es una carta/rol concreto dentro de una partida.

Ejemplo:

```js
{
  id: 'role_inspector-0',
  roleId: 'role_inspector',
  playerId: 'player-1',
  seat: 0,
  inPlay: true
}
```

Si hay dos roles iguales, habra dos instancias:

```text
role_inspector-0
role_inspector-1
```

### Action history

`actionHistory` es memoria de la sesion.

No describe lo que un rol es, ni describe el estado temporal actual de un
objetivo. Describe hechos que ya ocurrieron en esta partida.

Ejemplo:

```js
{
  cycleId: 1,
  actionId: 'block_out_of_play',
  actorRoleInstanceId: 'team_a_blocker-0',
  targetRoleInstanceIds: ['team_a_target-0'],
  blockKey: 'set_in_play:property:inPlay:value:false',
  result: 'applied'
}
```

Lo usamos para reglas que necesitan mirar el pasado. Por ejemplo:

```text
este mismo actor no puede bloquear al mismo objetivo dos ciclos consecutivos
```

Los bloqueos temporales del ciclo actual viven en `role.flags.blockedActions`
y se limpian al resolver el ciclo. El historial no se limpia, porque sirve para
auditar y validar reglas futuras.

### Relation

Una `relation` describe un vinculo activo entre varias `roleInstances`.

Ejemplo:

```js
{
  id: 'linked-role-a-role-b',
  type: 'linked',
  roleInstanceIds: ['role_a-0', 'role_b-0'],
  active: true
}
```

No usamos `role.flags.linked = true` como fuente principal porque eso no dice
con quien esta enlazado el rol y puede duplicar informacion. La relacion vive
una sola vez en `session.relations`.

La UI puede derivar informacion visual a partir de esa relacion:

```text
role_a-0 esta linked con role_b-0
role_b-0 esta linked con role_a-0
```

### Action

Una `action` describe algo que un rol puede hacer.

Formato base:

```js
{
  id: 'inspect_role',
  phase: 'each_night',
  actor: {},
  target: {},
  effect: {},
  repeat: 'each_cycle',
  visibility: 'actor_only'
}
```

Cada accion debe responder a estas preguntas:

- Quien actua?
- Cuando actua?
- Sobre quien o que puede actuar?
- Que efecto produce?
- Se puede repetir?
- Consume algun recurso?
- Quien ve el resultado?

## Estructura propuesta de una accion

```js
{
  id: 'inspect_role',

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
    type: 'reveal_property',
    property: 'roleId'
  },

  repeat: 'each_cycle',

  consumes: null,

  visibility: 'actor_only'
}
```

## Campos

### `id`

Identificador mecanico de la accion.

Debe ser generico.

Buenos nombres:

- `inspect_role`
- `set_in_play`
- `block_action`
- `block_out_of_play`
- `link_targets`
- `resolve_pending_effects`
- `change_role`

Malos nombres para el motor:

- `seer_power`
- `werewolf_bite`
- `witch_potion`
- `cupid_love`

Esos nombres pertenecen a la skin.

### `phase`

Indica cuando puede ejecutarse la accion.

Ejemplos:

```text
first_night
each_night
each_day
after_attack
before_vote
after_death
manual
```

Los nombres exactos aun pueden cambiar. Lo importante es que describan momento mecanico, no narrativa.

### `actor`

Define quien ejecuta la accion.

Ejemplos:

```js
{ type: 'role_holder' }
```

El jugador que tiene ese rol.

```js
{ type: 'faction_group', factionId: 'wolves' }
```

Todos los miembros en juego de una faccion actuan como grupo.

```js
{ type: 'system' }
```

La accion la resuelve el motor automaticamente. Este `system` no es un jugador; solo significa "evento automatico".

Nota: tambien existe `PLAYER_TYPES.SYSTEM`, pero significa otra cosa: un jugador/rol controlado por el motor. No lo usaremos ahora, pero queda reservado para un futuro en el que la app pueda completar partidas con roles automaticos y reducir el numero minimo de jugadores humanos.

### `target`

Define a que puede apuntar la accion.

Ejemplo:

```js
{
  type: 'role_instance',
  count: 1,
  filters: ['in_play', 'not_self']
}
```

Significa:

- elige una instancia de rol;
- exactamente una;
- debe estar en juego;
- no puede ser uno mismo.

Ejemplo con dos objetivos:

```js
{
  type: 'role_instance',
  count: 2,
  filters: ['in_play', 'distinct']
}
```

Significa:

- elige dos instancias en juego;
- no pueden ser la misma.

### `filters`

Los filtros limitan objetivos validos.

Filtros candidatos:

```text
in_play
out_of_play
not_self
self
same_faction
other_faction
not_same_faction
distinct
has_action_token
```

No implementaremos todos de golpe. Solo los iremos anadiendo cuando exista un caso real.

Filtros ya usados por `block_out_of_play`:

```text
in_play
not_self
```

La regla "no repetir objetivo en ciclos consecutivos" no es un filtro. Es una
restriccion de receta, porque puede aplicarse o no a la misma accion generica.

### `constraints`

`constraints` es el nombre tecnico de la propiedad. En castellano, son
restricciones que aplican reglas adicionales a una receta concreta.

Ejemplo:

```js
constraints: [
  {
    type: 'prevent_repeat_target',
    window: 'current_or_previous_cycle'
  }
]
```

`prevent_repeat_target` consulta `session.actionHistory`, no los flags del actor
ni los flags del objetivo. Esto permite crear dos poderes con la misma accion
base, uno con esta restriccion y otro sin ella.

### `effect`

Define que ocurre cuando la accion se resuelve.

Ejemplos:

```js
{
  type: 'reveal_property',
  property: 'roleId'
}
```

Revela una propiedad del objetivo.

```js
{
  type: 'set_property',
  targetType: 'role_instance',
  property: 'inPlay',
  value: false
}
```

Intenta cambiar una propiedad del objetivo.

Si el objetivo tenia bloqueada la accion que propone ese efecto, la accion se
considera intentada pero fallida y no llega a proponer el cambio.

```js
{
  type: 'block_action',
  blocks: {
    actionId: 'set_in_play',
    params: {
      property: 'inPlay',
      value: false
    }
  },
  duration: 'current_cycle'
}
```

Bloquea una accion concreta durante un ciclo.

Este bloqueo es anticipado. No restaura una propiedad que ya haya cambiado.

El objetivo del bloqueo no va dentro de `blocks`. Va en la seleccion de
objetivos de la accion (`targetRoleInstanceIds`) y se guarda como flag temporal
dentro de ese roleInstance. Dicho de otro modo:

```text
block_action(set_in_play, { property: 'inPlay', value: false }; target)
```

se representa en datos como:

```text
blocks = set_in_play + parametros
targetRoleInstanceIds = [target]
target.flags.blockedActions[blockKey] = true
```

```js
{
  type: 'resolve_pending_effects'
}
```

Cierra el ciclo de efectos y limpia marcas temporales.

```js
{
  type: 'link_fates'
}
```

Enlaza dos objetivos: si uno recibe `set_property inPlay=false`, el otro tambien.

### `repeat`

Define si la accion se repite.

Ejemplos:

```text
once_per_game
once_per_cycle
each_cycle
manual
```

Para una Vidente/Oraculo:

```text
each_cycle
```

Para Cupido:

```text
once_per_game
```

### `consumes`

Define si usar la accion consume algo.

Ejemplos:

```js
null
```

No consume nada.

```js
{ type: 'action_token', tokenId: 'heal_once' }
```

Consume un token concreto.

```js
{ type: 'charge', amount: 1 }
```

Consume una carga.

### `visibility`

Define quien ve el resultado.

Ejemplos:

```text
actor_only
all
storyteller_only
target_only
hidden
```

Para inspeccionar rol:

```text
actor_only
```

El jugador que inspecciona ve el resultado.

Para revelar victimas al amanecer:

```text
all
```

Todos lo ven.

## Ejemplo 1: inspeccionar rol

Mecanica generica:

```text
Cada noche, el actor elige un jugador en juego que no sea el mismo y ve su rol.
```

Regla:

```js
{
  id: 'inspect_role',
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
    type: 'reveal_property',
    property: 'roleId'
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: 'actor_only'
}
```

Skins posibles:

```text
Vidente
Oraculo
Scanner
Operador de periscopio
Agente de inteligencia
```

## Ejemplo 2: cambiar participacion principal

Mecanica generica:

```text
Cada noche, los miembros en juego de una faccion eligen un objetivo en juego de fuera de su faccion e intentan aplicar `set_in_play(false)`.
```

Si el objetivo ya tenia bloqueada la accion `set_in_play(false)`, la accion se
intenta igualmente contra ese objetivo, pero falla automaticamente. El actor no
necesita saber que el objetivo tenia esa bloqueo.

Regla:

```js
{
  id: 'set_in_play',
  phase: 'each_night',
  actor: {
    type: 'faction_group',
    factionId: 'predators'
  },
  target: {
    type: 'role_instance',
    count: 1,
    filters: ['in_play', 'not_same_faction']
  },
  effect: {
    type: 'set_property',
    targetType: 'role_instance',
    property: 'inPlay',
    value: false
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: 'storyteller_only'
}
```

Skins posibles:

```text
Hombres lobo devoran
Aliens infectan
Predators cazan
Nazis ejecutan una operacion
```

## Ejemplo 3: bloqueo de salida del juego principal

Mecanica generica:

```text
Cada noche, el actor bloquea sobre un objetivo en juego la accion `set_in_play(false)`. No puede aplicar efectivamente el mismo bloqueo al mismo objetivo en ciclos consecutivos.
```

El bloqueo debe existir antes del intento para surtir efecto. No es una cura
posterior y no restaura `inPlay=true` si el cambio ya se aplico.

Cuando el bloqueo se aplica correctamente, el motor registra el hecho en
`session.actionHistory`. Ese historial permite impedir que el mismo actor
prevenga al mismo objetivo en el ciclo siguiente.

Regla:

```js
{
  id: 'block_out_of_play',
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
      type: 'prevent_repeat_target',
      window: 'current_or_previous_cycle'
    }
  ],
  effect: {
    type: 'block_action',
    blocks: {
      actionId: 'set_in_play',
      params: {
        property: 'inPlay',
        value: false
      }
    },
    duration: 'current_cycle'
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: 'storyteller_only'
}
```

Skins posibles:

```text
Defensor
Guardian
Medico de combate
Escudo energetico
Angel custodio
```

## Ejemplo 4: resolver efectos pendientes

Mecanica generica:

```text
Al cerrar la noche, el sistema cierra el ciclo de efectos y limpia marcas temporales.
```

Regla:

```js
{
  id: 'resolve_pending_effects',
  phase: 'daybreak',
  actor: {
    type: 'system'
  },
  target: {
    type: 'all_role_instances',
    count: 'automatic'
  },
  effect: {
    type: 'resolve_pending_effects'
  },
  repeat: 'each_cycle',
  consumes: null,
  visibility: 'all'
}
```

Esta accion pertenece al motor, no a una skin concreta.

## Como iremos implementando

No implementaremos todo este lenguaje de golpe.

Orden recomendado:

1. Definir `inspect_role`.
2. Crear demo que resuelva `inspect_role`.
3. Definir `set_in_play`.
4. Crear demo que aplique `set_property inPlay=false`.
5. Definir `block_action`.
6. Crear demo donde `block_out_of_play` haga fallar `set_in_play(false)`.
7. Definir `resolve_pending_effects`.
8. Crear demo que cierre el ciclo y limpie bloqueos temporales.
9. Registrar `block_out_of_play` en `session.actionHistory`.
10. Crear demo de "no bloquear al mismo objetivo dos ciclos consecutivos".
11. Definir condiciones de victoria simples.

Cada regla nueva debe tener:

- descripcion humana;
- estructura de datos;
- demo visible en `tools/`;
- comentarios en el codigo que la ejecuta.

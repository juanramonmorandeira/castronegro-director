# Inventario de recetas del motor

Este documento lista las recetas mecanicas ya usadas por el nucleo limpio.

Regla base:

```text
accion pura = operacion simple
receta = actionKey + accion pura + configuracion + restricciones
```

`actionModel.js` debe recibir acciones puras. `recipeModel.js` valida
restricciones y convierte la receta en accion pura.

`recipeCatalog.js` contiene recetas reutilizables ya definidas. No ejecuta
nada: solo devuelve objetos de receta para que una skin, roleDefinition o
poolDefinition los coloque dentro de un stage.

Separacion:

```text
recipeCatalog -> define recetas conocidas
recipeModel        -> valida y resuelve una receta recibida
actionModel        -> ejecuta acciones puras
```

Resolver una receta no cierra el stage. El flujo normal es:

```text
resolveCurrentStage  -> ejecuta una receta
completeCurrentStage -> cierra el stage cuando player/director/sistema lo pide
```

Esto permite que un mismo stage tenga varias recetas opcionales y que el ritmo
lo controle una decision explicita, no la velocidad del motor.

Formato recomendado para un stage con varias recetas:

```js
{
  key: 'stage_03',
  completion: {
    mode: 'manual',
    allowedRequesters: ['player', 'director', 'system']
  },
  actions: [
    {
      key: 'restore_recent_out_of_play',
      optional: true
    },
    {
      key: 'set_out_of_play',
      optional: true
    }
  ]
}
```

`optional` expresa si la receta puede omitirse antes de cerrar el stage. No
desactiva validaciones cuando la receta se ejecuta.

## Contrato de recipe, actor y stage

Definiciones aceptadas:

```text
Actor  -> declara quien tiene autoridad mecanica para ejecutar una recipe.
Recipe -> define la mecanica reusable.
Stage  -> define el contexto concreto de ejecucion.
Session -> aporta los roles/groups reales.
Input  -> aporta la intencion humana concreta: seleccion, target, confirmacion.
```

Tipos base de actor:

```js
actor: { type: 'role' }     // actua un role individual
actor: { type: 'group' }    // actua un conjunto de roles derivado por stage/session
actor: { type: 'system' }   // accion automatica del motor
actor: { type: 'director' } // accion explicita del director de partida
```

Los tipos `role`, `group`, `session` y `objectiveRule` viven en
`MECHANICAL_ENTITY_TYPES`. El nombre evita confundirlos con todas las entidades
posibles del dominio: son sujetos mecanicos usados en contracts de actor, target,
effect, holder e influence.

La recipe debe declarar solo el tipo base cuando sea posible. La stage/session
materializa el actor concreto. Por ejemplo, `set_out_of_play` declara
`actor: { type: 'group' }`; la stage concreta decide que group actua.

En acciones colectivas, el historial debe poder conservar el actor mecanico y
los roles vivos que lo componian en ese momento:

```js
{
  actionKey: 'set_out_of_play',
  actor: {
    type: 'group',
    groupId: 'group_alignment_b',
    memberRoleIds: ['role_b_0', 'role_b_1']
  },
  selectorIds: ['role_b_0', 'role_b_1'],
  targetIds: ['role_a_0'],
  actorContract: { type: 'group' },
  targetContract: {
    type: 'role',
    count: 1,
    filters: ['in_play', 'not_same_alignment']
  }
}
```

Filtros base aceptados:

```text
in_play
not_in_play
not_self
same_alignment
not_same_alignment
recently_out_of_play
assumable
distinct
```

El catalogo de filtros es cerrado: el motor rechaza filtros desconocidos. Se
pueden anadir filtros nuevos, pero no usarlos como strings libres sin soporte
del dominio.

Overrides permitidos desde una stage:

```text
actor
target
usage
constraints
visibility
optional
metadata
influences
```

Overrides bloqueados desde una stage:

```text
id
effect
```

Cambiar `effect` cambia la naturaleza de la recipe. Cambiar `id` cambia la
action pura que ejecuta el motor; por tanto, tambien debe tratarse como otra
recipe o como una factory explicita futura, no como un override casual. Si un
override intenta cambiar `id` o `effect`, el dominio genera un diagnosticError
`recipe/blocked-override`. Si usa un campo no permitido, genera
`recipe/unknown-override`.

## Restricciones disponibles

### `no_repeat_target`

Impide repetir la misma receta sobre el mismo target dentro de una ventana.
La receta puede seguir usandose; lo que queda restringido es repetir ese
mismo target bajo la ventana configurada.

Campos principales:

```js
{
  type: 'no_repeat_target',
  window: 'current_or_next_cycle'
}
```

Lectura de ventanas:

```text
current_cycle         -> no repetir target dentro del ciclo actual
next_cycle            -> no repetir target en el ciclo inmediatamente posterior
current_or_next_cycle -> combina current_cycle y next_cycle
session               -> no repetir ese target durante toda la partida
```

El motor evalua desde el ciclo actual mirando `session.actionHistory`. Por eso
`next_cycle` significa que una entrada del ciclo anterior bloquea este ciclo:
este ciclo es el siguiente respecto al uso registrado.

### `require_recent_set_property`

Exige que el target haya recibido antes un `set_property` concreto.

Campos principales:

```js
{
  type: 'require_recent_set_property',
  window: 'current_cycle',
  property: 'inPlay',
  value: false,
  actionKey: 'set_out_of_play'
}
```

### `usage` y `limited_uses`

`usage` es el contrato publico de una recipe para declarar cuantas veces puede
usarla un actor dentro de una ventana. El motor lo traduce internamente a una
constraint `limited_uses` antes de validar la recipe.

Forma recomendada en recipe:

```js
usage: {
  limit: 1,
  window: 'session'
}
```

Forma interna generada:


```js
{
  type: 'limited_uses',
  limit: 1,
  window: 'session'
}
```

Valores iniciales:

```text
window:
- stage
- pool
- cycle
- current_cycle
- next_cycle
- current_or_next_cycle
- session
```

Lectura:

```text
usage.limit = null significa uso ilimitado.
Una recipe opcional que se omite no consume uso.
Una recipe valida consume uso aunque su efecto quede bloqueado.
Una recipe invalida antes de ejecutarse no consume uso.
```

Cuenta cualquier intento registrado con el mismo role actor y el mismo
`actionKey` dentro de la ventana. Si el efecto queda bloqueado, tambien consume
uso.

## Recetas definidas

Las recetas del nucleo viven en `src/lib/domain/recipeCatalog.js`.

### `inspect_role`

Accion pura:

```text
inspect_role
```

Configuracion principal:

```text
effect: reveal_property roleId
target: 1 role
filters: in_play, not_self
```

Restricciones:

```text
ninguna
```

### `link_targets`

Accion pura:

```text
link_targets
```

Configuracion principal:

```text
effect: set_group linked
target: 2 roles
filters: in_play, distinct
```

Restricciones:

```text
ninguna
```

### `block_out_of_play`

Accion pura:

```text
block_property_change
```

Configuracion principal:

```text
blockedPropertyChange: property=inPlay, value=false
blockedFor: group group_concealed_set_out_of_play y roles con alignment_b materializados
duration: pool actual, boundary after
target: 1 role
filters: in_play, not_self
```

Restricciones:

```js
[
  {
    type: 'no_repeat_target',
    window: 'current_or_next_cycle'
  }
]
```

### `set_out_of_play`

Accion pura:

```text
set_in_play
```

Configuracion principal:

```js
{
  key: 'set_out_of_play',
  id: 'set_in_play',
  actor: { type: 'group' },
  target: {
    type: 'role',
    count: 1,
    filters: ['in_play', 'not_same_alignment']
  },
  usage: { limit: null, window: 'session' },
  effect: {
    type: 'set_property',
    property: 'inPlay',
    value: false
  }
}
```

Restricciones base:

```text
ninguna
```

Nota: una skin no anade restricciones mecanicas. Las restricciones mecanicas
viven en ruleSet/role/group/recipe; la skin solo presenta el resultado.

La misma recipe puede ser limitada por la stage que la usa:

```js
usage: {
  limit: 1,
  window: 'session'
}
```

Lectura:

```text
No hace falta crear otra recipe para expresar que un uso es limitado. La
limitacion vive en recipe.usage y se traduce internamente a limited_uses.
```

### `restore_recent_out_of_play`

Accion pura:

```text
set_in_play
```

Configuracion principal:

```text
effect: set_property inPlay=true
target: 1 role
```

Restricciones y uso:

```js
constraints: [
  {
    type: 'require_recent_set_property',
    window: 'current_cycle',
    property: 'inPlay',
    value: false,
    actionKey: 'set_out_of_play',
    stageCatalogId: 'concealed_set_out_of_play' // cuando la aporta role_in_out_of_play en basic_ruleset
  }
],
usage: {
  limit: 1,
  window: 'session'
}
```

Lectura:

```text
Puede restaurar un target solo si ese target recibio inPlay=false este ciclo
por la receta set_out_of_play. El mismo actor solo puede usar esta receta una
vez en la partida.

En `basic_ruleset`, cuando la usa `role_in_out_of_play`, la constraint se acota
a `stageCatalogId: concealed_set_out_of_play`. Eso evita que el restore se
active por un `set_out_of_play` de otra stage catalogada.
```

### Seleccion + receta

`select` ya no es una receta de catalogo. Es un mecanismo de stage:

```text
stage.selectionRules -> selectionModel -> chosenId / empate / nulo
```

Si hay `chosenId`, `stageModel` ejecuta la receta normal declarada en
`stage.actions` usando ese `chosenId` como `targetId`.

Ejemplo actual:

```text
exposed_set_out_of_play
  selectionRules:
    required: all_selectors
    abstain: not_allowed
    unanimous: not_required
    tie: null_on_tie
    runoff: tied_candidates
    nullResult: end_as_null
    repeatLimit: 1
    abstainResolution: ignore
    supportThreshold: none
    candidateIds: null -> todos los roles inPlay
  actions:
    set_out_of_play
```

Lectura: el seleccion elige un target; la receta `set_out_of_play` aplica
`set_in_play(inPlay=false)` sobre ese target. La misma estructura podra elegir
para aplicar otra receta distinta sin crear una receta compuesta nueva.

Si existe un group `linked` activo, su propia `selectionRules` puede aportar
`groupRestrictions` a esta seleccion. `exposed_set_out_of_play` no conoce
`linked` por si mismo.

### `start_cycle`

Accion pura:

```text
start_cycle
```

Configuracion principal:

```text
limpia flags temporales
avanza currentCycleId
```

Restricciones:

```text
ninguna
```

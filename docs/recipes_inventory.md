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
poolDefinition los coloque dentro de un step.

Separacion:

```text
recipeCatalog -> define recetas conocidas
recipeModel        -> valida y resuelve una receta recibida
actionModel        -> ejecuta acciones puras
```

Resolver una receta no cierra el step. El flujo normal es:

```text
resolveCurrentStep  -> ejecuta una receta
completeCurrentStep -> cierra el step cuando player/director/sistema lo pide
```

Esto permite que un mismo step tenga varias recetas opcionales y que el ritmo
lo controle una decision explicita, no la velocidad del motor.

Formato recomendado para un step con varias recetas:

```js
{
  key: 'step_03',
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

`optional` expresa si la receta puede omitirse antes de cerrar el step. No
desactiva validaciones cuando la receta se ejecuta.

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

### `limited_uses`

Limita cuantas veces puede usar un actor una receta concreta dentro de una
ventana.

Campos principales:

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
- current_cycle
- next_cycle
- current_or_next_cycle
- session
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
block_action
```

Configuracion principal:

```text
blocks: set_in_play(property=inPlay, value=false)
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

```text
effect: set_property inPlay=false
target: 1 role
```

Restricciones base:

```text
ninguna
```

Nota: una skin puede anadir restricciones propias, por ejemplo `limited_uses`.

### `one_shot_set_out_of_play`

Accion pura:

```text
set_in_play
```

Configuracion principal:

```text
effect: set_property inPlay=false
target: 1 role
```

Restricciones:

```js
[
  {
    type: 'limited_uses',
    limit: 1,
    window: 'session'
  }
]
```

Lectura:

```text
Es una receta distinta de set_out_of_play aunque use la misma accion pura.
Su actionKey propio permite contar limited_uses sin mezclarla con otros
set_in_play(false) de la partida.
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

Restricciones:

```js
[
  {
    type: 'require_recent_set_property',
    window: 'current_cycle',
    property: 'inPlay',
    value: false,
    actionKey: 'set_out_of_play'
  },
  {
    type: 'limited_uses',
    limit: 1,
    window: 'session'
  }
]
```

Lectura:

```text
Puede restaurar un target solo si ese target recibio inPlay=false este ciclo
por la receta set_out_of_play. El mismo actor solo puede usar esta receta una
vez en la partida.
```

### Seleccion + receta

`select` ya no es una receta de catalogo. Es un mecanismo de step:

```text
step.selectionRules -> selectionModel -> chosenId / empate / nulo
```

Si hay `chosenId`, `stepModel` ejecuta la receta normal declarada en
`step.actions` usando ese `chosenId` como `targetId`.

Ejemplo actual:

```text
group_selection
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
    groupRestrictions: exclude_group_member_target linked
  actions:
    set_out_of_play
```

Lectura: el seleccion elige un target; la receta `set_out_of_play` aplica
`set_in_play(inPlay=false)` sobre ese target. La misma estructura podra elegir
para aplicar otra receta distinta sin crear una receta compuesta nueva.

### `close_cycle`

Accion pura:

```text
close_cycle
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

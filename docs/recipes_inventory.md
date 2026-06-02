# Inventario de recetas del motor

Este documento lista las recetas mecanicas ya usadas por el nucleo limpio.

Regla base:

```text
accion pura = operacion simple
receta = actionKey + accion pura + configuracion + restricciones
```

`actionModel.js` debe recibir acciones puras. `recipeModel.js` valida
restricciones y convierte la receta en accion pura.

## Restricciones disponibles

### `prevent_repeat_target`

Impide repetir la misma receta sobre el mismo target dentro de una ventana.

Campos principales:

```js
{
  type: 'prevent_repeat_target',
  window: 'current_or_previous_cycle'
}
```

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

Limita cuantas veces puede usarse una receta segun ventana y scope.

Campos principales:

```js
{
  type: 'limited_uses',
  limit: 1,
  window: 'session',
  scope: 'actor_recipe'
}
```

Valores iniciales:

```text
window:
- current_cycle
- previous_cycle
- current_or_previous_cycle
- session

scope:
- actor_recipe
- actor
- recipe
```

Cuenta cualquier intento registrado de la receta dentro del scope y ventana.
Si el efecto queda bloqueado, tambien consume uso.

## Recetas definidas

### `inspect_role`

Accion pura:

```text
inspect_role
```

Configuracion principal:

```text
effect: reveal_property roleId
target: 1 role_instance
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
effect: set_relation linked
target: 2 role_instances
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
target: 1 role_instance
filters: in_play, not_self
```

Restricciones:

```js
[
  {
    type: 'prevent_repeat_target',
    window: 'current_or_previous_cycle'
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
target: 1 role_instance
```

Restricciones base:

```text
ninguna
```

Nota: una skin puede anadir restricciones propias, por ejemplo `limited_uses`.

### `restore_recent_out_of_play`

Accion pura:

```text
set_in_play
```

Configuracion principal:

```text
effect: set_property inPlay=true
target: 1 role_instance
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
    window: 'session',
    scope: 'actor_recipe'
  }
]
```

Lectura:

```text
Puede restaurar un target solo si ese target recibio inPlay=false este ciclo
por la receta set_out_of_play. El mismo actor solo puede usar esta receta una
vez en la partida.
```

### `vote_out_of_play`

Accion pura:

```text
vote
```

Configuracion principal:

```text
requiredVotes: all_in_play
tiePolicy: null_on_tie
relationRestrictions: prevent_related_target linked
onWinnerAction: set_in_play(inPlay=false)
```

Restricciones:

```text
ninguna por ahora
```

Nota: `vote` solo devuelve ganador/empate/nulo. `onWinnerAction` define que
accion se aplica al ganador. Otras votaciones podran reutilizar `vote` con otra
accion posterior.

### `resolve_pending_effects`

Accion pura:

```text
resolve_pending_effects
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

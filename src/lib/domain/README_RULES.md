# Lenguaje de reglas

Este documento resume como describir reglas mecanicas sin depender de una skin
concreta.

## Principio

El motor no sabe que es una vidente, una bruja o un cazador. El motor sabe
trabajar con acciones, recetas, restricciones, efectos y relaciones.

Una skin puede vestir esos elementos con nombres, textos, imagenes y traducciones.

## Conceptos

### Role

Definicion mecanica de un tipo de rol.

```js
createRole({
  key: 'role_01',
  alignmentId: 'alignment_a',
  stepDefinitions: []
})
```

Un `Role` no es una carta en partida. Es una plantilla mecanica. Puede definir
alignment por defecto y los `stepDefinitions` que ese tipo de rol aporta al
flujo.

### Session role

Rol concreto dentro de una sesion.

```js
createSessionRole({
  id: 'role_01-0',
  roleKey: 'role_01',
  playerId: 'player-1',
  inPlay: true
})
```

Un `Role` es la unidad jugable. Las acciones, relaciones, filtros,
selecciones y efectos apuntan a roles, no a roles abstractos.

Regla practica:

```text
Role catalog/definition = plantilla reutilizable
Session role = rol concreto dentro de una sesion
roleKey = que plantilla usa
roleId = id del rol concreto en sesion
```

### Group

Coleccion mecanica de roles. Vive en `session.groups`.

Ejemplos:

- todos los roles de un alignment;
- todos los roles linked;
- todos los roles inPlay;
- un grupo definido por flag.

Un grupo puede empezar vacio y llenarse durante la sesion. Por ejemplo, un
grupo basado en `linked` no tendra miembros hasta que una accion cree esa
relacion.

### Step

Unidad ejecutable dentro de un pool.

El step define:

- `key`
- `actor`
- `actions`
- `completion`
- `metadata`

El nombre del step debe ser neutro, por ejemplo `step_01`.

Las recetas ejecutables viven en `step.actions`. Roles y groups solo aportan
`stepDefinitions`.

### Pool

Bloque ordenado de steps.

Pools actuales:

- `poolDeployment`
- `poolConcealed`
- `poolExposed`
- `poolSpecial`

El orden vive en arrays, no en nombres narrativos.

### Recipe

Receta mecanica reutilizable. Combina accion pura, parametros, restricciones y
posibles acciones derivadas.

Ejemplo:

```text
restore_recent_out_of_play = set_in_play(true) + require_recent_set_property
```

La receta no decide en que momento se ejecuta. Eso pertenece al step/pool.

### Constraint

Restriccion de uso de una receta.

Ejemplos actuales:

- `limited_uses`
- `no_repeat_target`
- `require_recent_set_property`

### Action

Intento mecanico puro.

Ejemplos actuales:

- `inspect_role`
- `set_in_play`
- `block_action`
- `link_targets`
- `select`
- `close_cycle`

### Effect

Consecuencia mecanica aplicable o revelable.

Ejemplos actuales:

- `reveal_property`
- `set_property`
- `set_group`
- `block_action`
- `close_cycle`

### Group

Coleccion mecanica de roles. Vive en `session.groups`.

Ejemplo:

```js
createGroup({
  type: 'linked',
  roleIds: ['role_a-0', 'role_b-0']
})
```

## Nombres

Buenos nombres para el motor:

- `set_in_play`
- `block_action`
- `link_targets`
- `inspect_role`
- `linked`
- `alignment_a`

Malos nombres para el motor:

- nombres de personajes concretos;
- verbos ligados a una ambientacion;
- nombres que impliquen muerte, amor, magia o tecnologia concreta.

La skin decide como presentar cada mecanica.

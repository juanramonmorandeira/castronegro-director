# Lenguaje de reglas

Este documento resume como describir reglas mecanicas sin depender de una skin
concreta.

## Principio

El motor no sabe que es una vidente, una bruja o un cazador. El motor sabe
trabajar con roles, groups, stages, selecciones, recetas, restricciones,
acciones y efectos.

Una skin puede vestir esos elementos con nombres, textos, imagenes y traducciones.

## Conceptos

### Role

Definicion mecanica de un tipo de rol.

```js
defineRole({
  key: 'role_01',
  alignmentId: 'alignment_a',
  stageDefinitions: [],
  specialStageDefinitions: []
})
```

Un `Role` no es una carta en partida. Es una plantilla mecanica. Puede definir
alignment por defecto y los `stageDefinitions` que ese tipo de rol aporta al
flujo. `specialStageDefinitions` contiene los stages iniciales que aporta a la
cola `specialStages`.

### Session role

Rol concreto dentro de una sesion.

```js
createRole({
  id: 'role_01-0',
  roleKey: 'role_01',
  playerId: 'player-1',
  inPlay: true
})
```

Un `Role` es la unidad jugable. Las acciones, groups, filtros,
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

Un group puede empezar vacio y llenarse durante la session. Por ejemplo, un
group de tipo `linked` no tendra miembros hasta que una action lo cree.

### Stage

Unidad ejecutable dentro de un pool.

La stageDefinition define:

- `key`
- `recipes`
- `completion`
- `metadata`

El stage runtime anade datos de session como `actorIds` y `status`.

El nombre del stage debe ser neutro, por ejemplo `stage_01`.

Las recetas ejecutables viven en `stage.recipes`. Roles y groups solo aportan
`stageDefinitions`.

### Pool

Bloque ordenado de stages.

Pools actuales:

- `poolConcealed`
- `poolExposed`

El orden vive en arrays, no en nombres narrativos.

`specialStages` no es un pool. Es una cola FIFO independiente de stages
dinamicos administrada por `specialStagesModel.js`.

Un stage no lleva una propiedad de clasificacion especial. Su ubicacion depende
de si fue materializado en `cycle.pools` o en `session.specialStages`.

Identidad:

- `cycle.id` representa `cycleId`, el numero de iteracion.
- `pool.key` representa `poolKey`; no existe `poolId`.
- `stage.key` representa `stageKey`, la definicion mecanica.
- `stage.id` representa `stageId`, la materializacion runtime unica.

Dos stages pueden compartir `stageKey`, pero nunca `stageId`. El cursor cambia
estado por `stageId`.

### Recipe

Receta mecanica reutilizable. Combina accion pura, parametros, restricciones y
posibles acciones derivadas.

Ejemplo:

```text
restore_recent_out_of_play = set_in_play(true) + require_recent_set_property
```

La receta no decide en que momento se ejecuta. Eso pertenece al stage/pool.

### Constraint

Restriccion de uso de una receta.

Ejemplos actuales:

- `limited_uses` derivada desde `recipe.usage`
- `no_repeat_target`
- `require_recent_set_property`
- `require_actor_in_play`

### Action

Intento mecanico puro.

Ejemplos actuales:

- `inspect_role`
- `set_in_play`
- `block_property_change`
- `link_targets`
- `select`

### Effect

Consecuencia mecanica aplicable o revelable.

Ejemplos actuales:

- `reveal_property`
- `set_property`
- `set_group`
- `block_property_change`

### GroupRule

Regla declarativa asociada a un group.

```js
{
  type: 'propagate_property_change',
  when: { property: 'inPlay', value: false },
  apply: { property: 'inPlay', value: false },
  targets: 'other_members'
}
```

El `group.type` clasifica el group, pero no activa comportamiento por si solo.

## Nombres

Buenos nombres para el motor:

- `set_in_play`
- `block_property_change`
- `link_targets`
- `inspect_role`
- `linked`
- `alignment_a`

Malos nombres para el motor:

- nombres de personajes concretos;
- verbos ligados a una ambientacion;
- nombres que impliquen muerte, amor, magia o tecnologia concreta.

La skin decide como presentar cada mecanica.

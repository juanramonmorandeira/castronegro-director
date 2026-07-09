# State Rule Model

Este documento define el lenguaje vigente del nucleo anonimo para describir
estado, condiciones, selecciones, acciones y reglas.

## Principio base

El motor procesa reglas declarativas y funciones conocidas:

1. lee estado;
2. obtiene una decision cuando es necesaria;
3. intenta producir cambios;
4. resuelve bloqueos y propagaciones;
5. aplica efectos;
6. registra el resultado;
7. evalua objetivos al completar el pool.

El motor no interpreta texto libre ni vocabulario narrativo de una skin.

## Conceptos

`role` = sujeto mecanico principal materializado en una session.

`group` = conjunto estable de roles requerido por una regla o mecanica.

`property` = dato de estado legible o modificable de un role.

`condition` = lectura o comparacion que no modifica estado.

`action` = intento de producir un cambio o resultado mecanico.

`effect` = cambio ya resuelto que puede aplicarse a la session.

`rule` = declaracion que combina condiciones, restricciones y consecuencias.

`stage` = unidad ejecutable dentro de un pool.

`select` = mecanismo general para obtener una decision individual o colectiva.

## Estado de role

Las propiedades runtime permanecen planas mientras no exista una necesidad real
de encapsularlas:

```js
{
  id: 'role_01-0',
  roleKey: 'role_01',
  alignmentId: 'alignment_a',
  inPlay: true,
  blockedPropertyChanges: []
}
```

Los cambios deben pasar por funciones del modelo. No se escribe directamente
estado critico sin comprobar antes restricciones y bloqueos.

## Bloqueos de propiedades

Un bloqueo impide un cambio concreto `(property, value)` para actores
determinados:

```js
{
  id: 'property-block-01',
  property: 'inPlay',
  value: false,
  blockedFor: {
    actorIds: ['role_attacker-0', 'role_attacker-1']
  },
  expiresAt: {
    type: 'pool_boundary',
    cycleId: 2,
    poolKey: 'poolConcealed',
    boundary: 'after'
  },
  metadata: {}
}
```

Reglas aceptadas:

- bloquear `inPlay=false` no bloquea `inPlay=true`;
- los bloqueos viven en `role.blockedPropertyChanges`;
- persisten hasta su vencimiento y no se consumen al impedir un cambio;
- entradas completamente identicas pueden deduplicarse;
- cada cambio, incluido uno propagado, se valida de forma independiente;
- `blockedFor.actorIds` identifica al actor mecanico inmediato del cambio.

Una recipe declara una duracion relativa:

```js
{
  unit: 'stage' | 'pool' | 'cycle' | 'session',
  offset: 0,
  boundary: 'before' | 'after'
}
```

`recipeModel` la convierte en un `expiresAt` absoluto. `before + offset 0` es
invalido.

Las fronteras responsables son:

| Frontera | Responsable |
| --- | --- |
| `stage_boundary.before` | `stage.onEnter` |
| `stage_boundary.after` | `stage.onExit` |
| `pool_boundary.before` | `pool.onEnter` |
| `pool_boundary.after` | `pool.onExit` |
| `cycle_boundary.before` | `cycle.onEnter` |
| `cycle_boundary.after` | `cycle.onExit` |
| `session` | no expira automaticamente |

Los offsets de pool recorren `cycle.poolOrder`. Los offsets de stage cuentan
stages disponibles pendientes del pool actual. Si no existe un stage destino,
el vencimiento cae en `pool_boundary.after`.

## Selection

`select` es la unica operacion de eleccion del motor. No existen funciones
runtime separadas para una eleccion individual y una colectiva.

Primero se construyen los candidatos:

```js
candidateIds = filterCandidateIds({
  roleIds,
  selectorIds,
  candidateRules,
  context
})
```

Despues se resuelve la seleccion:

```js
selectionResult = select({
  selectorIds,
  candidateIds,
  selectionRules,
  input
})
```

Lectura:

```text
candidateRules = quien puede ser elegido
selectionRules = como deciden los selectorIds
```

Una seleccion con un solo `selectorId` es individual. Con varios
`selectorIds`, las `selectionRules` pueden definir unanimidad, abstencion,
umbrales o desempates.

Resultados posibles:

```text
chosen
null
runoff
error
```

`optional` no pertenece a selection. Si una action opcional no se usa, la
selection no llega a ejecutarse.

## Conditions, actions y effects

Una condition solo lee:

```text
role.inPlay == true
role.alignmentId == alignment_b
group members inPlay >= otros roles inPlay
```

Una action intenta producir un resultado:

```text
set_in_play
block_property_change
link_targets
inspect_role
select
```

El resolver decide que efectos sobreviven:

```text
action -> resolver -> effect
```

Los efectos conservan `causedBy`, la causa mecanica inmediata. Una propagacion
causada por una regla de group usa el id de ese group, no el actor remoto que
inicio una cadena anterior.

## Groups y propagacion

Un group se materializa cuando la session necesita una coleccion estable de
roles. Su comportamiento se declara en `groupRules`; `group.type` no activa
logica por si mismo.

Ejemplo:

```js
{
  id: 'group_linked_01',
  key: 'linked',
  roleIds: ['role_a-0', 'role_b-0'],
  groupRules: [
    {
      type: 'propagate_property_change',
      when: { property: 'inPlay', value: false },
      apply: { property: 'inPlay', value: false },
      targets: 'other_members'
    }
  ]
}
```

Cada cambio propagado se vuelve a resolver contra los bloqueos de su objetivo.
Si la propagacion la causa `group_linked_01`, ese es su `causedBy`.

## Stages, pools y cycle

Identidad:

```text
cycleId = numero de iteracion del ciclo
poolKey = posicion mecanica estable dentro del ciclo
stageKey = definicion mecanica reutilizable
stageId = materializacion runtime unica
```

Un pool contiene:

```js
{
  key,
  stages: [],
  onEnter: [],
  onExit: [],
  currentStageIndex: 0
}
```

Flujo:

```text
pool.onEnter
  -> review pool_boundary.before
  -> preparePool
  -> validatePool
  -> operaciones de entrada
  -> stages
  -> operaciones de salida
  -> check_objectives
  -> review pool_boundary.after
pool completado
```

`startCycle` pertenece a `cycleModel`, no a un pool. El ciclo controla el orden
de pools y comprueba `queue` antes de entrar en el siguiente pool.

## Availability rules

`availabilityRules` determina si un stage persistente esta disponible en una
iteracion concreta:

```js
{
  all: [],
  any: []
}
```

Tipos iniciales:

```text
actor_in_play
has_executable_recipe
within_execution_window
always_available
```

Estados runtime:

```text
enabled
disabled
done
finished
```

- `disabled` es temporal y se reevalua al preparar el pool.
- `done` indica que el stage ya se ejecuto en esa entrada del pool.
- `finished` es permanente y no vuelve a evaluarse.

## Special stages

`session.queues` contiene colas FIFO independientes. No son pools, no se
prepara y no forma parte de `cycle.poolOrder`.

El cursor usa `session.currentStageSource` para distinguir si esta ejecutando
un stage de pool o uno de la cola. La existencia de stages pendientes no
interrumpe un pool a mitad de ejecucion.

Se procesa:

- al inicio de la session si contiene stages;
- despues de completar un pool;
- antes de entrar en el siguiente pool.

Un stage de queue que genera otro stage de queue lo añade al final de la misma
cola. Cada stage completado se elimina.

Las definiciones iniciales de cola viven en `queueStageDefinitions`. Los
stages generados por reacciones entran en la cola por la respuesta del evento.
El objeto stage no contiene una bandera de clasificacion.

## Objetivos

`check_objectives` evalua exclusivamente `session.objectiveRules`.

```js
checkObjectives(session) {
  return evaluateSessionObjectiveRules(session.objectiveRules, session);
}
```

No existen condiciones implicitas codificadas en el motor. RuleSet y roles
aportan las definiciones que se materializan en `session.objectiveRules`.

La evaluacion ocurre al completar cada pool y tambien cuando se vacia
`queue`. `conclude_play` solo se ejecuta cuando existe un
`playOutcome` concluyente y estable.

## Construccion

Convencion:

```text
defineX = describe un objeto antes de session
createX = materializa un objeto runtime
buildX = ensambla varios objetos o definiciones
```

`buildSession` coordina el ensamblaje final:

```text
ruleSet + runMode + match
  -> buildSession
  -> roles
  -> groups
  -> cycle.pools
  -> queue
  -> session
```

El analisis declarativo mas general de reglas y un futuro
`materializerCoordinator` permanecen en la TODO. No forman parte aun del
contrato runtime implementado.

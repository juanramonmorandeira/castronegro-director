# Domain engine

Este directorio contiene el nucleo mecanico del juego. No depende de Svelte,
Firebase, i18n, CSS ni assets.

## Convencion de archivos

### `index.js`

Puerta publica del nucleo. Exporta constructores, catalogos, constantes y
funciones principales de ejecucion/consulta.

No debe exportar automaticamente todos los helpers internos de cada archivo. Si
una funcion auxiliar necesita salir por `index.js`, primero debe tener sentido
como API estable del nucleo.

### `defineX`, `createX` y `buildX`

Las definiciones y los objetos runtime tienen puertas distintas:

Ejemplos:

- `defineRole` describe un role antes de session.
- `createRole` materializa un role runtime.
- `buildRoles` ensambla roles desde definiciones y asientos.
- `defineGroup` describe un group antes de session.
- `createGroup` materializa un group runtime.
- `buildGroups` ensambla groups desde definiciones.
- `defineStage` describe un stage antes de session.
- `createStage` materializa un stage runtime.

Ejemplos:

- `buildSession`: crea roles y pools a partir de configuracion.
- `buildGroups`: ensambla grupos runtime desde sus definiciones.
- `buildPools`: junta stages de roles, grupos y sistema.

Regla practica:

```text
defineX describe un objeto antes de session.
createX materializa un unico objeto runtime.
buildX ensambla varios objetos/definiciones para preparar una parte jugable.
```

`buildSession` valida por defecto la sesion resultante. Si algun rol no tiene
jugador o asiento asignado, devuelve `ok: false` con la lista de errores.

### `*Catalog.js`

Bibliotecas de piezas mecanicas predefinidas.

Ejemplos:

- `roleCatalog.js`
- `groupCatalog.js`
- `stageCatalog.js`
- `actionCatalog.js`
- `recipeCatalog.js`

Los catalogos no ejecutan reglas. Devuelven definiciones ya preparadas mediante
funciones como `getCatalogStage` o `getCatalogRecipe`.

Un catalogo no contiene objetos completos de sesion. Contiene definiciones
reutilizables. Un role, group, stage, recipe o session solo queda completo
cuando se materializa con datos concretos de partida.

Ejemplo: un stage de catalogo puede declarar que existe una receta de seleccion,
pero no conoce todavia `actorIds`. Esos ids aparecen al construir la sesion,
cuando los roles y grupos reales ya existen.

### `*Model.js`

Logica runtime del motor.

Ejemplos:

- `poolCursorModel.js`: mueve el cursor entre stages.
- `stageDefinition.js`: constructor, vocabulario y validacion basica de stages.
- `stageModel.js`: ejecuta el ciclo runtime de stage, resuelve recipes y cierra
  stages.
- `recipeDefinition.js`: constructor y validacion de forma de recipes.
- `recipeModel.js`: ejecuta el ciclo runtime de recipe y entrega actions a
  `actionModel`.
- `actionModel.js`: resuelve acciones puras.
- `effectModel.js`: deriva o bloquea efectos propuestos.
- `effectModel.js`: aplica efectos finales a la sesion.
- `eventModel.js`: convierte efectos finales en eventos y crea respuestas
  pendientes.
- `objectiveModel.js`: evalua objetivos y conclusion de la parte jugable.
- `actionModel.js`: seleccion mecanica; resuelve chosen/empate/nulo.

## Flujo principal

```text
ruleSet + runMode + match
-> Role/Group/Stage catalog
-> buildSession
-> buildPools
-> createSession
-> resolveCurrentStage
-> completeCurrentStage
```

Resolver una receta no cierra el stage. El cierre se hace explicitamente con
`completeCurrentStage`.

Flujo de ciclo aceptado:

```text
queueBeforeConcealed si hay stages pendientes
-> poolConcealed
-> queueAfterConcealed si hay stages pendientes
-> publicReveal
-> queueBeforeExposed si hay stages pendientes
-> poolExposed
-> queueAfterExposed si hay stages pendientes
-> privateHide
-> poolConcealed
```

`queue` no es un pool. Cada queue es una cola FIFO catalogada que el ciclo
comprueba en su punto declarado del flujo.

`session.currentStageSource` indica si el cursor esta ejecutando un stage de
pool o de queue. Una queue pendiente no interrumpe el pool actual.

`startCycle` pertenece a `cycleModel` y se ejecuta antes de preparar
`poolConcealed`. `check_objectives` forma parte de `pool.onExit`.

Cuando el cierre de un stage completa un pool, `completeCurrentStage`
devuelve `lifecycleResults` para que la capa superior pueda ver que se
ejecuto, por ejemplo, `check_objectives` o `conclude_play`.

## Roles, stages y recetas

La relacion actual es esta:

```text
Role o Group
-> stageDefinitions
-> Stage
-> recipes
-> Recipe
```

Un rol no ejecuta recetas directamente. Un rol define que stages puede aportar
al flujo. Las recetas ejecutables viven dentro de `stage.recipes`.

Los stages iniciales que no pertenecen a pools se declaran por separado en
`queueStageDefinitions` y se materializan en `session.queues`.

Los stages de catalogo son abstractos. Los stages de sesion deben tener actores
reales en `actorIds`. Si un grupo esta vacio, no puede crear un stage enabled
jugable.

Un rol tambien puede declarar `reactions`. Una reaccion no se ejecuta por si
misma: `eventModel.js` la evalua cuando un efecto final produce un evento. El
primer caso implementado es `role_reactive`: cuando ese rol recibe un cambio
real a `inPlay=false` desde `concealed_set_out_of_play` o
`exposed_set_out_of_play`, se crea un stage en queue para que pueda
ejecutar una respuesta.

El motor debe ejecutar `check_objectives` al final de cada pool. Si se emite un
`playOutcome` concluyente, primero se comprueba que no haya stages pendientes en
queue capaces de modificarlo. Solo entonces se ejecuta
`conclude_play`.
`conclude_play` concluye la parte jugable, pero no cierra administrativamente la
session.

El modelo objetivo de decision es `select`:

- `candidateRules` construyen o acotan `candidateIds`;
- `selectionRules` gobiernan como `selectorIds` eligen entre esos candidates;
- `actionModel.js` cubre la decision mecanica reusable.

## Estado vivo

La sesion guarda:

- `players`
- `roles`
- `groups`
- `session.cycle.pools` contiene el mapa de pools runtime.
- `session.queues` contiene las colas FIFO runtime entre pools.
- `session.history.recipeHistory`
- `session.history.cycleHistory`
- `session.history.poolHistory`
- `session.history.stageHistory`
- `session.history.queueHistory`
- `sessionMessageLog`
- `errorLog`
- `settings`
- `status`

## Documentacion relacionada

- `docs/engine_scope.md`: limites y responsabilidades del motor.
- `docs/engine_flow_map.md`: mapa visual del flujo.
- `docs/skin_ruleset_session.md`: separacion entre presentacion, reglas, configuracion y partida viva.
- `docs/domain_glossary.md`: diccionario de terminos finales del nuevo nucleo.
- `docs/STATE_RULE_MODEL.md`: modelo conceptual de estado, reglas, seleccion y
  propiedades.
- `docs/objectiveDefinition.md`: objetivos, achievedObjectives, playOutcome y conclude_play.
- `src/lib/domain/README_RULES.md`: lenguaje mecanico de reglas.

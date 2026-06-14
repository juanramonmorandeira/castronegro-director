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

### `*Definition.js`

Constructores de objetos del motor.

Ejemplos:

- `createSession` en `sessionDefinition.js`
- `createRole` en `roleDefinition.js`
- `createSessionRole` en `roleDefinition.js`
- `createGroup` en `groupDefinition.js`
- `createStep` en `stepDefinition.js`
- `createPool` en `poolDefinition.js`

### `buildX`

Funciones de ensamblaje.

Ejemplos:

- `buildSession`: crea roles y stepPools a partir de configuracion.
- `buildInitialGroups`: resuelve miembros iniciales de grupos.
- `buildPools`: junta steps de roles, grupos y sistema.
- `buildStepPool`: construye los steps de un pool concreto.

Regla practica:

```text
createX construye un objeto.
buildX ensambla varios objetos/definiciones para preparar una parte jugable.
```

`buildSession` valida por defecto la sesion resultante. Si algun rol no tiene
jugador o asiento asignado, devuelve `ok: false` con la lista de errores.

### `*Catalog.js`

Bibliotecas de piezas mecanicas predefinidas.

Ejemplos:

- `roleCatalog.js`
- `groupCatalog.js`
- `stepCatalog.js`
- `recipeCatalog.js`

Los catalogos no ejecutan reglas. Devuelven definiciones ya preparadas mediante
funciones como `getCatalogStep` o `getCatalogRecipe`.

Un catalogo no contiene objetos completos de sesion. Contiene definiciones
reutilizables. Un role, group, step, recipe o session solo queda completo cuando
se materializa con datos concretos de partida.

Ejemplo: un step de catalogo puede declarar que existe una receta de seleccion, pero
no conoce todavia `actorIds`. Esos ids aparecen al construir la sesion, cuando
los roles y grupos reales ya existen.

### `*Model.js`

Logica runtime del motor.

Ejemplos:

- `poolCursorModel.js`: mueve el cursor entre steps.
- `stepModel.js`: conecta step actual con recipe/action y cierre de step.
- `recipeModel.js`: valida restricciones y transforma receta en accion pura.
- `actionModel.js`: resuelve acciones puras.
- `resolverModel.js`: deriva o bloquea efectos propuestos.
- `effectModel.js`: aplica efectos finales a la sesion.
- `eventModel.js`: convierte efectos finales en eventos y crea respuestas
  pendientes.
- `objectiveModel.js`: evalua objetivos y conclusion de la parte jugable.
- `selectionModel.js`: seleccion mecanica; resuelve chosen/empate/nulo.

## Flujo principal

```text
ruleSet + configuration + skin + jugadores/asientos
-> Role/Group/Step catalog
-> buildSession
-> buildPools
-> createSession
-> resolveCurrentStep
-> completeCurrentStep
```

Resolver una receta no cierra el step. El cierre se hace explicitamente con
`completeCurrentStep`.

## Roles, steps y recetas

La relacion actual es esta:

```text
Role o Group
-> stepDefinitions
-> Step
-> actions
-> Recipe
```

Un rol no ejecuta recetas directamente. Un rol define que steps puede aportar al
flujo. Las recetas ejecutables viven dentro de `step.actions`.

Esto evita duplicar la misma receta en dos sitios. Si una skin quiere mover una
receta a otro momento, modifica el step o el pool; no modifica la accion pura.

Los steps de catalogo son abstractos. Los steps de sesion deben tener actores
reales en `actorIds`, salvo steps de sistema. Si un grupo esta vacio, no puede
crear un step enabled jugable.

Un rol tambien puede declarar `reactions`. Una reaccion no se ejecuta por si
misma: `eventModel.js` la evalua cuando un efecto final produce un evento. El
primer caso implementado es `role_reactive`: cuando ese rol recibe un cambio
real a `inPlay=false`, se crea un step en `poolSpecial` para que pueda ejecutar
una respuesta.

El motor debe ejecutar `check_objectives` al final de cada pool. Si se emite un
`playOutcome` concluyente, se ejecuta la etapa automatica `conclude_play`.
`conclude_play` concluye la parte jugable, pero no cierra administrativamente la
session.

El modelo objetivo de decision es `select`:

- `candidateRules` construyen o acotan `candidateIds`;
- `selectionRules` gobiernan como `selectorIds` eligen entre esos candidates;
- `selectionModel.js` cubre la decision mecanica reusable.

## Estado vivo

La sesion guarda:

- `players`
- `roles`
- `groups`
- `stepPools`
- `actionHistory`
- `stepHistory`
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

# Mapa visual del motor

Este documento muestra las partes del motor y donde validar cada cosa. La idea
es poder ubicar una regla nueva sin mezclar responsabilidades.

> Mapa integral actualizado: [domain_architecture.md](./domain_architecture.md).
> Incluye una imagen PNG de respaldo y una version PDF, por lo que no depende
> del soporte Mermaid del visor.

![Arquitectura completa del nuevo dominio](./domain_architecture.png)

## Vista general

```mermaid
flowchart TD
  Skin[Skin or setup]
  RoleCatalog[Role catalog]
  GroupCatalog[Group catalog]
  StageCatalog[Stage catalog]
  Players[Players and seats]
  BuildSession[buildSession]
  RoleStates[session.roles]
  GroupStates[session.groups]
  BuildPools[buildPools]
  CreatePool[createPool]
  CyclePools[session.cycle.pools]
  PoolLifecycle[pool onEnter/onExit]
  CurrentStage[Current stage]
  StageModel[stageModel]
  Recipe[Recipe]
  Constraint[constraintModel]
  Action[actionModel]
  Resolver[effectModel]
  Effect[effectModel]
  Session[Session]
  Objectives[objectiveModel]
  PlayOutcome{playOutcome}
  Event[eventModel]
  QueueStage[queue stage]
  Result[Result]

  Skin --> RoleCatalog
  Skin --> GroupCatalog
  Skin --> StageCatalog
  Skin --> Players
  RoleCatalog --> BuildSession
  GroupCatalog --> BuildSession
  StageCatalog --> BuildSession
  Players --> BuildSession
  BuildSession --> RoleStates
  BuildSession --> GroupStates
  BuildSession --> BuildPools
  BuildPools --> CyclePools
  CyclePools --> PoolLifecycle
  PoolLifecycle --> CurrentStage
  CurrentStage --> StageModel
  StageModel --> Recipe
  Recipe --> Constraint
  Recipe --> Action
  Constraint --> Action
  Action --> Resolver
  Resolver --> Effect
  Effect --> Session
  Session --> Event
  Event -->|reaccion crea stage| QueueStage
  QueueStage --> CurrentStage
  Event --> Objectives
  Objectives --> PlayOutcome
  PlayOutcome -->|No concluyente| CurrentStage
  PlayOutcome -->|Concluyente| QueueStage
```

Lectura corta:

```text
skin/setup -> buildSession -> roles + groups + cycle.pools -> stage actual -> receta -> restricciones -> accion pura -> resolver -> aplicar efectos -> eventos/reacciones -> pool.onExit -> check_objectives -> queue
```

## Capas del motor

| Capa | Archivo | Responsabilidad | No debe hacer |
|---|---|---|---|
| Sesion | `sessionModel.js` | Guardar vocabulario compartido y consultas basicas de sesion | Construir objetos o resolver reglas complejas |
| Definicion de sesion | `sessionDefinition.js` | Crear una sesion viva con players, roles, groups, pools e historiales | Resolver acciones |
| Definicion de player | `playerDefinition.js` | Crear players de sesion | Aplicar reglas sobre roles |
| Definicion de rol | `roleDefinition.js` | Crear roles y el estado de esos roles dentro de una sesion | Ejecutar acciones |
| Definicion de pool | `poolDefinition.js` | Crear pools y organizar stages dentro de pools configurables | Decidir que hace cada stage |
| Validacion de sesion | `sessionValidation.js` | Detectar datos rotos o incompletos | Corregir datos automaticamente |
| Historial | `historyModel.js` | Crear y consultar memoria mecanica de la sesion | Resolver acciones o cambiar estado por si mismo |
| Catalogo de roles | `roleCatalog.js` | Guardar roles mecanicos predefinidos | Vestir roles con nombres de skin |
| Definicion de grupo | `groupDefinition.js` | Definir y crear groups y groupRules | Ejecutar acciones |
| Groups runtime | `groupModel.js` | Resolver membresia y consecuencias declaradas por groupRules | Aplicar efectos |
| Catalogo de grupos | `groupCatalog.js` | Guardar grupos mecanicos predefinidos | Confundir grupo con skin o alignment narrativa |
| Cursor de pools | `poolCursorModel.js` | Mover el cursor entre stages activos dentro de los pools | Ejecutar acciones de roles |
| Stages | `stageModel.js` | Elegir recetas del stage actual y cerrar el stage cuando proceda | Resolver reglas propias de cada receta |
| Constructor de stages | `stageDefinition.js` | Crear stages genericos desde key, actor, acciones, completion y metadata | Decidir el orden final de ejecucion |
| Catalogo de stages | `stageCatalog.js` | Guardar stages predefinidos reutilizables | Definir todas las combinaciones posibles de una skin |
| Catalogo de recetas | `recipeCatalog.js` | Definir recetas reutilizables del nucleo | Ejecutar recetas o leer la sesion |
| Recetas | `recipeModel.js` | Validar restricciones y convertir receta en accion pura | Aplicar efectos o avanzar stages |
| Restricciones | `constraintModel.js` | Validar restricciones propias de una receta | Cambiar estado directamente |
| Acciones | `actionModel.js` | Validar y resolver acciones puras | Evaluar restricciones de receta |
| Resolver | `effectModel.js` | Procesar efectos, bloqueos, deduplicacion y consecuencias solicitadas por groupRules | Conocer tipos narrativos de group |
| Efectos | `effectModel.js` | Escribir efectos finales sobre la sesion | Decidir si un efecto debe existir |
| Eventos | `eventModel.js` | Convertir efectos finales en eventos y activar reacciones declaradas por roles | Ejecutar la receta del stage de queue |
| Objectives | `objectiveModel.js` | Evaluar objetivos y playOutcome | Cerrar administrativamente la session |
| Seleccion | `actionModel.js` | Contar elecciones y resolver chosen/empate | Aplicar el efecto de la seleccion |

## Construccion de sesion

```mermaid
flowchart TD
  A[Roles seleccionados desde roleCatalog]
  B[Jugadores y asientos]
  C[Groups seleccionados desde groupCatalog]
  E[buildSession]
  F[buildRoles]
  J[createSession base]
  G[buildGroups]
  H[buildPools]
  I[createPool]
  K[validateSession]
  L[session.roles]
  M[session.groups]
  N[session.cycle.pools]
  P[session.cycle.queues inicial]
  O[Session lista para ejecucion]

  A --> E
  B --> E
  C --> E
  E --> F
  F --> J
  J --> G
  G --> H
  H --> I
  H --> P
  F --> L
  G --> M
  I --> N
  L --> K
  M --> K
  N --> K
  P --> K
  K --> O
```

Regla de lectura:

```text
createX construye un objeto concreto.
buildX ensambla varias definiciones para preparar una sesion o parte de ella.
```

`roleDefinition.js` contiene `defineRole`, `createRole` y `buildRoles`.
`defineRole` describe el tipo mecánico y `createRole` materializa el estado que
vive en `session.roles`.

`buildSession` valida por defecto la sesion ensamblada. Si la terna
role/player/seat no esta completa, devuelve `ok: false` con errores y conserva
la sesion construida para inspeccion.

## Flujo de un stage

```mermaid
graph TD
  A[Sesion] --> B[poolCursorModel obtiene stage actual]
  B --> C{Stage enabled}
  C -->|No| D[Resultado invalido]
  C -->|Si| E{Tiene action}
  E -->|No| D
  E -->|Si| F[stageModel llama recipeModel]
  F --> G{Recipe valida}
  G -->|No| H[Stage sigue abierto]
  G -->|Si| I[actionModel ejecuta accion pura]
  I --> J[Stage sigue abierto]
  J --> K{Cierre explicito}
  K -->|No| J
  K -->|Si| L[completeCurrentStage]
  L --> M[poolCursorModel marca stage done]
  M --> N[Cursor al siguiente stage runnable]
```

`stageModel.js` no sustituye a `poolCursorModel.js` ni a `actionModel.js`. Solo une
ambas piezas y separa ejecutar receta de cerrar stage.

Los IDs de stage son slots neutros, por ejemplo `stage_01`, `stage_02` o
`stage_03`. Quien actua se define en `actor`; la accion disponible dentro
del stage describe la mecanica. Si un stage ofrece varias recipes, el input debe
indicar `recipeKey`.

## Flujo de una receta

```mermaid
flowchart TD
  A[stageModel selecciona recipeKey] --> B[recipeCatalog define receta]
  B --> C[recipeModel]
  C --> D[constraintModel]
  D --> E{Restricciones validas}
  E -->|No| F[Resultado invalido]
  E -->|Si| G[Crear accion pura]
  G --> H[actionModel]
```

Ejemplo:

```text
receta restore_recent_out_of_play
  -> accion pura set_in_play(true)
  -> restriccion require_recent_set_property
```

`actionModel.js` no recibe la receta completa. Recibe la accion pura despues de
que `recipeModel.js` haya validado sus restricciones.

## Restricciones

```mermaid
flowchart LR
  A[Receta] --> B{Puede usarse}
  B -->|No| C[constraintModel rechaza]
  B -->|Si| D[Accion pura]
  D --> E[actionModel]
```

Lectura:

```text
restriccion = condicion de uso de una receta
```

Por eso `no_repeat_target`, `require_recent_set_property` y la constraint
interna `limited_uses` viven en `constraintModel.js`. En recipes nuevas, el
contrato preferente es `usage`; `recipeModel` lo convierte en `limited_uses`.

## Orden de ejecucion

El motor no usa el nombre del stage para decidir que va antes o despues.

```text
poolOrder -> orden entre pools
pools[poolKey] -> orden de stages dentro de ese pool
```

`session.cycle.queues` es una cola FIFO independiente de `pools`. Antes de
entrar en cualquier pool normal, el ciclo comprueba si contiene stages
pendientes y, si los tiene, los resuelve primero. Cada stage dinamico puede
declarar `metadata.queueKey` (`before_concealed`, `after_concealed`,
`before_exposed`, `after_exposed`) para que la superficie lo proyecte en la
ventana correcta sin convertir la FIFO en cuatro colas fisicas.

Orden de superficie aceptado para un ciclo:

```text
before_concealed
-> poolConcealed
-> after_concealed
-> publicReveal
-> before_exposed
-> poolExposed
-> after_exposed
-> privateHide
```

Identidad usada por el flujo:

```text
cycle.id                 -> cycleId de la iteracion
pool.key                 -> poolKey estable
stage.key                -> stageKey de definicion
stage.id                 -> stageId runtime unico
```

El cursor usa `stage.id`. `stage.key` puede repetirse cuando varios roles
materializados aportan la misma definicion de stage.

Ejemplo:

```js
createCycle({
  poolOrder: ['poolConcealed', 'poolExposed'],
  pools: {
    poolConcealed: createPool({
      key: 'poolConcealed',
      stages: [{ key: 'stage_03' }]
    }),
    poolExposed: createPool({
      key: 'poolExposed',
      stages: [{ key: 'stage_05' }]
    })
  }
})

session.cycle.queues = [
  { id: 'stage-queue-stage_01-role-0', key: 'stage_01' },
  { id: 'stage-queue-stage_02-role-1', key: 'stage_02' }
]
```

El ruleSet y su configuration determinan ese orden. La skin solo presenta los
elementos. No hay pesos ni prioridades implicitas.

## Cierre de stage

Resolver una receta y avanzar al siguiente stage son operaciones distintas.

```mermaid
flowchart LR
  A[Stage actual enabled] --> B[resolveCurrentStage]
  B --> C[recipeModel valida restricciones]
  C --> D[actionModel ejecuta accion pura]
  D --> E[Stage sigue enabled]
  E --> F{Alguien pide cierre}
  F -->|player| G[completeCurrentStage]
  F -->|director| G
  F -->|system| G
  G --> H[poolCursorModel marca done y busca siguiente stage]
```

Lectura:

```text
resolveCurrentStage no marca done.
completeCurrentStage marca done y avanza.
```

El cierre queda registrado en `session.history.stageHistory` con `payload.requestedBy`
para distinguir cierres pedidos por player, director o system.

`poolDefinition.js` prepara arrays ordenados desde las definiciones
seleccionadas. Los pools configurables aceptan `order`; `poolCursorModel.js`
ejecuta los arrays ya materializados.

`queue` conserva siempre el orden FIFO de insercion.

## Flujo de una accion

```mermaid
graph TD
  A[Input de accion] --> B[Buscar actor]
  B --> C[Buscar objetivos]
  C --> D[Validar definicion de accion]
  D --> E[Validar objetivos]
  E --> F{Accion valida}
  F -->|No| G[Resultado invalido con errores]
  F -->|Si| H[Proponer efectos]
  H --> I[Resolver consecuencias sistemicas]
  I --> J[Aplicar efectos finales]
  J --> K[Resultado ok y sesion actualizada]
```

Ejemplo con `set_in_play`:

```text
input:
actorIds = [alignment_b_actor-0]
targetIds = [alignment_a_target-0]

validacion:
- existe el actor?
- existe el objetivo?
- el objetivo esta inPlay?
- cumple not_same_alignment?
- el objetivo tenia bloqueada esta accion?

efecto propuesto:
set_property target.inPlay = false

resolver:
- si target esta linked, derivar set_property linkedTarget.inPlay = false

aplicador:
- escribir inPlay=false en roles afectados
```

## Donde validar cada cosa

| Pregunta | Lugar correcto | Ejemplo |
|---|---|---|
| Existe la sesion y sus datos basicos son coherentes? | `sessionValidation.js` | IDs duplicados, grupo apunta a rol inexistente |
| Que ocurrio antes en esta partida? | `historyModel.js` | efectos aplicados en el ciclo actual |
| Este stage debe ejecutarse ahora? | `poolCursorModel.js` | saltar stages disabled |
| El stage actual tiene una receta ejecutable? | `stageModel.js` | stage enabled con `recipes` definida |
| La receta puede usarse ahora? | `recipeModel.js` + `constraintModel.js` | `restore_recent_out_of_play` exige historial previo |
| La accion esta bien definida? | `actionModel.js` | `set_in_play` debe traer `property: inPlay` |
| El actor existe? | `actionModel.js` | `missing actor` |
| Los objetivos existen y cumplen filtros? | `actionModel.js` | `in_play`, `not_in_play`, `not_self`, `same_alignment`, `not_same_alignment`, `recently_out_of_play`, `assumable`, `distinct` |
| Esta receta tiene una restriccion propia? | `constraintModel.js` | no repetir mismo objetivo en ciclos consecutivos |
| Un cambio de propiedad queda bloqueado? | `roleModel.js` | `block_property_change` bloquea `inPlay=false` frente a actores concretos |
| Un efecto genera consecuencias de group? | `groupModel.js` + `effectModel.js` | `propagate_property_change` genera efectos derivados |
| Como se escribe un cambio final? | `effectModel.js` | `set_property`, `set_group` |
| La parte jugable ha concluido? | `objectiveModel.js` | `holder_reaches_in_play_parity`, `holder_reaches_stable_in_play_parity`, `only_holder_group_remains_in_play`, `no_roles_in_play` |

## Flujo de efectos

```mermaid
graph LR
  A[Accion valida] --> B[Efectos propuestos]
  B --> C[Resolver]
  C --> D[Efectos finales]
  D --> E[Aplicador de efectos]
  E --> F[Sesion actualizada]
  F --> G[eventModel crea eventos]
  G --> H{Hay reacciones}
  H -->|Si| I[Crear stages de queue FIFO]
  H -->|No| J[check_objectives]
  I --> J
  J --> K{playOutcome concluyente}
  K -->|Si| O{Outcome estable}
  O -->|Si| L[Ejecutar conclude_play]
  O -->|No| N
  K -->|No| M[Continuar]
  L --> N[queue]
  I --> N
```

Regla importante:

```text
Una accion no deberia escribir directamente cualquier cosa en la sesion.
Debe proponer efectos, resolverlos y aplicar solo efectos finales.
```

Regla de `queue`:

```text
Los eventos especiales se registran como stages pendientes en queue. Si
check_objectives emite un playOutcome concluyente, primero se comprueba si algun
stage pendiente puede alterar ese outcome. conclude_play se ejecuta como
operacion final cuando el outcome es estable.
```

`block_property_change` guarda entradas tipadas en
`role.blockedPropertyChanges`. `pool.onExit` revisa sus vencimientos antes de
evaluar objetivos.

## Resolver vs Effect Model

Estas dos capas pueden parecer parecidas, pero su pregunta central es distinta.

### `effectModel.js`

Pregunta:

```text
dados estos efectos propuestos, cuales deben llegar a ser efectos finales?
```

Ejemplos:

- Si se propone `set_property inPlay=false` sobre un rol linked, derivar otro
  `set_property inPlay=false` sobre sus miembros de grupo.
- Si en el futuro un efecto queda neutralizado por otra regla, marcarlo como
  bloqueado.
- Si un efecto produce consecuencias encadenadas, generar esas consecuencias.

El resolver no escribe en la sesion. Solo decide la lista final:

```text
proposedEffects -> finalEffects + blockedEffects
```

### `effectModel.js`

Pregunta:

```text
como se escribe este efecto final en la sesion?
```

Ejemplos:

- `set_property`: cambiar `role.inPlay`.
- `set_group`: crear o actualizar un grupo mecanico, por ejemplo `linked`.
- `start_cycle`: limpiar flags temporales y preparar el nuevo ciclo.

El aplicador de efectos no decide si el cambio es justo, valido o narrativamente
correcto. Si recibe un efecto final valido, lo escribe.

Resumen:

```text
effectModel decide consecuencias.
effectModel aplica cambios.
```

## Flujo de grupos linked

```mermaid
graph TD
  A[link_targets] --> B[set_group linked]
  B --> R[linked_target_recognition]
  B --> C[session.groups]
  C --> D{Grupo activo}
  D -->|No| E[No ocurre nada mas]
  D -->|Si| F[groupModel interpreta groupRules]
  F --> G[effectModel procesa efectos derivados]
  G --> H[effectModel aplica cambios]
```

Lectura:

```text
link_targets no elimina a nadie.
link_targets solo crea un grupo.
Si el grupo se crea, `linked_target_recognition` registra en `recipeHistory`
que los miembros del group linked conocen al resto de miembros. No es una
`queueStage` y no cambia estado mecanico.
El group linked declara `propagate_property_change`. Su `type` no activa
ninguna logica especial por si solo.
```

## Flujo de objectives

```mermaid
graph TD
  A[Efectos del pool consumados] --> B[check_objectives]
  B --> C[Evaluar session.objectiveRules]
  C --> D{Alguna objectiveRule cumplida}
  D -->|No| E[Parte jugable continua]
  D -->|Si| F[objectiveResolution]
  F --> G{playOutcome concluyente}
  G -->|No| H[Registrar achievedObjectives]
  G -->|Si| I{QueueStages puede alterar outcome}
  I -->|Si| J[Resolver queue antes]
  I -->|No| K[Ejecutar conclude_play]
```

Orden objetivo:

1. Evaluar `session.objectiveRules`.
2. Registrar `achievedObjectives` no concluyentes.
3. Resolver conflictos entre objectives concluyentes.
4. Emitir `playOutcome` si la parte jugable queda concluida.
5. Cruzar `objectiveRule.dependencies` con `stage.influences` de stages
   pendientes en `queue`.
6. Ejecutar `conclude_play` como operacion final si hay `playOutcome`
   concluyente y estable.

Regla importante:

```text
check_objectives se ejecuta al final de cada pool, no despues de cada stage
normal, porque stages posteriores del mismo pool pueden modificar el resultado
de stages anteriores.
```

Flujo actual de comprobacion de objetivos:

```mermaid
graph TD
  A[Efectos consumados] --> B[checkObjectives]
  B --> C[Leer session.objectiveRules]
  C --> D[Evaluar cada condition contra su holder]
  D --> E{Alguna regla cumplida}
  E -->|No| F[ongoing]
  E -->|Si| G[fulfilledRules]
  G --> H{Alguna regla concluyente}
  H -->|No| I[achievedObjectives]
  H -->|Si| J[playOutcome]
```

Orden actual:

1. Leer `session.objectiveRules`.
2. Resolver el `holder` de cada regla.
3. Evaluar la `condition`.
4. Devolver `fulfilledRules`.
5. Emitir `achievedObjectives` o `playOutcome` segun `onFulfilled`.

`objectiveModel` no crea reglas implicitas de alignment o linked. Si un
alignment o group linked necesita objective, primero debe existir un group
holder que represente ese sujeto.

## Pipeline recomendado para nuevas mecanicas

Cuando aparezca una mecanica nueva, seguir este orden:

1. Nombrar la mecanica de forma abstracta.
2. Decidir si es accion, modificador, efecto, grupo, consecuencia u objective.
3. Escribir un ejemplo minimo de datos.
4. Implementar la pieza mas pequena posible.
5. Anadir un test real en `src/lib/domain/__test__/domain.test.js`.
6. Anadir una demo si ayuda a verla con ojos humanos.
7. Actualizar `docs/mechanics_inventory.md`.

## Ejemplos de clasificacion

| Regla humana | Clasificacion abstracta | Lugar probable |
|---|---|---|
| Un role inspecciona a otro role | accion `inspect_role` | `actionModel.js` |
| Un role bloquea un cambio de estado antes de otra accion | accion `block_property_change` | `actionModel.js` + `roleModel.js` |
| No puede bloquear al mismo objetivo dos ciclos seguidos | restriccion `no_repeat_target` | `constraintModel.js` |
| Un role enlaza dos targets | accion `link_targets` + group con reglas | `groupModel.js` |
| Si un miembro sale de juego, el otro tambien | `propagate_property_change` | `groupModel.js` + `effectModel.js` |
| Si solo quedan linked de alignments distintos, cumplen objective especial | objectiveRule sobre group linked | `session.objectiveRules` |
| Un group de alignment alcanza al resto | `holder_reaches_in_play_parity` | `session.objectiveRules` |
| `alignment_b` alcanza paridad estable en `basic_ruleset` | `holder_reaches_stable_in_play_parity` | `session.objectiveRules` |
| Un jugador no puede elegir contra su linked | selectionRule del group `linked` | `group.selectionRules` |

## Modelo de seleccion

Una seleccion generica no debe significar automaticamente "dejar fuera de juego".
Debe entenderse como una seleccion colectiva:

```text
selecciones -> recuento -> target chosen / empate / nulo
```

Despues otra capa decide que accion se aplica al target chosen.

```mermaid
flowchart TD
  A[Receta de seleccion] --> B[actionModel - recuento puro]
  B --> C{Resultado}
  C -->|chosen| D[target chosen]
  C -->|tie/null| E[sin accion posterior]
  D --> F[Ejecutar accion configurada]
  F --> G[effectModel]
  G --> H[effectModel]
```

### Estrategias de implementacion

| Estrategia | Idea | Ventaja | Riesgo |
|---|---|---|---|
| Mantener acciones concretas | una receta distinta por cada seleccion | Simple para pocos casos | Duplica logica de seleccion cuando aparezcan mas selecciones |
| Stage con selectionRules recomendado | `select` resuelve target y `stageModel` ejecuta la receta declarada | Flexible y anonimo | Requiere que el stage declare claramente sus reglas de seleccion |
| Efecto directo desde seleccion | El seleccion devuelve directamente `set_property` u otro efecto | Rapido de implementar | Mezcla recuento con consecuencias y empobrece la reutilizacion |

La estrategia recomendada es la segunda:

```text
stage = selectionRules + recipes
```

Ejemplo conceptual:

```js
{
  key: 'stage_05',
  selectionRules: {
    required: 'all_selectors',
    abstain: 'not_allowed',
    unanimous: 'not_required',
    tie: 'null_on_tie',
    runoff: 'tied_candidates',
    nullResult: 'end_as_null',
    repeatLimit: 1,
    abstainResolution: {
      type: 'ignore'
    },
    supportThreshold: {
      type: 'none',
      base: 'cast_selections'
    },
    candidateIds: null,
    groupRestrictions: [
      {
        type: 'exclude_group_member_target',
        groupType: 'linked'
      }
    ]
  },
  recipes: [
    {
      key: 'set_out_of_play',
      id: 'set_in_play',
      effect: {
        type: 'set_property',
        targetType: 'role',
        property: 'inPlay',
        value: false
      }
    }
  ]
}
```

Lectura:

```text
actionModel solo dice que roleId ha sido chosen.
stageModel convierte chosenId en targetIds.
recipeModel/actionModel aplican la receta configurada sobre ese target.
```

Ejemplos futuros con la misma estructura:

- `set_property inPlay=false`
- `set_property hasMarker=true`
- `set_group`
- cualquier otro efecto permitido por el motor

La restriccion de `linked` no aplica a cualquier seleccion ni vive en
`exposed_set_out_of_play`. La aporta el propio group `linked` mediante `selectionRules`
cuando su scope coincide con la seleccion actual. En el caso actual:

```text
exposed_set_out_of_play + set_out_of_play
```

Si una regla permite repetir la seleccion del ciclo con el mismo proposito, la
restriccion sigue aplicando porque el caracter mecanico de la seleccion no ha
cambiado.

## Selection Model

`actionModel.js` modela la parte de recuento:

```mermaid
flowchart TD
  A[Votos emitidos] --> B[Validar actores y targets]
  B --> C[Comprobar un seleccion por actor]
  C --> D[Sumar selecciones por targetId]
  D --> E{Ganador unico}
  E -->|Si| F[chosen]
  E -->|No| G{selectionRules.tie}
  G -->|null_on_tie| H[null]
  G -->|runoff_on_tie| I[runoff limitado a empatados]
  I --> J{Segundo empate}
  J -->|Si| H
  J -->|No| F
```

Implementacion actual:

```text
deliberation = public stage, no recipes
exposed_set_out_of_play = selectionRules + set_out_of_play
```

Reglas actuales de esa seleccion:

```text
selectionRules.selectorSource: in_play_roles
selectionRules.required: all_selectors
selectionRules.tie: null_on_tie
selectionRules.runoff: none
selectionRules.nullResult: end_as_null
selectionRules.repeatLimit: 0
selectionRules.abstainResolution: ignore
selectionRules.supportThreshold: none
selectionRules.candidateIds: null -> todos los roles inPlay
```

Definicion precisa de `stage_deliberation` en `basic_ruleset`:

```text
1. Ocurre en poolExposed antes de `exposed_set_out_of_play`.
2. Participan de forma interactiva todos los roles con inPlay=true.
3. Los roles con inPlay=false observan en modo readonly.
4. No tiene recipes ni selectionRules.
5. Se cierra por director.
```

Definicion precisa de `stage_exposed_set_out_of_play` en `basic_ruleset`:

```text
1. Participan todos los roles con inPlay=true.
2. La seleccion mecanica es method=vote.
3. Todos los selectors inPlay deben emitir seleccion.
4. Los candidates por defecto son todos los roles con inPlay=true.
5. Si hay chosen, `stageModel` ejecuta la recipe `set_out_of_play` con ese
   chosen como target.
6. Si el resultado es null por empate sin desempate o abstencion nula, la stage
   queda para cierre manual con una unica ronda resuelta.
```

Si el selector pertenece a un group `linked` activo creado por `link_targets`,
`stageModel` recopila su regla y anade una restriccion efectiva de grupo para esa
resolucion.

Interacciones relevantes:

- `selection_counts_double`: si esta seleccionada en la session, aporta
  `selectionValueRules` y `tieBreakers` scoped a `poolExposed + vote +
  set_out_of_play`.
- `linked`: no vive en la stage. El group linked aporta restricciones de
  seleccion y, si el target final queda `inPlay=false`, encola
  `linked_propagated_effect`.
- `role_reactive`: si el target final es ese role y queda `inPlay=false` desde
  `concealed_set_out_of_play` o `exposed_set_out_of_play`, `eventModel` puede
  encolar su queueStage de respuesta.
- `role_in_out_of_play`: su ventana especial de self-restore pertenece al
  concealed set_out_of_play. En exposed, si queda `inPlay=false`, no abre esa
  excepcion.

La deuda tecnica anterior era mezclar recuento de seleccion y consecuencia en una
receta compuesta. Eso ya queda separado:

```text
actionModel cuenta selecciones.
stageModel aplica la receta declarada si hay chosen.
actionModel resuelve la accion pura configurada.
```

Flujo actual de `exposed_set_out_of_play + set_out_of_play`:

```mermaid
flowchart TD
  A[stage con selectionRules] --> B[select resuelve ronda]
  B --> C{Resultado}
  C -->|chosen| E[stageModel pasa chosenId como targetId]
  C -->|null| D[Sin efectos; stage listo para cierre manual]
  C -->|tie + null_on_tie| D
  C -->|tie + runoff_on_tie| R[Pedir nextRound con candidateIds]
  R --> S[Stage sigue abierto para otra ronda]
  E --> F[recipe set_out_of_play]
  F --> G[actionModel resuelve accion pura]
  G --> H[effectModel deriva consecuencias]
  H --> I[effectModel aplica cambios]
```

Contrato del stage con seleccion:

```text
chosen:
  - actionModel devuelve chosenId.
  - stageModel ejecuta la receta del stage usando chosenId como targetIds.

null:
  - No se ejecuta receta.
  - No se generan efectos.
  - El stage queda abierto, pero listo para que player/director/system lo cierre
    con completeCurrentStage segun sus reglas de completion.

tie:
  - Si selectionRules.tie no define otra cosa, se trata como null.
  - Si selectionRules.tie = runoff_on_tie, actionModel devuelve nextRound con
    candidateIds definido por selectionRules.runoff.
  - La receta no se ejecuta hasta que una ronda posterior produzca chosen.
```

Reglas de seleccion ya previstas:

```text
candidateIds:
  - Lista de roleIds que pueden recibir selecciones en una ronda.
  - Si no se define, los candidatos por defecto son todos los roles inPlay.
  - En una segunda ronda puede cambiar, por ejemplo limitandose a los roleIds
    que recibieron selecciones o a los roleIds empatados.

runoff:
  - tied_candidates: segunda ronda solo entre los roleIds empatados.
  - selected_candidates: segunda ronda entre todos los roleIds que recibieron
    al menos un seleccion.
  - same_candidates: segunda ronda con los mismos candidatos de la ronda actual.

nullResult:
  - end_as_null: la seleccion nula no pide otra ronda.
  - repeat_on_null: la seleccion nula puede pedir otra ronda si repeatLimit lo
    permite.

repeatLimit:
  - Numero maximo de rondas adicionales que puede pedir actionModel.
  - Por defecto es 1: una seleccion inicial puede pedir una segunda ronda, pero
    si esa segunda ronda vuelve a empatar o quedar nula, termina como null.

supportThreshold:
  - Minimo de selecciones necesarios para aceptar el chosen provisional.
  - none: acepta el chosen provisional sin exigir minimo adicional.
  - majority: exige mitad + 1.
  - fraction: exige una fraccion, por ejemplo 2/3.
  - base cast_selections: calcula el minimo sobre selecciones emitidas no abstenidos.
  - base selector_count: calcula el minimo sobre los actores obligados o definidos
    para el stage.
  - Si no alcanza el minimo, el resultado pasa a null con reason
    insufficient_support y la receta no se ejecuta.

abstainResolution:
  - ignore: las abstenciones no entran en el recuento de chosen.
  - null_if_highest: si la abstencion tiene mas selecciones que cualquier targetId,
    la seleccion queda null con reason abstention_highest.
  - Si la abstencion empata con el target mas votado, esta regla no actua por
    ahora; queda espacio para definir nuevos tipos mas adelante.
```

## Regla de orientacion

Si una regla responde a:

```text
puedo intentar hacer esto?
```

probablemente pertenece a `actionModel.js` o `constraintModel.js`.

Si responde a:

```text
que consecuencias tiene este efecto aceptado?
```

probablemente pertenece a `effectModel.js`.

Si responde a:

```text
como se escribe este cambio?
```

probablemente pertenece a `effectModel.js`.

Si responde a:

```text
se ha cumplido un objetivo concluyente?
```

probablemente pertenece a `objectiveModel.js`.

# Mapa visual del motor

Este documento muestra las partes del motor y donde validar cada cosa. La idea
es poder ubicar una regla nueva sin mezclar responsabilidades.

## Vista general

```mermaid
flowchart TD
  Skin[Skin or setup]
  RoleCatalog[Role catalog]
  GroupCatalog[Group catalog]
  StepCatalog[Step catalog]
  Players[Players and seats]
  BuildSession[buildSession]
  RoleStates[session.roles]
  GroupStates[session.groups]
  BuildPools[buildPools]
  BuildStepPool[buildStepPool]
  StepPools[session.stepPools]
  CurrentStep[Current step]
  StepModel[stepModel]
  Recipe[Recipe]
  Constraint[constraintModel]
  Action[actionModel]
  Resolver[resolverModel]
  Effect[effectModel]
  Session[Session]
  Victory[victoryModel]
  Finished{Finished}
  Result[Result]

  Skin --> RoleCatalog
  Skin --> GroupCatalog
  Skin --> StepCatalog
  Skin --> Players
  RoleCatalog --> BuildSession
  GroupCatalog --> BuildSession
  StepCatalog --> BuildSession
  Players --> BuildSession
  BuildSession --> RoleStates
  BuildSession --> GroupStates
  BuildSession --> BuildPools
  BuildPools --> BuildStepPool
  BuildStepPool --> StepPools
  StepPools --> CurrentStep
  CurrentStep --> StepModel
  StepModel --> Recipe
  Recipe --> Constraint
  Recipe --> Action
  Constraint --> Action
  Action --> Resolver
  Resolver --> Effect
  Effect --> Session
  Session --> Victory
  Victory --> Finished
  Finished -->|No| CurrentStep
  Finished -->|Si| Result
```

Lectura corta:

```text
skin/setup -> buildSession -> roles + groups + stepPools -> step actual -> receta -> restricciones -> accion pura -> resolver -> aplicar efectos -> victoria
```

## Capas del motor

| Capa | Archivo | Responsabilidad | No debe hacer |
|---|---|---|---|
| Sesion | `sessionModel.js` | Guardar vocabulario compartido y consultas basicas de sesion | Construir objetos o resolver reglas complejas |
| Definicion de sesion | `sessionDefinition.js` | Crear una sesion viva con players, roles, groups, pools e historiales | Resolver acciones |
| Definicion de player | `playerDefinition.js` | Crear players de sesion | Aplicar reglas sobre roles |
| Definicion de rol | `roleDefinition.js` | Crear roles y el estado de esos roles dentro de una sesion | Ejecutar acciones |
| Definicion de relacion | `relationDefinition.js` | Crear relaciones entre roles | Guardar relaciones dentro de un unico rol |
| Definicion de pool | `poolDefinition.js` | Crear pools y organizar steps dentro de pools configurables | Decidir que hace cada step |
| Validacion de sesion | `sessionValidation.js` | Detectar datos rotos o incompletos | Corregir datos automaticamente |
| Historial | `historyModel.js` | Crear y consultar memoria mecanica de la sesion | Resolver acciones o cambiar estado por si mismo |
| Catalogo de roles | `roleCatalog.js` | Guardar roles mecanicos predefinidos | Vestir roles con nombres de skin |
| Definicion de grupo | `groupDefinition.js` | Crear grupos y resolver sus roleIds iniciales | Ejecutar acciones |
| Catalogo de grupos | `groupCatalog.js` | Guardar grupos mecanicos predefinidos | Confundir grupo con skin o alignment narrativa |
| Cursor de pools | `poolCursorModel.js` | Mover el cursor entre steps activos dentro de los pools | Ejecutar acciones de roles |
| Steps | `stepModel.js` | Elegir recetas del step actual y cerrar el step cuando proceda | Resolver reglas propias de cada receta |
| Constructor de steps | `stepDefinition.js` | Crear steps genericos desde key, actor, acciones, completion y metadata | Decidir el orden final de ejecucion |
| Catalogo de steps | `stepCatalog.js` | Guardar steps predefinidos reutilizables | Definir todas las combinaciones posibles de una skin |
| Catalogo de recetas | `recipeCatalog.js` | Definir recetas reutilizables del nucleo | Ejecutar recetas o leer la sesion |
| Recetas | `recipeModel.js` | Validar restricciones y convertir receta en accion pura | Aplicar efectos o avanzar steps |
| Restricciones | `constraintModel.js` | Validar restricciones propias de una receta | Cambiar estado directamente |
| Acciones | `actionModel.js` | Validar y resolver acciones puras | Evaluar restricciones de receta |
| Resolver | `resolverModel.js` | Decidir que efectos propuestos sobreviven, se bloquean o generan efectos derivados | Escribir cambios en sesion |
| Efectos | `effectModel.js` | Escribir efectos finales sobre la sesion | Decidir si un efecto debe existir |
| Victoria | `victoryModel.js` | Evaluar si la partida termina | Modificar la sesion |
| Voto | `voteModel.js` | Contar elecciones y resolver chosen/empate | Aplicar el efecto de la votacion |

## Construccion de sesion

```mermaid
flowchart TD
  A[Roles seleccionados desde roleCatalog]
  B[Jugadores y asientos]
  C[Groups seleccionados desde groupCatalog]
  D[Steps de sistema o por defecto]
  E[buildSession]
  F[buildRolesFromSeats]
  G[buildInitialGroups]
  H[buildPools]
  I[buildStepPool]
  J[createSession]
  K[validateSession]
  L[session.roles]
  M[session.groups]
  N[session.stepPools]
  O[Session lista para ejecucion]

  A --> E
  B --> E
  C --> E
  D --> E
  E --> F
  E --> G
  E --> H
  H --> I
  F --> L
  G --> M
  I --> N
  L --> J
  M --> J
  N --> J
  J --> K
  K --> O
```

Regla de lectura:

```text
createX construye un objeto concreto.
buildX ensambla varias definiciones para preparar una sesion o parte de ella.
```

`role` no tiene archivo `roleDefinition.js`. Es el estado de un
role dentro de `session.roles`, construido desde `roleDefinition.js`.

`buildSession` valida por defecto la sesion ensamblada. Si la terna
role/player/seat no esta completa, devuelve `ok: false` con errores y conserva
la sesion construida para inspeccion.

## Flujo de un step

```mermaid
graph TD
  A[Sesion] --> B[poolCursorModel obtiene step actual]
  B --> C{Step enabled}
  C -->|No| D[Resultado invalido]
  C -->|Si| E{Tiene action}
  E -->|No| D
  E -->|Si| F[stepModel llama recipeModel]
  F --> G{Recipe valida}
  G -->|No| H[Step sigue abierto]
  G -->|Si| I[actionModel ejecuta accion pura]
  I --> J[Step sigue abierto]
  J --> K{Cierre explicito}
  K -->|No| J
  K -->|Si| L[completeCurrentStep]
  L --> M[poolCursorModel marca step done]
  M --> N[Cursor al siguiente step runnable]
```

`stepModel.js` no sustituye a `poolCursorModel.js` ni a `actionModel.js`. Solo une
ambas piezas y separa ejecutar receta de cerrar step.

Los IDs de step son slots neutros, por ejemplo `step_01`, `step_02` o
`step_03`. Quien actua se define en `actor`; la accion disponible dentro
del step describe la mecanica. Si un step ofrece varias acciones, el input debe
indicar `actionKey`.

## Flujo de una receta

```mermaid
flowchart TD
  A[stepModel selecciona actionKey] --> B[recipeCatalog define receta]
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

Por eso `no_repeat_target`, `require_recent_set_property` y `limited_uses`
viven en `constraintModel.js`.

## Orden de ejecucion

El motor no usa el nombre del step para decidir que va antes o despues.

```text
poolOrder -> orden entre pools
pools[poolKey] -> orden de steps dentro de ese pool
```

Ejemplo:

```js
createPool({
  poolOrder: ['poolDeployment', 'poolExposed'],
  pools: {
    poolDeployment: [
      { key: 'step_01' },
      { key: 'step_02' }
    ],
    poolExposed: [
      { key: 'step_05' }
    ]
  }
})
```

Una skin puede cambiar ese orden declarando otro array. No hay pesos ni
prioridades implicitas por ahora; eso se anadira solo si aparece una regla real
que necesite reordenar steps dinamicamente.

## Cierre de step

Resolver una receta y avanzar al siguiente step son operaciones distintas.

```mermaid
flowchart LR
  A[Step actual enabled] --> B[resolveCurrentStep]
  B --> C[recipeModel valida restricciones]
  C --> D[actionModel ejecuta accion pura]
  D --> E[Step sigue enabled]
  E --> F{Alguien pide cierre}
  F -->|player| G[completeCurrentStep]
  F -->|director| G
  F -->|system| G
  G --> H[poolCursorModel marca done y busca siguiente step]
```

Lectura:

```text
resolveCurrentStep no marca done.
completeCurrentStep marca done y avanza.
```

El cierre queda registrado en `session.stepHistory` con `requestedBy`
para distinguir cierres pedidos por player, director o system.

Nota de diseno:

```text
poolDefinition.js preparara en el futuro arrays ordenados desde
definiciones de skin/flavor.
```

Ese modelo podra aceptar `order` en pools configurables como `poolExposed` y
`poolConcealed`. `poolCursorModel.js` seguira ejecutando arrays ya ordenados.

`poolSpecial` no debe reordenarse por skin/flavor.

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
| Existe la sesion y sus datos basicos son coherentes? | `sessionValidation.js` | IDs duplicados, relacion apunta a rol inexistente |
| Que ocurrio antes en esta partida? | `historyModel.js` | efectos aplicados en el ciclo actual |
| Este step debe ejecutarse ahora? | `poolCursorModel.js` | saltar steps disabled |
| El step actual tiene una receta ejecutable? | `stepModel.js` | step enabled con `actions` definida |
| La receta puede usarse ahora? | `recipeModel.js` + `constraintModel.js` | `restore_recent_out_of_play` exige historial previo |
| La accion esta bien definida? | `actionModel.js` | `set_in_play` debe traer `property: inPlay` |
| El actor existe? | `actionModel.js` | `missing actor` |
| Los objetivos existen y cumplen filtros? | `actionModel.js` | `in_play`, `not_self`, `not_same_alignment`, `distinct` |
| Esta receta tiene una restriccion propia? | `constraintModel.js` | no repetir mismo objetivo en ciclos consecutivos |
| Una accion queda bloqueada? | `actionModel.js` | `block_action` bloquea `set_in_play(false)` contra un target |
| Un efecto genera consecuencias globales? | `resolverModel.js` | `linked` propaga `inPlay=false` |
| Como se escribe un cambio final? | `effectModel.js` | `set_property`, `set_relation` |
| La partida ha terminado? | `victoryModel.js` | `at_least_remaining`, `single_alignment`, `linked_exclusive_survivors` |

## Flujo de efectos

```mermaid
graph LR
  A[Accion valida] --> B[Efectos propuestos]
  B --> C[Resolver]
  C --> D[Efectos finales]
  D --> E[Aplicador de efectos]
  E --> F[Sesion actualizada]
```

Regla importante:

```text
Una accion no deberia escribir directamente cualquier cosa en la sesion.
Debe proponer efectos, resolverlos y aplicar solo efectos finales.
```

Excepcion actual:

```text
block_action guarda flags temporales directamente porque su funcion es marcar
un bloqueo del ciclo actual. Si crece en complejidad, podria pasar tambien
por una ruta de efectos mas estricta.
```

## Resolver vs Effect Model

Estas dos capas pueden parecer parecidas, pero su pregunta central es distinta.

### `resolverModel.js`

Pregunta:

```text
dados estos efectos propuestos, cuales deben llegar a ser efectos finales?
```

Ejemplos:

- Si se propone `set_property inPlay=false` sobre un rol linked, derivar otro
  `set_property inPlay=false` sobre sus relacionados.
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
- `set_relation`: crear una entrada en `session.relations`.
- `close_cycle`: limpiar flags temporales y avanzar ciclo.

El aplicador de efectos no decide si el cambio es justo, valido o narrativamente
correcto. Si recibe un efecto final valido, lo escribe.

Resumen:

```text
resolverModel decide consecuencias.
effectModel aplica cambios.
```

## Flujo de relaciones

```mermaid
graph TD
  A[link_targets] --> B[set_relation]
  B --> C[session.relations]
  C --> D{Relacion activada}
  D -->|No| E[No ocurre nada mas]
  D -->|Si| F[resolverModel deriva efectos linked]
  F --> G[effectModel aplica cambios]
```

Lectura:

```text
link_targets no elimina a nadie.
link_targets solo crea una relacion.
La relacion linked tiene consecuencias cuando otro efecto la activa.
```

## Flujo de victoria

```mermaid
graph TD
  A[Efectos consumados] --> B[evaluateVictory]
  B --> C{Reglas de alignment}
  C -->|at_least_remaining cumplida| D[Victoria por regla de alignment]
  C -->|No| E{Linked exclusivo}
  E -->|Si| F[Victoria linked]
  E -->|No| G{Una alignment inPlay}
  G -->|Si| H[Victoria single_alignment]
  G -->|No| I[ongoing]
```

Orden actual:

1. Reglas configuradas de alignment.
2. Victoria especial por `linked`.
3. Victoria por unica alignment restante.
4. Partida en curso.

## Pipeline recomendado para nuevas mecanicas

Cuando aparezca una mecanica nueva, seguir este orden:

1. Nombrar la mecanica de forma abstracta.
2. Decidir si es accion, modificador, efecto, relacion, consecuencia o victoria.
3. Escribir un ejemplo minimo de datos.
4. Implementar la pieza mas pequena posible.
5. Anadir un test real en `src/lib/domain/__test__/domain.test.js`.
6. Anadir una demo si ayuda a verla con ojos humanos.
7. Actualizar `docs/mechanics_inventory.md`.

## Ejemplos de clasificacion

| Regla humana | Clasificacion abstracta | Lugar probable |
|---|---|---|
| La Vidente mira una carta | accion `inspect_role` | `actionModel.js` |
| El Protector protege antes del ataque | accion `block_action` | `actionModel.js` |
| No puede bloquear al mismo objetivo dos ciclos seguidos | restriccion `no_repeat_target` | `constraintModel.js` |
| Cupido enlaza dos jugadores | accion `link_targets` + efecto `set_relation` | `actionModel.js` + `effectModel.js` |
| Si un linked sale de juego, el otro tambien | consecuencia sistemica | `resolverModel.js` |
| Si solo quedan linked de alignments distintos, ganan | victoria especial | `victoryModel.js` |
| Una alignment gana si alcanza al resto | regla de alignment `at_least_remaining` | `victoryModel.js` |
| Un jugador no puede votar contra su linked | restriccion de voto | `step.voteRules.relationRestrictions` |

## Modelo de voto

Una votacion generica no debe significar automaticamente "dejar fuera de juego".
Debe entenderse como una seleccion colectiva:

```text
votos -> recuento -> target chosen / empate / nulo
```

Despues otra capa decide que accion se aplica al target chosen.

```mermaid
flowchart TD
  A[Receta de voto] --> B[voteModel - recuento puro]
  B --> C{Resultado}
  C -->|chosen| D[target chosen]
  C -->|tie/null| E[sin accion posterior]
  D --> F[Ejecutar accion configurada]
  F --> G[resolverModel]
  G --> H[effectModel]
```

### Estrategias de implementacion

| Estrategia | Idea | Ventaja | Riesgo |
|---|---|---|---|
| Mantener acciones concretas | una receta distinta por cada votacion | Simple para pocos casos | Duplica logica de voto cuando aparezcan mas votaciones |
| Step con voteRules recomendado | `vote` resuelve target y `stepModel` ejecuta la receta declarada | Flexible y anonimo | Requiere que el step declare claramente sus reglas de voto |
| Efecto directo desde voto | El voto devuelve directamente `set_property` u otro efecto | Rapido de implementar | Mezcla recuento con consecuencias y empobrece la reutilizacion |

La estrategia recomendada es la segunda:

```text
step = voteRules + recipes
```

Ejemplo conceptual:

```js
{
  key: 'step_05',
  voteRules: {
    required: 'all_actors',
    abstain: 'not_allowed',
    unanimous: 'not_required',
    tie: 'null_on_tie',
    candidateIds: null,
    relationRestrictions: [
      {
        type: 'exclude_related_target',
        relationType: 'linked'
      }
    ]
  },
  actions: [
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
voteModel solo dice que roleId ha sido chosen.
stepModel convierte chosenId en targetIds.
recipeModel/actionModel aplican la receta configurada sobre ese target.
```

Ejemplos futuros con la misma estructura:

- `set_property inPlay=false`
- `set_property hasMarker=true`
- `set_relation`
- cualquier otro efecto permitido por el motor

La restriccion de `linked` no aplica a cualquier voto. Aplica a los steps que
la declaren en `voteRules.relationRestrictions`. En el caso actual:

```text
group_vote + set_out_of_play
```

Si una regla permite repetir la votacion del ciclo con el mismo proposito, la
restriccion sigue aplicando porque el caracter mecanico de la votacion no ha
cambiado.

## Vote Model

`voteModel.js` modela la parte de recuento:

```mermaid
flowchart TD
  A[Votos emitidos] --> B[Validar actores y targets]
  B --> C[Comprobar un voto por actor]
  C --> D[Sumar votos por targetId]
  D --> E{Ganador unico}
  E -->|Si| F[chosen]
  E -->|No| G{voteRules.tie}
  G -->|null_on_tie| H[null]
  G -->|runoff_on_tie| I[runoff limitado a empatados]
  I --> J{Segundo empate}
  J -->|Si| H
  J -->|No| F
```

Implementacion actual:

```text
group_vote = voteRules + set_out_of_play
```

Reglas actuales de esa votacion:

```text
voteRules.required: all_actors
voteRules.tie: null_on_tie
voteRules.candidateIds: null -> todos los roles inPlay
relationRestrictions: exclude_related_target linked
```

La deuda tecnica anterior era mezclar recuento de voto y consecuencia en una
receta compuesta. Eso ya queda separado:

```text
voteModel cuenta votos.
stepModel aplica la receta declarada si hay chosen.
actionModel resuelve la accion pura configurada.
```

Flujo actual de `group_vote + set_out_of_play`:

```mermaid
flowchart TD
  A[step con voteRules] --> B[vote resuelve ronda]
  B --> C{Resultado}
  C -->|chosen| E[stepModel pasa chosenId como targetId]
  C -->|null| D[Sin efectos; step listo para cierre manual]
  C -->|tie + null_on_tie| D
  C -->|tie + runoff_on_tie| R[Pedir nextRound con candidateIds]
  R --> S[Step sigue abierto para otra ronda]
  E --> F[recipe set_out_of_play]
  F --> G[actionModel resuelve accion pura]
  G --> H[resolverModel deriva consecuencias]
  H --> I[effectModel aplica cambios]
```

Contrato del step con voto:

```text
chosen:
  - voteModel devuelve chosenId.
  - stepModel ejecuta la receta del step usando chosenId como targetIds.

null:
  - No se ejecuta receta.
  - No se generan efectos.
  - El step queda abierto, pero listo para que player/director/system lo cierre
    con completeCurrentStep segun sus reglas de completion.

tie:
  - Si voteRules.tie no define otra cosa, se trata como null.
  - Si voteRules.tie = runoff_on_tie, voteModel devuelve nextRound con
    candidateIds limitado a los targets empatados.
  - La receta no se ejecuta hasta que una ronda posterior produzca chosen.
```

Reglas de voto pendientes de concretar:

```text
candidateIds:
  - Lista de roleIds que pueden recibir votos en una ronda.
  - Si no se define, los candidatos por defecto son todos los roles inPlay.
  - En una segunda ronda puede cambiar, por ejemplo limitandose a los roleIds
    que recibieron votos o a los roleIds empatados.

supportThreshold:
  - Regla futura para exigir un minimo de votos antes de aceptar chosen.
  - Ejemplos: mitad + 1, dos tercios, unanimidad estricta.

abstainResolution:
  - Regla futura para decidir que ocurre si la abstencion supera a cualquier
    targetId. La opcion base sera tratar la votacion como null.

runoffRules:
  - Regla futura para decidir como se construye la segunda ronda.
  - Ejemplos: repetir con los mismos candidatos, limitar a targets votados,
    limitar solo a targets empatados.
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

probablemente pertenece a `resolverModel.js`.

Si responde a:

```text
como se escribe este cambio?
```

probablemente pertenece a `effectModel.js`.

Si responde a:

```text
ha terminado la partida?
```

probablemente pertenece a `victoryModel.js`.

# History contract

Este documento define el contrato de historial de una `session`.

## Alcance

`history` registra hechos del juego dentro de una session. No es un log tecnico
de aplicacion.

Separacion aceptada:

```js
session.history = {
  cycleHistory: [],
  poolHistory: [],
  stageHistory: [],
  queueHistory: [],
  recipeHistory: []
}
```

`session.errorLog` queda separado para errores de dominio de la session.
`applicationLog` queda fuera de `session` y pertenece a la aplicacion.

## Entrada comun

Toda entrada de history debe seguir esta forma:

```js
{
  id,
  sequence,
  timestamp,
  event,
  actor,
  payload,
  metadata: {
    context: {
      cycleId,
      poolKey,
      stageId,
      stageKey,
      stageCatalogId,
      queueKey
    }
  }
}
```

Reglas:

- `id` identifica una entrada concreta de history.
- `sequence` es global dentro de la session y define el orden determinista.
- `timestamp` es obligatorio y usa formato ISO.
- `event` identifica que ocurrio dentro de la coleccion correspondiente.
- `actor` identifica quien produjo la entrada.
- `payload` contiene solo datos especificos del evento.
- `metadata.context` contiene el contexto comun.

## Actor

Valores iniciales:

```js
{ authority: 'system' }
{ authority: 'director' }
{ authority: 'player', roleId }
```

Si el director actua en representacion de un player, se registra en el payload:

```js
{
  onBehalfOf: { authority: 'player', roleId }
}
```

`director` es una responsabilidad dentro de la session. La entidad que asuma esa
responsabilidad puede ser humana, sistema, IA o asistida, pero ese modo no forma
parte de este contrato inicial.

## Identidad

Regla uniforme:

- `id`: instancia runtime concreta.
- `key`: definicion mecanica estable.
- `catalogId`: entrada reusable del catalogo, si existe.
- `historyId`: referencia a una entrada concreta de history.

Aplicacion actual:

```text
poolKey              -> pool mecanico
stageId              -> stage runtime concreto
stageKey             -> slot mecanico de stage
stageCatalogId       -> stage catalogado, si existe
recipeKey            -> recipe mecanica ejecutada
actionId             -> action pura ejecutada por actionModel
recipeHistoryId      -> entrada concreta de recipeHistory
queueKey          -> ventana concreta de queue
```

## cycleHistory

`cycleHistory` registra lo que hace el ciclo como coordinador. No registra el
detalle interno de pools, stages ni recipes.

Eventos:

```text
started
finished
running_pool
running_queue
skipped_queue
surface_transition_public
surface_transition_private
conclude_play
```

Payloads:

```js
{ event: 'running_pool', payload: { poolKey } }
{ event: 'running_queue', payload: { queueKey } }
{ event: 'skipped_queue', payload: { queueKey, reason } }
{ event: 'surface_transition_public', payload: { from, to, step } }
{ event: 'surface_transition_private', payload: { from, to, step } }
```

## poolHistory

`poolHistory` registra la vida de un pool y que stage entrega a ejecucion.

Eventos:

```text
started
finished
running_stage
skipped_stage
```

Payloads:

```js
{ event: 'started', payload: { poolKey } }
{ event: 'finished', payload: { poolKey } }
{ event: 'running_stage', payload: { stageId, stageKey, stageCatalogId } }
{ event: 'skipped_stage', payload: { stageId, stageKey, stageCatalogId, reason } }
```

## stageHistory

`stageHistory` registra la vida de una stage normal, sus inputs,
acknowledgements y las recipes que entrega a ejecucion.

Eventos:

```text
started
finished
input_received
acknowledged
running_recipe
```

Payloads:

```js
{
  event: 'started',
  payload: { stageId, stageKey, stageCatalogId }
}
```

```js
{
  event: 'finished',
  payload: { stageId, stageKey, stageCatalogId }
}
```

```js
{
  event: 'input_received',
  payload: {
    inputType,
    roleId,
    submittedBy,
    onBehalfOf,
    recipeKey,
    targetIds,
    selections,
    roundIndex
  }
}
```

```js
{
  event: 'acknowledged',
  payload: {
    acknowledgementType,
    itemType,
    roleId,
    onBehalfOf
  }
}
```

```js
{
  event: 'running_recipe',
  payload: {
    recipeKey,
    recipeHistoryId
  }
}
```

## queueHistory

`queueHistory` usa el mismo contrato que `stageHistory`, pero
`metadata.context.queueKey` es obligatorio.

Eventos:

```text
started
finished
input_received
acknowledged
running_recipe
```

## recipeHistory

`recipeHistory` registra la vida runtime de una recipe ejecutada o intentada.

Una recipe puede ejecutar una o varias actions puras. Por eso `actionId` vive
en el evento `running_action`, no como supuesto fijo de `started` o `finished`.

Eventos:

```text
started
running_action
finished
```

Payloads:

```js
{
  event: 'started',
  payload: {
    recipeKey,
    actorIds,
    targetIds,
    actorContract,
    targetContract,
    stageId,
    stageKey,
    stageCatalogId
  }
}
```

```js
{
  event: 'running_action',
  payload: {
    recipeKey,
    actionId
  }
}
```

```js
{
  event: 'finished',
  payload: {
    recipeKey,
    result,
    proposedEffects,
    finalEffects,
    preventedPropertyChanges,
    blockedEffects
  }
}
```

Resultados iniciales:

```text
applied
blocked
partial
no_effect
failed
```

## Surface

La surface puede derivar mensajes visibles desde history, session y skin, pero
no debe sustituir a history.

`surfaceMessage` y `surfaceItem` pertenecen a la proyeccion de UI. History
guarda el hecho de dominio que permite reconstruirlos, no necesariamente el
texto final mostrado por una skin.

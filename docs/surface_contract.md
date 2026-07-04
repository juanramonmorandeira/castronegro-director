# Surface Contract

Este documento define como una UI, director app o skin debe derivar la
activacion visual y de interaccion a partir del estado mecanico de la session.

No define reglas nuevas del motor.

## Separacion

El motor mantiene estado mecanico:

- `role.inPlay`;
- `session.cycle.poolCurrent`;
- `pool.currentStageIndex`;
- `stage.actorIds`;
- `stage.selectionRules`;
- `specialStages`;
- historiales.

La superficie decide presentacion:

- pantalla negra;
- ojos cerrados;
- panel del director;
- panel del jugador activo;
- chat, video o debate;
- informacion visible para una audiencia concreta.

Por tanto, "activo" en este documento no significa `inPlay=true`. Significa que
una persona puede ver o interactuar con algo en la superficie durante un tramo
de ejecucion.

Terminos aceptados:

```text
screenHidden = no debe ver informacion de stage.
screenReadonly = puede ver informacion visible para su audiencia, pero no interactuar.
screenInteractive = puede introducir input o hacer acknowledgement.
```

El director no usa un estado especial de pantalla. Su proyeccion minima es:

```js
{
  viewerType: 'director',
  screenMode: 'screenInteractive',
}
```

## Regla Base

La superficie se deriva de:

```text
session.currentStageSource
session.cycle.poolCurrent
currentStage
currentStage.stage.actorIds
currentStage.stage.selectionRules
currentStage.stage.metadata
role.inPlay
actionHistory
```

El motor no debe escribir flags como `screenBlack=true` o
`allRolesInactive=true`. Esos estados son proyecciones de UI.

## Surface Projection

La capa `surfaceModel.js` expone el contrato base de superficie. Una futura
proyeccion completa debe ofrecer una funcion:

```js
getSurfaceProjection(session, viewer)
```

`viewer` identifica desde que punto de vista se proyecta la session:

```js
{ viewerType: 'director' }
{ viewerType: 'role', roleId: 'role_id' }
```

El resultado minimo esperado es:

```js
{
  viewerType,
  roleId,
  screenMode,
  currentStage,
  surfaceMessages,
  availableInputs,
  acknowledgements,
  canCloseStage
}
```

`currentStage` usa `stageCatalogId` como identificador principal para que la
surface y la futura skin sepan que pantalla pintar. `stageKey` queda como dato
materializado/historico.

Shape inicial:

```js
currentStage: {
  source,
  poolKey,
  stageId,
  stageKey,
  stageCatalogId,
  status,
  actorIds,
  audienceRoleIds,
  roundIndex,
  surfaceItems
}
```

- `actorIds`: roles que pueden actuar en la stage.
- `audienceRoleIds`: roles que pueden ver informacion de la stage pero no
  actuar.
- El director siempre recibe `currentStage`.
- Un role/player recibe `currentStage` solo si forma parte de la stage o de la
  audiencia visible.
- Si el role/player esta en `screenHidden`, `currentStage` debe ser `null`,
  aunque puede recibir `surfaceMessages` filtrados por skin.
- No se proyectan por ahora `hiddenRoleIds` ni `readonlyRoleIds`; el director
  solo necesita `actorIds` y `audienceRoleIds`.

Ejemplo de `linked_target_recognition` dentro de la stage
`role_links_targets`:

```js
surfaceItems: [
  {
    type: 'linked_target_recognition',
    recipientRoleIds: ['role_a', 'role_b'],
    payload: { linkedRoleIds: ['role_a', 'role_b'] },
    acknowledgementsRequired: true
  }
]
```

En `stage_exposed_set_out_of_play`, los roles `inPlay=false` reciben
`screenReadonly`, `currentStage` visible y sin `availableInputs` interactivos.

Ejemplo privado: si la current stage es `role_inspects`, el actor
`role_inspects-0` recibe `screenInteractive` y ve la stage. Un `role_plain-0`
que no actua ni es audiencia derivada recibe:

```js
{
  screenMode: 'screenHidden',
  currentStage: null,
  surfaceMessages: []
}
```

`availableInputs` puede representarse como lista generica de acciones de
superficie:

```js
[
  { type: 'select_target', actionKey, candidateIds },
  { type: 'submit_selection', selectionKey, candidateIds, roundIndex },
  {
    type: 'director_submit_selection',
    outcome: 'candidate' | 'null' | 'runoff',
    candidateId: 'role_id' | null,
    runoffCandidateIds: [],
    roundIndex,
    reason
  },
  { type: 'acknowledge', acknowledgementId },
  { type: 'finish_turn', reason },
  { type: 'finish_stage' },
  { type: 'director_override' }
]
```

Tipos iniciales aceptados:

- `select_target`: input directo de target para una recipe de un actor concreto,
  por ejemplo inspeccionar o enlazar targets.
- `submit_selection`: input individual de seleccion/voto dentro de una
  seleccion colectiva.
- `director_submit_selection`: resultado agregado que registra el director tras
  combinar votos remotos y presenciales; puede ser candidate final, null o
  runoff solo en stages que definan runoff. Si `outcome` es `runoff`,
  `candidateId` debe ser `null` y `runoffCandidateIds` contiene los candidates
  de la nueva ronda. Si `outcome` es `null`, `reason` explica la causa, por
  ejemplo `no_unanimity`, `tie`, `abstention` o `director_declared_null`. Si
  `outcome` es `candidate`, `reason` puede indicar `selection_resolved` u otra
  causa concreta.
- `acknowledge`: confirmacion de informacion recibida.
- `finish_turn`: el actor indica que no hara mas acciones en su stage.
- `finish_stage`: finalizacion de stage por director.
- `director_override`: toma de control del director sobre un input de surface.

La estructura inicial de acknowledgement es:

```js
{
  id,
  stageId,
  roleId,
  type,
  required: true,
  acknowledged: false,
  acknowledgedBy: null
}
```

`id` debe ser determinista para evitar duplicados, por ejemplo:

```js
`${stageId}:${roleId}:${type}`
```

`roleId` identifica el role para el que se exige el acknowledgement. Si el
player lo hace directamente:

```js
acknowledgedBy: {
  viewerType: 'player',
  roleId: 'role_plain-0'
}
```

Si el director lo hace en representacion de ese role:

```js
acknowledgedBy: {
  viewerType: 'director',
  roleId: 'role_plain-0'
}
```

En este contrato no usamos `roleId: null` dentro de `acknowledgedBy`, porque un
acknowledgement siempre se registra para un role concreto.

`type` distingue la clase general de confirmacion. El detalle concreto vive en
`payload`, porque los flujos son lineales y no conviene crear un tipo nuevo para
cada pantalla. Tipos iniciales:

- `information_seen`;
- `selection_result_seen`;
- `public_reveal_seen`.

Ejemplo:

```js
{
  type: 'information_seen',
  payload: {
    informationType: 'inspect_result',
    roleId: 'role_inspects-0'
  }
}
```

Los acknowledgements se persisten en `stageHistory`.

En inputs introducidos por el director en representacion de un jugador, el input
debe marcarse con:

```js
{
  submittedBy: 'director',
  directorOverride: true
}
```

`directorOverride: true` indica que el director ha tomado control del input de
surface en representacion del jugador. En inputs remotos enviados directamente
por el jugador, `submittedBy` puede ser `'player'`.

El recuento remoto visible para director en selecciones colectivas no expone el
voto individual de cada jugador conectado. Debe proyectarse como:

```js
{
  tally: { role_a: 2, role_b: 1 },
  pendingConnectedRoleIds: ['role_c']
}
```

Cuando el director registra el resultado final de una votacion mixta, envia solo
el outcome de la seleccion: candidate final, seleccion nula o runoff. No necesita
enviar el detalle de los votos presenciales como contrato mecanico.

Si hay runoff, la superficie proyecta una nueva ronda dentro de la misma stage
con `roundIndex + 1`. El historial de rondas anteriores queda visible para el
director durante esa stage.

`canCloseStage` es `false` para el director mientras falten acknowledgements
requeridos. Para players siempre es `false`, porque los players no cierran
stages en el flujo humano de `basic_ruleset`.

`surfaceMessages` queda como array plano inicial:

```js
[
  { messageKey, audience, payload }
]
```

La separacion entre mensajes mecanicos y mensajes filtrados por skin se aplaza
hasta tener ejemplos reales de UI/skin.

## Technical Gameplay Messages

Los mensajes tecnicos de director/player son mensajes `gameplay` con audiencia
concreta, no un catalogo separado. Ventajas de mantenerlos en el mismo
`MESSAGE_CATALOG`:

- un solo inventario de keys;
- una sola validacion de cobertura por skin/ruleSet;
- misma estructura `{ messageKey, audience, payload }`;
- evita duplicar presentadores de mensajes.

Inconveniente:

- el catalogo mezcla mensajes de resultado mecanico con mensajes de coordinacion
  de la partida, por lo que debe estar bien clasificado por audiencia.

La alternativa seria un catalogo separado de surface/director. Ventaja: separa
mejor lo visual/operativo del dominio. Inconveniente: duplica validacion,
presentacion y cobertura de skin. Para el contrato actual se acepta mantenerlos
juntos como `gameplay` + audiencia.

El texto final no vive en estos mensajes. La key y el payload dicen que ha
ocurrido; la skin decide como expresarlo. Ejemplo:

```js
{
  messageKey: 'director_role_turn_started',
  audience: 'director',
  payload: {
    roleId: 'role_assumes_role-0',
    roleKey: 'role_assumes_role',
    stageCatalogId: 'role_assumes_role',
    poolKey: 'poolConcealed'
  }
}
```

La UI podria mostrar "Turno de role_assumes_role", "Abre los ojos" u otro texto
segun skin. El contrato no fija esa frase.

Keys iniciales para director:

- `director_pool_started`;
- `director_stage_started`;
- `director_role_turn_started`;
- `director_group_stage_started`;
- `director_waiting_for_player_action`;
- `director_player_action_provided`;
- `director_waiting_for_acknowledgement`;
- `director_acknowledgement_provided`;
- `director_stage_ready_to_finish`;
- `director_selection_round_started`;
- `director_selection_result_ready`;
- `director_special_stage_started`;
- `director_informational_item_ready`.

Keys iniciales para players:

- `player_action_required`;
- `player_acknowledgement_required`;
- `player_waiting_for_director`.

Payload base recomendado para mensajes de stage/pool:

```js
{
  sessionId,
  cycleId,
  poolKey,
  stageId,
  stageKey,
  stageCatalogId,
  viewerType
}
```

Payload de role:

```js
{
  roleId,
  roleKey,
  playerId
}
```

Payload de group:

```js
{
  groupId,
  groupKey,
  roleIds
}
```

Payload de seleccion:

```js
{
  roundIndex,
  expectedCount,
  submittedCount,
  pendingConnectedRoleIds,
  tally
}
```

Para estados de espera se usa una sola entrada resumen con listas, no un mensaje
por cada role pendiente. Es mas limpio para implementar porque evita generar N
mensajes casi iguales y encaja mejor con `getSurfaceProjection`: la UI recibe un
estado actual de la stage, no una rafaga de notificaciones.

Ejemplo:

```js
{
  messageKey: 'director_waiting_for_player_action',
  audience: 'director',
  payload: {
    pendingRoleIds: ['role_a', 'role_b'],
    submittedRoleIds: ['role_c']
  }
}
```

`director_player_action_provided` se usa tanto si el input llega remotamente del
player como si el director lo introduce en representacion del player. La
diferencia queda en el payload del input: `submittedBy` y `directorOverride`.

`director_waiting_for_acknowledgement` tambien usa listas:

```js
{
  pendingAcknowledgementIds: ['stage_1:role_a:selection_result_seen'],
  providedAcknowledgementIds: ['stage_1:role_b:selection_result_seen']
}
```

`director_stage_ready_to_finish` aparece cuando ya no faltan inputs ni
acknowledgements requeridos.

Estos mensajes se proyectan en `surfaceMessages` con `audience: 'director'`,
`audience: 'role'` o la audiencia que corresponda. No se crea por ahora una
propiedad separada `directorSignals`.

Por trazabilidad, los mensajes tecnicos relevantes deben persistirse en el
history del ciclo, pool o stage que corresponda. No se crea `surfaceHistory`.

Distribucion inicial:

- `director_pool_started` se persiste en `poolHistory`;
- mensajes de stage, seleccion, informacion y acknowledgements se persisten en
  `stageHistory`;
- `director_special_stage_started` se persiste en `specialStagesHistory`;
- mensajes de player como `player_action_required`,
  `player_acknowledgement_required` y `player_waiting_for_director` se persisten
  en el log/history de su stage correspondiente.

Esta distribucion se limita a los pools y stages actuales de `basic_ruleset`.
Pools futuros se definiran cuando existan.

Estos mensajes no cambian estado mecanico de partida por si mismos. Ejemplo:
`director_stage_ready_to_finish` avisa de que se puede finalizar; no finaliza la
stage. La stage cambia cuando se ejecuta el input `finish_stage`.

Si falta una key tecnica necesaria para proyectar una pantalla, es un error de
contrato de surface/mensajes, no una regla de juego rota. Ejemplo: que falte
`director_waiting_for_acknowledgement` no cambia quien gana ni que actions son
validas, pero si impide que la UI informe correctamente al director.

`director_role_turn_started` y `director_group_stage_started` son excluyentes:
si el actor de la stage es un role se usa la primera; si el actor es un group se
usa la segunda.

Payload minimo de `director_waiting_for_player_action`:

```js
{
  pendingRoleIds: [],
  submittedRoleIds: []
}
```

Payload minimo adicional de `director_stage_ready_to_finish`:

```js
{
  pendingInputs: 0,
  pendingAcknowledgements: 0
}
```

## History Symmetry

Los histories/logs deben poder reconstruir el flujo humano de la partida. Como
regla de contrato:

- cada `start_session`, `start_cycle`, `start_pool` y `start_stage` debe tener
  su correspondiente `finish_session`, `finish_cycle`, `finish_pool` y
  `finish_stage`;
- cada estado `required` de surface debe poder correlacionarse con su
  correspondiente `provided`, pero no se persiste por defecto en history;
- cada mensaje `emitted` debe tener su correspondiente `received` cuando el
  contrato requiera confirmar recepcion;
- cada `finish` debe corresponder a un `start` previo;
- se reserva la dupla `open`/`close` para conceptos futuros de UI, como modales,
  paneles o pantallas;
- de momento los histories persistidos se centran en `start_*`, `finish_*`,
  rechazos y recepciones/acknowledgements explicitos; la depuracion de que
  entries sobran o se compactan queda para una fase posterior.

Estructura base aceptada para entries de history:

```js
{
  id,
  type,
  messageKey,
  stageId,
  stageCatalogId,
  roleId,
  submittedBy,
  payload,
  createdAt
}
```

Esta estructura es un punto de partida, no el cierre definitivo del modelo de
histories.

Tipos iniciales aceptados:

- `start_session`;
- `finish_session`;
- `start_cycle`;
- `finish_cycle`;
- `start_pool`;
- `finish_pool`;
- `start_stage`;
- `finish_stage`;
- `message_emitted`;
- `message_received`;
- `input_rejected`;
- `finish_rejected`;
- `acknowledgement_rejected`.

Los pares `required/provided` pertenecen al estado de surface y deben poder
correlacionarse, aunque no se guarden por defecto como entries de history. Para
ello se usa un id determinista cuando el estado necesita respuesta:

```js
{
  requiredId: 'stage_1:role_a:submit_selection'
}
```

La respuesta usa el mismo id:

```js
{
  requiredId: 'stage_1:role_a:submit_selection'
}
```

Los acknowledgements siguen el mismo patron mediante `acknowledgementId`.

Ubicacion inicial:

- `start_stage` y `finish_stage` viven en `stageHistory`;
- `start_pool` y `finish_pool` viven en `poolHistory`;
- `start_cycle` y `finish_cycle` viven en `cycleHistory`;
- `start_session` y `finish_session` viven en `sessionHistory`.

Toda entry debe incluir contexto base cuando exista:

```js
{
  sessionId,
  cycleId,
  poolKey,
  stageId,
  stageCatalogId
}
```

`roleId` solo aparece cuando la entry o estado de surface pertenece a un role
concreto. Ejemplo: un estado requerido para `role_inspects-0` incluye `roleId`;
`start_pool` no lo incluye porque no pertenece a ningun role concreto.

`submittedBy` solo aparece en estados o entries donde alguien aporta input o
confirmacion, como un input de surface, `input_rejected` o
`acknowledgement_rejected`. No se rellena con `null` donde no aplica.

`message_emitted` se persiste solo para mensajes importantes de coordinacion, no
para cualquier mensaje que pueda proyectarse. De momento se persisten tambien
los mensajes `director_waiting_for_*`; se depurara mas adelante.

No se genera `finish_stage` si la stage no puede cerrarse. En ese caso se
registra `finish_rejected` con payload explicando la causa, por ejemplo
acknowledgements pendientes. Los rechazos son eventos terminales de intento
fallido y no necesitan pareja simetrica.

`finish_rejected` se usa para cualquier scope finalizable:

```js
{
  type: 'finish_rejected',
  payload: {
    scope: 'stage' | 'pool' | 'cycle' | 'session',
    reason
  }
}
```

`message_received` solo se registra cuando existe una recepcion explicita por
parte del viewer. Un mensaje proyectado en `surfaceMessages` no genera
automaticamente `message_received`.

## Basic Ruleset

Flujo de superficie esperado:

```text
poolConcealed entra
-> todos los jugadores role quedan screenHidden
-> director queda screenInteractive
-> stages concealed se ejecutan una a una
-> durante cada stage, solo sus actores/audiencia derivada quedan screenInteractive
-> publicReveal proyecta la mesa publica y todos los jugadores quedan screenReadonly
-> before_exposed resuelve eventos publicos previos al exposed
-> stage_deliberation
-> stage_exposed_set_out_of_play
-> after_exposed resuelve eventos publicos posteriores al exposed
-> privateHide devuelve los jugadores role a screenHidden antes del siguiente tramo privado
```

Lectura humana:

```text
all roles inactive
stage(role_assumes_role)
stage(role_links_targets)
stage(role_inspects)
stage(concealed_set_out_of_play)
stage(role_in_out_of_play)
all roles active
stage(deliberation)
stage(exposed_set_out_of_play)
all roles inactive
```

`role_links_targets` incluye la consecuencia informativa
`linked_target_recognition`: los miembros del group linked conocen al resto de
miembros. En presencial esto puede ser "abren los ojos"; en remoto la app
habilita esa informacion solo para esos roles y el director.

## Stage Data Flows

Esta seccion define los flujos de surface por stage. Los flujos son lineales:
la stage empieza, la surface muestra mensajes/items, los actores aportan input o
acknowledgement si corresponde, el director revisa y finaliza la stage.

Estos flujos son una estructura inicial para construir la UI. No son definitivos:
al implementar pantallas reales, especialmente en interacciones paralelas como
`role_peek`, puede ser necesario ajustar nombres, payloads o proyecciones sin
cambiar por ello las reglas mecanicas del dominio.

### `role_assumes_role`

Ficha base:

```js
{
  stageCatalogId: 'role_assumes_role',
  actorProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `role_assumes_role`.
2. La surface muestra los items de roles asumibles al actor y al director.
3. Si al menos un role asumible no es `role_set_out_of_play`:
   - la surface muestra un mensaje equivalente a "selecciona uno de los N roles
     disponibles";
   - `N` queda parametrizado aunque en `basic_ruleset` actualmente sea 2;
   - el player puede seleccionar uno de los roles disponibles;
   - o puede no seleccionar ninguno;
   - no seleccionar nada se modela como abstencion:

```js
{
  type: 'select_target',
  targetId: null,
  reason: 'abstain'
}
```

4. Si todos los roles asumibles son `role_set_out_of_play`:
   - la surface muestra un mensaje equivalente a "player will assume
     role_set_out_of_play";
   - el player debe hacer acknowledgement con `type: 'information_seen'`;
   - no hay `select_target`.
5. El director recibe seleccion, abstencion o acknowledgement.
6. El director ejecuta `finish_stage`.

Reglas del flujo:

- Cuando el player selecciona un role asumible, la seleccion basta; no se pide
  acknowledgement adicional.
- Cuando el player se abstiene, la abstencion basta; no se pide acknowledgement
  adicional.
- El acknowledgement solo existe en el caso forzado donde todos los roles
  asumibles son `role_set_out_of_play`, porque el player recibe informacion que
  debe confirmar.
- El director ve las mismas opciones/items que el player y puede registrar el
  input en su representacion.

### `role_links_targets`

Ficha base:

```js
{
  stageCatalogId: 'role_links_targets',
  actorProjection,
  directorProjection,
  audienceProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `role_links_targets`.
2. La surface muestra al actor los candidates validos para `link_targets`.
3. En `basic_ruleset`, el actor selecciona exactamente 2 targets. El contrato se
   expresa con `targetCount: N` para permitir rulesets futuros:

```js
{
  type: 'select_target',
  actionKey: 'link_targets',
  targetCount: 2,
  targetIds: ['role_a', 'role_b']
}
```

4. Si el actor no selecciona ningun target o selecciona menos de `targetCount`,
   se entiende como abstencion/no accion:

```js
{
  type: 'select_target',
  actionKey: 'link_targets',
  targetIds: [],
  reason: 'abstain'
}
```

5. En abstencion/no accion no se crea link. El director revisa y ejecuta
   `finish_stage`.
6. Si la seleccion es valida, se crea el group linked. El actor no necesita
   acknowledgement: al enviar la seleccion, la creacion del link se da por
   supuesta.
7. Si se crea el group linked, la stage contiene un `surfaceItem`
   `linked_target_recognition` para los miembros linked. Ese item muestra a cada
   miembro linked solo los otros miembros del group.
8. Cada miembro linked debe hacer acknowledgement con `type: 'information_seen'`
   y `payload.informationType: 'linked_target_recognition'`, o el director lo
   hace en su representacion si el jugador es presencial.
9. El actor que creo el link no ve el reconocimiento si no forma parte del group.

Reglas del flujo:

- `surfaceMessages` comunica instrucciones o estados, por ejemplo que el actor
  debe seleccionar targets.
- `surfaceItems` contiene informacion que debe mostrarse, por ejemplo la lista
  de otros miembros linked para cada miembro del group.
- No se proyecta un mensaje extra al actor para decir que el link se ha creado;
  el envio de una seleccion valida basta dentro del flujo.

### `role_inspects`

Ficha base:

```js
{
  stageCatalogId: 'role_inspects',
  actorProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `role_inspects`.
2. La surface muestra al actor los players/candidates validos.
3. El actor selecciona un target:

```js
{
  type: 'select_target',
  actionKey: 'inspect_role',
  targetCount: 1,
  targetIds: ['role_target_id']
}
```

4. Si el actor no selecciona target, se considera abstencion/no accion:

```js
{
  type: 'select_target',
  actionKey: 'inspect_role',
  targetIds: [],
  reason: 'abstain'
}
```

5. Si hay target, el sistema resuelve `inspect_role` y genera un `surfaceItem`
   `inspect_result` para el actor.
6. El actor hace acknowledgement `type: 'information_seen'` sobre ese item.
7. Tras el acknowledgement, el actor pasa a `screenHidden`.
8. El director ejecuta `finish_stage`.

Reglas del flujo:

- El resultado muestra al actor el role asociado al player seleccionado.
- `actorIds` indica quien actua; `recipientRoleIds` en el `surfaceItem` indica
  quien recibe la informacion. En este caso ambos apuntan al role inspector.
- Si el director actua en representacion de un jugador presencial, el director
  selecciona target, ve resultado y hace acknowledgement en representacion del
  actor.
- Si el player remoto actua directamente, el director no ve el resultado completo
  hasta que el player haya hecho acknowledgement.
- Al finalizar la stage, el actor no puede volver a consultar el resultado.

Ejemplo de `surfaceItem`:

```js
{
  type: 'inspect_result',
  recipientRoleIds: ['role_inspects-0'],
  payload: {
    selectedPlayerId: 'player_x',
    selectedRoleId: 'role_x',
    outcome: {
      type: 'role',
      roleKey: 'role_plain'
    }
  },
  acknowledgementsRequired: true
}
```

### `concealed_set_out_of_play`

Ficha base:

```js
{
  stageCatalogId: 'concealed_set_out_of_play',
  actorProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `concealed_set_out_of_play`.
2. La surface muestra a los miembros de `group_concealed_set_out_of_play` los
   candidates validos sobre el plano de jugadores.
3. Los candidates son roles `inPlay=true` que no forman parte de
   `group_concealed_set_out_of_play`.
4. Cada miembro conectado del group puede marcar una seleccion provisional
   visible para el resto del group y para el director:

```js
{
  type: 'concealed_selection_draft',
  recipientRoleIds: ['role_set_out_of_play-0', 'role_set_out_of_play-1'],
  payload: {
    selectorRoleId: 'role_set_out_of_play-0',
    candidateRoleId: 'role_plain-0'
  }
}
```

5. La seleccion provisional es temporal, puede cambiarse hasta enviar la
   seleccion definitiva y no se guarda en history.
6. Cada miembro conectado del group emite una seleccion definitiva:

```js
{
  type: 'submit_selection',
  selectionKey: 'concealed_set_out_of_play',
  candidateId: 'role_x'
}
```

7. La seleccion definitiva se proyecta como no editable al group y al director:

```js
{
  type: 'concealed_selection_submission',
  recipientRoleIds: ['role_set_out_of_play-0', 'role_set_out_of_play-1'],
  payload: {
    selectorRoleId: 'role_set_out_of_play-0',
    candidateRoleId: 'role_plain-0',
    editable: false
  }
}
```

8. No se permite abstencion. Si un miembro no selecciona nada, no hay unanimidad
   y la seleccion queda nula.
9. Si todos los votos llegan por app, el sistema puede resolver automaticamente
   el resultado.
10. En partida presencial o mixta, el director registra la seleccion definitiva
    agregada con `director_submit_selection`. Puede hacerlo antes de que todos
    los miembros conectados hayan enviado su seleccion.
11. Si no hay unanimidad, el outcome es null:

```js
{
  type: 'director_submit_selection',
  outcome: 'null',
  candidateId: null,
  reason: 'no_unanimity'
}
```

12. Si hay unanimidad, el candidate elegido pasa a ser el target de
    `set_out_of_play`.
13. El director ve selecciones provisionales, selecciones definitivas, roles
    pendientes de enviar seleccion y resultado calculable.
14. El group no ve aqui el resultado final de eliminacion. Al cerrar la stage,
    sus pantallas pasan a `screenHidden`.
15. El role elegido como candidate no recibe comunicacion propia en esta stage.
16. El director ejecuta `finish_stage`.

Ejemplo de resultado proyectable cuando una stage lo necesite:

```js
{
  type: 'selection_result',
  recipientRoleIds: ['role_set_out_of_play-0'],
  payload: {
    outcome: 'candidate',
    candidateRoleId: 'role_plain-0'
  }
}
```

`role_peek` durante `concealed_set_out_of_play` queda como flujo paralelo: opera
desde `start_stage` hasta que se envia el candidate.

Contrato mecanico aceptado:

- `peekAttempt` lo registra el sistema cuando el player pulsa o mantiene el
  control de espiar;
- el historial guarda contador, timestamps, duracion y roles revelados al peek;
- mientras el control esta pulsado, los miembros de
  `group_concealed_set_out_of_play` pueden ver al player/role_peek expuesto;
- los miembros del group pueden emitir `peek_warning` contra un role/player
  visible siempre que el target este `inPlay=true` y no sea miembro del group;
- la confirmacion del warning es configurable, con unanimidad por defecto y
  mayoria simple como alternativa;
- si el warning queda confirmado, aplica `override_selected_candidate` sobre el
  role señalado, aunque no sea realmente `role_peek`;
- si el warning se confirma antes de votar, resuelve candidate directamente;
- si se confirma despues de votos emitidos y antes del cierre por director,
  sobrescribe el resultado previo;
- la mecanica separada para esta situacion es `peek_warning`;
- en partida presencial pura no es necesario registrar `peek_warning`; en
  partida mixta si debe registrarse para coordinar app y mesa fisica;
- `role_peek` no recibe comunicacion especial ni acknowledgement.

### `deliberation`

Ficha base:

```js
{
  stageCatalogId: 'deliberation',
  actorProjection,
  audienceProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `deliberation`.
2. Todos los roles de la session reciben la stage como publica:
   - roles `inPlay=true`: `screenInteractive`;
   - roles `inPlay=false`: `screenReadonly`.
3. Los roles `inPlay=true` deliberan antes de la seleccion publica.
4. No hay recipes mecanicas ni `selection_draft`.
5. El director ejecuta `finish_stage`.

### `exposed_set_out_of_play`

Ficha base:

```js
{
  stageCatalogId: 'exposed_set_out_of_play',
  actorProjection,
  audienceProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `exposed_set_out_of_play`.
2. Todos los roles de la session reciben la stage como publica:
   - roles `inPlay=true`: `screenInteractive`;
   - roles `inPlay=false`: `screenReadonly`.
3. Solo los roles `inPlay=true` pueden votar.
4. Los roles `inPlay=true` conectados emiten una seleccion definitiva publica:

```js
{
  type: 'submit_selection',
  selectionKey: 'exposed_set_out_of_play',
  candidateId: 'role_x',
  roundIndex: 0
}
```

5. La seleccion definitiva se proyecta en tiempo real a todos:

```js
{
  type: 'exposed_selection_submission',
  recipientRoleIds: ['role_a-0', 'role_b-0', 'role_c-0'],
  payload: {
    selectorRoleId: 'role_a-0',
    candidateRoleId: 'role_b-0',
    weight: 1
  }
}
```

6. Todos ven candidates y conteo de votos en tiempo real:

```js
{
  type: 'selection_tally',
  recipientRoleIds: ['role_a-0', 'role_b-0', 'role_c-0'],
  payload: {
    counts: [
      { candidateRoleId: 'role_b-0', count: 2 },
      { candidateRoleId: 'role_c-0', count: 1 }
    ],
    pendingSelectorRoleIds: []
  }
}
```

7. La abstencion no esta permitida. Si un role conectado no vota, la seleccion
   queda pendiente hasta que vote o el director intervenga.
8. Si todos los votos llegan por app, el sistema puede resolver automaticamente
   candidate o null en una unica ronda.
9. En partida presencial o mixta, el director registra el resultado agregado
    con `director_submit_selection`. El director puede registrarlo antes de que
    todos los conectados hayan votado.
10. El director puede anular o reemplazar un resultado calculado por sistema:

```js
{
  type: 'director_submit_selection',
  outcome: 'candidate' | 'null',
  candidateId: 'role_x' | null,
  runoffCandidateIds: [],
  roundIndex,
  reason
}
```

11. Todos ven el resultado y su razon antes de que el director cierre la stage.
12. Si `selection_counts_double` aplica, su voto cuenta doble siempre. Si afecta
    al resultado, se comunica publicamente en el resultado.
13. Si el conteo ponderado sigue empatado, el outcome es null. No hay runoff en
    `exposed_set_out_of_play`.
14. Si nunca se eligio un holder de `selection_counts_double`, el voto doble no
    existe. Si ya existia holder y el role holder esta out of play, eso indica un
    error de sistema porque la sucesion debio haberse resuelto.
15. Si el candidate es el role holder de `selection_counts_double`, se encola
    `pick_next_double_selector` en `after_exposed`.
16. Si el outcome es candidate, `set_out_of_play` se aplica antes de
    `finish_stage` bajo `basic_ruleset`.
17. El reveal del role asociado al player se encola como `role_state_revealed`
    en `after_exposed`.
18. Si `role_reactive` es el candidate, `role_reactive_response` se encola en
    `after_exposed` despues de `role_state_revealed`.
19. Si el candidate esta linked, la propagacion linked se encola en
    `after_exposed`.
20. Las specialStages de `after_exposed` mantienen FIFO natural. Cada nuevo
    `set_out_of_play` derivado genera su propio `role_state_revealed` con razon.
21. No hay acknowledgement publico de resultado; basta el cierre por director.
22. Despues de `finish_stage`, todos permanecen en `screenReadonly` hasta vaciar
    `after_exposed`. Si la partida concluye, se entra en `conclude_play`; si no,
    se pasa a `privateHide`.
23. El director ejecuta `finish_stage`.

Ejemplo de `surfaceItem`:

```js
{
  type: 'selection_result',
  recipientRoleIds: ['role_in_play_a', 'role_in_play_b'],
  payload: {
    outcome: 'candidate',
    candidateRoleId: 'role_x',
    reason: 'selection_resolved',
    resolvedByRule: null
  }
}
```

Ejemplo con `selection_counts_double`:

```js
{
  type: 'selection_result',
  recipientRoleIds: ['role_in_play_a', 'role_in_play_b'],
  payload: {
    outcome: 'candidate',
    candidateRoleId: 'role_x',
    reason: 'tie_broken_by_selection_counts_double',
    resolvedByRule: 'selection_counts_double',
    resolvedByRoleId: 'role_double_selector'
  }
}
```

### `role_in_out_of_play`

Ficha base:

```js
{
  stageCatalogId: 'role_in_out_of_play',
  actorProjection,
  directorProjection,
  hiddenProjection,
  availableInputs,
  acknowledgements,
  surfaceMessages,
  surfaceItems,
  historyEntries
}
```

Flujo:

1. `start_stage` de `role_in_out_of_play`.
2. La surface muestra al actor la informacion del resultado de
   `concealed_set_out_of_play` del current pool.
3. Si hubo candidate/current out of play, se muestra:

```js
{
  type: 'current_out_of_play',
  recipientRoleIds: ['role_in_out_of_play-0'],
  payload: {
    sourceStageCatalogId: 'concealed_set_out_of_play',
    targetRoleId: 'role_x'
  },
  acknowledgementsRequired: true
}
```

4. Si no hubo candidate, tambien se muestra un `surfaceItem` informativo y se
   exige acknowledgement:

```js
{
  type: 'current_out_of_play',
  recipientRoleIds: ['role_in_out_of_play-0'],
  payload: {
    sourceStageCatalogId: 'concealed_set_out_of_play',
    targetRoleId: null,
    outcome: 'null'
  },
  acknowledgementsRequired: true
}
```

5. El actor hace acknowledgement `type: 'information_seen'` sobre ese item.
6. Si el actor esta `inPlay=false`, solo puede continuar si el current out of
   play es el propio actor. En ese caso puede usar
   `restore_recent_out_of_play` sobre si mismo.
7. El input de restore tiene la misma forma para self o para otro target:

```js
{
  type: 'select_target',
  actionKey: 'restore_recent_out_of_play',
  targetCount: 1,
  targetIds: ['role_target_id']
}
```

8. Si tras restaurarse queda `inPlay=true` y conserva uso de su
   `set_out_of_play` privado, se habilita:

```js
{
  type: 'select_target',
  actionKey: 'set_out_of_play',
  targetCount: 1,
  targetIds: ['role_target_id']
}
```

9. Si el actor esta `inPlay=true` desde el inicio, puede usar
   `restore_recent_out_of_play` sobre el current out of play aunque no sea self,
   si conserva uso de esa recipe.
10. Si el actor esta `inPlay=false` y el current out of play no es el, la stage
    no deberia estar disponible.
11. Si no tiene usos disponibles de ninguna recipe, la stage se muestra
    igualmente y basta con el acknowledgement inicial.
12. Si puede usar alguna recipe, debe existir un input explicito de fin de turno:

```js
{
  type: 'finish_turn',
  reason: 'done'
}
```

13. El actor puede usar 0, 1 o 2 recipes antes de `finish_turn`.
14. Tras `finish_turn`, el actor pasa a `screenHidden`.
15. El director revisa y ejecuta `finish_stage`.

Reglas del flujo:

- Los inputs de recipes bastan; no se pide acknowledgement adicional por el
  resultado de restore o set out.
- El director puede ejecutar cualquiera de estos inputs en representacion del
  actor presencial.
- Si el actor usa su `set_out_of_play` privado, el target no recibe mensaje ni
  acknowledgement en esta stage; se entera por estado o por un flujo posterior.
- `player_waiting_for_director` no implica que el player espere una respuesta
  conversacional del director. En este flujo preferimos proyectar
  `screenHidden` tras `finish_turn`, porque expresa mejor que el player ya no
  debe ver ni hacer nada.

## Pool Concealed

Durante `poolConcealed`:

- el director siempre tiene `screenInteractive`;
- los roles no implicados en el currentStage tienen `screenHidden`;
- los `stage.actorIds` del currentStage tienen `screenInteractive`;
- las audiencias derivadas por historial o metadata, como
  `linked_target_recognition.metadata.audienceRoleIds`, pueden recibir
  informacion especifica;
- cerrar el stage sigue siendo responsabilidad del director segun el flujo de
  partida, aunque el motor pueda aceptar otros requesters mientras no cerremos
  esa regla en dominio.

Ejemplos:

| Stage | Screen interactive | Screen hidden |
| --- | --- | --- |
| `role_assumes_role` | actor del role y director | resto de roles |
| `role_links_targets` | actor del role y director | resto de roles |
| `linked_target_recognition` | miembros linked y director | roles no linked |
| `role_inspects` | actor del role y director | resto de roles |
| `stage_concealed_set_out_of_play` | miembros de `group_concealed_set_out_of_play` y director | resto de roles |
| `role_in_out_of_play` | actor del role y director | resto de roles |

## Director/Player Stage Contract

Este contrato describe lo que la superficie debe permitir para `basic_ruleset`.
No cambia `stage.completion`: mecanicamente muchas stages aceptan
`player/director/system` como requester, pero el flujo humano aceptado es que el
director cierre realmente cada stage.

Hay un unico concepto de acknowledgement:

- un acknowledgement confirma que el jugador ha recibido o entendido la
  informacion que se le muestra;
- todos los acknowledgements se expresan en superficie mediante boton o checkbox;
- el director puede registrar un acknowledgement en representacion de un jugador
  presencial;
- un acknowledgement puede ser requisito para aplicar un efecto o avanzar, pero
  no deja de ser contrato de superficie;
- por defecto se guarda en `stageHistory`, porque ocurre durante una stage;
- si una recipe o action futura necesita acknowledgement propio, se guardara en
  su historial correspondiente.

Columnas:

- `Director ve`: informacion y controles que debe tener el panel director.
- `Player remoto ve`: informacion que recibe el jugador conectado.
- `Director por presencial`: input que el director puede registrar si el player
  no usa dispositivo.
- `Player hace`: accion o confirmacion esperada del jugador.
- `Ack`: confirmacion minima esperada antes de que el director cierre.
- `Cierre`: quien debe avanzar la stage en el flujo de direccion.

| Stage | Director ve | Player remoto ve | Director por presencial | Player hace | Ack | Cierre |
| --- | --- | --- | --- | --- | --- | --- |
| `role_assumes_role` | Todo lo que ve el player: opciones asumibles, opcion enviada, resultado final, y control de cierre. | Siempre ve todas las opciones asumibles, incluso si la asignacion queda forzada. | Registrar una eleccion concreta o hacer acknowledgement por el jugador si ambos roles sobrantes fuerzan `role_set_out_of_play`. | Elige role asumible o confirma la asignacion forzada. | Si, antes de aplicar el resultado. | Por director. |
| `role_links_targets` | Todo lo que ve el player: candidates, targets, resultado, y control de cierre. | Candidates validos para `link_targets`. | Registrar los targets que el jugador senala. | Selecciona targets. En `basic_ruleset` son exactamente 2, aunque el role debe admitir N como definicion general. | No hay ack de "accion registrada". Los acknowledgements pertenecen al reconocimiento informativo posterior. | Por director. |
| `linked_target_recognition` | Group linked creado, miembros, audiencia que recibe la informacion, acknowledgements pendientes, y control de cierre. | Cada miembro linked ve los otros miembros del group, preferiblemente sin incluirse a si mismo. | Marcar acknowledgement individual por cada miembro linked presencial. | Cada miembro linked confirma que reconoce al resto. El actor que creo el link no lo ve si no forma parte del group. | Si, individual por miembro linked o marcado por director. | Por director, dentro del cierre de `role_links_targets`. |
| `role_inspects` | Todo lo que ve el player: candidates, target, resultado revelado, y control de cierre. | Candidates validos y resultado revelado inmediatamente tras seleccionar target. | Registrar target y mostrar/comunicar el resultado al jugador presencial. | Selecciona target y hace acknowledgement de que vio el resultado. Tras ese acknowledgement no vuelve a consultar el resultado. | Si. | Por director. |
| `stage_concealed_set_out_of_play` | Group actor, candidates, recuento recibido por candidate, estado de voto de jugadores conectados, unanimidad/no unanimidad, candidate final, efectos finales, y control de cierre. | Cada miembro conectado del group puede emitir seleccion individual. Tras resolver, conoce unanimidad/no unanimidad y candidate final si lo hay. | Ver votos remotos, sumar votos presenciales fuera del motor y registrar el candidate final o null segun unanimidad. | Cada miembro conectado emite seleccion individual. | Si, porque deben conocer el resultado de su seleccion. | Por director. |
| `role_in_out_of_play` | Todo lo que ve el player: designacion previa, recipes disponibles/usadas, targets, resultado, y control de cierre. | Si fue puesto out en el concealed actual, primero ve que ha sido designado; luego decide restore/no restore. Si no puede actuar, solo ve acknowledgement. | Registrar acknowledgement, restore self, y si procede `set_out_of_play`. | Puede restaurarse self; si queda inPlay y conserva recipes, puede usar `set_out_of_play` en la misma stage; tambien puede no actuar. | Si, incluso si no actua. | Por director. |
| `stage_deliberation` | Roles `inPlay=true`, mesa publica, informacion publica disponible, y control de cierre. | Roles `inPlay=true`: deliberan. Roles `inPlay=false`: observan todo, pero no interactuan. | Facilitar o cerrar la deliberacion presencial/remota. | Delibera sin input mecanico. | No. | Por director. |
| `stage_exposed_set_out_of_play` | Roles `inPlay=true`, recuento publico por candidate, estado de voto de jugadores conectados, candidate final o null, razon del resultado, efectos finales, y control de cierre. | Roles `inPlay=true`: emiten seleccion definitiva publica. Roles `inPlay=false`: observan todo, pero no interactuan. | Ver votos remotos, sumar votos presenciales fuera del motor, registrar el candidate final o null, y anular/reemplazar resultado si procede. | Emite vote en una unica ronda. | No. Los players ven candidate final antes de cierre. | Por director. |
| `role_reactive_response` | Causa de activacion, candidates, target elegido, efecto final publico, y control de cierre. | Ve por que se activo su respuesta y elige target durante su stage. | Registrar y confirmar target indicado por el jugador presencial. | Selecciona target inmediatamente dentro de su stage. | No. | Por director. |
| `select_double_selector` | Seleccion publica, candidates `inPlay=true`, holder elegido, acknowledgements, y control de cierre. | Participa en la votacion si esta `inPlay=true`. El holder elegido conoce publicamente que ahora es `doubleSelector`. | Votar en representacion de jugadores presenciales. | Vota. Si resulta elegido, hace acknowledgement. | Si, para el nuevo holder. | Por director. |
| `pick_next_double_selector` | Holder saliente, candidates, seleccion del nuevo holder, acknowledgements, y control de cierre. | El holder anterior selecciona sucesor si puede actuar; todos conocen la transferencia publicamente. | Registrar seleccion del holder anterior. | Holder anterior elige sucesor; nuevo holder hace acknowledgement. | Si, para el nuevo holder. | Por director. |
| `linked_propagated_effect` | Efecto propagado, causa, causalCondition, target, si produce efecto o queda sin efecto, y control de cierre. | Normalmente nada especifico. Si produce `out_of_play`, el cambio se vera por estado de pantalla. | Revisar y cerrar la resolucion. | Ninguna accion de player. | No. Si queda sin efecto por causalCondition, se comunica solo al director. | Por director. |

Reglas comunes:

- El director debe poder introducir por un jugador presencial cualquier input que
  ese jugador podria enviar remotamente.
- Que un jugador este conectado por telefono, tablet o pc no impide que el
  director pueda introducir input en su representacion.
- En selecciones colectivas mixtas, los jugadores conectados pueden emitir voto
  desde la app. El director ve el recuento remoto por candidate y si todos los
  jugadores conectados han votado; despues suma los votos presenciales fuera del
  motor y registra el candidate final o null segun corresponda.
- Durante una votacion secreta, los jugadores no ven votos ajenos antes del
  cierre. El director si puede ver el recuento recibido por candidate y el
  estado de emision de los jugadores conectados.
- Un player remoto no debe ver informacion de stages donde no es actor ni
  audiencia derivada.
- Un acknowledgement no es una accion mecanica por si mismo, aunque una recipe
  o stage pueda esperar a recibirlo antes de aplicar un resultado o permitir el
  cierre.
- La capa `surfaceModel.js` debe proyectar estos acknowledgements y su
  persistencia sin introducir reglas nuevas de juego.
- Los acknowledgements marcados como `required` son requeridos por el flujo de
  superficie antes del cierre normal de la stage.
- Una stage con acknowledgements requeridos solo puede cerrarse cuando cada
  acknowledgement haya sido realizado por el jugador o por el director en su
  representacion.
- El cierre aceptado para `basic_ruleset` es director-driven: el director,
  humano o automatizado, avanza cada stage tras revisar acciones, informacion y
  acknowledgements.
- `role_reactive_response` queda descrita aqui como contrato de superficie. La
  regla de dominio aceptada es que `role_reactive` solo reacciona si fue puesto
  `out_of_play` en `concealed_set_out_of_play` o `exposed_set_out_of_play`.

## Pool Exposed

Durante `poolExposed`:

- los roles con `inPlay=true` pueden tener superficie publica activa;
- los roles con `inPlay=false` observan la stage expuesta completa, pero no
  participan mecanicamente salvo regla explicita;
- `stage_exposed_set_out_of_play` usa `selectorSource: in_play_roles`;
- la conversacion, chat o videoconferencia es superficie, no accion mecanica;
- la seleccion mecanica empieza cuando la UI envia selections al motor;
- al completarse el pool, la superficie puede volver a modo oculto antes del
  siguiente `poolConcealed`.

## Special Stages

La superficie trata `specialStages` como interrupciones causales entre pools. La
cola runtime sigue siendo `session.specialStages`, y cada specialStage puede
declarar `metadata.eventWindow` para proyectarse en el momento de superficie
correcto:

- `before_concealed`;
- `after_concealed`;
- `before_exposed`;
- `after_exposed`.

- si una specialStage requiere director, el director queda `screenInteractive`;
- si una specialStage tiene actores, esos actores quedan `screenInteractive`;
- si es informativa, la UI puede mostrarla como revision/acknowledgement del
  director.

La ejecucion de una specialStage y la comunicacion publica de sus resultados son
momentos distintos.

Ventanas aceptadas inicialmente:

- `role_reactive_response` creado desde `concealed_set_out_of_play` usa
  `eventWindow: 'before_exposed'`. El director queda `screenInteractive`, el
  actor `role_reactive` queda `screenInteractive`, y el resto de jugadores queda
  en superficie publica `screenReadonly`.
- `role_reactive_response` creado desde `exposed_set_out_of_play` usa
  `eventWindow: 'after_exposed'` y se resuelve antes de terminar el ciclo.
- `linked_propagated_effect` creado desde `poolConcealed` usa
  `eventWindow: 'after_concealed'`; es privado y only director.
- La activacion visual publica de todos los jugadores pertenece a `publicReveal`,
  funcion de superficie posterior a `after_concealed`.

## Public Reveal

`publicReveal` es la transicion de superficie que ocurre entre
`after_concealed` y `before_exposed`.

Flujo aceptado:

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

Durante `publicReveal`, todos los jugadores ven un plano publico de la mesa:

- los jugadores se organizan alrededor de un circulo o elipse usando `seat`;
- cada jugador muestra su estado publico actual, especialmente `inPlay=true` o
  `inPlay=false`;
- se muestran los resultados finales publicos de efectos ocurridos en
  `poolConcealed` y `after_concealed`;
- links, groups u otras agrupaciones privadas permanecen ocultas salvo que una
  regla las declare publicas.

`publicReveal` puede producir:

- `surfaceMessages`: mensajes temporales filtrables por skin, por ejemplo que un
  jugador ha quedado `inPlay=false`;
- `surfaceItems`: informacion estructurada para pintar la mesa, por ejemplo el
  estado publico de cada seat.

Ejemplo de `surfaceItem` para el plano publico:

```js
{
  type: 'public_table_state',
  recipientRoleIds: ['role_a', 'role_b', 'role_c'],
  payload: {
    seats: [
      { seat: 0, roleId: 'role_a', playerId: 'player_a', inPlay: true },
      { seat: 1, roleId: 'role_b', playerId: 'player_b', inPlay: false },
      { seat: 2, roleId: 'role_c', playerId: 'player_c', inPlay: true }
    ]
  }
}
```

Ejemplo de `surfaceMessage` temporal:

```js
{
  messageKey: 'role_state_revealed',
  audience: 'public',
  payload: {
    role: 'role_b',
    property: 'inPlay',
    value: false
  },
  expiresOn: 'finish_stage'
}
```

`before_exposed` puede usar esa superficie publica como base. En
`role_reactive_response` creado desde concealed:

- el sistema o el director comunica publicamente que el jugador tiene asignado
  `role_reactive` y que su estado actual es `inPlay=false`;
- el actor `role_reactive` hace su pick;
- el target elegido queda `inPlay=false`;
- todos los jugadores reciben un `surfaceMessage` publico filtrable por skin,
  con `messageKey: 'role_state_revealed'`, `sourceId` del reactivo y
  `reason: 'reactive_response'`;
- el resultado se muestra inmediatamente como `effect_result`;
- estos mensajes publicos son temporales y expiran con `finish_stage`;
- este flujo no requiere acknowledgement publico ni acknowledgement del actor.

En `role_reactive_response` creado desde `exposed_set_out_of_play`, la
revelacion de que el actor reactivo ha quedado `inPlay=false` pertenece al flujo
general de `exposed_set_out_of_play`. La stage reactiva comunica su pick y el
efecto producido.

Payload aceptado:

```js
{
  type: 'effect_result',
  sourceId: reactiveRoleId,
  targetId: targetRoleId,
  reason: 'reactive_response',
  effect: {
    property: 'inPlay',
    value: false
  }
}
```

La activacion publica inicial deja a todos los jugadores en `screenReadonly`.
Durante `before_exposed`, el director queda `screenInteractive`. Si existe una
specialStage como `role_reactive_response`, sus actores quedan
`screenInteractive`. Al terminar su input, el actor vuelve a `screenReadonly`
mientras dure la fase publica. Al entrar en `poolExposed`, los roles
`inPlay=true` pasan a `screenInteractive` cuando deban participar; los roles
`inPlay=false` mantienen la superficie publica readonly.

Si `role_reactive_response` se abre sin targets validos, la session debe
registrar un error de dominio. En una partida correctamente resuelta, esa stage
solo existe si todavia hay candidates validos o si la partida debe haber pasado
antes por `conclude_play`.

La revelacion publica de roles que quedan `inPlay=false` debe modelarse como
evento informativo en `specialStages`. Cada `set_out_of_play` revelable crea una
specialStage en la ventana que corresponda por caso, normalmente
`before_exposed` o `after_exposed`.

Ejemplo: si un player tiene asignado `role_plain` y ese role queda
`inPlay=false` durante la zona privada, se crea una specialStage informativa con
`eventWindow: 'before_exposed'`. Esa stage emite un `surfaceMessage` filtrable
por skin equivalente a:

```js
{
  messageKey: 'role_state_revealed',
  audience: 'public',
  payload: {
    playerId: 'player_n',
    role: 'role_plain-0',
    roleKey: 'role_plain',
    property: 'inPlay',
    value: false
  },
  expiresOn: 'finish_stage'
}
```

No requiere acknowledgement de jugadores. El cierre por director confirma que la
informacion ya fue comunicada. Despues de vaciar la cola de specialStages de esa
ventana, el plano publico de players queda actualizado para todos los jugadores.

Tras `after_exposed`, `privateHide` devuelve la superficie de roles al estado
oculto antes del siguiente tramo privado.

## Fuera Del Motor

Queda fuera del nucleo de dominio:

- color, imagen o animacion de pantalla negra;
- texto final visible;
- sonido o aviso;
- layout de director;
- layout de jugador;
- gestion de camara/video/chat;
- automatismos de presencia fisica.

La futura capa de UI puede implementar un `surfaceProjection` que lea la session
y produzca props de presentacion, pero esa proyeccion no debe modificar la
session mecanica.

# Diccionario del nucleo anonimo

Este documento recoge solo definiciones finales o aceptadas. No debe incluir
nombres historicos, aliases provisionales ni versiones intermedias.

## Capas

`Catalog` = biblioteca de piezas mecanicas disponibles.

`ruleSet` = universo mecanico construido con piezas de Catalog.

`configuration` = seleccion concreta dentro de un ruleSet.

`skin` = capa narrativa y visual sobre elementos del ruleSet/configuration.

`match` = union concreta de jugadores, asientos y roles seleccionados.

`session` = partida viva materializada.

## Configuracion

`basicConfiguration` = `ruleSetId`, `skinId`, `playersExpected`,
`sessionLanguage` y opciones base.

`sessionLanguage` = idioma de la session de juego. No es el idioma global de la
aplicacion.

`runModeConfiguration` = modo de direccion de partida: `human`, `human_ai` o
`ai`, mas `delegatedTasks` cuando corresponda.

`ruleSetConfiguration` = seleccion de roles, cantidades, reglas opcionales y
`distributionOverride` dentro de lo permitido por el ruleSet.

`gameConfiguration` = plantilla reutilizable formada por
`basicConfiguration + runModeConfiguration + ruleSetConfiguration`.

`matchConfiguration` = seleccion de jugadores, asientos y roles antes de
materializar el match.

`match` = jugadores, asientos y roles ya preparados para construir una session.

`sessionConfiguration` = input completo para crear una session:
`gameConfiguration + matchConfiguration`.

`gameConfigurationCatalog` = futuro catalogo de plantillas reutilizables de
partida.

`selectedRuleSet` = ruleSet elegido desde catalogo antes de aplicar
`ruleSetConfiguration`.

`ruleSet` = si se usa como input de `buildSession`, significa ruleSet ya acotado
para una session concreta. Se construye con `buildRuleSet`.

## Identificadores

`catalogRoleId` = id del role dentro del catalogo mecanico.

`ruleSetRoleId` = id con el que un ruleSet expone un role dentro de su universo
mecanico.

`roleKey` = identificador mecanico estable de un tipo de role. No es texto
visible.

`skinKey` = clave que conecta un elemento mecanico expuesto por ruleSet con su
nombre, texto, imagen o recurso dentro de una skin.

`presentationKey` = alternativa tecnica aceptable para `skinKey` si el codigo lo
requiere, pero la preferencia actual es `skinKey`.

`roleId` = id de un role vivo dentro de una session concreta. En los objetos
runtime se guarda como `role.id`.

`playerId` = id de un jugador de la aplicacion.

`player` = persona o cliente de aplicacion que participa en una session. Un
player ocupa un `seat` y puede tener un role asignado, pero no es el role.

`player asignado a un role` = vinculacion runtime entre `playerId` y `roleId`.
Las recipes, stages y efectos mecanicos apuntan normalmente a roles; la UI,
presencia remota/presencial y surface necesitan saber que player ve o introduce
esa informacion.

`role asignado a un player` = identidad mecanica que ese player controla o
representa en la session. Si el role cambia de estado, por ejemplo
`inPlay=false`, la mecanica cambia el role; la surface puede comunicarlo como
informacion sobre el player que tiene ese role asignado.

`seat` = posicion/asiento asignado dentro de una match/session.

`groupId` = id de un group dentro de una session o definicion mecanica.

`alignmentId` = id de una alineacion mecanica. Sustituye a cualquier vocabulario
tematico como faccion narrativa.

`alignment_a` = convencion recomendada para el primer alignment principal de un
ruleSet basico.

`alignment_b` = convencion recomendada para el segundo alignment principal de un
ruleSet basico.

`alignment_undefined` = convencion recomendada para roles cuyo alignment final
no esta resuelto al inicio de la session y puede definirse durante la partida.

`alignment_independent` = convencion recomendada para roles con objectives
propios o no dependientes del eje principal `alignment_a` /
`alignment_b`.

## Objetos mecanicos

`role` = unidad minima jugable definida por el motor.

`instanceRule` = regla definida por un role para indicar cuantas instancias de
si mismo puede o debe materializar en una session.

`group` = conjunto de roles. Puede representar equipos, subconjuntos,
vinculos o colecciones temporales. No siempre necesita persistir; solo se
materializa cuando una regla necesita una referencia estable a esa coleccion.

`groupRules` = reglas declarativas asociadas a un group. El resolver no deduce
comportamiento a partir de `group.type`; interpreta estas reglas.

`propagate_property_change` = groupRule que observa un cambio `(property,
value)` sobre un miembro y genera otro cambio sobre los miembros indicados por
`targets`. Cada efecto derivado usa como `causedBy` el id del group.

`stage` = periodo ejecutable dentro de un pool. Define el contexto concreto de
ejecucion: cuando ocurre, quien puede actuar, que actions/recipes estan
disponibles y que reglas de seleccion o disponibilidad aplican.

`stageKey` = clave mecanica estable de una definicion de stage. Varias
materializaciones pueden compartirla.

`stageId` = identificador unico de un stage materializado dentro de la session.
El cursor y los historiales lo usan para distinguir stages con el mismo
`stageKey`.

`pool.onEnter` = ciclo de entrada completo del pool. Contiene operaciones
obligatorias y configurables que deben ejecutarse antes de sus stages.

`pool.onExit` = ciclo de salida completo del pool. Contiene operaciones
obligatorias y configurables que deben ejecutarse tras sus stages.

`pool` = coleccion ordenada de stages con ciclos de vida `onEnter` y `onExit`.

`poolKey` = clave mecanica estable que identifica la posicion y finalidad de un
pool dentro del ciclo, por ejemplo `poolConcealed` o `poolExposed`. No existe
`poolId`: una ejecucion queda identificada por `cycleId + poolKey`.

`cycle` = entidad runtime superior a los pools. Conoce el orden de los pools,
la iteracion actual y cuando debe resolver `specialStages` antes de continuar
con `poolConcealed` o `poolExposed`.

`cycleId` = numero de la iteracion actual del ciclo. En codigo vive como
`session.cycle.id`. El ciclo inicial previo al primer ciclo normal usa `0`.

`cycleKey` = concepto no implementado. No se necesita mientras la session solo
tenga una unica definicion de ciclo repetitivo.

`specialStages` = cola FIFO runtime de stages dinamicos que se resuelven entre
pools. No es un pool, no se prepara y cada stage se elimina al completarse.
Cada elemento tiene `stageId`, `stageKey` y metadatos de origen. Los stages
generados durante un pool se resuelven despues de completar ese pool y antes
del siguiente, conservando su relacion causal con el ciclo actual.

`eventWindow` = metadata opcional de una specialStage que indica en que ventana
de superficie debe proyectarse: `before_concealed`, `after_concealed`,
`before_exposed` o `after_exposed`. No convierte `specialStages` en varios
pools ni en varias colas.

`publicReveal` = transicion de superficie entre `after_concealed` y
`before_exposed`. Proyecta la mesa publica por `seat`, estados publicos como
`inPlay`, mensajes temporales filtrables por skin y resultados publicos ya
resueltos.

`privateHide` = transicion de superficie posterior a `after_exposed` que devuelve
la pantalla de roles al modo oculto antes del siguiente tramo privado.

`specialStageDefinitions` = stages iniciales que una definicion aporta
directamente a `session.specialStages`. No usan una bandera dentro del stage.

`currentStageSource` = indica si el cursor ejecuta actualmente un stage de
`cycle.pools` o de `session.specialStages`. Sus valores son `pool` y
`specialStages`.

`specialStageHistory` = historial propio de altas, inicios, cierres y fallos de
la cola `specialStages`, dentro de `session.history`.

`role_state_revealed` = specialStage informativa generada cuando un role queda
`inPlay=false` y debe comunicarse publicamente. No tiene actions ni
acknowledgements de jugadores; el director la cierra tras comunicar player,
role revelado, estado y causa.

`cycleModel` = modelo runtime responsable de iniciar ciclos, contar sus
iteraciones y mover el flujo entre pools.

`startCycle` = operacion de `cycleModel` que incrementa `cycle.id`. No es action,
recipe, effect ni stage, y no modifica directamente estado de roles.

`preparePool` = operacion previa que prepara los stages persistentes del pool
seleccionado evaluando sus `availabilityRules`.

`validatePool` = operacion que valida un pool despues de prepararlo y antes de
ejecutarlo.

`runPool` = ejecucion incremental de `pool.onEnter`, stages y `pool.onExit`.
Puede quedar esperando input humano durante un stage.

`actor` = contrato que declara quien tiene autoridad mecanica para ejecutar una
recipe. Los tipos base aceptados son:

```js
{ type: 'role' }     // actua un role individual
{ type: 'group' }    // actua un conjunto de roles derivado por stage/session
{ type: 'system' }   // accion automatica del motor
{ type: 'director' } // accion explicita del director de partida
```

`recipe` = receta mecanica reusable que combina una lista de actions puras,
actor, target, usage, constraints y visibility. La recipe define la mecanica
general; no decide por si sola en que momento concreto se ejecuta.

`recipe.key` = identificador mecanico de la recipe concreta, por ejemplo
`set_out_of_play`.

`recipe.actions` = lista de actions puras que ejecuta la recipe. La
implementacion actual ejecuta una unica action por recipe, pero el contrato
queda preparado para recipes multi-action futuras.

`input` = intencion humana o externa concreta para una ejecucion: seleccion,
target, confirmacion, requester, acusacion, validacion u otros datos de action.

`session` = partida viva materializada. Aporta los roles, groups, pools,
specialStages, objectiveRules e historiales reales sobre los que se resuelven
stages y recipes.

`action` = intento de producir un cambio o resultado mecanico.

`effect` = cambio final que puede aplicarse sobre la session.

`constraint` = restriccion que limita si una recipe puede ejecutarse.

`modifier` = modificador futuro. No debe confundirse con constraint.

`event` = hecho producido por la session que puede disparar reacciones.

`reaction` = definicion que escucha un event y puede crear una respuesta, como
un stage especial.

`objective` = objetivo mecanico que puede cumplirse durante la parte jugable.
Es el lenguaje interno del nucleo para evaluar logros o conclusiones.

`objectiveRules` = lista viva de reglas de objetivo evaluables dentro de una
session concreta. En el modelo objetivo vive como `session.objectiveRules`.

`objectiveRule` = regla que define una condicion de objetivo, que propone al
cumplirse y como resolver conflictos asociados.

`holder` = sujeto mecanico sobre el que se evalua una objectiveRule. Puede ser
un role o group runtime. En definiciones que se materializan despues, puede usar
la referencia relativa `self`.

`self` = referencia relativa de holder usada antes de materializar una
objectiveRule dentro de un objeto como group. Al entrar en runtime debe
resolverse a un holder concreto.

`onFulfilled` = propuestas emitidas por una objectiveRule cuando su condicion se
cumple. No es todavia el outcome final.

`beneficiaries` = sujetos mecanicos beneficiados por un objetivo cumplido. No
implica un resultado narrativo concreto.

`beneficiaries: holder` = referencia relativa que indica que el beneficiario es
el holder ya resuelto de esa misma objectiveRule.

`conclusive` = indica si un objetivo cumplido concluye la parte jugable de la
session.

`achievedObjectives` = objetivos cumplidos que no necesariamente concluyen la
parte jugable.

`playOutcome` = conclusion mecanica de la parte jugable. No cierra la session
administrativa.

`playOutcomeCandidate` = conclusion mecanica posible, pero todavia no estable
si existen stages pendientes capaces de alterar las objectiveRules cumplidas.

`dependencies` = propiedades o estructuras de estado que una objectiveRule lee
para sostener su condicion.

`influences` = propiedades o estructuras de estado que una action, recipe o
stage puede modificar, incluyendo operacion y valores posibles cuando aplique.

`check_objectives` = operacion de `pool.onExit` que evalua objectiveRules
de session y emite achievedObjectives o playOutcome.

`conclude_play` = operacion de ciclo de vida que gestiona la conclusion jugable
cuando existe un playOutcome concluyente y estable.

`blockedPropertyChanges` = bloqueos runtime almacenados en cada role. Cada
entrada identifica `property`, `value`, los `blockedFor.actorIds` afectados y
su `expiresAt`.

`block_property_change` = action generica que añade una entrada tipada a
`role.blockedPropertyChanges`. No bloquea una action por nombre: bloquea un
cambio mecanico `(property, value)`.

`review_property_blocks` = operacion de ciclo de vida que elimina bloqueos cuyo
`expiresAt` coincide con la frontera actual.

`duration` = coordenada temporal relativa declarada por una recipe:
`unit: stage | pool | cycle | session`, `offset` no negativo y `boundary:
before | after`. `before + offset 0` es invalido.

`expiresAt` = coordenada runtime absoluta calculada al materializar la recipe.
Puede señalar `stage_boundary`, `pool_boundary`, `cycle_boundary` o `session`.

`causedBy` = causa mecanica inmediata de un efecto. Identifica el role o group
cuya accion o regla genera directamente ese cambio, no el origen remoto de una
cadena de propagaciones.

`preventedPropertyChanges` = cambios de propiedad que una action intento
producir pero fueron impedidos por `blockedPropertyChanges`.

`assumableRoles` = lista simple de roleIds no asignados que pueden ser asumidos
por una receta como `assume_role`.

`role_assumes_role` = familia mecanica para roles que reemplazan su identidad por
otro role elegido desde `assumableRoles`.

`select` = mecanismo general para obtener una decision humana o grupal.

`selectorIds` = roleIds que participan en una selection.

`candidateIds` = roleIds que pueden ser elegidos en una selection.

`candidateRules` = reglas para construir o acotar `candidateIds` antes de una
selection.

`selectionRules` = reglas que gobiernan como `selectorIds` eligen entre
`candidateIds`.

`chosen` = candidate elegido por una selection valida.

`property` = unidad de estado legible o modificable de un role.

`condition` = lectura o comparacion del estado.

`rule` = declaracion que combina condition, action, consequence o restriction.

`ruleAnalyzer` = responsabilidad futura que leera reglas, detectara objetos
necesarios y solicitara su materializacion. Todavia no es una API runtime.

`materializerCoordinator` = responsabilidad futura que coordinara los
constructores solicitados por `ruleAnalyzer`.

`buildSession` = ensamblador actual que construye la session desde piezas ya
seleccionadas y materializables.

## Estado

`inPlay` = indica si un role sigue participando mecanicamente en la partida.

`out_of_play` = lectura conceptual de `inPlay=false`.

`actorIds` = roleIds que actuan dentro de una recipe/action. En flujos de
seleccion se mantiene compatibilidad temporal, pero el nombre recomendado para
quienes eligen es `selectorIds`.

`selectorIds` = roleIds que participan como selectores en una seleccion. En una
accion colectiva pueden coincidir con los miembros activos del group actor, pero
no son conceptualmente lo mismo que el actor mecanico de la recipe.

`targetIds` = roleIds que reciben una accion, recipe o decision.

`actorContract` = copia del contrato `recipe.actor` usado al resolver una
recipe/action. Se guarda para auditoria y depuracion.

`targetContract` = copia del contrato `recipe.target` usado al resolver una
recipe/action. Se guarda para auditoria y depuracion.

`recipeHistory` = historial de recipes ejecutadas o intentadas. Para recipes
colectivas debe poder registrar el actor group, sus miembros activos en ese
momento, `selectorIds` cuando haya seleccion, `targetIds`, y el contrato
`actorContract`/`targetContract` usado para resolver la action.

`stageHistory` = historial de cierres y avances de stages.

`gameplayMessage` = mensaje estructurado producido por una regla o resultado
esperado de la partida. Se presenta mediante skin.

`diagnosticMessage` = mensaje estructurado sobre un fallo tecnico del dominio.
Se guarda en `session.errorLog`.

`applicationMessage` = mensaje externo a la partida, gestionado por la
aplicacion y su propio i18n.

`sessionMessageLog` = historial de gameplayMessages. Conserva siempre el
mensaje estructurado y puede conservar tambien el texto exacto presentado.

`errorLog` = registro de diagnosticMessages de una session.

`applicationLog` = registro externo a session para mensajes de aplicacion.

`messagePresenter` = capa que combina mensaje estructurado, skin, idioma y
estado de session para producir texto listo para UI.

## Validacion

`warning` = se puede continuar, pero hay algo incompleto o mejorable.

`error` = no se puede crear o ejecutar una session valida con esa definicion o
input.

`fatal` = definicion corrupta o situacion imposible de interpretar que impide
continuar.

## Construccion

`createX` = constructor de un objeto X.

`buildX` = ensamblador que combina varios objetos o definiciones para preparar
una parte jugable.

`materializar` = convertir definiciones o referencias en estado vivo dentro de
session.

## Reglas aceptadas

`required missing skin element` = error.

`optional missing skin element` = warning + disabled.

`mechanical ruleSet change` = requiere nueva version.

`cosmetic skin change` = puede modificar el elemento existente con aviso.

`recipe.usage` = contrato publico de limite de uso de una recipe. El motor lo
traduce internamente a una constraint `limited_uses`.

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

`sessionRoleId` = id de un role vivo dentro de una session concreta.

`playerId` = id de un jugador de la aplicacion.

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

`groupRules` = reglas asociadas a un group.

`memberRole` = rol interno provisional de un miembro dentro de un group. Solo se
conservara si aparece un caso real de grupo direccional.

`stage` = periodo ejecutable dentro de un pool. Normalmente permite actuar a
uno o varios roles, pero no necesita distinguir conceptualmente si proceden de
un role individual o de un group.

`automaticStage` = etapa automatica del sistema. No representa actuacion de
role/group. Ejemplos aceptados: `start_cycle`, `check_objectives`,
`conclude_play`.

`automaticStages.onEnter` = automaticStages que se ejecutan al entrar en un
pool. Por ahora solo `poolConcealed` declara `start_cycle`.

`automaticStages.onExit` = automaticStages que se ejecutan al terminar un pool.
Por ahora todos los pools declaran `check_objectives`.

`pool` = coleccion ordenada de stages y automaticStages.

`cycle` = entidad runtime superior a los pools. Conoce el orden de los pools,
la iteracion actual y cuando debe resolver `specialStages` antes de continuar
con `poolConcealed` o `poolExposed`.

`specialStages` = cola FIFO runtime de stages dinamicos que se resuelven entre
pools. No es un pool, no se prepara y cada stage se elimina al completarse.

`specialStagesHistory` = historial propio de altas, inicios, cierres y fallos de
la cola `specialStages`.

`cycleModel` = modelo runtime responsable de iniciar ciclos, contar sus
iteraciones y mover el flujo entre pools. La migracion desde `poolCursorModel`
esta acordada pero todavia no implementada.

`preparePool` = operacion previa que prepara los stages persistentes del pool
seleccionado.

`validatePool` = operacion que valida un pool despues de prepararlo y antes de
ejecutarlo.

`runPool` = ejecucion completa de un pool: `automaticStages.onEnter`, stages
normales y `automaticStages.onExit`.

`recipe` = receta mecanica que combina una o varias acciones con restricciones.

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

`onFulfilled` = propuestas emitidas por una objectiveRule cuando su condicion se
cumple. No es todavia el outcome final.

`beneficiaries` = sujetos mecanicos beneficiados por un objetivo cumplido. No
implica un resultado narrativo concreto.

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

`check_objectives` = automaticStage del cierre de pool que evalua objectiveRules
de session y emite achievedObjectives o playOutcome.

`conclude_play` = automaticStage que gestiona la conclusion de la parte jugable
cuando existe un playOutcome concluyente y estable.

`resources` = recursos mecanicos consumibles o contadores que un role materializa
en session. Sustituye a los viejos tokens consumibles cuando no hacen falta como
elemento visual de tablero.

`roleChoiceSet` = concepto pendiente para roles que necesitan una lista de roles
elegibles sobre los que asumir, copiar, intercambiar o activar comportamiento.

`role_assumes_role` = familia mecanica pendiente para roles que asumen temporal o
permanentemente otro role elegido desde un `roleChoiceSet`.

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

`ruleAnalyzer` = responsabilidad que lee reglas, detecta objetos necesarios y
solicita materializacion cuando faltan.

`materializerCoordinator` = responsabilidad que coordina que creador debe
materializar cada objeto solicitado por ruleAnalyzer.

`sessionAssembler` = coordinador general que ensambla una session jugable desde
ruleSet, configuration y match.

## Estado

`inPlay` = indica si un role sigue participando mecanicamente en la partida.

`out_of_play` = lectura conceptual de `inPlay=false`.

`actorIds` = roleIds que actuan dentro de un stage.

`targetIds` = roleIds que reciben una accion, recipe o decision.

`actionHistory` = historial de acciones ejecutadas o intentadas.

`stageHistory` = historial de cierres y avances de stages.

`errorLog` = futuro registro de warnings, errors y fatals.

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

`resource consumption` = si una recipe se usa, consume su resource aunque el
efecto falle o sea bloqueado; si una restriccion impide usar la recipe antes de
ejecutarla, el resource no se consume.

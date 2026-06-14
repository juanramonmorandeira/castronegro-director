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

`basicConfiguration` = `ruleSetId`, `skinId`, `playersExpected`, idioma y
opciones base.

`runModeConfiguration` = modo de direccion de partida: `human`, `human_ai` o
`ai`, mas tareas asistidas cuando corresponda.

`ruleSetConfiguration` = seleccion de roles, cantidades, alignments y reglas
opcionales permitidas por el ruleSet.

`gameConfiguration` = plantilla reutilizable formada por
`basicConfiguration + runModeConfiguration + ruleSetConfiguration`.

`matchConfiguration` = jugadores, asientos y roles asignados.

`sessionConfiguration` = input completo para crear una session:
`gameConfiguration + matchConfiguration`.

`gameConfigurationCatalog` = futuro catalogo de plantillas reutilizables de
partida.

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

`step` = periodo ejecutable dentro de un pool donde un role o group puede
actuar.

`automaticStage` = etapa automatica del sistema. No representa actuacion de
role/group. Ejemplos aceptados: `close_cycle`, `check_objectives`,
`conclude_play`.

`pool` = coleccion ordenada de steps.

`recipe` = receta mecanica que combina una o varias acciones con restricciones.

`action` = intento de producir un cambio o resultado mecanico.

`effect` = cambio final que puede aplicarse sobre la session.

`constraint` = restriccion que limita si una recipe puede ejecutarse.

`modifier` = modificador futuro. No debe confundirse con constraint.

`event` = hecho producido por la session que puede disparar reacciones.

`reaction` = definicion que escucha un event y puede crear una respuesta, como
un step especial.

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

`check_objectives` = automaticStage del cierre de pool que evalua objectiveRules
de session y emite achievedObjectives o playOutcome.

`conclude_play` = automaticStage que gestiona la conclusion de la parte jugable
cuando existe un playOutcome concluyente.

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

`actorIds` = roleIds que actuan dentro de un step.

`targetIds` = roleIds que reciben una accion, recipe o decision.

`actionHistory` = historial de acciones ejecutadas o intentadas.

`stepHistory` = historial de cierres y avances de steps.

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

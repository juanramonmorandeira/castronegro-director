# Skin, ruleSet, configuration y session

Este documento define las capas que deben conectarse antes de llevar el
nucleo anonimo a la UI.

La regla principal:

```text
Catalog define la biblioteca de piezas disponibles.
ruleSet define como funciona el universo mecanico.
configuration acota que parte del ruleSet se usara.
skin define como se presenta el juego.
match une jugadores, asientos y roles.
session ejecuta una partida concreta combinando todo lo anterior.
```

## Skin

`skin` es la capa de presentacion y narrativa de una partida.

Define el mundo visible:

- nombres de roles;
- nombres de grupos, efectos, tokens, edificios u otros elementos jugables;
- textos largos y cortos;
- imagenes, iconos y assets;
- tono narrativo;
- fantasia, metatrama e intriga;
- traducciones o claves de texto asociadas a elementos del juego.

Una skin no cambia como funciona el motor. Solo asigna identidad visual y
narrativa a elementos mecanicos anonimos.

Ejemplo conceptual:

```text
role_reactive
  en otra puede llamarse Operador de Retaliacion
  en otra puede llamarse Testigo Final
```

La skin debe indicar que texto, imagen o nombre corresponde a cada elemento
mecanico. Como el motor esta anonimizado, casi todos los elementos jugables
pueden necesitar una presentacion de skin.

### Limite importante

La skin afecta a los objetos y dinamicas de la partida, no a la aplicacion como
producto.

Pertenece a skin:

- carta de rol;
- imagen de rol;
- nombre narrativo de una accion;
- texto mostrado durante un stage;
- descripcion de un token;
- ambientacion del juego.

No pertenece a skin:

- menus generales de la aplicacion;
- inicio de sesion;
- ajustes globales;
- navegacion;
- pantallas de administracion;
- textos del producto que no pertenecen a la partida concreta.

La skin es el mundo de los colores, nombres, imagenes y fantasia. No define
reglas mecanicas.

## ruleSet

`ruleSet` es la configuracion mecanica de una variante jugable.

Usamos `ruleSet` en vez de `flavor` porque `flavor` se parece demasiado a
`skin`. `ruleSet` apunta mejor a reglas, definiciones y funcionamiento.

Define el universo mecanico:

- que roles existen o estan disponibles;
- que alignments declara;
- que grupos existen;
- que reglas de membership tienen esos grupos;
- que stages aporta cada role o group;
- que recetas usa cada stage;
- que restricciones aplican a esas recetas;
- que `selectionRules` aplican a cada seleccion;
- que objectiveRules existen;
- que orden de pools y stages se propone;
- que eventos, triggers o reacciones existen;
- que reglas pueden generar stages dinamicos en `specialStages`.

Un `ruleSet` no entiende de skins. No decide si un rol se llama Operador de
Retaliacion, Testigo Final o cualquier otro nombre visible. Solo define que ese
rol tiene una reaccion, que esa reaccion escucha un evento y que genera un
stage especial.

El motor no limita cuantos alignments puede declarar un ruleSet. Para ruleSets
basicos recomendamos esta convencion:

```text
alignment_a
alignment_b
alignment_undefined
alignment_independent
```

`alignment_undefined` describe roles cuyo alignment final aun no esta resuelto
al inicio de la session. `alignment_independent` describe roles con
objectiveRules propias o separadas del eje principal.

Una skin puede apuntar a uno o varios `ruleSet`. Un `ruleSet` puede usarse con
varias skins si la skin cubre todos los elementos mecanicos necesarios.

La clave que conecta un elemento de ruleSet con su presentacion en skin se llama
`skinKey`. Si mas adelante el codigo exige un nombre mas tecnico, la alternativa
aceptada es `presentationKey`.

Ejemplo conceptual:

```text
ruleSet.basic_ruleset
  roles:
    role_inspects
    role_links_targets
    role_in_out_of_play
    role_reactive

  groups:
    group_alignment_a
    group_alignment_b
    group_concealed_set_out_of_play
    group_exposed_set_out_of_play

  objectives:
    group_alignment_b holder_reaches_in_play_parity
```

## Configuration

`configuration` es la acotacion concreta que hace el creador de una session
dentro de lo permitido por un `ruleSet`.

El `ruleSet` define lo disponible. La `configuration` decide que parte de eso
participa en una partida concreta.

Define, por ejemplo:

- numero de jugadores;
- modalidad de juego;
- roles disponibles del ruleSet que entran en esta session;
- cantidad de cada rol seleccionado;
- grupos o reglas opcionales activadas;
- que `selectionRules` disponibles se aplican;
- que objectiveRules opcionales se activan;
- orden o variantes permitidas por el ruleSet;
- opciones elegidas por el narrador, servidor o creador de la partida.

Una configuration no deberia inventar reglas fuera del ruleSet. Su funcion es
seleccionar, parametrizar y acotar.

Usamos estas capas:

```text
basicConfiguration = ruleSetId, skinId, playersExpected, sessionLanguage, opciones base.
runModeConfiguration = human / human_ai / ai y delegatedTasks.
ruleSetConfiguration = roles, cantidades, reglas opcionales y distributionOverride.
gameConfiguration = basicConfiguration + runModeConfiguration + ruleSetConfiguration.
matchConfiguration = jugadores + asientos + roles asignados.
sessionConfiguration = gameConfiguration + matchConfiguration.
```

Ejemplo conceptual:

```text
ruleSet.basic_ruleset permite:
  role_inspects
  role_links_targets
  role_in_out_of_play
  role_reactive

configuration.8_players selecciona:
  1 role_inspects
  1 role_reactive
  2 group_concealed_set_out_of_play members
  3 alignment_a_plain
```

Lectura:

```text
ruleSet = biblioteca mecanica permitida.
configuration = seleccion concreta para esta session.
```

## Session

`session` es el estado vivo de una partida concreta.

Es el punto donde convergen:

- definiciones mecanicas del `ruleSet`;
- acotacion concreta de la `configuration`;
- presentacion de la `skin`;
- jugadores;
- asientos;
- elecciones del narrador o creador de la partida;
- decisiones tomadas durante la partida;
- estado actual de roles, groups y cycle;
- `objectiveRules`;
- `achievedObjectives`;
- `playOutcome`;
- historiales;
- resultados.

La session dirige, registra, evalua, analiza y emite resultados mecanicos. Por
eso sera necesariamente grande y de alta responsabilidad.

La session guarda estado, no metatrama. Puede conservar referencias a skin y
ruleSet para saber como interpretar o presentar sus datos, pero no deberia
mezclar textos narrativos dentro del estado mecanico si puede evitarlo.

Ejemplo conceptual:

```text
session
  ruleSetId: basic_ruleset
  configurationId: basic_8_players
  skinId: castronegro_like
  players: [...]
  roles: [...]
  groups: [...]
  cycle: ...
  objectiveRules: [...]
  achievedObjectives: [...]
  playOutcome: null
  actionHistory: [...]
  stageHistory: [...]
  status: in_progress
```

## Compatibilidad entre skin y ruleSet

Antes de crear una session, la aplicacion debe poder comprobar:

- la configuration solo selecciona elementos existentes en el ruleSet;
- la configuration cumple las restricciones del ruleSet;
- la skin tiene textos para los roles del ruleSet;
- la skin tiene assets para los elementos que la UI necesita mostrar;
- la skin puede presentar las acciones, tokens, efectos o stages relevantes;
- el ruleSet es mecanicamente valido;
- la seleccion de jugadores/asientos permite construir la session.

Si falta un texto o una imagen, no deberia romper el motor. Pero la UI debe
poder detectarlo.

Regla aceptada:

```text
elemento obligatorio sin skin = error.
elemento opcional sin skin = warning + disabled.
```

No usamos fallback automatico para elementos obligatorios.

## Flujo objetivo

```text
ruleSetCatalog + basicConfiguration.ruleSetId
  -> selectedRuleSet

skinCatalog + basicConfiguration.skinId
  -> skin

selectedRuleSet + skin + basicConfiguration.playersExpected
  -> availableConfigurationOptions

availableConfigurationOptions + decisiones del creador
  -> ruleSetConfiguration

selectedRuleSet + skin + ruleSetConfiguration
  -> buildRuleSet
  -> ruleSet

runModeConfiguration
  -> runMode

basicConfiguration + ruleSet + players
  -> buildMatch
  -> match

ruleSet + runMode + match
  -> buildSession
  -> session viva

UI presenta session usando skin + sessionLanguage
motor ejecuta reglas usando ruleSet materializado en session
```

## Pendiente de definir

- Estructura exacta de `ruleSetDefinition`.
- Estructura exacta de `configurationDefinition`.
- Estructura exacta de `skinDefinition`.
- Como validar compatibilidad configuration/ruleSet.
- Como validar compatibilidad skin/ruleSet/configuration.
- Que datos de skin se copian a session y cuales se referencian por id.
- Como la UI solicita textos/assets sin contaminar el motor.
- Como almacenar skins y ruleSets en local para una app final sin Firebase.
- Analizar limites de seleccion de roles y alignments a partir de la aplicacion vieja.

Documentos relacionados:

- `docs/ruleSetDefinition.md`
- `docs/roleDefinition.md`
- `docs/objectiveDefinition.md`
- `docs/configurationDefinition.md`
- `docs/skinDefinition.md`
- `docs/domain_glossary.md`
- `docs/TODO_DOMAIN.md`

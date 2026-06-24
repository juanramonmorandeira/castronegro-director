# TODO del nucleo y capas de juego

Lista de decisiones pendientes antes de conectar el nucleo anonimo a la UI.

## Mensajes y skin

- Ampliar `MESSAGE_CATALOG` al incorporar nuevas mecanicas.
- Definir requisitos de cobertura de mensajes por ruleSet.
- Conectar `messagePresenter` con la UI cuando exista una primera skin real.
- Definir persistencia externa de `applicationLog`.
- Clasificar progresivamente los errores restantes como gameplay o diagnostic.

## Antes de anadir muchos mas roles

- Revisar la jerarquia mecanica:
  `primaryElement -> action/effect -> recipe -> role/group -> stage -> ruleSet`.
- Definir inventario de `primaryElements`.
- Verificar si el codigo actual se ajusta a esa jerarquia o si hay que mover
  responsabilidades.

## ruleSet

- Consolidar la primera implementacion de `ruleSetDefinition` y
  `basic_ruleset`.
- Decidir estructura final de `catalogRefs`.
- Ampliar `skinRequirements` cuando exista la primera skin real.
- Definir reglas de seleccion que una configuration debe respetar.
- Convertir `alignmentDistributionRules` en estructura de codigo cuando este
  cerrado el modelo de validacion.
- Revisar limites de seleccion heredados de la aplicacion vieja:
  - distribucion por alignment segun numero de jugadores;
  - roles multi-instancia obligatoria;
  - roles duplicables;
  - exclusiones especiales como actor/thief;
  - reglas dependientes de objectiveRules.
- Endurecer validaciones de reglas aportadas por roles y groups:
  - claves duplicadas dentro de `selectionRules`, `objectiveRules` y `groupRules`;
  - reglas con `holder: self` fuera de role/group;
  - reglas que referencian actions o conditions inexistentes.
- Implementar `role_assumes_role`:
  - `roleChoiceSet`;
  - eleccion inicial;
  - asuncion permanente de role;
  - regla forzada cuando todas las opciones cumplen una condicion.
- Implementar `role_observes_selection`:
  - observar una stage ajena;
  - detectar observacion;
  - sustituir el candidate elegido.
- Revisar configuracion avanzada de `selection_counts_double`:
  - abstencion configurable para vote expuesta;
  - parametros configurables de eleccion inicial;
  - resolucion UI del director si el runoff inicial sigue empatado.
- Materializar `instanceRule` y validar cantidades contra `playersExpected`.
- Validar que una configuration no nace con un objective concluyente cumplido.
- Definir validacion de ruleSet:
  - catalogIds existentes;
  - colisiones de stages;
  - colisiones de order;
  - objectiveRules presentes;
  - groups validos;
  - coherencia de poolOrder.

## configuration

- Revisar `Configure.svelte`, `Properties.svelte`, `Selection.svelte` y
  `Match.svelte` antes de implementar el nuevo modelo.
- Definir `basicConfiguration`.
- Definir `runModeConfiguration`.
- Definir `ruleSetConfiguration`.
- Definir `gameConfiguration`.
- Definir `matchConfiguration`.
- Definir `sessionConfiguration`.
- Definir diferencia exacta entre `gameConfiguration`, `matchConfiguration` y
  `sessionConfiguration`.
- Decidir que configuraciones pueden guardarse en un catalogo de
  `gameConfiguration`.
- Nota futura: estudiar capa de metatrama asociada a configuraciones o sessions.

## skin

- Definir `skinDefinition` en codigo.
- Definir compatibilidad skin/ruleSet/configuration.
- Usar `skinKey` como puente entre ruleSet y skin, salvo que el codigo requiera
  `presentationKey`.
- Aplicar regla aceptada:
  - elemento obligatorio sin skin = error;
  - elemento opcional sin skin = warning + disabled.
- Decidir si habra versionado simple de skins o solo ids diferentes.

## session

- Decidir que datos guarda como referencia:
  - `ruleSetId`;
  - `skinId`;
  - `sessionConfigurationId`.
- Decidir que datos materializa:
  - roles;
  - groups;
  - cycle y pools;
  - settings;
  - match/seats.
- Revisar persistencia vieja para trasladarla al modelo nuevo.
- Definir que significa materializar cada capa al crear una session.
- Distinguir `playOutcome` de `sessionStatus`.

## objective

- Completar la migracion de UI y referencias antiguas hacia `objective`.
- Completar persistencia de `achievedObjectives`.
- Completar resolucion de conflictos entre objectiveRules concluyentes.
- Eliminar cualquier import antiguo que no use `objectiveModel.js`.

## roleDefinition

- Implementar `instanceRule` cuando pasemos estas reglas a codigo.
- Migrar los viejos tokens consumibles a `resources` mecanicos.
- Definir como recipeModel consume resources.
- Definir `roleChoiceSet` para roles que asumen o intercambian otros roles.
- Mantener `role_assumes_role` como familia mecanica preferida para ese caso.

## Validaciones y errores

- Extender la conversion de errores existentes a `diagnosticMessages`.
- Definir politicas de pausa por severidad cuando se implemente el control de
  errores de session.
- Conectar `errorLog` a una vista tecnica para director o desarrollo.

## Bloqueos temporales

- Mantener sin offsets negativos hasta que exista una mecanica real que los
  justifique.
- No aplicar duraciones de stage a `specialStages` hasta que exista un caso
  real.
- Anadir nuevas `groupRules` solo cuando aparezcan mecanicas reales; la primera
  implementada es `propagate_property_change`.

## Pool runtime

- Definir `runPool` como coordinador incremental, porque los stages pueden
  esperar input humano.
- Completar `poolHistory` con `started`, `completed` y `failed` durante la
  ejecucion incremental.
- Aplicar pausa administrativa en session cuando un error ascienda desde pool.
- No crear `cycleSpecialStages` hasta que exista una mecanica real ejecutada
  entre ciclos. Mantener mientras tanto una unica cola `session.specialStages`.

## Futuro editor de catalog

- Nota mental: permitir crear nuevos elementos de catalog desde la aplicacion.
- No implementar ahora.
- Requiere antes tener bien definidos primaryElements y constructores.

## Diccionario

- Mantener `docs/domain_glossary.md` como fuente de definiciones finales.
- No registrar en el diccionario nombres intermedios ni aliases historicos.

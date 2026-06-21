# TODO del nucleo y capas de juego

Lista de decisiones pendientes antes de conectar el nucleo anonimo a la UI.

## Antes de anadir muchos mas roles

- Revisar la jerarquia mecanica:
  `primaryElement -> action/effect -> recipe -> role/group -> stage -> ruleSet`.
- Definir inventario de `primaryElements`.
- Verificar si el codigo actual se ajusta a esa jerarquia o si hay que mover
  responsabilidades.

## ruleSet

- Definir `ruleSetDefinition` en codigo.
- Decidir estructura final de `catalogRefs`.
- Definir `skinRequirements`.
- Definir reglas de seleccion que una configuration debe respetar.
- Convertir `alignmentDistributionRules` en estructura de codigo cuando este
  cerrado el modelo de validacion.
- Revisar limites de seleccion heredados de la aplicacion vieja:
  - distribucion por alignment segun numero de jugadores;
  - roles multi-instancia obligatoria;
  - roles duplicables;
  - exclusiones especiales como actor/thief;
  - reglas dependientes de objectiveRules.
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

- Crear catalogo de severidades:
  - warning;
  - error;
  - fatal.
- Definir formato comun de error.
- Definir si necesitamos `errorLog` dentro de session o solo resultados de
  validacion antes de crear session.
- Definir textos de error para UI sin contaminar el motor.

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

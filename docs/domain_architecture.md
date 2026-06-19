# Arquitectura del nuevo dominio

Este mapa contiene exclusivamente los elementos del nuevo dominio mecanico. No
representa la UI antigua, Firebase ni el flujo historico de `Session.svelte`.

Leyenda:

- Verde: implementado en `src/lib/domain`.
- Amarillo discontinuo: concepto acordado pendiente de migracion.
- Gris punteado: pendiente de definicion.

El PDF navegable esta en [domain_architecture.pdf](./domain_architecture.pdf).
La imagen inferior sirve como respaldo cuando el visor Markdown no soporta
Mermaid.

![Arquitectura completa del nuevo dominio](./domain_architecture.png)

## Flujo principal

```mermaid
flowchart TD
  CATALOGS["Catalogs"]
  RULESET["ruleSet"]
  CONFIG["gameConfiguration"]
  MATCH["match"]
  BUILD["buildSession"]
  SESSION["session"]
  CYCLE["cycleModel"]
  SPECIAL["specialStages FIFO"]
  CONCEALED["poolConcealed"]
  EXPOSED["poolExposed"]
  PREPARE["preparePool"]
  VALIDATE["validatePool"]
  RUN["runPool"]
  ENTER["automaticStages.onEnter"]
  STAGES["stages normales"]
  EXIT["automaticStages.onExit"]
  PIPELINE["recipe -> constraint -> action -> resolver -> effect"]
  EVENTS["eventModel"]
  OBJECTIVES["objectiveModel"]

  CATALOGS --> RULESET
  RULESET --> CONFIG
  CONFIG --> MATCH
  MATCH --> BUILD
  BUILD --> SESSION
  SESSION --> CYCLE
  CYCLE --> SPECIAL
  CYCLE --> CONCEALED
  CYCLE --> EXPOSED
  SPECIAL --> PREPARE
  CONCEALED --> PREPARE
  EXPOSED --> PREPARE
  PREPARE --> VALIDATE
  VALIDATE --> RUN
  RUN --> ENTER
  ENTER --> STAGES
  STAGES --> PIPELINE
  PIPELINE --> EVENTS
  EVENTS --> SPECIAL
  PIPELINE --> EXIT
  EXIT --> OBJECTIVES
  OBJECTIVES --> CYCLE
```

## Jerarquia aceptada

```text
session
└── cycle
    ├── coordina specialStages entre pools
    ├── poolConcealed
    └── poolExposed
        ├── automaticStages.onEnter
        ├── stages
        └── automaticStages.onExit
```

`cycle` entiende la relacion entre pools y sus iteraciones. Un pool entiende
solo de sus propios stages. Un stage coordina selection y recipes, pero no mueve
otros pools.

## Migracion pendiente

Los siguientes acuerdos todavia no estan materializados completamente:

1. Crear `session.cycle`.
2. Mover `poolCurrent`, `poolPrevious`, `poolNext` y `poolOrder` desde
   `stagePools` hacia `session.cycle`.
3. Mover la navegacion entre pools desde `poolCursorModel` hacia `cycleModel`.
4. Mantener `session.specialStages` como cola FIFO independiente que elimina
   cada stage completado.
5. Crear `preparePool`, `validatePool` y `runPool`.
6. Mover `start_cycle` desde action/recipe/effect hacia `cycleModel`.
7. Sustituir `blockedActions` por `blockedPropertyChanges`.

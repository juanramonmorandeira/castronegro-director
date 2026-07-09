# Archivo historico: modelo intermedio de session

Este documento describia una fase anterior de la migracion desde
`Session.svelte`. No es una fuente de verdad del dominio actual.

## Valor conservado

El analisis original establecio decisiones que siguen vigentes:

- la UI no debe ser la fuente de verdad mecanica;
- los roles runtime deben tener ids propios;
- el flujo debe ser derivable del estado de la session;
- las reglas deben vivir en funciones puras y testeables;
- los eventos excepcionales deben resolverse antes de continuar el flujo normal;
- el historial debe permitir reconstruir decisiones y cambios.

## Equivalencias cerradas

| Concepto actual | Ubicacion vigente |
|---|---|
| pools de ciclo | `session.cycle.pools` |
| stage runtime | `stage` |
| cursor de stage | `pool.currentStageIndex` |
| cola FIFO excepcional | `session.queues` |
| preparacion de pool | `preparePool` |
| navegacion entre pools | `cycleModel` |
| bloqueo mecanico | `blockedPropertyChanges` |
| objetivos y cierre jugable | `objectiveRules`, `playOutcome`, `conclude_play` |

## Flujo vigente

```text
session
  -> cycle
      -> pool
          -> pool.onEnter
          -> stages
          -> pool.onExit
  -> queue entre pools cuando la cola no esta vacia
```

Consultar:

- `domain_architecture.md`
- `engine_flow_map.md`
- `domain_glossary.md`
- `STATE_RULE_MODEL.md`

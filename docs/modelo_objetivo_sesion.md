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

## Sustituciones definitivas

| Modelo intermedio | Modelo actual |
|---|---|
| `phase_pools` | `session.cycle.pools` |
| step/paso | `stage` |
| `poolCurrentStepIndex` | `pool.currentStageIndex` |
| `poolSpecialEvents` | `session.specialStages` |
| `hydrateStepPool` | `preparePool` |
| avance entre pools desde el pool | navegación en `cycleModel` |
| estado `blocked` del paso | restricciones, input pendiente o error explícito |
| victoria/final automático | `objectiveRules`, `playOutcome`, `conclude_play` |

## Flujo vigente

```text
session
  -> cycle
      -> pool
          -> pool.onEnter
          -> stages
          -> pool.onExit
  -> specialStages entre pools cuando la cola no esta vacia
```

Consultar:

- `domain_architecture.md`
- `engine_flow_map.md`
- `domain_glossary.md`
- `STATE_RULE_MODEL.md`

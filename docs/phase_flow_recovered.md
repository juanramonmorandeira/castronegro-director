# Archivo historico: flujo recuperado de fases

Este documento conserva el resultado útil del análisis de la aplicación vieja.
Los nombres de fases, pasos, votos y pools especiales de aquella implementación
no forman parte del dominio vigente.

## Conclusiones recuperadas

- El orden de actuación debe construirse desde roles y groups seleccionados.
- Una decisión colectiva necesita reglas de selección configurables.
- Las acciones excepcionales deben esperar al cierre del pool actual.
- El estado final solo debe evaluarse después de resolver todos los cambios del
  pool.
- Los roles pueden añadir stages, recipes, groups, objectiveRules y reactions.
- El flujo visible de la UI no debe contener reglas mecánicas.

## Traducción al modelo actual

| Aplicación anterior | Dominio actual |
|---|---|
| fase | definición antigua que puede convertirse en stage o lifecycle operation |
| paso | `stage` |
| voto | `actionModel` con varios `selectorIds` |
| pool nocturno | `poolConcealed` |
| pool diurno | `poolExposed` |
| pool especial | cola FIFO `queue` |
| hidratación | `preparePool` |
| final de partida | `check_objectives` y `conclude_play` |

## Regla vigente

```text
poolConcealed
-> queue si existen
-> poolExposed
-> queue si existen
-> siguiente ciclo
```

Cada pool ejecuta:

```text
pool.onEnter
-> stages
-> pool.onExit
```

Consultar `engine_flow_map.md` para el flujo ejecutable actual.

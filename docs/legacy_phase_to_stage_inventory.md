# Inventario historico: fase antigua a stage

Este inventario sirve únicamente para migrar comportamiento de la aplicación
vieja. Los nombres de la columna izquierda no deben reutilizarse en el dominio.

## Mapeos ya materializados

| Comportamiento antiguo | Stage/recipe actual |
|---|---|
| inspección de role | stage con recipe `inspect_role` |
| enlace de targets | stage con recipe `link_targets` |
| protección temporal | stage con recipe `block_out_of_play` |
| decisión grupal para sacar de juego | stage con `selectionRules` y recipe `set_out_of_play` |
| reacción al cambio `inPlay=false` | stage dinámico en `queue` |
| comprobación de final | lifecycle operation `check_objectives` |

## Familias pendientes de estudiar

- preparación de opciones para roles que asumen otros roles;
- debate o ventana sin acción mecánica;
- inspecciones de grupos;
- revelación de miembros;
- cambios de alignment;
- recursos consumibles;
- repetición de selecciones;
- restricciones temporales de selección;
- objetivos añadidos dinámicamente.

Cada caso pendiente debe expresarse usando el lenguaje actual:

```text
role/group definition
-> stageDefinition
-> selectionRules si necesita input
-> recipe
-> action
-> resolver
-> effect
```

No deben crearse composites con nombres narrativos ni recuperar el antiguo
modelo de fases.

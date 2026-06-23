# Decision: extraer un nucleo limpio de juego

## Contexto

El proyecto contiene conocimiento util: flujos, assets, reglas investigadas,
roles especiales y soluciones parciales. La logica original crecio dentro de
componentes Svelte, especialmente `Session.svelte`, mezclando UI, Firebase,
i18n, tokens visuales, fases y reglas.

Seguir anadiendo reglas ahi aumenta el riesgo de romper comportamiento existente. Empezar un proyecto completamente nuevo tambien tiene riesgo: perderiamos decisiones y conocimiento ya recuperado.

## Decision

Mantendremos el proyecto actual como shell visual y referencia, pero construiremos un nucleo de dominio limpio dentro de:

```text
src/lib/domain/
```

Este nucleo sera:

- independiente de Svelte;
- independiente de Firebase;
- independiente de i18n;
- independiente de assets visuales;
- local-first;
- preparado para varios temas de juego.

El objetivo no es reescribir toda la app de golpe. El objetivo es crear piezas pequenas, testeables y comprensibles que despues puedan sustituir gradualmente la logica mezclada en `Session.svelte`.

## Principios del nucleo

- El nucleo trabaja con conceptos genericos: `alignment`, `role`, `group`,
  `cycle`, `pool`, `stage`, `recipe`, `action` y `condition`.
- Los textos visibles viven fuera del nucleo.
- Los assets visuales viven fuera del nucleo.
- El almacenamiento se conectara mediante adaptadores.
- Las reglas deben poder ejecutarse sin navegador.
- Cada funcion debe aceptar datos y devolver datos, evitando efectos secundarios siempre que sea razonable.

## Limite inicial

El primer paso solo define modelos y validaciones basicas:

- `session`
- `player`
- `role`
- `resource`
- `cycle`
- `pool`
- `stage`
- validacion de Match completo
- validacion de IDs duplicados
- validacion de asientos duplicados

No se conectara aun a la UI.

## Estrategia de migracion

1. Crear modelos puros.
2. Crear validaciones puras.
3. Crear reglas de stage puras.
4. Crear objectiveRules puras.
5. Crear adaptador desde el modelo actual (`settings.roles`, `player_roles`, `seating_order`) al modelo nuevo.
6. Hacer que `Configure/Match` genere datos compatibles.
7. Hacer que `Session` lea del nucleo sin cambiar la UI.
8. Sustituir gradualmente fases, arrays locales y tokens como fuente de verdad.

## Criterio de exito

El nucleo sera correcto cuando podamos simular una partida minima desde Node, sin abrir Svelte ni Firebase:

1. crear jugadores;
2. asignar roles;
3. construir roles runtime;
4. validar Match;
5. avanzar stages;
6. resolver acciones;
7. evaluar objectives;
8. persistir el estado con un adaptador local.

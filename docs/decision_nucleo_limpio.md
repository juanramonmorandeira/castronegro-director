# Decision: extraer un nucleo limpio de juego

## Contexto

El proyecto actual contiene mucho conocimiento util: flujos, assets, reglas investigadas, roles especiales y soluciones parciales. El problema es que la logica del juego crecio dentro de componentes Svelte, especialmente `Session.svelte`, mezclando UI, Firebase, i18n, tokens visuales, steps y reglas.

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

- El nucleo trabaja con conceptos genericos: `faction`, `role`, `phase`, `action`, `condition`.
- Los textos visibles viven fuera del nucleo.
- Los assets visuales viven fuera del nucleo.
- El almacenamiento se conectara mediante adaptadores.
- Las reglas deben poder ejecutarse sin navegador.
- Cada funcion debe aceptar datos y devolver datos, evitando efectos secundarios siempre que sea razonable.

## Limite inicial

El primer paso solo define modelos y validaciones basicas:

- `GameSession`
- `Player`
- `RoleInstance`
- `ActionToken`
- `PhasePools`
- validacion de Match completo
- validacion de IDs duplicados
- validacion de asientos duplicados

No se conectara aun a la UI.

## Estrategia de migracion

1. Crear modelos puros.
2. Crear validaciones puras.
3. Crear reglas de step puras.
4. Crear condiciones de victoria puras.
5. Crear adaptador desde el modelo actual (`settings.roles`, `player_roles`, `seating_order`) al modelo nuevo.
6. Hacer que `Configure/Match` genere datos compatibles.
7. Hacer que `Session` lea del nucleo sin cambiar la UI.
8. Sustituir gradualmente `session_phases`, arrays locales y tokens como fuente de verdad.

## Criterio de exito

El nucleo sera correcto cuando podamos simular una partida minima desde Node, sin abrir Svelte ni Firebase:

1. crear jugadores;
2. asignar roles;
3. construir `roleInstances`;
4. validar Match;
5. avanzar steps;
6. resolver acciones;
7. evaluar victoria;
8. persistir el estado con un adaptador local.


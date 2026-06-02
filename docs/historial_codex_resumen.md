# Historial recuperado de Codex

Este documento resume las transcripciones locales de Codex encontradas para `village-storyteller`. Su objetivo no es copiar todo el historial, sino reconstruir la memoria tecnica del proyecto antes de continuar con la logica estructural del juego.

## Fuentes

Las transcripciones completas estan en:

```text
/home/juanramon/.codex/sessions/
```

La base local de indices esta en:

```text
/home/juanramon/.codex/state_5.sqlite
```

Los chats propios de VS Code encontrados en `~/.config/Code/User/workspaceStorage/.../chatSessions` no contienen trabajo util del proyecto: una sesion esta vacia y otra solo contiene una pregunta de Copilot sin configurar.

## Lectura rapida

La historia del proyecto muestra tres lineas de trabajo que acabaron mezclandose:

- Flujo de producto: login, registro, seleccion de sesion, sala de espera, configuracion, match, share y dashboard.
- Capa visual: sistema de diseno, modales, tarjetas, footbar/topbar, paletas, marcadores y tokens.
- Motor de juego: seleccion de roles, emparejamiento, distribucion, fases, tokens de accion, efectos nocturnos/diurnos, condiciones de victoria y roles especiales.

El problema actual viene de que el motor de juego crecio desde la UI de `Session.svelte`: muchas reglas se anadieron directamente en la pantalla, usando tokens visuales, arrays locales y fases antiguas. Despues empezo una migracion hacia `role_instances` y `phase_pools`, pero quedo incompleta.

## Cronologia resumida

### 2025-10-27 a 2025-10-29: arquitectura inicial y limpieza

Hilos principales:

- `2025/10/27`: limpieza y organizacion de `Landing.svelte`.
- `2025/10/28`: revision de `docs/arquitectura.md`.
- `2025/10/29`: comprobacion de si se usaba Firebase Data Connect.

Resumen:

- Se empezo a ordenar el proyecto y a documentar flujo de pantallas.
- La arquitectura se mantenia como borrador vivo, mas descriptiva que vinculante.
- El backend real era Firestore, no Data Connect.

Impacto actual:

- La documentacion de arquitectura quedo por detras del codigo real.
- El modelo de sesion descrito en `docs/arquitectura.md` no recoge todavia las decisiones posteriores sobre `role_instances` y `phase_pools`.

### 2025-11-03 a 2025-11-07: identidad, dashboard y borrado

Hilos principales:

- `2025/11/03`: creacion de `Registration.svelte`.
- `2025/11/04` y `2025/11/05`: ajustes de avatar, menus, alineacion y warnings de accesibilidad.
- `2025/11/06`: renombrado conceptual de Landing/Storyteller y revision de flujo.
- `2025/11/07`: borrado de sesiones desde `HistoryCard.svelte` / `Dashboard.svelte`.

Resumen:

- Se construyo la parte de identidad de usuario y registro.
- Se revisaron problemas visuales de cabecera, avatar y menu.
- Se implemento o corrigio el borrado de sesiones propias.

Decision recuperada:

- El borrado debe estar autorizado por creador de sesion.
- El borrado requiere confirmacion fuerte, idealmente con palabra `delete`.

Impacto actual:

- Esta linea afecta mas a administracion de sesiones que al motor de juego.
- Conviene no mezclar ahora estos temas con la estabilizacion de `Session.svelte`.

### 2025-11-08 a 2025-11-12: Configure, Match, Waiting y jugadores

Hilos principales:

- `2025/11/08`: cambios de `Configuration/Configure`, titulo, contadores, role mix, Properties.
- `2025/11/10`: revision larga de `Configure`, modales, Match, Distribution, Share y botones.
- `2025/11/12`: creacion de `Waiting.svelte` y flujo de jugadores.

Resumen:

- Se definio el flujo de sala de espera: jugadores entran a sesiones `shared`, `waiting`, `in_progress` o `paused` bajo restricciones.
- Se introdujeron estados de jugadores conectados y listos.
- `Configure.svelte` debia mostrar contadores `Expected`, `Connected`, `Ready`.
- `Match` debia permitir asignar jugadores a roles y esos jugadores debian venir desde `Waiting.svelte`.
- El boton `Start` no debia activarse hasta que todos los jugadores esperados estuvieran conectados y listos.

Decisiones recuperadas:

- `Waiting.svelte` es parte del flujo real, no una pantalla secundaria.
- `Match` es el puente entre jugadores reales/offline y roles en partida.
- El estado de readiness condiciona el inicio normal, aunque existe un boton temporal de `Force start` para pruebas.

Impacto actual:

- `role_instances` debe nacer al guardar Match, no al entrar en Session de forma improvisada.
- Si Match no esta completo, el motor de juego no deberia avanzar.
- La existencia de jugadores offline/test forma parte del flujo de desarrollo y debe mantenerse, pero modelada de forma clara.

### 2025-11-14 y 2025-11-24: refactor y mantenibilidad

Hilos principales:

- `2025/11/14`: plan de refactor con principios de legibilidad, modulos pequenos, stores, servicios y calidad.
- `2025/11/24`: repeticion/ampliacion de principios de refactorizacion.

Resumen:

- Se pidio reducir archivos enormes y separar responsabilidades.
- Se recomendo mover logica de negocio a `src/lib/services/`, `src/lib/utils/` o modulos de dominio.
- Se identifico que componentes grandes mezclaban presentacion, reactividad, Firebase y reglas del juego.

Decision recuperada:

- El proyecto no deberia seguir concentrando reglas de partida dentro de paginas Svelte.
- `Session.svelte` es el candidato principal a extraccion de dominio.

Impacto actual:

- La migracion de fases deberia hacerse creando primero funciones puras y testeables fuera de Svelte.
- Una refactorizacion puramente visual no resolvera el fallo estructural del juego.

### 2025-11-25 a 2025-12-01: Firebase, diseno y modales

Hilos principales:

- `2025/11/25`: reglas de seguridad de Firestore.
- `2025/11/25`: analisis de UI/UX a partir de capturas.
- `2025/11/27`: `Distribution` debe mostrar alias del jugador si hay Match.
- `2025/11/30`: separacion de botones `Close` y `Save` en modales.

Resumen:

- Se revisaron reglas de seguridad de Firestore tras aviso de test mode.
- Se impulso un sistema de diseno con tokens, clases globales y componentes reutilizables.
- Se trabajo en coherencia de modales: cerrar no debe equivaler a guardar.
- `Distribution` empezo a depender del resultado de Match.

Decisiones recuperadas:

- Las acciones `Save` y `Close/Cancel` deben estar separadas.
- Si Match asigna un jugador a un rol, ese alias debe aparecer en la ficha correspondiente.
- La UI debe reutilizar componentes y estilos globales.

Impacto actual:

- `Distribution` y `Session` no deben recalcular asignaciones desde cero si Match ya produjo una estructura persistida.
- Al migrar `role_instances`, el alias/jugador debe estar ligado a la instancia de rol.

### 2025-12-03 a 2025-12-07: PHASE ORDER, tokens de accion y Selection

Hilo principal:

- `2025/12/03`: faltaban acciones para Judge y Big Bad Wolf en `PHASE ORDER`.

Resumen recuperado:

- Se anadio normalizacion de roles y alias para activar pasos de fase aunque los roles vinieran con variantes de nombre.
- Ejemplos de alias recuperados:
  - `big_bad_wolf` -> `bad`
  - `wolf_hound` -> `hound`
  - `white_werewolf` -> `white`
  - `cursed_wolf_father` -> `father`
  - `wandering_judge` / `the_judge` -> `judge`
  - `bear_tamer` -> `tamer`
  - `wild_child` -> `child`
  - `two_sisters` -> `sisters`
  - `three_brothers` -> `brothers`
  - `prejudiced_manipulator` -> `manipulator`

Se empezo tambien a implementar una paleta de tokens de accion en `Session.svelte`:

- Cupido: corazones para enlazar amantes.
- Defender: escudo de proteccion.
- Bruja: pocion de curacion y veneno.
- Werewolves: garras para marcar victima.
- Cursed Wolf Father: mordisco/infeccion.

Se implemento un flujo de resolucion visual:

- Los tokens especiales se colocaban sobre fichas de personaje.
- Al cerrar el dia/fase, `resolveBoardEffects` detectaba objetivos por proximidad en el tablero.
- Se persistian/actualizaban efectos como `loversLinks`, `protectedTargets`, `pendingDeaths`, `infectedTargets`, `consumedSpecialIds`.

Tambien se trabajo intensamente en `Selection.svelte`:

- Se reescribio el modal para que los contadores reaccionaran correctamente.
- Se anadieron pickers visuales para Actor y Thief.
- Actor debia tener 3 roles disponibles, sin bloquear la seleccion base salvo para evitar duplicados no duplicables.
- Thief debia tener 2 roles posibles, con override/manualidad.
- Hubo varios ajustes porque la reactividad de `actorActive` no se actualizaba correctamente.

Decisiones recuperadas:

- El orden de fases debia derivarse de roles seleccionados y normalizados.
- Los tokens de accion eran una solucion UI-operativa, pero terminaron conteniendo logica real.
- La deteccion por proximidad en tablero fue una solucion practica, no necesariamente el modelo final.
- Actor y Thief introducen roles virtuales/reservados que afectan seleccion, fases y poderes.

Impacto actual:

- Hay que separar `PHASE ORDER` visual de motor de fases.
- La normalizacion de slugs debe vivir en un modulo de dominio, no repartida por componentes.
- Los efectos de tokens deben escribir en `role_instances`, no solo en arrays visuales.
- Actor y Thief necesitan modelo explicito dentro de `role_instances` o una estructura auxiliar formal.

### 2025-12-09: warnings y limpieza CSS

Hilo principal:

- `2025/12/09`: warnings de CSS no usado en Svelte/Vite.

Resumen:

- Se trabajaron avisos de selectores no usados.
- Parte del esfuerzo fue de limpieza visual y mantenimiento.

Impacto actual:

- No es prioritario para el motor de juego.
- Conviene posponer limpieza CSS hasta estabilizar logica.

### 2025-12-16: Defender

Hilo principal:

- `2025/12/16`: regla del protector/defender.

Resumen:

- El Defender no puede proteger efectivamente al mismo rol durante dos noches consecutivas.
- Puede elegir la misma persona cada noche, pero el efecto solo aplica si no fue protegida la noche anterior.
- Existia un marcador para indicar proteccion previa; habia problemas de visibilidad/solapamiento con otros markers.

Decision recuperada:

- Hay que distinguir `target chosen` de `protection effective`.
- Debe persistirse el ultimo objetivo protegido para validar la siguiente noche.

Impacto actual:

- En `role_instances` convendria separar:
  - `defended`: protegido esta noche.
  - `lastDefendedNight` o estructura global de ultimo objetivo del Defender.
- La regla no debe depender solo de que haya un marcador visible en el token.

### 2025-12-17: markers de estado

Hilo principal:

- `2025/12/17`: nuevos markers en `public/markers`.

Resumen:

Se incorporaron imagenes para marcar estados sobre tokens de rol:

- `charmed-flute`: encantados por Piper.
- `defended-shield`: protegido por Defender.
- `lovers-heart`: amantes de Cupido.
- `seer-eye`: visible por Seer.
- `sheriff-star`: Sheriff.
- `model-lantern`: modelo del Wild Child.
- `manipulated-blue` y `manipulated-cream`: bandos del Manipulator.

Decision recuperada:

- Los markers debian apilarse alrededor de la circunferencia del token, no ocupar esquinas fijas que se solapan.
- `seer-eye` mantenia funcion, pero cambiaba ruta a `public/markers/seer-eye.png`.

Impacto actual:

- Los markers son capa visual derivada.
- El estado real debe vivir en `role_instances`; los markers se renderizan a partir de esos flags.

### 2025-12-20: modales y cierre

Hilo principal:

- `2025/12/20`: listado de modales con X circular de cierre.

Resumen:

- Se reviso consistencia de modales.
- Habia preferencia por quitar la X superior en varios modales y usar botones explicitos.

Impacto actual:

- No afecta al motor de juego.
- No debe bloquear la migracion de fases.

### 2025-12-22: White Werewolf

Hilo principal:

- `2025/12/22`: implementacion del rol `white`.

Reglas recuperadas:

- `white` necesita token de accion `white-claw` con imagen `white-claw.png`.
- `white-claw` no esta activo en la primera noche.
- En cada noche recurrente alterna una noche activa y una no activa.
- `white` se levanta y actua con los hombres lobo.
- A efectos de victoria de hombres lobo, `white` cuenta como hombre lobo.
- `white` no gana si ganan los hombres lobo.
- `white` gana solo si todos mueren menos el.
- `white-claw` solo es efectiva contra hombres lobo.
- `white` tambien puede usar `werewolves-claw`.

Decision recuperada:

- White tiene doble pertenencia operacional:
  - Cuenta como lobo para fase de manada y paridad.
  - Tiene condicion de victoria propia y excluyente.

Impacto actual:

- El motor de victoria debe soportar objetivos por rol, no solo alineaciones.
- `role_instances` necesita poder distinguir `alignment` de `winCondition`.
- El token `white-claw` debe habilitarse por numero de noche y por estado vivo de `white`.

### 2025-12-27 a 2026-01-20: persistencia de Match

Hilo principal:

- `2025/12/27`: Match persistia localmente pero no bien en Firebase.

Resumen:

- Tras refrescar con F5, los menus desplegables de Match volvian a `Unassigned`.
- Se sospechaba que los valores podian persistir para Session, pero no para el modal.
- Se trabajo para persistir asientos y roles asignados, incluyendo jugadores offline/test.

Decision recuperada:

- `Match` debe persistir dos cosas:
  - `player_roles`: asignacion jugador -> rol.
  - `seating_order`: orden/asientos y rol asociado por asiento.

Impacto actual:

- Este hilo explica por que ahora hay `seating_order` con objetos y `role_instances` construidos desde Match.
- La migracion actual debe respetar esa persistencia: no basta con derivar roles desde `settings.roles`.

### 2026-05-16: estado del proyecto

Hilo principal:

- `2026/05/16`: consulta breve del estado actual del proyecto.

Resumen:

- El hilo es corto y no contiene gran cantidad de decisiones nuevas.
- Confirma que el proyecto se reabrio despues de tiempo parado.

Impacto actual:

- Es antecedente directo de la revision actual.

### 2026-05-26: auditoria actual y modelo objetivo

Hilo principal:

- `2026/05/26`: inspeccion actual desde terminal.

Resumen:

- Se confirmo que el proyecto compila.
- Se detecto que existen cambios sin confirmar en:
  - `src/lib/i18n.js`
  - `src/pages/Configure.svelte`
  - `src/pages/Session.svelte`
- Se confirmo que la nueva gestion de fases esta incompleta.
- Se documento el modelo objetivo en `docs/modelo_objetivo_sesion.md`.

Decision recuperada:

- El modelo objetivo queda definido como:
  - `role_instances` = fuente de verdad del estado de roles.
  - `phase_pools` = fuente de verdad del avance de fases.
  - `tokens` = capa visual.
  - `session_phases` = compatibilidad temporal.

## Hilos mas relevantes para retomar el motor de juego

### 1. PHASE ORDER y alias de roles

Fuente:

```text
/home/juanramon/.codex/sessions/2025/12/03/rollout-2025-12-03T17-51-36-019ae520-642d-7f43-8a33-6e9432a942e0.jsonl
```

Relevancia:

- Explica la aparicion de alias y normalizacion de roles.
- Explica por que algunas fases no aparecian para Judge/Bad.
- Es antecedente directo de `PHASE_RULES`, `PHASE_LABELS`, `roleAliases` y normalizaciones en `Session.svelte`.

### 2. Selection, Actor y Thief

Fuente principal:

```text
/home/juanramon/.codex/sessions/2025/12/03/rollout-2025-12-03T17-51-36-019ae520-642d-7f43-8a33-6e9432a942e0.jsonl
```

Relevancia:

- Contiene gran parte del trabajo en `Selection.svelte`.
- Explica los pickers de Actor y Thief.
- Explica por que hay logica de exclusiones, reservas y roles no duplicables.

### 3. Defender

Fuente:

```text
/home/juanramon/.codex/sessions/2025/12/16/rollout-2025-12-16T20-25-09-019b289f-a3be-7903-92af-c5bdeb8c6805.jsonl
```

Relevancia:

- Define una regla temporal que requiere memoria entre noches.
- Es buen ejemplo de estado que no debe depender solo de markers visuales.

### 4. Markers

Fuente:

```text
/home/juanramon/.codex/sessions/2025/12/17/rollout-2025-12-17T02-11-47-019b29dc-fe1a-73c2-8b11-60b0310577d5.jsonl
```

Relevancia:

- Define markers visuales que deben derivarse de estado.
- Ayuda a separar UI de dominio.

### 5. White Werewolf

Fuente:

```text
/home/juanramon/.codex/sessions/2025/12/22/rollout-2025-12-22T20-41-59-019b4795-3705-75b0-98b0-dacb3e4879fb.jsonl
```

Relevancia:

- Define una condicion de victoria especial.
- Obliga a separar alineacion, fases activas y condicion de victoria.

### 6. Match persistente

Fuente:

```text
/home/juanramon/.codex/sessions/2025/12/27/rollout-2025-12-27T11-55-33-019b5f73-0a8d-7390-9228-acad2a61df97.jsonl
```

Relevancia:

- Explica la necesidad de persistir asientos y roles.
- Es base para `role_instances`.

## Estado heredado por area

### `Configure.svelte`

Responsabilidad historica:

- Configurar propiedades de sesion.
- Seleccionar roles.
- Abrir Match.
- Compartir sesion.
- Controlar inicio normal/forzado.
- Persistir parte del modelo inicial.

Estado actual probable:

- Funciona como orquestador.
- Tiene demasiada responsabilidad, pero es menos critico que `Session.svelte`.
- Ya empieza a generar `role_instances` desde Match.

Riesgo:

- Si se cambia seleccion de roles despues de Match, hay que definir si invalida `role_instances`, `seating_order` y `player_roles`.

### `Selection.svelte`

Responsabilidad historica:

- Seleccion base de roles.
- Contadores por categoria.
- Roles duplicables.
- Pickers de Actor.
- Pickers de Thief.
- Exclusiones.

Estado actual probable:

- Ha sufrido muchas iteraciones por problemas de reactividad.
- Es funcional pero delicado.

Riesgo:

- Actor/Thief no son solo UI: generan roles potenciales que deben afectar fases y tokens.

### `Match.svelte`

Responsabilidad historica:

- Relacionar jugadores con roles.
- Persistir asignaciones.
- Mantener orden/asientos tras refresco.
- Permitir jugadores offline/test.

Estado actual probable:

- Es el punto correcto para construir `role_instances`.

Riesgo:

- Si `role_instances` se derivan de Match, Session no debe reconstruirlas desde `tokens` salvo migracion.

### `Distribution.svelte`

Responsabilidad historica:

- Mostrar distribucion fisica.
- Reflejar alias del jugador asignado por Match.

Estado actual probable:

- Es una vista intermedia/visual.

Riesgo:

- No debe convertirse en fuente de verdad paralela.

### `Session.svelte`

Responsabilidad historica acumulada:

- Renderizar tablero.
- Mostrar orden de fases.
- Gestionar tokens de accion.
- Detectar objetivos por posicion.
- Resolver efectos.
- Registrar log.
- Calcular victoria.
- Gestionar fases.
- Gestionar estados de roles especiales.

Estado actual probable:

- Es el archivo mas critico.
- Contiene mezcla de UI, reglas, persistencia y migracion.
- Tiene dos motores de fase conviviendo: `session_phases` y `phase_pools`.

Riesgo:

- Cualquier cambio directo puede romper reglas no evidentes.
- Antes de implementar nuevas reglas conviene extraer funciones puras y fijar invariantes.

## Reglas de dominio recuperadas

### Cupido

- Usa dos corazones.
- Al emparejar dos personajes, el vinculo persiste.
- Si uno de los amantes muere, el otro tambien debe morir.
- Los corazones son de un solo uso.

### Defender

- Puede elegir el mismo objetivo varias noches.
- La proteccion solo es efectiva si el objetivo no fue protegido la noche anterior.
- Requiere memoria de noche previa.

### Witch

- Tiene una pocion de curacion y una de veneno.
- Cada pocion es consumible.
- La curacion puede cancelar una muerte pendiente.
- El veneno puede anadir una muerte.

### Werewolves

- Tienen token de garras.
- Deben poder marcar victima nocturna.
- Algunos roles cuentan como lobos para fases/victoria aunque tengan condicion especial.

### Cursed Wolf Father

- Puede infectar.
- La infeccion hace que el infectado cuente como lobo para ciertas fases/efectos.

### White Werewolf

- Actua con la manada.
- Tiene `white-claw` en noches alternas, no en primera noche.
- Cuenta como lobo para paridad.
- No comparte victoria con lobos.
- Solo gana si es el unico superviviente.
- Su garra especial solo debe afectar a lobos.

### Actor

- Tiene hasta 3 roles disponibles.
- Sus roles deben elegirse/reservarse sin duplicar roles no duplicables en la seleccion principal.
- Requiere saber si sus poderes estan consumidos.

### Thief

- Tiene 2 roles disponibles.
- Puede requerir eleccion forzada si ambas opciones son lobos.
- Al elegir, adopta rol para el resto de la partida.

### Sheriff

- Es un estado/honor asociado a un rol/jugador.
- Si cae, puede activar sucesion/interfase.

### Wild Child

- Necesita modelo.
- El modelo debe persistir como estado.

### Piper

- Encanta jugadores.
- Tiene condicion de victoria propia si todos los vivos salvo Piper estan encantados.

## Conclusiones para continuar

1. No conviene seguir anadiendo reglas directamente en `Session.svelte`.
2. El primer objetivo debe ser estabilizar el modelo de estado.
3. `Match` debe crear `role_instances` completos y validos.
4. `phase_pools` debe sustituir al avance por `session_phases`.
5. `tokens` y markers deben ser derivados visuales.
6. Hay que mover normalizacion de slugs y reglas de fase a modulos en `src/lib/`.
7. Las condiciones de victoria deben ser una funcion de dominio sobre `role_instances`.
8. La migracion debe mantener compatibilidad con sesiones antiguas, pero no escribir dos modelos indefinidamente.

## Proxima accion recomendada

Crear una primera capa de dominio, sin cambiar UI:

```text
src/lib/domain/roles.js
src/lib/domain/phases.js
src/lib/domain/sessionState.js
src/lib/domain/victory.js
```

Primeras funciones candidatas:

```js
normalizeRoleSlug(role)
buildRoleInstancesFromMatch(matchState)
isMatchComplete(roleInstances)
hydratePhasePool(poolKey, sessionState)
getCurrentPhase(phasePools)
advancePhaseCursor(phasePools, sessionState)
evaluateVictory(roleInstances, sessionState)
```

Despues de eso, `Session.svelte` puede empezar a delegar sin perder comportamiento visible.

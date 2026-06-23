# Scope del motor

Este documento define los limites del nucleo limpio de juego. La regla central
es sencilla:

```text
estado de sesion + accion intentada -> nueva sesion + reporte mecanico
```

El motor no conoce Svelte, Firebase, i18n, imagenes, CSS ni nombres narrativos
de una skin concreta.

El motor puede emitir mensajes mecanicos estructurados, pero nunca texto final
de skin.

## Responsabilidades

### Acciones

Una accion representa un intento mecanico.

Ejemplos actuales:

- `inspect_role`: inspecciona una propiedad de un objetivo.
- `set_in_play`: intenta cambiar `inPlay`.
- `block_property_change`: bloquea un cambio de propiedad para actores concretos.
- `link_targets`: intenta enlazar varios objetivos.
- `select`: resuelve una seleccion y devuelve un resultado.

La accion no es narrativa. Una skin puede presentar `link_targets` como
"enamorar", "sincronizar" o "atar destinos"; el motor solo ve la accion.

### Recetas

Una receta combina una accion pura con parametros y restricciones.

Ejemplo:

```text
restore_recent_out_of_play = set_in_play(true) + require_recent_set_property
```

La receta no decide en que momento se ejecuta. Esa ubicacion vive en `Stage` y
`Pool`.

### Restricciones

Una restriccion decide si una receta puede usarse en un contexto concreto.

Ejemplos actuales:

- `limited_uses` derivada desde `recipe.usage`
- `no_repeat_target`
- `require_recent_set_property`

Las restricciones no cambian estado directamente.

### Resolucion

La resolucion decide que efectos sobreviven, fallan o derivan consecuencias.

Ejemplo:

```text
set_in_play(false) sobre A
A esta linked con B
```

El resolver puede derivar:

```text
set_property A.inPlay false
set_property B.inPlay false
```

### Efectos

Un efecto representa una salida mecanica ya aceptada.

Ejemplos actuales:

- `reveal_property`
- `set_property`
- `block_property_change`
- `set_group`

El aplicador de efectos escribe datos, pero no decide si una accion era valida.

### Estado de sesion

La sesion es el estado vivo de la partida:

- `players`
- `roles`
- `groups`
- `session.cycle.pools` como mapa de pools runtime.
- `actionHistory`
- `stageHistory`
- `objectiveRules`
- `achievedObjectives`
- `playOutcome`
- `settings`
- `status`
- `sessionMessageLog`
- `errorLog`

## Flujo

```text
Stage actual
-> Recipe
-> Constraint
-> Action
-> Resolver
-> Effect
-> Session
-> Event
-> pool.onExit
-> check_objectives
-> conclude_play si la parte jugable concluye
```

El loop normal de la parte jugable es:

```text
specialStages inicial si hay stages pendientes
-> cycle.startCycle
-> poolConcealed
-> pool.onExit: review_property_blocks, check_objectives
-> specialStages si hay stages pendientes
-> poolExposed
-> pool.onExit: review_property_blocks, check_objectives
-> specialStages si hay stages pendientes
```

Los stages especiales se registran en `specialStages`. `conclude_play` no se
registra como stage especial: se ejecuta como operacion final cuando existe
un playOutcome estable. Si aun hay stages pendientes capaces de alterar ese
outcome, `conclude_play` no debe ejecutarse todavia.

`conclude_play` no cierra administrativamente la session. Solo gestiona la
conclusion de la parte jugable. El cierre de la session corresponde al creador o
al flujo de administracion de la aplicacion.

`resolveCurrentStage` ejecuta una receta, pero no cierra el stage. `completeCurrentStage`
marca el stage como `done` y avanza el cursor.

Si ese avance dispara operaciones de ciclo de vida, `completeCurrentStage`
devuelve `lifecycleResults` con las ejecuciones realizadas.

## Regla de nombres

Preferimos nombres mecanicos y anonimos:

```text
set_property inPlay false
set_group linked
block_property_change inPlay false
```

Evitamos nombres narrativos o ligados a una ambientacion. La skin decide si
`inPlay: false` se presenta como muerto, capturado, expulsado, infectado o fuera
de combate.

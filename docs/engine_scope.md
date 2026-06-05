# Scope del motor

Este documento define los limites del nucleo limpio de juego. La regla central
es sencilla:

```text
estado de sesion + accion intentada -> nueva sesion + reporte mecanico
```

El motor no conoce Svelte, Firebase, i18n, imagenes, CSS ni nombres narrativos
de una skin concreta.

## Responsabilidades

### Acciones

Una accion representa un intento mecanico.

Ejemplos actuales:

- `inspect_role`: inspecciona una propiedad de un objetivo.
- `set_in_play`: intenta cambiar `inPlay`.
- `block_action`: bloquea una accion concreta sobre un objetivo concreto.
- `link_targets`: intenta enlazar varios objetivos.
- `vote`: cuenta elecciones y devuelve un resultado.
- `close_cycle`: cierra el ciclo actual.

La accion no es narrativa. Una skin puede presentar `link_targets` como
"enamorar", "sincronizar" o "atar destinos"; el motor solo ve la accion.

### Recetas

Una receta combina una accion pura con parametros y restricciones.

Ejemplo:

```text
restore_recent_out_of_play = set_in_play(true) + require_recent_set_property
```

La receta no decide en que momento se ejecuta. Esa ubicacion vive en `Step` y
`Pool`.

### Restricciones

Una restriccion decide si una receta puede usarse en un contexto concreto.

Ejemplos actuales:

- `limited_uses`
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
- `block_action`
- `set_relation`
- `close_cycle`

El aplicador de efectos escribe datos, pero no decide si una accion era valida.

### Estado de sesion

La sesion es el estado vivo de la partida:

- `players`
- `roleInstances`
- `relations`
- `stepPools`
- `actionHistory`
- `stepHistory`
- `settings`
- `status`

## Flujo

```text
Step actual
-> Recipe
-> Constraint
-> Action
-> Resolver
-> Effect
-> Session
-> Victory
```

`resolveCurrentStep` ejecuta una receta, pero no cierra el step. `completeCurrentStep`
marca el step como `done` y avanza el cursor.

## Regla de nombres

Preferimos nombres mecanicos y anonimos:

```text
set_property inPlay false
set_relation linked true
block_action set_in_play false
```

Evitamos nombres narrativos o ligados a una ambientacion. La skin decide si
`inPlay: false` se presenta como muerto, capturado, expulsado, infectado o fuera
de combate.

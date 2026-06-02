# Scope del motor

Este documento define los limites del nucleo limpio de juego. La idea es evitar
que el motor vuelva a mezclar reglas, historia, interfaz y almacenamiento.

## Capas

### Acciones

Una accion representa un intento mecanico.

Ejemplos actuales:

- `inspect_role`: inspecciona una propiedad de un objetivo.
- `set_in_play`: intenta cambiar `inPlay`.
- `block_action`: bloquea una accion concreta sobre un objetivo concreto.
- `link_targets`: intenta enlazar varios objetivos.
- `resolve_pending_effects`: cierra el ciclo actual.

La accion no es narrativa. Una skin puede llamar a `link_targets` "enamorar",
"sincronizar", "atar destinos" o cualquier otro nombre.

### Efectos

Un efecto representa una salida mecanica ya aceptada por el resolver.

Ejemplos actuales:

- `reveal_property`: devuelve informacion visible.
- `set_property`: cambia una propiedad concreta.
- `block_action`: marca un bloqueo temporal.
- `set_relation`: crea o actualiza una relacion de sesion.
- `resolve_pending_effects`: limpia flags temporales y avanza ciclo.

El aplicador de efectos escribe datos, pero no decide si una accion era valida.

### Relaciones

Una relacion es estado compartido de partida y vive en `session.relations`.

Ejemplo actual:

- `linked`: varios `roleInstances` comparten una consecuencia mecanica.

La relacion no pertenece a un unico actor ni a un unico objetivo. Por eso no se
guarda dentro del rol que la crea ni dentro de los roles afectados.

### Consecuencias sistemicas

Una consecuencia sistemica es una regla del motor que deriva efectos nuevos a
partir de efectos finales.

Ejemplo actual:

- Si un efecto final hace `set_property inPlay=false` sobre un rol linked, el
  resolver deriva otro `set_property inPlay=false` para sus relacionados.

Esto no pertenece a `link_targets`. La accion solo crea la relacion. La
consecuencia ocurre mas tarde, si algun efecto activa esa relacion.

## Regla de oro

El motor recibe acciones y estado de sesion. Devuelve efectos, estado actualizado
y explicaciones mecanicas. No conoce textos visibles, skins, Svelte, Firebase ni
assets.

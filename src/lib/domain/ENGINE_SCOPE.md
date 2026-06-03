# Alcance del motor

Este documento define que debe hacer el motor del juego y donde estan sus
limites.

La idea principal:

```text
El motor recibe estado + acciones.
El motor devuelve nueva sesion + reporte de resolucion.
```

El motor no debe saber nada de Svelte, Firebase, i18n, imagenes, CSS ni nombres
tematicos de una skin concreta.

## Por que separar responsabilidades

Una accion no siempre produce directamente un cambio final de estado.

Ejemplo:

```text
set_in_play(false) sobre A
block_action(set_in_play false) sobre A
```

La accion sobre A se intenta, pero si A tenia esa accion bloqueada, el intento
falla. Por eso no conviene decir que la accion "produce salida de juego" sin
pasar por una resolucion.

Otro ejemplo:

```text
set_in_play(false) sobre A
A esta linked con B
```

Si la resolucion final cambia `A.inPlay` a `false`, una regla sistemica puede
generar tambien un cambio sobre `B.inPlay`.

Por eso distinguimos cuatro responsabilidades.

## 1. Action Resolver

Responsabilidad:

```text
Convertir acciones intentadas en efectos propuestos o fallos explicados.
```

Entrada:

```text
sesion actual
acciones intentadas por jugadores, alignments o sistema
```

Salida:

```text
efectos propuestos
acciones fallidas
motivos de fallo
```

Ejemplo:

```text
set_in_play(false) sobre A sin bloqueo
-> propone set_property A.inPlay false
```

Ejemplo con bloqueo:

```text
set_in_play(false) sobre A con block_action activa
-> accion intentada
-> accion fallida por bloqueo
-> no propone set_property A.inPlay false
```

## 2. Effect Resolver

Responsabilidad:

```text
Revisar efectos propuestos y generar consecuencias antes de aplicarlos.
```

Aqui viven reglas sistemicas que dependen de efectos, no de acciones concretas.

Ejemplo:

```text
efecto propuesto: set_property A.inPlay false
A esta linked con B
```

Salida:

```text
set_property A.inPlay false
set_property B.inPlay false
```

El Effect Resolver puede:

- anadir efectos derivados;
- bloquear efectos;
- modificar efectos;
- explicar por que lo hizo.

No debe modificar la sesion directamente.

## 3. Effect Applier

Responsabilidad:

```text
Aplicar efectos finales a la sesion.
```

Debe ser mecanico y predecible.

Ejemplo:

```text
set_property A.inPlay false
-> roleInstance A queda con inPlay: false
```

Ejemplo:

```text
set_relation linked A B true
-> la sesion registra una relacion linked entre A y B
```

El Effect Applier no debe decidir reglas complejas.

Mal:

```text
aplicar A.inPlay false y, dentro del applier, buscar si A esta linked con B
```

Bien:

```text
el Effect Resolver ya genero el efecto sobre B
el Effect Applier solo aplica ambos cambios
```

## 4. State Evaluator

Responsabilidad:

```text
Observar la sesion despues de aplicar efectos y detectar consecuencias globales.
```

Ejemplos:

- condicion de victoria;
- cambio de estado de sesion;
- activacion de fases;
- cierre de ciclo;
- eventos derivados del nuevo estado.

Ejemplo:

```text
despues de aplicar inPlay false, solo queda un alignment con miembros en juego
-> propone set_session_status finished
-> propone set_winner team_b
```

Esos cambios pueden tratarse tambien como efectos finales y pasar por el
Effect Applier.

## Flujo recomendado

```text
acciones intentadas
-> Action Resolver
-> efectos propuestos
-> Effect Resolver
-> efectos finales
-> Effect Applier
-> nueva sesion
-> State Evaluator
-> efectos globales opcionales
-> Effect Applier
-> sesion final + reporte
```

No necesitamos implementar todo este flujo de golpe, pero si debemos nombrar las
piezas de forma que no nos cierren puertas.

## Accion, resolucion y efecto

### Action

Algo que un jugador, alignment o sistema intenta hacer.

Ejemplos:

```text
inspect_role
set_in_play
block_action
link_targets
```

### Resolution

Proceso que decide que ocurre con las acciones.

Ejemplos:

```text
set_in_play aplicado
set_in_play fallido por bloqueo
block_action rechazado por repeticion de objetivo
inspeccion valida
```

### Effect

Cambio final de estado que se puede aplicar a la sesion.

Preferimos efectos estructurados y genericos:

```js
{
  type: 'set_property',
  targetType: 'role_instance',
  targetId: 'team_a_target-0',
  property: 'inPlay',
  value: false
}
```

Para relaciones entre varios roles:

```js
{
  type: 'set_relation',
  relationType: 'linked',
  roleInstanceIds: ['role_a-0', 'role_b-0'],
  value: true
}
```

Esto es mas anonimo que nombres como `kill_target` o `cupid_love`.

## Decision sobre nombres

Evitaremos nombres finales demasiado narrativos dentro del motor.

Mejor:

```text
set_property inPlay false
set_relation linked true
```

Peor:

```text
kill_target
fall_in_love
werewolf_bite
```

La skin puede traducir `inPlay: false` como:

- muerto;
- eliminado;
- capturado;
- infectado;
- fuera de combate.

El motor solo cambia datos.

## Estado actual del codigo

El codigo actual todavia no cumple completamente este modelo.

Ahora mismo `actionModel.js` mezcla parte de estas responsabilidades porque
estamos construyendo el nucleo paso a paso.

Ya hemos empezado a alinear el codigo con este modelo:

```text
set_in_play
-> propone/aplica set_property inPlay false

close_cycle
-> cierra el ciclo y limpia bloqueos temporales
```

Ya existe `resolverModel.js` como primer punto de separacion para el Effect
Resolver. Todavia queda trabajo: `actionModel.js` sigue mezclando partes de
Action Resolver y cierre de ciclo. Antes de anadir muchas acciones nuevas,
conviene seguir separando esas piezas en funciones o archivos mas claros.

## Regla practica

Si una funcion decide si algo debe ocurrir, pertenece a resolucion.

Si una funcion solo cambia datos porque ya se decidio que debe ocurrir,
pertenece a aplicacion.

Si una funcion revisa el estado completo para detectar victoria, fases o eventos
globales, pertenece a evaluacion de estado.

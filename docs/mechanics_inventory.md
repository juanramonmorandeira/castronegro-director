# Inventario de mecanicas

Este documento lista las mecanicas detectadas y su estado dentro del nucleo
limpio. No es un documento de ambientacion: los nombres narrativos solo sirven
como referencia humana.

## Estados

- `implementada`: existe en `src/lib/domain` y tiene tests.
- `parcial`: existe una parte, pero faltan consecuencias o reglas asociadas.
- `pendiente`: identificada, todavia sin modelo en el nucleo.
- `bloqueada`: necesita antes otra pieza del motor.

## Mecanicas base

| Mecanica abstracta | Referencia humana | Estado | Notas |
|---|---|---|---|
| `inspect_role` | Vidente | implementada | Revela una propiedad del objetivo. Ahora usamos `roleId`. |
| `set_in_play` | eliminar, expulsar, apartar | implementada | Cambia `inPlay`; no implica muerte narrativa. |
| `block_action` | bloquear, proteger, interferir | implementada | Bloquea una accion concreta con parametros concretos. |
| `block_out_of_play` | Protector | implementada | Receta que bloquea `set_in_play(inPlay=false)`. |
| `no_repeat_target` | Protector no repite objetivo | implementada | Restriccion basada en `session.actionHistory`. |
| `close_cycle` | cierre de noche/ciclo | implementada | Limpia flags temporales y avanza ciclo. |
| `link_targets` | Cupido | parcial | Crea relacion `linked` entre varios objetivos. |
| `linked` consequence | Enamorados comparten destino | parcial | Propaga `inPlay=false`; restriccion de voto linked implementada para `vote_out_of_play`. |
| `linked_victory` | Enamorados de bandos distintos | parcial | Primera version en `victoryModel.js`. |
| `alignment_victory_rule` | condicion propia de un alignment | parcial | `at_least_remaining` configurable por sesion. |
| `vote_count` | recuento de votacion | implementada | `voteModel.js` valida votos, suma unidades y resuelve ganador/empate. |
| `vote_out_of_play` | votacion para dejar un rol out_of_play | implementada | Receta compuesta: `vote` + `onWinnerAction(set_in_play false)`. |

## Mecanicas pendientes detectadas

| Mecanica abstracta candidata | Referencias humanas | Estado | Dependencias |
|---|---|---|---|
| `evaluate_victory` | victoria de alignments y condiciones especiales | parcial | `victoryModel.js` inicial. |
| `configurable_vote_effect` | eleccion de cargo, otras votaciones | parcial | El protocolo `vote` + `onWinnerAction` ya existe; faltan acciones genericas como marcar o conceder recursos. |
| `prevent_vote_out_of_play` | linked no puede votar contra linked | implementada | `vote_out_of_play` rechaza votos contra target relacionado por `linked`. |
| `set_flag` | hechizado, infectado, revelado, acusado | pendiente | Necesita normalizar flags de estado. |
| `change_alignment` | infeccion, conversion | pendiente | Necesita reglas de alignment y victoria. |
| `change_role` | ladron, actor, sirvienta | pendiente | Necesita reglas de reemplazo de rol. |
| `consume_token` | pociones, poderes de un uso | pendiente | Necesita modelo estable de recursos. |
| `inspect_group` | zorro, sabueso u otras inspecciones amplias | pendiente | Ampliacion de `inspect_role`. |
| `redirect_action` | manipulador u otras alteraciones | pendiente | Necesita resolver acciones compuestas. |
| `delayed_effect` | caballero, pirotecnico, efectos retardados | pendiente | Necesita cola real de efectos pendientes. |
| `instant_victory` | angel | pendiente | Necesita eventos de fase y causa de salida. |
| `all_targets_flagged_victory` | flautista | pendiente | Necesita `set_flag` y evaluador de victoria por estado. |
| `role_specific_last_action` | cazador | pendiente | Necesita interrupciones/special events. |

## Siguiente criterio

Antes de implementar roles nuevos, conviene normalizar la mecanica que bloquea
el avance. Ahora mismo esa pieza es victoria:

- saber si la partida continua;
- saber si gana un alignment;
- saber si una regla configurada de alignment se cumple;
- saber si una relacion `linked` cambia la condicion de victoria;
- dejar sitio para victorias individuales o por estado.

## Vocabulario de alignments

El nucleo debe ser aseptico. Una alignment no significa "equipo bueno" ni
"equipo enemigo". Una alignment es cualquier conjunto de roles que comparte una
condicion de victoria distinta.

Ejemplos abstractos:

- `alignment_a`
- `alignment_b`
- `alignment_c`

Una skin puede presentar esas alignments como aldeanos, criaturas, tripulantes,
infiltrados, corporaciones o cualquier otro tema. El motor solo compara
condiciones mecanicas.

Regla inicial configurada:

```js
{
  id: 'alignment_b_reaches_threshold',
  alignmentId: 'alignment_b',
  condition: 'at_least_remaining'
}
```

`at_least_remaining` significa:

```text
miembros inPlay de alignment_b >= todos los demas roleInstances inPlay juntos
```

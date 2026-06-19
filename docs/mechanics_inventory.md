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
| `start_cycle` | inicio de ciclo normal | implementada | Limpia flags temporales y prepara el siguiente ciclo. |
| `link_targets` | Cupido | parcial | Crea un grupo `linked` entre varios objetivos. |
| `linked` consequence | Enamorados comparten destino | parcial | Propaga `inPlay=false`; restriccion de seleccion linked implementada en stages con seleccion. |
| `linked_objective` | Enamorados de bandos distintos | parcial | Implementado en `objectiveModel.js`. |
| `group_objective_rule` | condicion propia de un group | parcial | `holder_reaches_in_play_parity` y `only_holder_group_remains_in_play` configurables por sesion. |
| `selection_count` | recuento de seleccion | implementada | `selectionModel.js` valida selecciones, suma unidades y resuelve chosen/empate. |
| `group_selection` | seleccion de grupo | implementada | El stage vota para elegir `chosenId`; despues aplica la receta configurada. |

## Mecanicas pendientes detectadas

| Mecanica abstracta candidata | Referencias humanas | Estado | Dependencias |
|---|---|---|---|
| `check_objectives` | objetivos de alignments y condiciones especiales | parcial | Ya se evalua al cierre de pool; faltan achievedObjectives persistidos y conflictos. |
| `configurable_selection_effect` | eleccion de cargo, otras selecciones | parcial | El protocolo `stage.selectionRules` + receta aplicada al `chosenId` ya existe; faltan acciones genericas como marcar o conceder recursos. |
| `block_group_member_selection_candidate` | linked no puede elegir contra linked | implementada | El stage con seleccion rechaza selecciones contra target del mismo grupo `linked`. |
| `set_flag` | hechizado, infectado, revelado, acusado | pendiente | Necesita normalizar flags de estado. |
| `change_alignment` | infeccion, conversion | pendiente | Necesita reglas de alignment y objective. |
| `change_role` | ladron, actor, sirvienta | pendiente | Necesita reglas de reemplazo de rol. |
| `consume_resource` | pociones, poderes de un uso | pendiente | Necesita modelo estable de resources. |
| `inspect_group` | zorro, sabueso u otras inspecciones amplias | pendiente | Ampliacion de `inspect_role`. |
| `redirect_action` | manipulador u otras alteraciones | pendiente | Necesita resolver acciones compuestas. |
| `delayed_effect` | caballero, pirotecnico, efectos retardados | pendiente | Necesita cola real de efectos pendientes. |
| `instant_objective` | angel | pendiente | Necesita eventos de stage y causa de salida. |
| `all_targets_flagged_objective` | flautista | pendiente | Necesita `set_flag` y evaluador de objetivos por estado. |
| `role_specific_last_action` | cazador | pendiente | Necesita interrupciones/special events. |

## Siguiente criterio

Antes de implementar roles nuevos, conviene normalizar la mecanica que bloquea
el avance. Ahora mismo esa pieza es objective:

- saber si la parte jugable continua;
- saber si un alignment cumple un objetivo;
- saber si una regla configurada de alignment se cumple;
- saber si un grupo `linked` cambia una objectiveRule;
- dejar sitio para objetivos individuales o por estado.

## Vocabulario de alignments

El nucleo debe ser aseptico. Una alignment no significa "equipo bueno" ni
"equipo enemigo". Una alignment es cualquier conjunto de roles que puede ser
referenciado por objectiveRules.

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
  key: 'alignment_b_reaches_threshold',
  holder: {
    type: 'group',
    id: 'group_alignment_b'
  },
  condition: {
    type: 'holder_reaches_in_play_parity'
  }
}
```

`holder_reaches_in_play_parity` significa:

```text
miembros inPlay del group holder >= roles inPlay que no pertenecen a ese group
```

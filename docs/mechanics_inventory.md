# Inventario de mecanicas

Este documento lista las mecanicas detectadas y su estado dentro del nucleo
limpio. No es un documento de ambientacion y evita nombres narrativos.

## Estados

- `implementada`: existe en `src/lib/domain` y tiene tests.
- `parcial`: existe una parte, pero faltan consecuencias o reglas asociadas.
- `pendiente`: identificada, todavia sin modelo en el nucleo.
- `bloqueada`: necesita antes otra pieza del motor.

## Mecanicas base

| Mecanica abstracta | Estado | Notas |
|---|---|---|
| `inspect_role` | implementada | Revela una propiedad del objetivo. Ahora usamos `roleId`. |
| `set_in_play` | implementada | Cambia `inPlay`; no implica muerte narrativa. |
| `block_property_change` | implementada | Bloquea un cambio `(property, value)` para actores concretos. |
| `block_out_of_play` | implementada | Receta que bloquea `inPlay=false` frente a los roles materializados de `alignment_b`. |
| `no_repeat_target` | implementada | Restriccion basada en `session.actionHistory`. |
| `startCycle` | implementada | Incrementa `cycle.id`; no limpia estado de roles. |
| `link_targets` | implementada | Crea un group con miembros, `groupRules`, `selectionRules` y `objectiveRules`. |
| `propagate_property_change` | implementada | Propaga cambios por regla declarativa; no depende del `group.type`. |
| `linked_objective` | implementada | El group aporta objectiveRule y `objectiveModel` la recopila si aplica. |
| `group_objective_rule` | implementada | `holder_reaches_in_play_parity`, `holder_reaches_stable_in_play_parity`, `only_holder_group_remains_in_play` y `all_holder_members_are_only_roles_in_play`. |
| `selection_count` | implementada | `selectionModel.js` valida selecciones, suma unidades y resuelve chosen/empate. |
| `exposed_set_out_of_play` | implementada | El stage vota para elegir `chosenId`; despues aplica la receta `set_out_of_play`. |
| `assume_role` | implementada | `replace_role_identity` asigna un role de `assumableRoles` al asiento/player del actor. |
| `peek_attempt` | implementada | `role_peek` puede registrar un intento privado durante la stage observada. |
| `peek_accusation` | implementada | Una `stageRule` validada por director contra el verdadero `role_peek` aplica `override_selected_candidate`. |

## Mecanicas pendientes detectadas

| Mecanica abstracta candidata | Referencias humanas | Estado | Dependencias |
|---|---|---|---|
| `check_objectives` | objetivos de alignments y condiciones especiales | parcial | Ya se evalua al cierre de pool; faltan achievedObjectives persistidos y conflictos. |
| `configurable_selection_effect` | eleccion de cargo, otras selecciones | parcial | El protocolo `stage.selectionRules` + receta aplicada al `chosenId` ya existe; faltan acciones genericas como marcar o conceder usos limitados. |
| `block_group_member_selection_candidate` | linked no puede elegir contra linked | implementada | El group aporta una selectionRule que filtra candidates para sus propios miembros en votes con `set_out_of_play`. |
| `set_flag` | hechizado, infectado, revelado, acusado | pendiente | Necesita normalizar flags de estado. |
| `change_alignment` | infeccion, conversion | pendiente | Necesita reglas de alignment y objective. |
| `change_role` | ladron, actor, sirvienta | parcial | `role_assumes_role` ya cubre reemplazo desde `assumableRoles`; faltan otros modos de cambio forzado o temporal. |
| `limited_recipe_usage` | acciones de uso limitado | implementada | `recipe.usage` se traduce internamente a la constraint `limited_uses`. |
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
  key: 'alignment_b_reaches_stable_in_play_parity',
  holder: {
    type: 'group',
    id: 'group_alignment_b'
  },
  condition: {
    type: 'holder_reaches_stable_in_play_parity'
  }
}
```

`holder_reaches_in_play_parity` queda como condicion generica de catalogo:

```text
miembros inPlay del group holder >= roles inPlay que no pertenecen a ese group
```

`basic_ruleset` usa `holder_reaches_stable_in_play_parity`: la misma base de
paridad, pero sin dar por cumplida una igualdad que conserve counterplay
mecanico inmediato contra el holder.

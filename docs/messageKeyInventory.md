# Message Key Inventory

Este inventario define significado y audiencia, no texto narrativo final. Los
textos ES/EN pertenecen a una skin.

| messageKey | Tipo | Audiencia por defecto | Estado | Significado mecanico |
| --- | --- | --- | --- | --- |
| `action_usage_limit_reached` | gameplay | role | implemented | La accion limitada ya agoto sus usos declarados por `recipe.usage`. |
| `invalid_candidate` | gameplay | role | planned | La opcion elegida no pertenece a los candidatos validos. |
| `property_change_blocked` | gameplay | role | planned | Un cambio de propiedad fue impedido. |
| `selection_tied` | gameplay | group | planned | La seleccion colectiva termino empatada. |
| `inspection_revealed` | gameplay | role | planned | Se entrega privadamente el resultado de una inspeccion. |
| `collective_selection_requested` | gameplay | group | planned | Un grupo debe realizar una seleccion. |
| `role_state_revealed` | gameplay | public | planned | Un estado mecanico pasa a ser publico. |
| `reactive_selection_requested` | gameplay | role | planned | Una reaction habilita una seleccion privada. |
| `limited_action_applied` | gameplay | role | planned | Se aplico una accion con limite de uso. |
| `group_created` | gameplay | group | planned | Se materializo un grupo dinamico. |
| `role_assumption_requested` | gameplay | role | planned | Un role debe elegir una definicion que asumir. |
| `role_assumption_completed` | gameplay | role | planned | La asuncion de role quedo aplicada. |
| `peek_available` | gameplay | role | planned | `role_peek` puede intentar espiar la stage observada. |
| `peek_accusation_received` | gameplay | director | planned | El group observado registro una acusacion de peek que requiere resolucion. |
| `selection_authority_assigned` | gameplay | public | planned | Se asigno una autoridad que modifica selecciones. |
| `selection_authority_transferred` | gameplay | public | planned | La autoridad paso a otro role. |
| `objective_achieved` | gameplay | public | planned | Se cumplio un objective. |
| `play_concluded` | gameplay | public | planned | La parte jugable ha concluido. |
| `missing_group` | diagnostic | system | implemented | Falta un group requerido por el dominio. |
| `invalid_stage` | diagnostic | system | implemented | Una stage no cumple su contrato. |
| `unknown_action` | diagnostic | system | implemented | La action solicitada no existe o no esta soportada. |
| `domain_operation_failed` | diagnostic | system | implemented | Fallo generico del dominio. |
| `application_operation_failed` | application | system | implemented | Fallo administrativo fuera de la session. |

## Audiencias

| Audiencia | Uso |
| --- | --- |
| `role` | Solo el role y su player asignado. |
| `player` | Uno o varios players concretos. |
| `group` | Miembros de un group runtime. |
| `director` | Responsable humano o agente delegado de la direccion. |
| `public` | Todos los participantes de la session. |
| `system` | Diagnostico tecnico, log y herramientas administrativas. |

La primera skin debera proporcionar ES y EN para todas las keys gameplay que el
ruleSet marque como obligatorias. Los mensajes diagnostic y application no
adoptan fantasia de juego, aunque su capa de presentacion tambien debe
traducirlos.

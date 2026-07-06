# Documentacion del dominio

Este indice separa la documentacion normativa del material historico. Solo los
documentos normativos describen el modelo vigente.

## Fuentes de verdad

- `domain_glossary.md`: diccionario de conceptos aceptados.
- `domain_architecture.md`: jerarquia y responsabilidades.
- `engine_scope.md`: limites del motor.
- `engine_flow_map.md`: flujo runtime.
- `STATE_RULE_MODEL.md`: estado, reglas, selecciones y propiedades.
- `roleDefinition.md`: definicion y materializacion de roles.
- `ruleSetDefinition.md`: estructura de ruleSet.
- `configurationDefinition.md`: configuraciones y match.
- `skinDefinition.md`: capa visual y narrativa.
- `surface_contract.md`: proyeccion de visibilidad/interaccion desde la session.
- `history_contract.md`: contrato de histories de session.
- `action_recipe_contract.md`: separacion entre actionDefinition, actionCatalog
  y recipeCatalog.
- `objectiveDefinition.md`: objetivos y conclusion jugable.
- `messageSystem.md`: mensajes, logs, skin y presentacion.
- `messageKeyInventory.md`: keys, audiencias y estado de implementacion.
- `recipes_inventory.md`: recipes actualmente definidas.
- `mechanics_inventory.md`: inventario de mecanicas.
- `TODO_DOMAIN.md`: trabajo pendiente vigente.

## Resumen del modelo actual

```text
Catalog
  -> selectedRuleSet + configuration
  -> ruleSet
  -> match
  -> buildSession
  -> session
      -> cycle
          -> pools
              -> stages
                  -> recipes
                      -> actions
                          -> resolver
                              -> effects
      -> specialStages
      -> sessionMessageLog
      -> errorLog
```

Conceptos actuales:

- `stage`.
- `selectionModel`.
- `group`.
- `objectiveRules`.
- `specialStages` es una cola FIFO, no un pool.
- `pool.onEnter/onExit`.
- `blockedPropertyChanges`.
- las propagaciones viven en `groupRules`.

## Archivo historico

Estos documentos conservan contexto de la aplicacion anterior. No deben usarse
para implementar el nuevo dominio:

- `historial_codex_resumen.md`
- `modelo_objetivo_sesion.md`
- `phase_flow_recovered.md`
- `legacy_phase_to_stage_inventory.md`

Los nombres antiguos que aparezcan dentro de ellos describen exclusivamente el
software anterior o decisiones descartadas.

# Domain Health Report

Fecha de revision: 2026-07-09.

Alcance: solo `src/lib/domain`, incluyendo READMEs internos. No incluye UI,
mensajes antiguos ni implementacion previa.

## Resumen

| Estado | Lectura |
| --- | --- |
| Bueno | Fichero con responsabilidad clara, tamano controlado y contrato estable. |
| Vigilar | Fichero correcto, pero con tamano alto, demasiadas colaboraciones o reglas densas. |
| Revisar | Fichero funcional, pero candidato a limpieza o ajuste arquitectonico cercano. |

## Ficheros

| Fichero | Responsabilidad real | Salud | Observaciones |
| --- | --- | --- | --- |
| `actionCatalog.js` | Catalogo de actions mecanicas reutilizables. | Bueno | Encaja con `actionDefinition`/`actionModel`. |
| `actionDefinition.js` | IDs, constructor y validacion formal de action. | Bueno | Ya no contiene `defineAction`; el contrato es mas limpio. |
| `actionModel.js` | Runtime de actions: contexto, validacion, resolucion y effects. | Vigilar | Sigue siendo grande por `select`; funcional y alineado, pero sera el primer candidato si crece. |
| `actorModel.js` | Materializacion de actores desde actor contract/input/stage. | Bueno | Separacion correcta frente a `roleModel`. |
| `constraintModel.js` | Evaluacion de constraints de recipe. | Vigilar | Denso por ventanas de uso; correcto mientras siga acotado a constraints. |
| `cycleModel.js` | Ciclo, transiciones surface, entrada/salida de pools y queues. | Vigilar | Grande, pero su responsabilidad es central y coherente. |
| `domainTypes.js` | Vocabulario transversal de tipos mecanicos. | Bueno | Pequeno y estable. |
| `doubleSelectorModel.js` | Regla opcional `selection_counts_double` y sucesion. | Vigilar | Regla especifica aislada correctamente; mantener fuera del engine generico. |
| `effectDefinition.js` | Tipos, constructor y validacion formal de effect. | Bueno | Encaja con el lifecycle de effect. |
| `effectModel.js` | Resolucion y aplicacion de effects. | Bueno | Responsabilidad clara; aplicar effects sigue aqui. |
| `eventCatalog.js` | Reglas declarativas de eventos y respuestas. | Bueno | Reduce hardcodes en `eventModel`. |
| `eventDefinition.js` | Tipos formales de event, trigger y response. | Bueno | Pequeno y estable. |
| `eventModel.js` | Runtime de events: lee efectos, evalua triggers, encola/remueve queueStages. | Vigilar | Aun denso por payloads dinamicos; aceptable tras catalogar respuestas. |
| `groupCatalog.js` | Catalogo de groups mecanicos. | Bueno | Sin reglas de ruleset no materializadas. |
| `groupDefinition.js` | Definicion y constructor de group. | Bueno | Responsabilidad clara. |
| `groupModel.js` | Runtime de membership, linked y selectionRules de groups. | Vigilar | Linked esta bien localizado, pero conviene observar si aparecen mas groupRules. |
| `historyModel.js` | Historial comun de session. | Bueno | Evita crear historiales por objeto. |
| `index.js` | Barrel de exports del dominio. | Vigilar | Largo por crecimiento natural del dominio; aceptable como frontera publica. |
| `objectiveModel.js` | Evaluacion de objectiveRules y estabilidad de outcome. | Vigilar | Denso por paridad estable y casos especiales; correcto para basic_ruleset. |
| `playerDefinition.js` | Constructor de player. | Bueno | Pequeno y estable. |
| `poolCatalog.js` | Catalogo de pools mecanicos. | Bueno | Nuevo; contiene `poolConcealed` y `poolExposed`. |
| `poolCursorModel.js` | Cursor de stages dentro de pool. | Bueno | Responsabilidad separada y util. |
| `poolDefinition.js` | Definicion, construccion y organizacion de pools y queueStages iniciales. | Vigilar | Correcto, aunque construye tambien queueStages desde roles/groups. |
| `poolModel.js` | Lifecycle runtime de pool. | Bueno | Alineado con start/evaluate/resolve/validate/finish. |
| `queueCatalog.js` | Catalogo de queues entre pools. | Bueno | Nuevo; cuatro queueKeys aceptadas. |
| `queueDefinition.js` | Errores y operaciones de history para queue. | Bueno | Pequeno y especifico. |
| `queueModel.js` | FIFO runtime de queues por `queueKey`. | Vigilar | Correcto y probado; revisar si crecen operaciones de scheduling. |
| `recipeCatalog.js` | Catalogo de recipes mecanicas. | Bueno | Contrato publico por `usage`; effects no se sobreescriben. |
| `recipeDefinition.js` | Definicion, normalizacion y validacion de recipe. | Bueno | Responsabilidad clara. |
| `recipeModel.js` | Runtime de recipe y escritura de recipeHistory. | Bueno | Alineado con lifecycle aceptado. |
| `roleCatalog.js` | Catalogo de roles mecanicos. | Bueno | Basic roles estan materializados por ruleset, no por mera existencia en catalogo. |
| `roleDefinition.js` | Definicion, constructor y build de roles. | Bueno | Usa `queueStageDefinitions`, sin vocabulario antiguo. |
| `roleModel.js` | Estado runtime de roles y blockedPropertyChanges. | Bueno | Bloqueos modelados por property/value/expiracion. |
| `ruleSetCatalog.js` | Catalogo de ruleSets y basic_ruleset. | Vigilar | Debe seguir evitando mecanicas no incluidas en basic_ruleset. |
| `ruleSetDefinition.js` | Seleccion, validacion y build de ruleSet. | Bueno | Frontera correcta entre catalogo y session. |
| `sessionDefinition.js` | Construccion de session viva desde input/ruleSet. | Vigilar | Centraliza materializacion; ahora usa `queues` sin entrada `queue` legacy. |
| `sessionModel.js` | Estados y vocabulario runtime de session. | Bueno | `currentStageSource` ya usa `queue`. |
| `sessionValidation.js` | Validacion de integridad de session. | Bueno | Incluye validacion de queues vacias al concluir. |
| `stageCatalog.js` | Catalogo unico de stages, incluidos los usados en queues. | Bueno | No existe catalogo separado de queueStages. |
| `stageDefinition.js` | Definicion, constructor, ids y reglas de stage. | Vigilar | Amplio por selection/peek/stageRules, pero estable. |
| `stageModel.js` | Runtime de stage y conexion con recipe/action/cycle. | Vigilar | Mucho mejor tras lifecycle; peek sigue aumentando densidad. |
| `stageTypes.js` | Tipos de completion de stage. | Bueno | Pequeno y estable. |
| `surfaceModel.js` | Proyeccion estructurada para pantalla/surface. | Bueno | Contrato claro entre dominio y UI. |
| `targetModel.js` | Validacion y materializacion de targets/candidates. | Bueno | Buen paralelo de `actorModel`. |
| `README.md` | Resumen operativo del dominio. | Bueno | Actualizado a pools/queues. |
| `README_RULES.md` | Lenguaje de reglas mecanicas. | Bueno | Actualizado a `queueStageDefinitions` y `session.cycle.queues`. |

## Riesgos Vivos

| Riesgo | Estado | Recomendacion |
| --- | --- | --- |
| `actionModel.js` y `stageModel.js` siguen grandes. | Controlado. | No dividir todavia; esperar a que aparezca una segunda familia real de complejidad. |
| `eventModel.js` concentra payloads dinamicos. | Controlado. | Mantener declarativo en `eventCatalog`; mover solo si aparece duplicacion real. |
| `objectiveModel.js` contiene reglas densas de basic_ruleset. | Aceptable. | Vigilar que no filtre reglas de otros ruleSets al motor generico. |
| Documentacion historica puede estar semanticamente vieja aunque ya no use nombres antiguos. | Parcial. | Revisar docs largas por contenido, no por vocabulario, cuando cerremos dominio. |

## Verificacion

- `npm run lint`: correcto.
- `npm test`: 185/185 domain tests passed.
- `npm run build`: correcto.
- `git diff --check`: correcto.
- PDF de estructura: `docs/domain_architecture.pdf`.

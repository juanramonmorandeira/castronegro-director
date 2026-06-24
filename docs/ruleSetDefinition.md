# ruleSetDefinition

`ruleSet` define el universo mecanico permitido para una familia de partidas.

No es una partida concreta. No elige jugadores. No elige cuantos roles entran
en una session. No contiene textos ni imagenes de skin.

## Relacion con Catalog

Los catalogos son la biblioteca mecanica del software:

- `roleCatalog`
- `groupCatalog`
- `stageCatalog`
- `recipeCatalog`
- futuros catalogos de objectives, resources, groups o buildings.

Un `ruleSet` se construye con elementos existentes en esos catalogos.

Decision actual:

```text
Un ruleSet referencia elementos de catalogo.
No modifica elementos catalogados.
No desactiva partes internas de un elemento catalogado.
No combina piezas libres para crear roles nuevos.
```

Si se necesita una variante de una receta, role, group o stage, esa variante debe
existir como nuevo elemento de catalogo.

Esto conserva una regla simple:

```text
catalog item = pieza mecanica estable y reutilizable.
ruleSet = seleccion organizada de piezas catalogadas.
```

## Copiar vs referenciar

Referenciar significa guardar ids de catalogo:

```js
{
  roleIds: ['role_inspects', 'role_reactive']
}
```

Copiar significa guardar dentro del ruleSet una copia completa del objeto
catalogado.

Decision provisional:

```text
Durante definicion, ruleSet referencia catalogIds.
Durante creacion de session, buildSession materializa esos ids en objetos vivos.
```

Ventajas de referenciar:

- menos duplicacion;
- el catalogo sigue siendo la fuente de verdad;
- es mas facil validar si un ruleSet usa piezas existentes.

Riesgo de referenciar:

- si un catalog item cambia, todos los ruleSets que lo usan cambian.

Este riesgo se resolvera mas adelante con versionado o con snapshots de session
si aparece un caso real que lo exija.

## Operaciones unitarias

Necesitamos inventariar las particulas mecanicas indivisibles.

Nombre provisional:

```text
primaryElements
```

Tambien se han considerado:

- atomicRules
- primitives
- basicRules
- unitOperations

Lectura:

```text
primaryElement = operacion mecanica minima e indivisible.
```

Ejemplos actuales:

- cambiar una propiedad: `set_property`
- crear un grupo: `set_group`
- revelar una propiedad: `reveal_property`
- bloquear un cambio de propiedad: `block_property_change`
- resolver una seleccion: `select`

Pendiente:

```text
Antes de anadir muchos mas roles, revisar si el modelo actual separa bien:
primaryElement -> action/effect -> recipe -> role/group -> stage -> ruleSet.
```

## Primera implementacion ejecutable

El dominio ya contiene:

- `ruleSetDefinition.js`: normaliza un ruleSet y construye la seleccion
  mecanica para una session;
- `ruleSetCatalog.js`: contiene el ruleSet anonimo `basic_ruleset`;
- `buildSession({ ruleSet, ... })`: consume directamente el ruleSet ya
  construido.

Estados de soporte:

```text
ready = puede seleccionarse y ejecutarse con las primitivas actuales.
partial = existe una parte mecanica, pero faltan reglas necesarias.
pending = faltan primitivas de dominio.
```

Cobertura inicial:

| Opcion mecanica | Estado | Observacion |
| --- | --- | --- |
| `role_collective_set_out_of_play` | ready | Actua mediante `group_alignment_b`. |
| `role_inspects` | ready | Inspeccion privada. |
| `role_reactive` | ready | Crea una specialStage al cambiar a `inPlay=false`. |
| `role_in_play_control` | ready | Dos acciones limitadas durante la session. |
| `role_plain` | ready | Sin stage personal. |
| `role_links_targets` | ready | Crea un group, aporta selectionRules y objectiveRules propias. |
| `role_assumes_role` | pending | Falta `roleChoiceSet` y asuncion de role. |
| `role_observes_selection` | pending | Falta observacion y sustitucion del candidate elegido. |

Reglas disponibles iniciales:

| Regla mecanica | Tipo | Estado | Observacion |
| --- | --- | --- | --- |
| `selection_counts_double` | `selectionRule` | ready | Regla opcional: setea `role.doubleSelector=true`, hace que ese selector cuente doble en vote expuesta de `set_out_of_play`, puede desempatar si eligio un candidate empatado, y encola sucesion por specialStage si el holder queda `inPlay=false`. |

Los nombres anteriores son exclusivamente mecanicos. Ninguno es texto visible
de una skin.

## Campos minimos propuestos

```js
{
  id: 'basic_ruleset',
  version: 1,
  catalogRefs: {
    roles: [],
    groups: [],
    stages: [],
    objectiveRules: []
  },
  poolOrder: [],
  optionalRules: [],
  configurationRules: [],
  skinRequirements: {},
  metadata: {}
}
```

## Alignments

Un `alignment` es una propiedad mecanica de un role. El ruleSet no necesita un
catalogo o listado de alignments separado: los conoce indirectamente por los
roles que expone y por las reglas que consultan `alignmentId`.

No es una regla por si misma. Solo afecta a la partida cuando otras reglas lo
usan:

- `objectiveRules`;
- `groupRules`;
- reglas de seleccion de configuration;
- reglas de activacion de stages;
- reglas de target.

El motor no limita cuantos valores de alignment pueden aparecer en un ruleSet
si sus roles y reglas son coherentes.

Convencion inicial para los roles del catalogo:

```text
alignment_a
alignment_b
alignment_undefined
alignment_independent
```

Lectura:

- `alignment_a`: primer alignment principal.
- `alignment_b`: segundo alignment principal.
- `alignment_undefined`: role sin alignment final resuelto al inicio de la
  session.
- `alignment_independent`: role con objective propio o separado del
  eje principal.

El catalogo puede ampliarse en el futuro. Por ahora no existe
`alignmentCatalog`: `alignmentId` forma parte de `roleDefinition`.

## Campos que si pertenecen a ruleSet

- roles disponibles;
- alignments usados indirectamente por sus roles y reglas;
- groups disponibles;
- stages disponibles o aportados por roles/groups;
- objectiveRules disponibles;
- poolOrder;
- reglas opcionales disponibles;
- restricciones sobre configuraciones validas;
- requisitos minimos que una skin debe cubrir.

## Limites de seleccion

No aceptamos todavia un modelo plano `min / max / recommended` por role.

El programa viejo ya contiene al menos dos clases distintas de limites:

- distribucion recomendada por alignment segun numero de jugadores;
- restricciones propias de roles concretos, por ejemplo roles que fuerzan 2, 3
  o N instancias de si mismos.

Ejemplos encontrados en la version vieja:

- `reference-data/rulesets/balance_table.json` define cantidades recomendadas
  por categorias/alignment segun numero de jugadores;
- `src/components/config/Selection.svelte` contiene excepciones para roles
  multi-instancia como `brothers` y `sisters`;
- `reference-data/rulesets/resources_table.json` agrupa roles disponibles por
  ruleset viejo y categoria.

Estado actual:

```text
El modelo plano min/max/recommended queda descartado. Ya hay decisiones
aceptadas, pero falta convertirlas en estructura de codigo.
```

Decision aceptada:

```text
Las recomendaciones por alignment se definen en ruleSet mediante
distributionRules.
```

`distributionRules` relaciona `playersExpected` con una distribucion de
alignments.

Ejemplo conceptual:

```js
{
  playersExpected: 8,
  distribution: {
    alignment_a: 5,
    alignment_undefined: 1,
    alignment_b: 1,
    alignment_independent: 1
  }
}
```

El ruleSet debe declarar si esta distribucion admite override:

```js
{
  distributionRules: {
    allowOverride: true,
    formula: {
      type: 'basic_ruleset_distribution',
      minPlayers: 5,
      maxPlayers: 15
    }
  }
}
```

Reglas aceptadas:

- si `allowOverride = false`, la configuration debe respetar la tabla;
- si `allowOverride = true`, el creador puede ignorarla desde
  `ruleSetConfiguration`;
- override debe estar desactivado por defecto aunque el ruleSet lo permita;
- aunque haya override, la configuration no puede superar `playersExpected`;
- la suma total de roles seleccionados no puede superar `playersExpected`;
- una configuration no puede iniciar una session con un `playOutcome`
  concluyente ya cumplido;
- un role que fuerce N instancias debe quedar deshabilitado si no quedan asientos
  suficientes para materializar esas N instancias.

Las restricciones impuestas por un role concreto no viven aqui. Viven en
`roleDefinition` mediante `instanceRule`.

## ruleSet listo para session

`selectedRuleSet` es el ruleSet elegido desde catalogo.

`ruleSet`, cuando se usa como input de `buildSession`, es el ruleSet ya acotado
para una session concreta.

Se construye cruzando:

```text
selectedRuleSet + skin + ruleSetConfiguration -> buildRuleSet -> ruleSet
```

`buildSession` debe recibir este `ruleSet` ya construido, no el ruleSet bruto del
catalogo.

Estructura de trabajo:

```js
{
  id,
  version,
  roles: {
    baseRoles: [],
    optionalRoles: []
  },
  rules: {
    baseRules: [],
    optionalRules: [],
    objectiveRules: [],
    stageRules: [],
    selectionRules: [],
    candidateRules: [],
    configurationRules: []
  },
  groups: [
    {
      groupKey,
      roleIds: [],
      groupRules: []
    }
  ],
  pools: [
    {
      poolKey,
      stages: [],
      poolRules: []
    }
  ],
  skinRequirements: {}
}
```

Las categorias `stageRules`, `candidateRules` y `configurationRules` siguen
abiertas a revision. Solo deben mantenerse si tienen comportamiento propio.

Preguntas pendientes:

- como se cruzan limites por alignment, limites por role y objectiveRules?
- que reglas viejas de actor/thief son restricciones generales reutilizables y
  cuales pertenecen solo a esos roles concretos?
- que validaciones de objective inicial pueden implementarse sin conocer todavia
  todas las objectiveRules futuras?

## Campos que no pertenecen a ruleSet

- numero final de jugadores de una partida concreta;
- que roles concretos entran en una session;
- reparto jugador/asiento/rol;
- textos visibles;
- imagenes;
- idioma;
- modo de narracion elegido para una session concreta.

## Validacion pendiente

No esta resuelto como demostrar que un `ruleSet` es valido.

Preguntas abiertas:

- todos los catalogIds existen?
- hay stages duplicados conflictivos?
- hay colisiones de `order` dentro de pools configurables?
- los groups referenciados existen?
- las objectiveRules referenciadas existen?
- hay al menos una objectiveRule concluyente?
- hay suficientes elementos para construir una session?
- sus `skinRequirements` son completos?
- las reglas opcionales tienen nombres y parametros validos?

La validacion debe devolver errores clasificados por severidad.

```text
warning = la partida podria funcionar, pero falta calidad o cobertura.
error = no se puede crear una session valida con esa definicion.
fatal = definicion corrupta o imposible de interpretar.
```

## Versionado mecanico

Decision aceptada:

```text
Los cambios que alteran logica mecanica obligan a crear una nueva version.
```

Los cambios cosmeticos no pertenecen a ruleSet. Si en el futuro existe un editor
de ruleSets, cualquier cambio que pueda afectar a roles, groups, recipes, stages,
selectionRules, objectiveRules o poolOrder debe tratarse como cambio mecanico.

## Nota de futuro: editor de catalog

Futura mejora del software:

```text
Permitir que creadores avanzados creen nuevos elementos de catalogo.
```

Ese editor podria permitir construir roles, stages, recipes, groups, resources u
objectiveRules a partir de elementos mecanicos disponibles.

No forma parte del objetivo actual. Primero necesitamos un flujo minimo
funcional con catalogos cerrados.

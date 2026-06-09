# ruleSetDefinition

`ruleSet` define el universo mecanico permitido para una familia de partidas.

No es una partida concreta. No elige jugadores. No elige cuantos roles entran
en una session. No contiene textos ni imagenes de skin.

## Relacion con Catalog

Los catalogos son la biblioteca mecanica del software:

- `roleCatalog`
- `groupCatalog`
- `stepCatalog`
- `recipeCatalog`
- futuros catalogos de objectives, resources, relations o buildings.

Un `ruleSet` se construye con elementos existentes en esos catalogos.

Decision actual:

```text
Un ruleSet referencia elementos de catalogo.
No modifica elementos catalogados.
No desactiva partes internas de un elemento catalogado.
No combina piezas libres para crear roles nuevos.
```

Si se necesita una variante de una receta, role, group o step, esa variante debe
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
- crear una relacion: `set_relation`
- revelar una propiedad: `reveal_property`
- bloquear una accion: `block_action`
- contar votos: `vote`

Pendiente:

```text
Antes de anadir muchos mas roles, revisar si el modelo actual separa bien:
primaryElement -> action/effect -> recipe -> role/group -> step -> ruleSet.
```

## Campos minimos propuestos

```js
{
  id: 'classic_hidden_roles',
  version: 1,
  alignments: [],
  catalogRefs: {
    roles: [],
    groups: [],
    steps: [],
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

Un `alignment` es una etiqueta mecanica declarada por el ruleSet.

No es una regla por si misma. Solo afecta a la partida cuando otras reglas lo
usan:

- `objectiveRules`;
- `groupRules`;
- reglas de seleccion de configuration;
- reglas de activacion de steps;
- reglas de target.

Decision aceptada:

```text
El motor no limita cuantos alignments puede tener un ruleSet.
```

Un ruleSet puede declarar dos, cuatro, seis o cualquier otro numero de
alignments si sus reglas mecanicas son coherentes.

Convencion recomendada para ruleSets basicos de identidad oculta:

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

Esta convencion no es obligatoria. Es una guia para que los ruleSets basicos
sean legibles sin contaminar el motor con narrativa.

## Campos que si pertenecen a ruleSet

- roles disponibles;
- alignments declarados;
- groups disponibles;
- steps disponibles o aportados por roles/groups;
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
alignmentDistributionRules.
```

`alignmentDistributionRules` relaciona `playersExpected` con una distribucion de
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

El ruleSet debe declarar si esta tabla admite override:

```js
{
  alignmentDistributionRules: {
    allowOverride: true,
    byPlayersExpected: {}
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
- hay steps duplicados conflictivos?
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
de ruleSets, cualquier cambio que pueda afectar a roles, groups, recipes, steps,
voteRules, objectiveRules o poolOrder debe tratarse como cambio mecanico.

## Nota de futuro: editor de catalog

Futura mejora del software:

```text
Permitir que creadores avanzados creen nuevos elementos de catalogo.
```

Ese editor podria permitir construir roles, steps, recipes, groups, resources u
objectiveRules a partir de elementos mecanicos disponibles.

No forma parte del objetivo actual. Primero necesitamos un flujo minimo
funcional con catalogos cerrados.

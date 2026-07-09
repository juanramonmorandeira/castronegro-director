# roleDefinition

`roleDefinition` define un role mecanico disponible para ruleSets.

No contiene textos visibles ni imagenes. Esa informacion pertenece a skin. No
elige jugadores ni asientos. Esa informacion pertenece a match/session.

## Responsabilidades

Un roleDefinition puede definir:

- `key`;
- `alignmentId` inicial;
- `instanceRule`;
- `stageDefinitions` que aporta a pools;
- `queueStageDefinitions` iniciales que aporta a `queue`;
- `stageRules` contextuales que aporta a otras stages;
- `reactions`;
- `assumableRoles` si necesita asumir roles no asignados;
- metadatos mecanicos.

## instanceRule

`instanceRule` define cuantas instancias de un role pueden o deben existir en una
session.

Regla base aceptada:

```text
Un role permite 0 o 1 instancia salvo que declare otra cosa.
```

Ejemplo base:

```js
{
  instanceRule: {
    allowedCounts: [0, 1]
  }
}
```

Un role puede permitir varias instancias:

```js
{
  instanceRule: {
    allowedCounts: [0, 1, 2, 3, 4]
  }
}
```

Un role tambien puede forzar paquetes exactos:

```js
{
  instanceRule: {
    allowedCounts: [0, 3, 6, 9],
    materializesPerSelection: 3
  }
}
```

Lectura:

```text
Una misma roleDefinition puede materializar varios `roleId`.
```

Ejemplo:

```text
roleDefinition role_group_of_three
count seleccionado: 3
roleIds runtime:
  role_group_of_three-0
  role_group_of_three-1
  role_group_of_three-2
```

## assumableRoles

`assumableRoles` es una lista simple de roleIds no asignados que una recipe como
`assume_role` puede consumir como candidates validos.

Casos humanos equivalentes:

- un role que puede asumir temporalmente otro role;
- un role que se intercambia por otro role;
- un role que elige entre varias capacidades disponibles;
- un role cuya lista de opciones se prepara durante configuration.

Nombre mecanico preferido para la familia:

```text
role_assumes_role
```

Motivo:

```text
assumes es mas amplio que exchanges.
```

`exchange` implica intercambio entre dos sujetos. `assumes` permite copiar,
adoptar, ocupar temporalmente o transformarse en otro role.

## Relacion con ruleSetConfiguration

`ruleSetConfiguration` selecciona roles y cantidades.

`roleDefinition.instanceRule` decide si esa cantidad es valida.

Ejemplos de validacion:

- no seleccionar mas instancias que `playersExpected`;
- no seleccionar una cantidad que no este en `allowedCounts`;
- no habilitar un role de paquete exacto si no quedan asientos suficientes;
- no crear una session con una combinacion que active un objective concluyente inicial.

## Relacion con session

Al crear session:

- cada role seleccionado se materializa en uno o varios `roleId`;
- cada reaction queda disponible para `eventModel`;
- cada `stageDefinition` aplicable puede aportar stages a los pools;
- cada `stageRule` queda disponible para `stageModel`;
- cada `queueStageDefinition` aplicable se añade a la cola inicial.

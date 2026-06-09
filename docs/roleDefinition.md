# roleDefinition

`roleDefinition` define un role mecanico disponible para ruleSets.

No contiene textos visibles ni imagenes. Esa informacion pertenece a skin. No
elige jugadores ni asientos. Esa informacion pertenece a match/session.

## Responsabilidades

Un roleDefinition puede definir:

- `roleKey`;
- `alignmentId` inicial;
- `instanceRule`;
- `stepDefinitions` que puede aportar;
- `resources` que materializa en session;
- `reactions`;
- `roleChoiceSet` si necesita elegir/asumir otros roles;
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
Una misma roleDefinition puede materializar varios sessionRoleIds.
```

Ejemplo:

```text
roleDefinition role_group_of_three
count seleccionado: 3
sessionRoleIds:
  role_group_of_three-0
  role_group_of_three-1
  role_group_of_three-2
```

## resources

`resources` sustituye a los viejos tokens consumibles cuando el token no necesita
existir como elemento visual de tablero.

Ejemplo conceptual:

```js
{
  resources: [
    { key: 'restore_inPlay', count: 1 },
    { key: 'set_out_of_play', count: 1 }
  ]
}
```

Un resource es estado mecanico de session. Sirve para saber si un role conserva
usos disponibles, cargas, permisos o contadores.

Regla aceptada:

```text
Si una recipe se usa, consume el resource aunque su efecto falle o sea bloqueado.
Si una restriccion impide usar la recipe antes de ejecutarla, el resource no se
consume.
```

Por eso el consumo pertenece a recipeModel/constraintModel, no al step como
concepto general.

## roleChoiceSet

`roleChoiceSet` queda como concepto pendiente para roles que necesitan una lista
de roles elegibles.

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

- cada role seleccionado se materializa en uno o varios `sessionRoleIds`;
- cada resource se copia como estado vivo de ese sessionRole;
- cada reaction queda disponible para `eventModel`;
- cada stepDefinition aplicable puede aportar steps a los pools.

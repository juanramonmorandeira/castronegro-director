# configurationDefinition

`configuration` define que parte de un `ruleSet` se usara para crear una
session concreta.

No crea reglas. No inventa roles. No modifica recetas catalogadas. Solo
selecciona y parametriza opciones permitidas por el `ruleSet`.

## Capas de configuracion

La palabra configuration es amplia. Para evitar mezclar conceptos, usamos esta
separacion:

```text
gameConfiguration
  = basicConfiguration
  + runModeConfiguration
  + ruleSetConfiguration

sessionConfiguration
  = gameConfiguration
  + matchConfiguration
```

### basicConfiguration

Define datos basicos para preparar una partida:

- `ruleSetId`;
- `skinId`;
- `playersExpected`;
- idioma de juego si aplica a la partida;
- opciones generales visibles para el creador.

### runModeConfiguration

Define como se dirige la partida.

Modos previstos:

- `human`: partida dirigida completamente por una persona.
- `human_ai`: partida dirigida por humano con asistencia del sistema/IA.
- `ai`: partida dirigida completamente por IA.

En la aplicacion vieja hay referencias relacionadas en:

- `src/pages/Configure.svelte`
- `src/components/config/Properties.svelte`
- `assistTasks`
- `storyteller`

No migrar todavia sin revisar ese flujo.

### ruleSetConfiguration

Define la seleccion concreta dentro del ruleSet:

- roles seleccionados;
- cantidades de roles seleccionados;
- alignments que entran en juego;
- reglas opcionales activadas;
- variante de voteRules elegida si el ruleSet ofrece varias;
- grupos opcionales activados;
- objectiveRules opcionales activadas.

Regla:

```text
ruleSetConfiguration solo puede elegir entre opciones definidas por ruleSet.
```

No puede alterar parametros libres como `voteRules.tie` si esa variante no esta
predefinida en el ruleSet.

## GameConfiguration

`gameConfiguration` es una plantilla guardable y reutilizable sin jugadores
concretos.

Sirve para preparar partidas parecidas sin rehacer siempre las mismas
elecciones mecanicas y de modo de juego.

Ejemplo conceptual:

```js
{
  id: 'classic_8_human',
  basicConfiguration: {
    ruleSetId: 'classic_hidden_roles',
    skinId: 'castronegro_like',
    playersExpected: 8
  },
  runModeConfiguration: {
    mode: 'human',
    assistTasks: []
  },
  ruleSetConfiguration: {
    selectedRoles: [
      { roleKey: 'role_inspects', count: 1 },
      { roleKey: 'role_blocks_out_of_play', count: 1 },
      { roleKey: 'role_reactive', count: 1 }
    ],
    selectedAlignments: ['alignment_a', 'alignment_b'],
    enabledOptionalRules: []
  }
}
```

## MatchConfiguration

`matchConfiguration` no es lo mismo que `gameConfiguration`.

`matchConfiguration` une jugadores, asientos y roles seleccionados.

Depende del numero de jugadores definido por `basicConfiguration`, pero no vive
dentro de `gameConfiguration`, porque una misma plantilla puede reutilizarse con
jugadores concretos diferentes.

Ejemplo conceptual:

```js
{
  seats: [
    { seat: 0, playerId: 'player_1', roleKey: 'role_inspects' },
    { seat: 1, playerId: 'player_2', roleKey: 'role_reactive' }
  ]
}
```

En la aplicacion vieja hay un flujo relevante en:

- `src/components/config/Match.svelte`
- `src/pages/Configure.svelte`

Pendiente revisar antes de implementar el nuevo constructor.

## SessionConfiguration

`sessionConfiguration` es el input completo que permite construir una session.

```text
sessionConfiguration = gameConfiguration + matchConfiguration
```

Puede guardarse si queremos reproducir exactamente una preparacion concreta,
pero conceptualmente ya incluye jugadores/asientos/roles asignados. Por eso es
mas concreta que `gameConfiguration`.

## Grupo con session

La session deberia guardar:

- `sessionConfigurationId` si viene de una configuracion guardada;
- referencias a `gameConfiguration`, `ruleSet` y `skin` cuando sea suficiente;
- los datos materializados derivados de `matchConfiguration`;
- `players`;
- `roles`;
- `groups`;
- `groups`;
- `stepPools`;
- historiales.

Decision pendiente:

```text
Definir que se guarda por referencia y que se materializa dentro de session.
```

Lectura de trabajo:

```text
materializar = convertir definiciones/referencias en estado vivo de session.
```

Ejemplo: un role seleccionado en configuration se materializa como un role real
de session con id propio, asiento, jugador asignado, estado `inPlay`, grupos
y posibles steps.

## Validacion pendiente

Una configuration es valida si:

- apunta a un ruleSet existente;
- apunta a una skin compatible;
- solo selecciona roles disponibles en el ruleSet;
- respeta cantidades permitidas;
- respeta reglas opcionales permitidas;
- respeta numero de jugadores;
- puede crear un match completo;
- no deja elementos obligatorios sin seleccionar.

Las reglas concretas de seleccion deben vivir en el `ruleSet`.

## Nombres aceptados

Convencion aceptada:

- `basicConfiguration`
- `runModeConfiguration`
- `ruleSetConfiguration`
- `gameConfiguration`
- `matchConfiguration`
- `sessionConfiguration`

## Metatrama futura

En el futuro puede existir una capa de metatrama asociada a configuraciones o
sessions concretas.

Esa capa no forma parte del motor actual. Serviria para enriquecer narraciones,
descripciones o eventos de una partida preparada, por encima de la skin base.

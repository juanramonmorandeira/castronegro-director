# Nucleo de dominio

Esta carpeta contiene el intento de construir el "motor" del juego fuera de Svelte, Firebase, i18n y assets visuales.

La aplicacion actual todavia no usa este nucleo. Por ahora es una zona aislada para construir y entender la logica con calma.

## Por que existe

Ahora mismo `Session.svelte` mezcla demasiadas cosas:

- botones y layout;
- tablero visual;
- textos traducidos;
- Firebase;
- roles;
- fases;
- efectos de acciones;
- condiciones de victoria.

Eso hace dificil saber si una regla falla porque la regla esta mal, porque la UI no actualizo, porque Firebase no guardo, o porque una traduccion no coincide.

Esta carpeta separa el problema:

> Primero hacemos que el juego funcione como datos puros. Luego lo conectamos a la pantalla.

## Archivos

### `sessionModel.js`

Define las piezas basicas de una partida:

- jugador;
- rol asignado a un jugador;
- relaciones entre roles;
- token de accion;
- lista de fases;
- historial de acciones de la sesion;
- sesion completa.

No decide reglas complejas. Solo crea estructuras consistentes.

`actionHistory` guarda hechos que ocurrieron en una partida concreta. Por
ejemplo, `block_out_of_play` registra ahi que objetivo quedo bloqueado y en que ciclo. Esto
permite aplicar reglas como "no bloquear al mismo objetivo dos ciclos seguidos"
sin guardar esa memoria dentro del actor ni dentro del objetivo.

`relations` guarda vinculos activos entre roleInstances. Por ejemplo, una
relacion `linked` entre `role_a-0` y `role_b-0`. Esto es mejor que duplicar un
flag en ambos roles, porque la relacion existe una sola vez y el motor puede
consultar con quien esta enlazada cada instancia.

Ejemplo mental:

```js
createPlayer({ id: 'p1', displayName: 'Player 1' })
```

crea un jugador normalizado.

```js
createRoleInstance({ roleId: 'seer', playerId: 'p1', seat: 0 })
```

crea una carta/rol real dentro de una partida.

```js
createRelation({
  type: 'linked',
  roleInstanceIds: ['role_a-0', 'role_b-0']
})
```

crea una relacion mecanica entre dos roles de la sesion.

### `sessionValidation.js`

Comprueba si los datos basicos tienen sentido.

Ejemplos:

- no puede haber dos jugadores con el mismo `id`;
- no puede haber dos roles en el mismo asiento;
- una partida no puede empezar si hay roles sin jugador;
- una partida no puede empezar si hay roles sin asiento.

Esto es lo que antes estaba repartido por la UI.

### `phaseModel.js`

Gestiona el cursor de fases.

No sabe que es "bruja", "vidente" o "lobo". Solo sabe:

- hay pools de fases;
- cada fase puede estar `enabled`, `disabled` o `done`;
- la fase actual se puede marcar como terminada;
- despues se busca la siguiente fase activa.

El orden de ejecucion no depende de nombres tematicos. Depende de los datos:

```text
poolOrder decide el orden de pools
el array de steps decide el orden dentro de cada pool
```

Por ahora no usamos pesos/prioridades. Es mas claro que cada skin declare el
orden exacto que quiere ejecutar. Si mas adelante aparece una necesidad real de
reordenar steps dinamicamente, se puede anadir una capa explicita encima.

### `phaseDefinition.js`

Documento tecnico para una pieza futura.

La decision acordada es:

```text
phaseModel ejecuta arrays ya ordenados
phaseDefinition preparara esos arrays desde una definicion de skin
```

Esto permitiria que una skin declare `order` para steps de pools configurables,
por ejemplo `poolExposed` o `poolConcealed`, sin cambiar el runtime.

Regla importante:

```text
dos steps del mismo pool configurable no podran compartir el mismo order
```

Si eso ocurre, sera error de definicion de skin. No habra empate ni desempate
automatico.

`poolSpecial` queda fuera de esta configuracion porque sus reglas deben
ser fijas del motor.

Pools mecanicos actuales:

```text
poolDeployment -> configuracion jugable inicial
poolConcealed  -> acciones ocultas o de informacion privada
poolExposed    -> acciones publicas o visibles para el grupo
poolSpecial    -> interrupciones y resoluciones excepcionales
```

Razonamiento de orden inicial:

```text
link_targets vive en poolDeployment porque las relaciones de destino compartido
deben existir antes de que acciones recurrentes puedan cambiar inPlay, alignment
u otros estados relevantes.

inspect_role y block_out_of_play viven antes de group_set_out_of_play dentro de
poolConcealed. Si block_out_of_play ocurre despues, no bloquea nada util.

role_in_play_control vive despues de group_set_out_of_play porque
restore_recent_out_of_play necesita mirar el historial del ciclo actual.
```

Ejemplo:

```text
prepare_characters -> seer_inspects -> wolves_attack -> reveal_victims -> vote
```

Si `seer_inspects` esta desactivada, el cursor la salta.

### `stepModel.js`

Conecta `phaseModel.js` con `recipeModel.js`.

`phaseModel.js` solo sabe cual es el step actual. `recipeModel.js` sabe resolver
recetas. `stepModel.js` hace de coordinador entre ambos:

```text
leer step actual -> elegir actionKey -> resolver action -> avanzar cursor
```

No debe decidir reglas complejas. Si una regla trata sobre objetivos, efectos,
bloqueos, relaciones o victoria, pertenece a otro modelo.

Ejemplo de step anonimo:

```js
{
  key: 'step_01',
  status: 'enabled',
  actorScope: {
    type: 'role',
    roleInstanceId: 'role_inspector-0'
  },
  actions: [
    {
      key: 'inspect_role',
      id: 'inspect_role',
      target: {
        type: 'role_instance',
        count: 1,
        filters: ['in_play', 'not_self']
      },
      effect: {
        type: 'reveal_property',
        property: 'roleId'
      }
    }
  ]
}
```

El nombre visible de skin puede ser "Vidente", "Oraculo", "Scanner" o cualquier
otro. El step no toma ese nombre. La accion disponible dentro del step describe
la mecanica.

Convencion actual:

```text
slot 1 -> step_01
slot 2 -> step_02
slot 3 -> step_03
slot 4 -> step_04
slot 5 -> step_05
```

Esta convencion evita que el motor dependa de nombres de roles o de acciones
concretas.

Quien actua se define con `actorScope`, no con el nombre del step. Dos steps
distintos pueden ejecutar la misma accion generica. Por ejemplo, `step_04` y
`step_03` podrian ejecutar `set_in_play(false)`. El origen se distingue despues
por `stepKey` en `actionHistory`, no duplicando nombres de acciones.

Si un step ofrece varias acciones, el input debe indicar `actionKey`. Esto evita
que el motor elija implicitamente por posicion.

Accion y receta no son lo mismo:

```text
accion generica = set_in_play
receta = actionKey + accion generica + parametros + restricciones
```

Ejemplo:

```text
restore_recent_out_of_play
  actionKey: restore_recent_out_of_play
  actionId: set_in_play
  effect: inPlay=true
  restriccion: require_recent_set_property(inPlay=false, actionKey=set_out_of_play)
```

La accion sigue siendo simple. La receta expresa las condiciones de uso.

### `recipeModel.js`

Gestiona recetas.

Una receta no es una accion nueva. Es la forma concreta en que un step ofrece
una accion generica:

```text
actionKey
actionId
parametros/efecto
constraints // propiedad tecnica que contiene restricciones
```

Responsabilidad:

```text
validar restricciones de receta
convertir receta en accion pura
llamar a actionModel
```

Ejemplo:

```text
restore_recent_out_of_play
  -> valida require_recent_set_property
  -> entrega a actionModel set_in_play(true)
```

`actionModel.js` no debe recibir la receta completa. Debe recibir la accion pura
cuando `recipeModel.js` ya ha validado sus restricciones.

### `stepDefinition.js`

Construye definiciones de step.

Responsabilidad:

```text
stepKey
actorScope
actions
order declarativo
metadata
```

Tipos iniciales de `actorScope`:

```text
role
role_group
all_roles
linked_roles
```

La unidad minima sigue siendo `roleInstance`. Un grupo solo acota que
roleInstances pueden actuar.

### `phaseDefinition.js`

Organiza steps dentro de pools.

Responsabilidad:

```text
validar order
ordenar steps en pools configurables
crear phasePools para phaseModel
```

Si dos steps de un mismo pool configurable comparten `order`, es error de
definicion de skin. No hay desempate automatico.

### `historyModel.js`

Centraliza la memoria mecanica de la sesion.

`session.actionHistory` sigue viviendo dentro de la sesion, pero este modelo
define como crear y consultar sus entradas. Esto evita que `actionModel.js`
tenga que saber todos los detalles de historial.

Una entrada puede guardar:

```text
cycleId
poolKey
stepKey
actionKey
actionId
actorRoleInstanceId
targetRoleInstanceIds
proposedEffects
finalEffects
blockedActions
result
```

Esto permitira a mecanicas futuras preguntar cosas como:

```text
quien recibio inPlay=false durante este ciclo?
desde que step ocurrio?
el efecto se aplico o quedo bloqueado?
```

`session.stepCompletionHistory` registra cierres explicitos de steps. No vive
en `actionHistory` porque cerrar un step no es una accion de juego. Guarda quien
pidio pasar al siguiente step:

```text
player
director
system
```

### `stepModel.js`

Coordina el step actual.

Separacion clave:

```text
resolveCurrentStep  -> ejecuta una receta del step actual
completeCurrentStep -> cierra el step actual y avanza el cursor
```

Resolver una receta no avanza automaticamente. El step permanece abierto hasta
que `player`, `director` o `system` pidan cierre explicito. Esto permite
steps con varias recetas opcionales y respeta el ritmo humano de la partida.

En una definicion de step:

```js
completion: {
  mode: 'manual', // o 'automatic'
  allowedRequesters: ['player', 'director', 'system']
}
```

En una receta dentro del step:

```js
optional: true
```

`optional: true` significa que el step puede cerrarse aunque esa receta no se
haya ejecutado. Si se intenta ejecutar, sus filtros y restricciones siguen
aplicando igual.

### `recipeCatalog.js`

Define recetas reutilizables del nucleo. No ejecuta nada y no lee la sesion.

Ejemplos:

```text
restore_recent_out_of_play
set_out_of_play
block_out_of_play
vote_out_of_play
```

`recipeModel.js` recibe esas recetas, valida restricciones y las convierte en
acciones puras para `actionModel.js`.

### `stepCatalog.js`

Define steps reutilizables del nucleo. No sustituye a `stepDefinition.js`.

La separacion es esta:

```text
stepDefinition.js -> construye cualquier step generico
stepCatalog.js    -> guarda steps ya preparados con recetas conocidas
phaseDefinition.js -> coloca esos steps dentro de pools ordenados
```

Un step no queda definido por cuantas recetas contiene. Queda definido por su
`key`, `actorScope`, `actions`, `completion`, `order` y `metadata`.

`source` puede guardarse como `metadata.source`. No participa en la ejecucion
del step. Sirve para trazabilidad: saber si el step fue construido desde una
roleInstance, un grupo, el sistema, una skin o un evento especial.

Ejemplo conceptual:

```js
createStep({
  key: 'step_03',
  actorScope: { type: 'role' },
  actions: [
    getCatalogRecipe(RECIPE_KEYS.RESTORE_RECENT_OUT_OF_PLAY),
    getCatalogRecipe(RECIPE_KEYS.ONE_SHOT_SET_OUT_OF_PLAY)
  ]
});
```

El catalogo solo evita repetir esa composicion cuando una skin quiera reutilizar
un patron mecanico ya conocido.

Steps catalogados ahora mismo:

```text
role_inspects          -> role ejecuta inspect_role
role_links_targets    -> role ejecuta link_targets
role_blocks_out_of_play -> role ejecuta block_out_of_play
role_in_play_control  -> role puede ejecutar restore_recent_out_of_play y/o set_out_of_play
group_set_out_of_play -> role_group ejecuta set_out_of_play
group_vote_out_of_play -> all_roles ejecutan vote_out_of_play
system_closes_cycle   -> system ejecuta close_cycle
```

### `roleDefinition.js` y `roleCatalog.js`

`roleDefinition.js` construye definiciones mecanicas de rol. Una definicion
de rol no es una instancia en partida y no ejecuta acciones.

Responsabilidades:

```text
roleDefinition -> declara que puede aportar un tipo de rol
roleInstance   -> representa ese rol concreto dentro de una sesion
stepDefinition -> convierte esa capacidad en una unidad ejecutable
phaseDefinition -> ordena esos steps dentro de pools
```

`roleCatalog.js` guarda roles mecanicos predefinidos. No usa nombres de
skin. Por ejemplo:

```text
role_inspects
role_links_targets
role_blocks_out_of_play
role_in_play_control
```

Cada definicion incluye `stepDefinitions: []`. Cada entrada es un step creado
con `createStep` o con un helper de `stepCatalog`. Puede llevar `poolKey`,
`order`, `actions`, `actorScope`, `completion` y `metadata.orderReason`.

`groupDefinition.js` y `groupCatalog.js` hacen lo mismo para grupos
mecanicos. Por ejemplo:

```text
alignment_set_out_of_play -> grupo seleccionado por alignmentId que ejecuta group_set_out_of_play
```

Un grupo no es un alignment narrativa. Es una seleccion mecanica de
roleInstances: por alignment, relacion, flag, todos los roles o una regla
custom.

### `actionModel.js`

Ejecuta acciones genericas del motor.

Por ahora solo implementa:

```text
inspect_role
set_in_play
block_action
link_targets
vote
close_cycle
```

`inspect_role` significa:

```text
un rol actor elige un objetivo valido y ve una propiedad de ese objetivo
```

No sabe si el actor es Vidente, Oraculo o Scanner. Eso pertenece a la skin.

`set_in_play` significa:

```text
un actor elige un objetivo valido e intenta cambiar su estado inPlay
```

Si el objetivo tenia bloqueada esa accion concreta, la accion se produce como
intento, pero falla automaticamente y no propone `set_property`.

No sabe si eso significa morir, ser expulsado, arrestado, eyectado o volver al
juego principal.

`block_action` significa:

```text
un actor bloquea temporalmente una accion concreta contra un objetivo
```

`block_out_of_play` es una receta construida sobre `block_action`. Marca que un efecto de
`set_in_play` con `value:false` debe fallar sobre un objetivo. No restaura `inPlay=true` si el objetivo
ya fue afectado. Eso seria otra accion distinta.

`link_targets` significa:

```text
un actor crea una relacion mecanica entre varios objetivos
```

No sabe si eso representa amor, sincronizacion, juramento, maldicion o cualquier
otro tema narrativo. La accion solo crea `set_relation`; las consecuencias de
esa relacion viven en el resolver o en el evaluador de victoria.

`vote` significa:

```text
una ronda colectiva de votos elige un roleInstance ganador
```

No aplica efectos por si misma. Si hay ganador, una receta compuesta puede
ejecutar otra accion sobre ese ganador.

`vote_out_of_play` es una receta compuesta:

```text
vote + onWinnerAction(set_in_play false)
```

Si la votacion empata y la politica de empate la declara nula, no se ejecuta
ninguna accion posterior. Si hay ganador, `recipeModel.js` ejecuta
`onWinnerAction` usando ese ganador como target. Ese efecto pasa por
`resolverModel.js`, por lo que relaciones como `linked` pueden derivar
consecuencias.

La accion derivada no inventa un actor. Hereda el `actorScope` del step o de la
receta. Por ejemplo, una votacion de todos los roles queda registrada como
origen `actorScope: { type: 'all_roles' }`, con `actorRoleInstanceId: null`.

Reglas actuales de esta votacion:

- `requiredVotes: all_in_play`: todos los roleInstances `inPlay` deben votar.
- `tiePolicy: null_on_tie`: si hay empate, no se aplica efecto.
- `exclude_related_target` con `linked`: un actor no puede votar a un target
  relacionado con el por `linked`.

Importante: `vote_out_of_play` no representa todas las votaciones posibles. Una
votacion futura para conceder una marca, cargo o accion extra debera reutilizar
`vote` con otro `onWinnerAction`.

`close_cycle` significa:

```text
el sistema cierra el ciclo de efectos y limpia marcas temporales
```

Esta accion no la elige un jugador. Es una accion automatica del motor.

### `constraintModel.js`

Evalua restricciones de una receta.

Un filtro responde si un target es valido por si mismo:

```text
in_play
not_self
not_same_alignment
```

Una restriccion responde si esta receta concreta puede usarse en este contexto.

Por ahora implementa:

```text
no_repeat_target
require_recent_set_property
limited_uses
```

`no_repeat_target` usa `session.actionHistory` para impedir repetir el
mismo target en la ventana configurada. No vive como filtro porque puede
aplicarse a unas recetas si y a otras no.

Ventanas principales:

```text
current_cycle         -> solo el ciclo actual
next_cycle            -> el ciclo inmediatamente posterior al uso registrado
current_or_next_cycle -> ciclo actual o ciclo inmediatamente posterior
session               -> toda la partida
```

`require_recent_set_property` usa `historyModel` para exigir que el target haya
recibido antes un cambio concreto en la ventana configurada. Por ejemplo,
`restore_recent_out_of_play` exige que el target haya recibido `inPlay=false`
por la receta `set_out_of_play` durante el ciclo actual.

`limited_uses` cuenta usos por actor + receta. En datos significa
`actorRoleInstanceId + actionKey`. No tiene campo `scope` por ahora: si mas
adelante aparece una regla real que necesite contar por actor global o por
receta global, se anadira entonces.

### `modifierModel.js`

Mantiene compatibilidad con el nombre antiguo y reexporta temporalmente la
logica de `constraintModel.js`.

Queda reservado para modificadores reales futuros: reglas que alteren
parametros, efectos o resultados, no solo restricciones de uso.

### `effectModel.js`

Contiene utilidades del lado de efectos.

Su trabajo no es decidir si una accion puede hacerse. Eso pertenece a
`actionModel.js`.

Su trabajo es aplicar o preparar efectos ya definidos:

- construir claves de bloqueo como `set_in_play:property:inPlay:value:false`;
- comprobar si un rol tiene bloqueada una accion;
- aplicar `set_property` sobre una instancia de rol;
- limpiar bloqueos temporales al cerrar ciclo;
- avanzar `currentCycleId`.

Ejemplo mental:

```js
applySetPropertyEffect({
  session,
  effect: {
    type: 'set_property',
    targetType: 'role_instance',
    targetId: 'team_a_target-0',
    property: 'inPlay',
    value: false
  }
})
```

Eso solo cambia el dato. No decide si el objetivo debia recibir ese efecto.

### `resolverModel.js`

Decide que efectos propuestos sobreviven, quedan bloqueados o generan
consecuencias.

Su trabajo no es validar acciones ni aplicar cambios finales. Es la pieza entre
`actionModel.js` y `effectModel.js`.

Flujo mental:

```text
actionModel propone set_property inPlay=false
resolverModel deriva consecuencias como linked
effectModel aplica los efectos finales que sobrevivieron
```

Ahora mismo implementa una regla sistemica:

- deriva `set_property inPlay=false` hacia los roleInstances conectados por una
  relacion activa `linked`.

Ejemplo:

```text
efecto propuesto: set_property role_a-0.inPlay=false
relacion activa: linked [role_a-0, role_b-0]
efectos finales:
- set_property role_a-0.inPlay=false
- set_property role_b-0.inPlay=false
```

El resolver no aplica esos cambios. Solo decide la lista final de efectos.

### `victoryModel.js`

Evalua si la partida ha terminado.

Primera version implementada:

```text
ongoing
alignment_rule
single_alignment
linked_exclusive_survivors
draw
```

`alignment_rule` significa que una regla configurada de alignment se ha cumplido.
Por ahora existe:

```text
at_least_remaining
```

Esa condicion significa que los miembros `inPlay` de un alignment son al menos
tantos como todos los demas roleInstances `inPlay` juntos. El nombre evita
lenguaje de bandos buenos, malos, enemigos u hostiles.

Ejemplo:

```js
settings: {
  victory: {
    alignmentRules: [
      {
        id: 'alignment_b_reaches_threshold',
        alignmentId: 'alignment_b',
        condition: 'at_least_remaining'
      }
    ]
  }
}
```

`single_alignment` significa que todos los roles que siguen `inPlay` pertenecen
al mismo alignment.

`linked_exclusive_survivors` significa que una relacion `linked` de alignments
distintas es el unico grupo que queda `inPlay`. Esto modela la parte abstracta
de "dos destinos enlazados ganan juntos si quedan solos", sin usar nombres de
skin.

Todavia no implementa reglas especificas como paridad de alignments hostiles,
victoria por todos los objetivos marcados, victoria instantanea o condiciones
individuales. Esas reglas necesitan configuracion adicional.

### `index.js`

Es una puerta de salida comoda.

No manda nada a ningun sitio por si solo. Solo reexporta funciones.

En vez de importar cada archivo por separado:

```js
import { createGameSession } from './sessionModel.js';
import { advancePhaseCursor } from './phaseModel.js';
```

se puede hacer:

```js
import { createGameSession, advancePhaseCursor } from './index.js';
```

Es como una recepcion: no hace el trabajo, solo te permite pedir cosas de varios
archivos desde una unica entrada.

## Como verlo funcionar

Ejecuta desde la raiz del proyecto:

```bash
node tools/domain_demo.js
```

Ese script imprime una partida minima en terminal:

1. crea dos jugadores;
2. asigna dos roles anonimos;
3. valida si el Match esta completo;
4. crea fases;
5. activa fases segun los roles en juego;
6. avanza fase por fase.

Si esto funciona, significa que la logica basica del nucleo funciona sin abrir la app.

Para ver la primera accion real del motor:

```bash
node tools/inspect_role_demo.js
```

Esa demo muestra como un rol generico `role_inspector` inspecciona a
`hidden_enemy` y recibe como resultado su `roleId`.

Para ver la primera accion que modifica la sesion:

```bash
node tools/set_in_play_demo.js
```

Esa demo muestra como un actor intenta aplicar `set_property inPlay=false`.

Para ver el primer ciclo completo de cambio de estado, bloqueo y resolucion:

```bash
node tools/block_cycle_demo.js
```

Esa demo muestra:

1. `set_in_play(false)` sin bloqueo: el objetivo acaba con `inPlay=false`;
2. `set_in_play(false)` y despues intento de bloqueo: el bloqueo llega tarde;
3. bloqueo antes de `set_in_play(false)`: la accion ocurre como intento, pero falla;
4. repetir bloqueo sobre el mismo objetivo en el ciclo siguiente: falla;
5. intento invalido de bloqueo: el motor devuelve un error claro.

Para ver como se guardan relaciones entre roles:

```bash
node tools/relation_demo.js
```

Esa demo muestra una relacion `linked` guardada en `session.relations` y como
consultar con quien esta enlazada cada roleInstance.

Para ver como `linked` genera consecuencias reales:

```bash
node tools/linked_effect_demo.js
```

Esa demo muestra que un `set_property inPlay=false` sobre un roleInstance genera
otro `set_property inPlay=false` para su roleInstance enlazado.

## Como describiremos reglas

El formato propuesto para reglas genericas esta documentado en:

```text
src/lib/domain/README_RULES.md
```

Ese documento explica como convertir una regla tematica como "La Vidente ve una
carta cada noche" en una regla mecanica generica como `inspect_role`.

El alcance del motor esta documentado en:

```text
src/lib/domain/ENGINE_SCOPE.md
```

Ese documento separa responsabilidades: resolver acciones, resolver efectos,
aplicar efectos y evaluar estado global.

El inventario de recetas esta documentado en:

```text
docs/recipes_inventory.md
```

Ese documento lista cada receta, su accion pura y sus restricciones actuales.

## Regla importante

Nada de esta carpeta debe importar:

- `.svelte`;
- `firebase`;
- `i18n`;
- imagenes;
- CSS;
- componentes.

Si algun archivo de `domain/` necesita eso, significa que estamos mezclando de nuevo capas que queremos separar.

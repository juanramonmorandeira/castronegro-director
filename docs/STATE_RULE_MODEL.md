# State Rule Model

Este documento define la capa conceptual mas baja del nucleo anonimo: estado,
propiedades, condiciones, acciones, seleccion y reglas.

No describe una implementacion final. Sirve para fijar lenguaje antes de seguir
tocando codigo.

## Principio base

El juego puede entenderse como una secuencia de reglas que:

1. leen estado;
2. piden decisiones si las necesitan;
3. intentan cambiar estado;
4. registran que ocurrio;
5. permiten que el cierre del pool evalue los resultados.

El motor no debe interpretar lenguaje libre. Debe interpretar reglas
declarativas pequenas y funciones conocidas.

## Conceptos aceptados

`role` = sujeto mecanico principal.

`group` = conjunto de roles. No siempre necesita persistir; solo debe
materializarse si una regla necesita una referencia estable a esa coleccion.

`property` = unidad de estado legible o modificable de un role.

`condition` = lectura o comparacion del estado.

`action` = intento de producir un cambio o resultado mecanico.

`rule` = declaracion que combina condition, action, consequence o restriction.

`select` = mecanismo general para obtener una decision humana o grupal.

`candidateRules` = reglas para construir o acotar `candidateIds` antes de una
selection.

`selectionRules` = reglas que gobiernan como `selectorIds` eligen entre
`candidateIds`.

`stage` = periodo ejecutable dentro de un pool.

`automaticStage` = etapa del sistema que no representa actuacion de role/group.

## Stages y automaticStages

Un `stage` puede tener `actorIds` cuando requiere actuacion de roles:

```text
stage = periodo donde uno o varios roles actuan
```

Ejemplos de stages:

```text
vote_out_of_play
discussion / debate
role_inspects
role_blocks_property_change
group_selects_target
```

No son stages manuales:

```text
start_cycle
check_objectives
conclude_play
```

Estos son `automaticStages`: rutinas de sistema que preparan ciclo, limpian o
evalúan estado.

## Property State

Modelo simple:

```js
role.properties.inPlay = {
  value: true,
  blocked: false
}
```

Modelo preferente para cambios bloqueados:

```js
role.properties = {
  inPlay: {
    value: true,
    blockedChanges: [
      {
        value: false,
        source: 'role_block',
        range: ['group_01', 'role_03'],
        expires: 'end_of_pool'
      }
    ]
  }
}
```

Lectura:

- `value`: valor actual de la property.
- `blockedChanges`: cambios concretos que no pueden aplicarse.
- `value` dentro de `blockedChanges`: valor que queda bloqueado.
- `source`: role, group, rule o action que genero el bloqueo.
- `range`: sujetos contra los que aplica el bloqueo.
- `expires`: momento en que el bloqueo deja de aplicar.

Importante:

```text
bloquear inPlay=false no implica bloquear inPlay=true
```

Por eso `blockedChanges` es mas preciso que `blocked: true`.

## Getters y setters

Las properties deben modificarse mediante funciones conocidas.

Ejemplos conceptuales:

```text
getRoleProperty(roleId, propertyKey)
setRoleProperty(roleId, propertyKey, value)
canSetRoleProperty(roleId, propertyKey, value, context)
addBlockedPropertyChange(roleId, propertyKey, blockedChange)
removeExpiredBlockedChanges(expirationPoint)
```

Un setter no debe cambiar estado critico sin comprobar antes si el cambio esta
bloqueado.

## Select

`select` es la funcion unica de eleccion.

No existen `pick` y `select` como funciones del motor. Pueden usarse en
conversacion humana para explicar casos simples, pero el modelo solo necesita
`select`.

Fase previa:

```js
candidateIds = filterCandidateIds({
  session,
  baseRoleIds,
  selectorIds,
  candidateRules
})
```

Fase de seleccion:

```js
selectionResult = select({
  selectorIds,
  candidateIds,
  selectionRules,
  input
})
```

Lectura:

```text
candidateRules = quien puede ser elegido
selectionRules = como se elige
```

`selectorIds.length === 1` describe una seleccion individual.

`selectorIds.length > 1` describe una seleccion grupal.

No necesitamos `selectionType`, `mode`, `pick` ni `select` como campos.

Resultado posible:

```text
chosen
null
runoff
error
```

La validez de `null` o `runoff` depende de `selectionRules`. Si una selection de
un solo selector devuelve `runoff`, eso normalmente indica mala configuracion.

### candidateRules

Ejemplos:

```text
in_play
not_self
not_selector
not_group_member
not_previously_selected
has_property
exclude_role_ids
```

### selectionRules

Ejemplos:

```text
unanimity_required
abstain_allowed
abstain_not_allowed
null_on_tie
runoff_on_tie
support_threshold
```

`optional` no pertenece a selection. Si una action opcional no se ejecuta,
entonces `select` ni siquiera se llama.

`abstain` pertenece a una decision grupal donde el selector participa pero no
apoya ningun candidate.

### Relacion con selectionModel

`selectionModel` es implementacion historica actual. El modelo objetivo debe
sustituirlo por `selectionModel`.

```text
selectionModel sustituye a selectionModel
```

## Conditions

Una `condition` solo lee o compara estado.

Ejemplos:

```text
role.properties.inPlay.value == true
role.properties.linked.value == true
holder inPlay count >= non-holder inPlay count
only holder members remain inPlay
previousSelected(roleId, propertyKey) != selectedRoleId
```

Una condition no debe cambiar estado.

## Actions

Una `action` intenta producir un resultado.

Ejemplos:

```text
setRoleProperty(roleId, 'inPlay', false)
setRoleProperty(roleId, 'linked', true)
addBlockedPropertyChange(roleId, 'inPlay', { value: false, ... })
inspectRole(targetRoleId)
```

Una action puede:

- devolver informacion;
- proponer efectos;
- intentar cambiar properties;
- fallar por restricciones o bloqueos.

## Resultado de acciones

El punto importante no es cuando se ejecuta una action, sino cuando se evalua el
resultado conjunto de las actions.

Regla aceptada:

```text
los objetivos se evaluan siempre al final de cada pool
```

Esto evita cerrar la parte jugable antes de que todos los roles de ese pool
hayan podido modificar, bloquear o compensar resultados anteriores.

## Pool execution places

Algunas reglas pueden necesitar ejecutarse o materializarse en un lugar concreto
del flujo.

Campo conceptual:

```js
eventExecutionPlace: {
  timing: 'end_of_stage' | 'end_of_pool' | 'first_next_pool' | 'start_of_pool',
  poolKey: null
}
```

Ejemplos:

```text
role-repeat-select pide repetir una seleccion al final del pool actual
role-reactive pide actuar al principio del siguiente pool
check_objectives se ejecuta al final de cada pool
```

Decision pendiente:

```text
mantener specialEventsPool
o reemplazarlo por insercion explicita en pool/posicion definida por regla
```

Lectura actual:

- `specialEventsPool` puede ser mas limpio programaticamente.
- `eventExecutionPlace` puede ser mas preciso conceptualmente.
- No se debe decidir hasta revisar mas eventos especiales reales.

## RuleAnalyzer

`ruleAnalyzer` lee reglas, valida lo que piden y detecta objetos necesarios.

Responsabilidades conceptuales:

```text
recoger reglas aplicables
leer cada regla
detectar subjects, properties, conditions y actions
comprobar si existen objetos requeridos
solicitar materializacion si falta algun objeto
pasar reglas materializadas al ensamblaje de session
```

Ejemplo:

```text
regla: group con alignment_b alcanza paridad
ruleAnalyzer detecta que necesita el conjunto de roles con alignment_b
ruleAnalyzer comprueba si existe group adecuado
si no existe, solicita su creacion a materializerCoordinator
```

## MaterializerCoordinator

`materializerCoordinator` no analiza reglas. Solo coordina peticiones de
materializacion.

Ejemplos:

```text
crear role
crear group
crear stage
crear objectiveRule
crear group
crear pool
```

Regla de nomenclatura:

```text
Analyzer = entiende reglas
Coordinator = decide a que creador delegar
Creator/constructor = crea un tipo concreto de objeto
Assembler = ensambla la session completa
```

## SessionAssembler

`sessionAssembler` coordina la construccion de una session jugable.

Modelo conceptual:

```text
ruleSet + configuration + match
        |
        v
sessionAssembler
        |
        +-> role materialization
        +-> ruleAnalyzer
        +-> materializerCoordinator
        |       +-> group creation
        |       +-> stage creation
        |       +-> objectiveRule creation
        |       +-> group creation for linked/collective rules
        |       +-> pool creation
        |
        v
session
```

## Rule categories

Categorias iniciales aceptadas:

```text
selectionRules
candidateRules
objectiveRules
stageRules
groupRules
poolRules
```

No se aceptan por ahora:

```text
resourceRules
```

Motivo:

```text
resources pueden empezar como parametros simples del role o recipe
```

## Group linked

Decision conceptual aceptada:

```text
linked se representa como un group mecanico.
No existe un modelo separado para vinculos entre roles.
```

Motivo:

```text
un vinculo entre roles es un caso concreto de group con reglas
```

Ejemplo `linked`:

```js
{
  id: 'group_linked_01',
  type: 'linked',
  members: [
    { roleId: 'role_a', memberRole: 'member' },
    { roleId: 'role_b', memberRole: 'member' }
  ],
  groupRules: [
    { type: 'share_property_change', property: 'inPlay', value: false },
    { type: 'members_cannot_select_each_other' }
  ]
}
```

`memberRole` queda aceptado solo como posibilidad para grupos direccionales.
Ejemplo hipotetico:

```text
source -> target
```

Advertencia:

```text
si al final del desarrollo no existe ningun caso real de grupo direccional,
memberRole y toda referencia a grupos direccionales deben eliminarse.
```

Responsabilidad futura de `groupModel`:

```text
getGroup
createGroup
removeGroup
getGroupMembers
addRoleToGroup
removeRoleFromGroup
evaluateGroupRules
deriveGroupConsequences
```

No se debe crear otro modelo para vinculos mientras group pueda representar el
caso limpiamente.

## Ejemplo: protector

Regla humana:

```text
un role selecciona un target y bloquea que ese target pueda recibir inPlay=false
hasta el final del pool
```

Modelo conceptual:

```text
candidateIds:
  filterCandidateIds(
    baseRoleIds = all roles,
    selectorIds = [role_block_change_01],
    candidateRules = [in_play, not_self, not_previous_selected_for_property_inPlay]
  )

select:
  selectorIds = [role_block_change_01]
  candidateIds = [...]
  selectionRules = []

action:
  addBlockedPropertyChange(
    selectedRoleId,
    'inPlay',
    {
      value: false,
      source: role_block_change_01,
      range: ['group_attackers'],
      expires: 'end_of_pool'
    }
  )
```

## Ejemplo: grupo atacante

Regla humana:

```text
un group selecciona target por decision grupal e intenta poner inPlay=false
```

Modelo conceptual:

```text
candidateIds:
  filterCandidateIds(
    baseRoleIds = all roles,
    selectorIds = group_attackers,
    candidateRules = [in_play, not_selector]
  )

select:
  selectorIds = group_attackers
  candidateIds = [...]
  selectionRules = [unanimity_required]

action:
  setRoleProperty(selectedRoleId, 'inPlay', false)

setter:
  si inPlay=false esta bloqueado para ese target y ese source/range
  entonces no cambia value y registra blockedEffect
```

## Ejemplo: role de control inPlay

Regla humana:

```text
un role puede intentar inPlay=true o inPlay=false sobre roles elegibles
```

Punto pendiente:

```text
necesitamos representar roles que estaban inPlay al inicio del pool
```

Opciones:

```text
pool.startedInPlayRoleIds
role.properties.currentPoolEnabled.value
snapshot de pool en metadata
```

Decision pendiente.

## Decisiones pendientes

1. Decidir si `specialEventsPool` se conserva o se reemplaza por
   `eventExecutionPlace`.
2. Migrar `selectionModel` hacia `selectionModel` y eliminar el vocabulario historico
   cuando la migracion este verificada.
3. Definir el formato exacto de `role.properties`.
4. Definir si `inPlay` migra inmediatamente a property avanzada o si se mantiene
   como boolean hasta que el modelo este probado.
5. Definir como registrar snapshots de inicio de pool.
6. Definir un diccionario formal de rule types y function names.

# objectiveDefinition

`objective` es el lenguaje mecanico del nucleo para evaluar objetivos.

Motivo:

```text
El motor no debe asumir que una condicion cumplida implica un significado
narrativo cerrado.
```

Una skin puede presentar el outcome como logro, derrota, escape, equilibrio,
colapso, supervivencia, puntuacion, logro compartido o cualquier otra fantasia.
El motor solo detecta objetivos cumplidos y si alguno de ellos concluye la parte
jugable de la session.

## Conceptos

### objectiveRules

`session.objectiveRules` es la lista viva de reglas de objetivo evaluables
durante una session concreta.

Puede empezar con reglas definidas por el ruleSet y cambiar durante la partida
por efectos, roles, groups o events.

### objectiveRule

`objectiveRule` define una condicion evaluable y que debe proponerse si se
cumple.

Estructura aceptada:

```js
{
  key: 'alignment_b_reaches_parity',
  holder: {
    type: 'group',
    id: 'group_alignment_b'
  },
  condition: {
    type: 'holder_reaches_in_play_parity'
  },
  dependencies: [
    {
      subject: 'role',
      property: 'inPlay'
    }
  ],
  onFulfilled: [
    {
      conclusive: true,
      beneficiaries: {
        type: 'holder'
      }
    }
  ],
  conflictRules: []
}
```

Lectura:

- `key`: id mecanico estable de la regla.
- `holder`: sujeto mecanico al que se asocia el objective. Por ahora puede ser
  `role` o `group`.
- `condition`: condicion que se evalua.
- `dependencies`: propiedades o estructuras de estado que sostienen esa
  condicion.
- `onFulfilled`: propuestas que emite la regla si la condicion se cumple.
- `conflictRules`: reglas para resolver conflictos con otros objetivos
  cumplidos.
- `metadata.origin`: trazabilidad opcional. No participa en la evaluacion.

### onFulfilled

`onFulfilled` no es el resultado final. Es la propuesta que emite una
`objectiveRule` al cumplirse.

Campos iniciales:

```js
{
  conclusive: true,
  beneficiaries: {
    type: 'alignment',
    ids: ['alignment_b']
  }
}
```

`conclusive` indica si el cumplimiento de este objetivo debe concluir la parte
jugable de la session.

`beneficiaries` indica que roles, groups, alignments u otros sujetos mecanicos
se benefician del objetivo cumplido. No define por si mismo el significado
narrativo.

### achievedObjectives

`achievedObjectives` guarda objetivos cumplidos que no concluyen necesariamente
la parte jugable.

### playOutcome

`playOutcome` representa una conclusion mecanica de la parte jugable.

No cierra la session administrativa. La session puede seguir abierta para
narracion, resumen, logs, revision, estadisticas o cierre manual del creador.

Ejemplo conceptual:

```js
{
  conclusive: true,
  beneficiaries: [
    {
      type: 'alignment',
      ids: ['alignment_b']
    }
  ],
  fulfilledObjectiveRuleKeys: ['alignment_b_reaches_parity'],
  resolutionReason: 'single_conclusive_objective'
}
```

### check_objectives

`check_objectives` es la lifecycle operation que comprueba objetivos al final de
un pool. No es un stage ejecutable por player, group o director.

Responsabilidades:

1. evaluar todas las `session.objectiveRules`;
2. registrar objetivos cumplidos no concluyentes en `achievedObjectives`;
3. resolver conflictos si varias condiciones concluyentes se cumplen a la vez;
4. emitir `playOutcome` si la parte jugable queda concluida;
5. comprobar si hay stages pendientes en `specialStages` que pueden alterar el
   outcome;
6. ejecutar `conclude_play` como operacion final solo si existe un
   `playOutcome` concluyente y estable.

### conclude_play

`conclude_play` es la operacion que gestiona la conclusion de la parte
jugable.

No cierra la session. Cerrar la session es responsabilidad exclusiva del creador
o del flujo de administracion de la aplicacion.

`conclude_play` no se encola en `specialStages`. Si hay stages pendientes que
puedan alterar el outcome, se resuelve primero `specialStages`. Si no los hay,
`conclude_play` se ejecuta como operacion final y el flujo de pools deja de
avanzar.

## Dependencies e influences

Una objectiveRule declara `dependencies`: que estado necesita leer para sostener
su condicion.

Una action, recipe o stage declara `influences`: que estado puede cambiar y en
que sentido.

Ejemplo:

```js
objectiveRule.dependencies = [
  {
    subject: 'role',
    property: 'inPlay'
  }
];

recipe.influences = [
  {
    subject: 'role',
    property: 'inPlay',
    operation: 'set',
    values: [false]
  }
];
```

El cruce entre ambas listas no basta por si solo. Tambien hay que mirar el
contexto real del stage:

- si sigue pendiente;
- si sus acciones o recursos no estan consumidos;
- que targets o candidates reales puede afectar;
- si los valores posibles pueden cambiar una condicion cumplida hacia no
  cumplida.

Por ejemplo, una accion pendiente que solo pueda hacer `inPlay=true` sobre un
role del holder no amenaza una condicion ya cumplida de
`holder_reaches_in_play_parity`; la refuerza. En cambio, una accion pendiente
que pueda hacer `inPlay=false` sobre un role del holder si puede volver inestable
ese outcome.

## Momento de evaluacion

Regla aceptada:

```text
check_objectives se ejecuta al final de cada pool, despues de resolver y aplicar
todos los efectos de ese pool.
```

Motivo:

```text
Un stage temprano dentro de un pool puede producir un estado que parece
concluyente, pero un stage posterior del mismo pool puede revertirlo o modificarlo.
```

## Evaluacion y resolucion

`check_objectives` trabaja en dos fases.

### objectiveEvaluation

Evalua cada `objectiveRule` individualmente.

Si ninguna se cumple, la parte jugable continua.

### objectiveResolution

Si una o varias reglas se cumplen:

- las no concluyentes se registran en `achievedObjectives`;
- una unica concluyente produce `playOutcome`;
- varias concluyentes activan resolucion de conflictos.

## Conflictos

Si varias condiciones concluyentes incompatibles se cumplen al final de un pool,
el orden inicial de resolucion es:

1. aplicar `conflictRules` especificas entre esas objectiveRules;
2. si sigue el conflicto, prevalece la condicion cuyo estado cumplido fue causado
   antes dentro del pool actual;
3. si sigue el conflicto, un objetivo individual prevalece sobre uno colectivo;
4. si sigue el conflicto, todas las condiciones cumplidas producen sus
   beneficiaries.

Esta regla queda sujeta a revision cuando aparezcan casos reales que la
contradigan.

## Condition types iniciales

Tipos de condicion aceptados provisionalmente:

```text
holder_reaches_in_play_parity
only_holder_group_remains_in_play
no_roles_in_play
```

`holder_reaches_in_play_parity`:

```text
members inPlay del holder >= roles inPlay que no pertenecen al holder
```

`only_holder_group_remains_in_play`:

```text
solo quedan inPlay miembros del group holder
```

`no_roles_in_play`:

```text
no queda ningun role inPlay
```

Son puntos de partida. No son una lista cerrada. Las conditions no saben que es
un alignment o linked: esas ideas se expresan creando groups adecuados y
pasandolos como holder.

## Grupo con session

La session puede guardar:

- `session.objectiveRules`;
- `achievedObjectives`;
- `playOutcome`;
- historial de objective checks si lo necesitamos para debug o narracion.

Tambien debe distinguir:

```text
playOutcome = conclusion de la parte jugable.
sessionStatus = estado administrativo de la session.
```

La existencia de `playOutcome` concluyente no obliga a cerrar `sessionStatus`.

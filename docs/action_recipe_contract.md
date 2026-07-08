# Action and recipe contract

Este documento fija la separacion vigente entre `action` y `recipe`.

## Jerarquia objetivo

```text
Stage
-> start/evaluate/resolve/validate/finish
   -> Recipe
      -> start/evaluate/resolve/validate/finish
         -> Action
            -> start/collectContext/validate/evaluate/resolveEffects/validateOutput/finish
               -> Effect
                  -> start/validate/resolve/apply/finish
```

## actionDefinition

`actionDefinition.js` contiene el vocabulario y constructor basico de actions:

- `ACTION_IDS`;
- `createAction`;
- `validateAction`.

Una action es una primitiva mecanica generica. No conoce el stage ni el role que
la usa.

## actionCatalog

`actionCatalog.js` contiene actions reutilizables por id.

El catalogo no ejecuta nada. Solo devuelve actions normalizadas mediante:

```js
getCatalogAction(actionId, overrides)
```

El `id` de una action catalogada lo fija siempre el catalogo. Sus parametros
mecanicos, como `target`, `effect`, `visibility` o `selectionRules`, pueden
adaptarse cuando una recipe necesita una variante concreta. Los campos ajenos a
la materializacion de una action catalogada no forman parte del contrato publico
de `getCatalogAction`.

## effectDefinition

`effectDefinition.js` contiene:

- `EFFECT_TYPES`;
- `createEffect`;
- `validateEffect`.

Un effect describe un cambio o salida mecanica propuesta por el runtime. La
validacion de effect comprueba la forma minima por tipo.

## effectModel

`effectModel.js` ejecuta el runtime conceptual de effects:

```text
startEffect
validateEffect
resolveEffect(s)
applyEffect(s)
finishEffect
```

Las funciones publicas son `resolveEffects`, `applyEffect` y `applyEffects`.
Los appliers concretos de cada tipo de effect son internos.

## recipeCatalog

Una recipe ya no declara `id` y `effect` como campos propios. Una recipe declara
una lista de actions:

```js
{
  key: 'set_out_of_play',
  actor: { type: 'group' },
  target: { type: 'role', count: 1, filters: [...] },
  actions: [
    getCatalogAction('set_in_play', {
      effect: { property: 'inPlay', value: false }
    })
  ]
}
```

En la implementacion actual cada recipe ejecuta una unica action. El contrato ya
usa lista para no bloquear recipes multi-action futuras.

## recipeHistory

`recipeHistory` mantiene los eventos:

```text
started
running_action
finished
```

El evento `running_action` conserva `actionId`. No existe todavia
`session.history.actionHistory`.

## actionHistory futuro

`actionHistory` queda aplazado. Solo se incorporara cuando exista una necesidad
real de consultar actions con vida runtime propia, por ejemplo:

- recipes con varias actions parciales;
- action fallida dentro de una recipe que sigue ejecutandose;
- auditoria independiente por action.

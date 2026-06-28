# Sistema de mensajes y presentacion

Este documento define la frontera entre motor, skin, aplicacion y UI.

## Tipos

`gameplayMessage` = resultado o rechazo mecanico esperado dentro de la partida.
Se guarda en `session.sessionMessageLog` y se presenta mediante skin.

`diagnosticMessage` = fallo tecnico o incoherencia del dominio. Se guarda en
`session.errorLog` y no usa narrativa de skin.

`applicationMessage` = mensaje externo a la partida, como autenticacion, red o
persistencia. Se guarda en `applicationLog`, fuera de session, y usa el i18n de
la aplicacion.

## Contrato

```js
{
  id,
  type: 'gameplay' | 'diagnostic' | 'application',
  key,
  severity: 'info' | 'warning' | 'error' | 'fatal',
  audience: {
    type: 'role' | 'player' | 'group' | 'director' | 'public' | 'system',
    ids: []
  },
  params: {},
  context: {
    sessionId,
    cycleId,
    poolKey,
    stageId,
    stageKey,
    recipeKey,
    actionId,
    phase
  },
  timestamp,
  metadata
}
```

`type` y `severity` son independientes.

## Entidades

Un parametro puede referenciar una entidad mecanica:

```js
{
  entityType: 'role',
  id: 'role_in_out_of_play-0'
}
```

El presentador obtiene el `roleKey` runtime y busca su `displayName` en skin.
La misma regla se aplica a groups, stages, objectives, actions y
recipes.

## Skin

```js
{
  id: 'skin_01',
  defaultLanguage: 'es',
  languages: ['es', 'en'],
  entities: {
    roles: {
      role_in_out_of_play: {
        displayName: {
          es: 'Control de estado',
          en: 'State control'
        }
      }
    },
    recipes: {
      restore_recent_out_of_play: {
        displayName: {
          es: 'pocion de restauracion',
          en: 'restoration potion'
        }
      }
    }
  },
  messages: {
    es: {
      action_usage_limit_reached: {
        role: '{actor}, la {recipe} ya ha sido usada.',
        director: '{actor} ya uso {recipe} hasta su limite.'
      }
    }
  }
}
```

La skin puede definir una plantilla `default` y variantes por audiencia.

## Persistencia

`sessionMessageLog` conserva siempre el mensaje estructurado. Puede guardar
tambien el texto exacto mostrado:

```js
{
  id,
  message: {},
  rendered: {
    text,
    language,
    skinId,
    severity,
    audience
  }
}
```

Esto permite regenerar la presentacion con otra skin y conservar una auditoria
de lo que vio el usuario.

`errorLog` conserva diagnosticos estructurados. No se usa para metatrama.

`applicationLog` no pertenece a session.

## Flujo

```text
motor
  -> error o resultado mecanico
  -> messageModel
  -> gameplayMessage o diagnosticMessage
  -> messageRouter
  -> sessionMessageLog o errorLog

gameplayMessage
  -> messagePresenter + skin + language
  -> texto presentado
  -> UI, toast o log narrativo
```

Los mensajes de aplicacion siguen un flujo separado:

```text
aplicacion
  -> applicationMessage
  -> i18n de aplicacion
  -> UI o applicationLog
```

## Casos implementados

`constraint/limited_uses` produce `action_usage_limit_reached`. El error tecnico
original sigue disponible en `result.errors` y el gameplayMessage se guarda en
`sessionMessageLog`.

Los fallos de stage y pool producen diagnosticMessages en `errorLog`.

## Archivos

- `src/lib/messages/messageDefinition.js`
- `src/lib/messages/messageCatalog.js`
- `src/lib/messages/messageModel.js`
- `src/lib/messages/messageLogModel.js`
- `src/lib/messages/skinDefinition.js`
- `src/lib/messages/skinValidation.js`
- `src/lib/messages/messagePresenter.js`

# skinDefinition

`skin` define como se presenta un juego mecanico anonimo.

No cambia reglas. No crea roles mecanicos. No altera recipes, actions,
selectionRules ni objectiveRules.

La skin da forma visible:

- nombres;
- textos;
- imagenes;
- iconos;
- traducciones;
- tono;
- fantasia;
- metatrama.

Tambien presenta los `gameplayMessages` emitidos por el motor. No presenta
diagnosticos tecnicos ni mensajes generales de la aplicacion.

## Relacion con ruleSet

Una skin se define sobre uno o varios `ruleSet`.

Debe cubrir los elementos mecanicos que esos ruleSets necesitan presentar.

Decision actual:

```text
La skin usa ids expuestos por el ruleSet.
No deberia depender directamente de ids internos de capas inferiores si el
ruleSet ya expone ids propios.
```

Esto evita mezclar capas:

```text
catalog -> ruleSet -> skin
```

## skinKey

Nombre aceptado:

```text
skinKey
```

`skinKey` es el puente entre ruleSet y skin.

El ruleSet expone `skinKey` para los elementos que pueden necesitar nombre,
texto, imagen, icono, sonido o cualquier otro recurso narrativo/visual. La skin
provee esos recursos usando esa misma clave.

Si `skinKey` no resulta suficiente en codigo, `presentationKey` queda como
alternativa aceptable, pero la preferencia actual es `skinKey`.

## Elementos que puede nombrar o vestir

Una skin puede proporcionar presentacion para:

- roles;
- groups;
- recipes;
- actions;
- tokens;
- buildings;
- stages;
- playOutcome;
- achievedObjectives;
- eventos especiales;
- textos de narrador asociados a la partida.

No todos estos elementos tienen que mostrarse siempre en UI, pero la skin debe
poder cubrirlos si el ruleSet los marca como necesarios.

## Lo que no pertenece a skin

La skin no controla la aplicacion como producto.

No pertenece a skin:

- login;
- registro;
- navegacion general;
- menus de administracion;
- preferencias globales;
- textos de error generales;
- UI no relacionada con una session concreta.

## Campos minimos propuestos

```js
{
  id: 'castronegro_like',
  version: 1,
  supportedRuleSetIds: ['basic_ruleset'],
  labels: {
    roles: {},
    groups: {},
    stages: {},
    recipes: {},
    tokens: {},
    buildings: {}
  },
  descriptions: {
    roles: {},
    groups: {},
    tokens: {}
  },
  assets: {
    roles: {},
    tokens: {},
    buildings: {},
    backgrounds: {}
  },
  messages: {
    es: {
      action_usage_limit_reached: {
        default: '{recipe} ya ha alcanzado su limite de usos.'
      }
    }
  },
  metadata: {}
}
```

## Cobertura obligatoria y opcional

El `ruleSet` debe declarar que elementos de skin son obligatorios.

Ejemplo conceptual:

```js
skinRequirements: {
  required: {
    roles: ['role_inspects', 'role_reactive'],
    groups: ['group_concealed_set_out_of_play', 'group_exposed_set_out_of_play']
  },
  optional: {
    tokens: ['linked_marker'],
    stages: ['stage_05']
  }
}
```

Si falta un elemento obligatorio:

```text
La skin no es compatible con ese ruleSet/configuration. Es un error.
```

Si falta un elemento opcional:

```text
La UI debe deshabilitarlo o mostrarlo como no disponible. Es warning + disabled.
```

No hay fallback automatico para elementos obligatorios. Si un creador quiere una
imagen o texto generico, debe declararlo dentro de la propia skin.

## Versionado

Decision provisional:

```text
No implementar versionado complejo de skins todavia.
```

Si una skin cambia, las sessions que referencian esa skin pueden verse con la
version actualizada.

Si se quiere conservar una version anterior, se puede crear una skin nueva con
otro id.

Pendiente:

- valorar versionado si hay editor de skins;
- valorar snapshots si se necesita reproducibilidad historica estricta.

## Validacion pendiente

Una skin es compatible si:

- declara soporte para el ruleSet o pasa validacion contra el ruleSet;
- cubre todos los elementos obligatorios del ruleSet/configuration;
- sus assets obligatorios existen;
- sus claves de texto existen para los idiomas soportados;
- no usa ids inexistentes.
- cubre las messageKeys obligatorias en los idiomas declarados.

## Relacion con UI

La UI debe pedir a la skin presentacion para un elemento mecanico.

Ejemplo conceptual:

```text
renderRoleCard(roleId)
  -> buscar roleId en session
  -> buscar presentacion en skin
  -> mostrar nombre, texto e imagen
```

El motor no debe importar skin ni assets.

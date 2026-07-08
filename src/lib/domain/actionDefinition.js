// actionDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario y constructor basico de actions.
//
// Una action es una primitiva mecanica generica. No sabe en que stage se usa ni
// que recipe la invoca. Esos contratos viven por encima, en recipe/stage.
// -----------------------------------------------------------------------------

import { MECHANICAL_ENTITY_TYPES } from './domainTypes.js';
import { EFFECT_TYPES } from './effectDefinition.js';

export const ACTION_IDS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  SET_PROPERTY: 'set_property',
  SET_IN_PLAY: 'set_in_play',
  BLOCK_PROPERTY_CHANGE: 'block_property_change',
  LINK_TARGETS: 'link_targets',
  SELECT: 'select',
  REPLACE_ROLE_IDENTITY: 'replace_role_identity',
  CONCLUDE_PLAY: 'conclude_play'
});

export function createAction({
  id,
  target = null,
  effect = null,
  visibility = null,
  selectionRules = null,
  metadata = {}
} = {}) {
  return {
    id,
    ...(target ? { target: { ...target, filters: [...(target.filters ?? [])] } } : {}),
    ...(effect ? { effect: { ...effect } } : {}),
    ...(visibility ? { visibility } : {}),
    ...(selectionRules ? { selectionRules: { ...selectionRules } } : {}),
    metadata: { ...metadata }
  };
}

// Valida requisitos internos de una accion antes de resolverla.
//
// Esta validacion comprueba que la action trae los datos mecanicos necesarios
// para que el motor no cree resultados incompletos. La validacion de actor,
// targets y filtros vive en target/actor runtime.
export function validateAction(action) {
  const errors = [];

  if (!action?.id) {
    errors.push({
      code: 'action/missing-id',
      message: 'action has no id'
    });
  }

  if (action?.id === ACTION_IDS.SET_PROPERTY || action?.id === ACTION_IDS.SET_IN_PLAY) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_PROPERTY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: `${action.id} requires a set_property effect`
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: `${action.id} currently requires targetType "role"`
      });
    }
    if (action?.id === ACTION_IDS.SET_IN_PLAY && effect.property !== 'inPlay') {
      errors.push({
        code: 'action/invalid-effect-property',
        message: 'set_in_play requires effect.property "inPlay"'
      });
    }
    if (action?.id === ACTION_IDS.SET_IN_PLAY && typeof effect.value !== 'boolean') {
      errors.push({
        code: 'action/invalid-effect-value',
        message: 'set_in_play requires a boolean effect.value'
      });
    }
  }

  if (action?.id === ACTION_IDS.BLOCK_PROPERTY_CHANGE) {
    const blockedPropertyChange = action?.effect?.blockedPropertyChange;
    if (action?.effect?.type !== EFFECT_TYPES.BLOCK_PROPERTY_CHANGE) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: `${action.id} requires a block_property_change effect`
      });
    }
    if (!blockedPropertyChange?.property) {
      errors.push({
        code: 'action/missing-blocked-property',
        message: `${action.id} requires effect.blockedPropertyChange.property`
      });
    }
    if ((action?.effect?.blockedFor?.actorIds ?? []).length === 0) {
      errors.push({
        code: 'action/missing-blocked-actors',
        message: `${action.id} requires effect.blockedFor.actorIds`
      });
    }
  }

  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_GROUP) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'link_targets requires a set_group effect'
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.GROUP) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'link_targets requires targetType "group"'
      });
    }
    if (!effect.groupType) {
      errors.push({
        code: 'action/missing-group-type',
        message: 'link_targets requires effect.groupType'
      });
    }
  }

  if (action?.id === ACTION_IDS.CONCLUDE_PLAY) {
    if (action?.effect?.type !== EFFECT_TYPES.CONCLUDE_PLAY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'conclude_play requires a conclude_play effect'
      });
    }
  }

  if (action?.id === ACTION_IDS.REPLACE_ROLE_IDENTITY) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.REPLACE_ROLE_IDENTITY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'replace_role_identity requires a replace_role_identity effect'
      });
    }
    if (effect.targetType !== MECHANICAL_ENTITY_TYPES.ROLE) {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'replace_role_identity requires targetType "role"'
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

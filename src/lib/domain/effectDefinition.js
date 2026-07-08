// effectDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario y constructor basico de effects.
//
// Un effect describe un cambio o salida mecanica que el runtime puede proponer.
// effectModel se encarga de resolverlo y aplicarlo contra una session concreta.
// -----------------------------------------------------------------------------

export const EFFECT_TYPES = Object.freeze({
  REVEAL_PROPERTY: 'reveal_property',
  SET_PROPERTY: 'set_property',
  BLOCK_PROPERTY_CHANGE: 'block_property_change',
  SET_GROUP: 'set_group',
  REPLACE_ROLE_IDENTITY: 'replace_role_identity',
  CONCLUDE_PLAY: 'conclude_play'
});

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

export function createEffect(effect = {}) {
  return {
    ...effect
  };
}

export function validateEffect(effect = {}) {
  const errors = [];

  if (!effect?.type) {
    errors.push({
      code: 'effect/missing-type',
      message: 'effect has no type'
    });
  }

  if (effect?.type && !Object.values(EFFECT_TYPES).includes(effect.type)) {
    errors.push({
      code: 'effect/invalid-type',
      message: `effect has invalid type "${effect.type}"`
    });
  }

  if (effect?.type === EFFECT_TYPES.SET_PROPERTY) {
    if (!hasValue(effect.targetType)) {
      errors.push({
        code: 'effect/missing-target-type',
        message: 'set_property effect requires targetType'
      });
    }
    if (!hasValue(effect.targetId)) {
      errors.push({
        code: 'effect/missing-target-id',
        message: 'set_property effect requires targetId'
      });
    }
    if (!hasValue(effect.property)) {
      errors.push({
        code: 'effect/missing-property',
        message: 'set_property effect requires property'
      });
    }
  }

  if (effect?.type === EFFECT_TYPES.BLOCK_PROPERTY_CHANGE) {
    if (!hasValue(effect.targetType)) {
      errors.push({
        code: 'effect/missing-target-type',
        message: 'block_property_change effect requires targetType'
      });
    }
    if (!hasValue(effect.targetId) && (effect.targetIds ?? []).length === 0) {
      errors.push({
        code: 'effect/missing-target-id',
        message: 'block_property_change effect requires targetId or targetIds'
      });
    }
    if (!hasValue(effect.blockedPropertyChange?.property)) {
      errors.push({
        code: 'effect/missing-blocked-property',
        message: 'block_property_change effect requires blockedPropertyChange.property'
      });
    }
  }

  if (effect?.type === EFFECT_TYPES.SET_GROUP) {
    if (!hasValue(effect.targetType)) {
      errors.push({
        code: 'effect/missing-target-type',
        message: 'set_group effect requires targetType'
      });
    }
    if (!hasValue(effect.groupType)) {
      errors.push({
        code: 'effect/missing-group-type',
        message: 'set_group effect requires groupType'
      });
    }
    if ((effect.roleIds ?? []).length < 2) {
      errors.push({
        code: 'effect/invalid-role-count',
        message: 'set_group effect requires at least two roleIds'
      });
    }
  }

  if (effect?.type === EFFECT_TYPES.REPLACE_ROLE_IDENTITY) {
    if (!hasValue(effect.targetType)) {
      errors.push({
        code: 'effect/missing-target-type',
        message: 'replace_role_identity effect requires targetType'
      });
    }
    if (!hasValue(effect.actorRoleId)) {
      errors.push({
        code: 'effect/missing-actor-role-id',
        message: 'replace_role_identity effect requires actorRoleId'
      });
    }
    if (!hasValue(effect.targetId)) {
      errors.push({
        code: 'effect/missing-target-id',
        message: 'replace_role_identity effect requires targetId'
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

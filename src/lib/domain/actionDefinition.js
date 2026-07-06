// actionDefinition.js
// -----------------------------------------------------------------------------
// Vocabulario y constructor basico de actions.
//
// Una action es una primitiva mecanica generica. No sabe en que stage se usa ni
// que recipe la invoca. Esos contratos viven por encima, en recipe/stage.
// -----------------------------------------------------------------------------

export const ACTION_IDS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  SET_PROPERTY: 'set_property',
  SET_IN_PLAY: 'set_in_play',
  BLOCK_PROPERTY_CHANGE: 'block_property_change',
  LINK_TARGETS: 'link_targets',
  LINKED_TARGET_RECOGNITION: 'linked_target_recognition',
  SELECT: 'select',
  REPLACE_ROLE_IDENTITY: 'replace_role_identity',
  CONCLUDE_PLAY: 'conclude_play'
});

export const VISIBILITY = Object.freeze({
  ACTOR_ONLY: 'actor_only',
  STORYTELLER_ONLY: 'storyteller_only',
  ALL: 'all',
  HIDDEN: 'hidden'
});

export function defineAction({
  id,
  target = null,
  effect = null,
  visibility = VISIBILITY.STORYTELLER_ONLY,
  selectionRules = null,
  metadata = {}
} = {}) {
  return {
    id,
    ...(target ? { target: { ...target, filters: [...(target.filters ?? [])] } } : {}),
    ...(effect ? { effect: { ...effect } } : {}),
    visibility,
    ...(selectionRules ? { selectionRules: { ...selectionRules } } : {}),
    metadata: { ...metadata }
  };
}

export function createAction(action = {}) {
  return defineAction(action);
}

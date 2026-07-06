// actionModel.js
// -----------------------------------------------------------------------------
// Este archivo ejecuta acciones genericas del motor.
//
// Acciones implementadas por ahora:
// - inspect_role: revela informacion.
// - set_in_play: intenta cambiar si un objetivo sigue en el juego principal.
// - block_property_change: bloquea un cambio concreto contra un objetivo.
// - link_targets: crea un grupo mecanico entre varios objetivos.
// - select: resuelve una seleccion y devuelve chosen/empate/nulo.
// - conclude_play: concluye la parte jugable desde pool.onExit.
//
// Importante:
// - No sabe que skin o nombre visible tendra un role.
// - No sabe que fantasia representa cada alignment.
// - No pinta nada en pantalla.
// - No guarda nada en Firebase.
//
// Solo recibe datos y devuelve un resultado.
// -----------------------------------------------------------------------------

import {
  EFFECT_TYPES,
  applyConcludePlay as applyConcludePlayFromModel,
  applyReplaceRoleIdentityEffect,
  applySetGroupEffect,
  applySetPropertyEffect,
  getCurrentCycleId
} from './effectModel.js';
import {
  PROPERTY_BLOCK_EXPIRATION_TYPES,
  addBlockedPropertyChange
} from './roleModel.js';
import {
  HISTORY_RESULTS,
  appendRecipeHistory,
  getRecipeHistorySignature
} from './historyModel.js';
import { resolveProposedEffects } from './resolverModel.js';
import {
  SELECTION_OUTCOME_TYPES,
  SELECTION_ROUND_TYPES,
  resolveSelectionRound
} from './selectionModel.js';
import {
  MECHANICAL_ENTITY_TYPES,
  TARGET_FILTER_TYPES,
  isTargetFilterType
} from './domainTypes.js';
import { LINKED_PROPAGATED_EFFECT_STAGE } from './stageTypes.js';
import { STAGE_STATUSES } from './sessionModel.js';
import {
  SPECIAL_STAGE_EVENT_WINDOWS,
  appendSpecialStage
} from './specialStagesModel.js';

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

// Busca un rol de sesion por id.
//
// Un rol de sesion es una carta/personaje concreto en la partida:
// role_inspector-0, hidden_role-0, enemy-0, etc.
export function findRole(session, roleId) {
  return (session?.roles ?? []).find((role) => role.id === roleId) ?? null;
}

export function getActionActors(session, actorIds = []) {
  return (actorIds ?? []).map((actorId) => findRole(session, actorId));
}

// Devuelve true si una accion puede resolverse sin actor individual.
//
// Ejemplo: una seleccion all_roles puede derivar un set_in_play(false). Esa
// accion no tiene un unico actorId. Es valida mientras la propia accion no
// necesite comparar target contra actor, como ocurre con not_self.
export function canResolveWithoutActor(action) {
  const filters = action?.target?.filters ?? [];
  const needsIndividualActor =
    filters.includes(TARGET_FILTER_TYPES.NOT_SELF) ||
    filters.includes(TARGET_FILTER_TYPES.SAME_ALIGNMENT) ||
    filters.includes(TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT);

  return !needsIndividualActor;
}

function wasTargetRecentlyOutOfPlay(session = {}, target = {}) {
  const currentCycleId = getCurrentCycleId(session);

  return (session.recipeHistory ?? []).some((entry) =>
    entry.cycleId === currentCycleId &&
    (entry.finalEffects ?? []).some((effect) =>
      effect.targetType === MECHANICAL_ENTITY_TYPES.ROLE &&
      effect.targetId === target?.id &&
      effect.property === 'inPlay' &&
      effect.value === false
    )
  );
}

// Comprueba si un objetivo cumple un filtro.
//
// Por ahora implementamos solo los filtros que necesitan inspect_role y
// set_in_play y block_property_change:
// - in_play: el objetivo debe seguir participando en la partida principal.
// - not_self: el actor no puede elegirse a si mismo.
// - not_same_alignment: actor y objetivo no pueden pertenecer al mismo alignment.
// - distinct: se valida en validateActionTargets porque necesita ver toda la
//   lista de objetivos, no un objetivo aislado.
//
// Iremos anadiendo filtros cuando haya reglas reales que los necesiten.
export function targetMatchesFilter({ filter, actor, target, session }) {
  if (filter === TARGET_FILTER_TYPES.IN_PLAY) return target?.inPlay === true;
  if (filter === TARGET_FILTER_TYPES.NOT_IN_PLAY) return target?.inPlay === false;
  if (filter === TARGET_FILTER_TYPES.ASSUMABLE) {
    return (
      (session?.assumableRoles ?? []).includes(target?.id) &&
      !target?.playerId &&
      target?.seat === null
    );
  }
  if (filter === TARGET_FILTER_TYPES.NOT_SELF) return actor?.id !== target?.id;
  if (filter === TARGET_FILTER_TYPES.SAME_ALIGNMENT) {
    return !!actor?.alignmentId && actor.alignmentId === target?.alignmentId;
  }
  if (filter === TARGET_FILTER_TYPES.NOT_SAME_ALIGNMENT) {
    return actor?.alignmentId !== target?.alignmentId;
  }
  if (filter === TARGET_FILTER_TYPES.RECENTLY_OUT_OF_PLAY) {
    return target?.inPlay === false && wasTargetRecentlyOutOfPlay(session, target);
  }
  if (filter === TARGET_FILTER_TYPES.DISTINCT) return true;
  return false;
}

// Valida si una lista de objetivos sirve para una accion.
//
// Devuelve:
// {
//   ok: true/false,
//   errors: []
// }
//
// No lanza errores porque queremos poder mostrar problemas de forma clara en UI
// o en demos.
export function validateActionTargets({
  session,
  action,
  actor,
  targets
}) {
  const errors = [];
  const expectedCount = action?.target?.count ?? 0;
  const filters = action?.target?.filters ?? [];
  const unknownFilters = filters.filter((filter) => !isTargetFilterType(filter));

  unknownFilters.forEach((filter) => {
    errors.push({
      code: 'target/unknown-filter',
      message: `unknown target filter "${filter}"`,
      filter
    });
  });

  if (!actor && !canResolveWithoutActor(action)) {
    errors.push({
      code: 'action/missing-actor',
      message: 'action has no actor role'
    });
  }

  if (!Array.isArray(targets) || targets.length !== expectedCount) {
    errors.push({
      code: 'action/invalid-target-count',
      message: `action expected ${expectedCount} target(s), received ${targets?.length ?? 0}`,
      expectedCount,
      receivedCount: targets?.length ?? 0
    });
  }

  if (filters.includes(TARGET_FILTER_TYPES.DISTINCT)) {
    const targetIds = (targets ?? []).filter(Boolean).map((target) => target.id);
    if (new Set(targetIds).size !== targetIds.length) {
      errors.push({
        code: 'target/filter-distinct',
        message: 'action targets must be distinct',
        targetIds
      });
    }
  }

  (targets ?? []).forEach((target, index) => {
    if (!target) {
      errors.push({
        code: 'action/missing-target',
        message: `target at index ${index} does not exist`,
        index
      });
      return;
    }

    filters.filter(isTargetFilterType).forEach((filter) => {
      if (!targetMatchesFilter({ filter, actor, target, session })) {
        errors.push({
          code: `target/filter-${filter}`,
          message: `target "${target.id}" does not match filter "${filter}"`,
          targetId: target.id,
          filter,
          index
        });
      }
    });
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

// Valida requisitos internos de una accion antes de resolverla.
//
// Esta validacion es distinta de validateActionTargets:
// - validateActionTargets comprueba actor + objetivos + filtros.
// - validateActionDefinition comprueba que la accion trae los datos mecanicos
//   necesarios para que el motor no cree resultados incompletos.
export function validateActionDefinition(action) {
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

// Une la validacion de definicion con la validacion de objetivos.
//
// Mantenerlo en una funcion evita repetir el mismo patron en cada resolver.
//
// Las restricciones no se validan aqui. Pertenecen a recipeModel porque son
// condiciones de uso de una receta, no de la accion pura.
export function validateActionResolution({
  session,
  action,
  actor,
  targets
}) {
  const definitionValidation = validateActionDefinition(action);
  const targetValidation = validateActionTargets({
    session,
    action,
    actor,
    targets
  });
  const errors = [...definitionValidation.errors, ...targetValidation.errors];

  return {
    ok: errors.length === 0,
    errors
  };
}

// Aplica un efecto de tipo reveal_property.
//
// Esto no cambia el estado de la partida. Solo produce informacion visible para
// alguien.
//
// Ejemplo:
// reveal_property roleKey sobre hidden_role-0 devuelve que su roleKey es enemy.
export function applyRevealPropertyEffect({ action, actor, targets }) {
  const property = action?.effect?.property;
  const visibility = action?.visibility ?? VISIBILITY.ACTOR_ONLY;

  return {
    type: EFFECT_TYPES.REVEAL_PROPERTY,
    visibility,
    actorIds: [actor.id],
    reveals: targets.map((target) => ({
      targetId: target.id,
      property,
      value: target?.[property]
    }))
  };
}

// Construye la descripcion de accion que puede ser bloqueada.
//
// Para set_in_play guardamos property/value porque queremos distinguir:
// - set_in_play inPlay=false: deja al objetivo fuera del juego principal.
// - set_in_play inPlay=true: lo devuelve al juego principal.
// Traduce efectos/bloqueos a un resultado resumido de historial.
//
// El detalle completo queda guardado en proposedEffects, finalEffects y
// preventedPropertyChanges. Este campo sirve para consultas rapidas.
export function getHistoryResultFromResolution({
  finalEffects = [],
  preventedPropertyChanges = []
} = {}) {
  const hasFinalEffects = (finalEffects ?? []).length > 0;
  const hasPreventedChanges = (preventedPropertyChanges ?? []).length > 0;

  if (hasFinalEffects && hasPreventedChanges) return HISTORY_RESULTS.PARTIAL;
  if (hasFinalEffects) return HISTORY_RESULTS.APPLIED;
  if (hasPreventedChanges) return HISTORY_RESULTS.BLOCKED;
  return HISTORY_RESULTS.NO_EFFECT;
}

// Aplica efectos finales ya aceptados por resolverModel.
//
// actionModel no decide aqui si un efecto debe existir. Eso ya lo hizo el
// resolver. Esta funcion solo evita duplicar el mismo reduce en cada accion.
export function applyFinalEffects({ session, finalEffects = [] }) {
  return (finalEffects ?? []).reduce((currentSession, effect) => {
    if (effect?.type === EFFECT_TYPES.SET_PROPERTY) {
      return applySetPropertyEffect({ session: currentSession, effect });
    }
    if (effect?.type === EFFECT_TYPES.SET_GROUP) {
      return applySetGroupEffect({ session: currentSession, effect });
    }
    if (effect?.type === EFFECT_TYPES.REPLACE_ROLE_IDENTITY) {
      return applyReplaceRoleIdentityEffect({ session: currentSession, effect });
    }
    return currentSession;
  }, session);
}

function getImmediateCause(actor = null, context = {}) {
  if (context.causedBy?.id) {
    return {
      type: context.causedBy.type ?? MECHANICAL_ENTITY_TYPES.ROLE,
      id: context.causedBy.id
    };
  }

  return actor?.id
    ? {
        type: MECHANICAL_ENTITY_TYPES.ROLE,
        id: actor.id
      }
    : null;
}

function getHistoryContracts(context = {}) {
  return {
    actorContract: context.actorContract ?? null,
    targetContract: context.targetContract ?? null
  };
}

function appendLinkedPropagatedEffectStages(session = {}, linkedPropagatedEffects = [], context = {}) {
  return (linkedPropagatedEffects ?? []).reduce((currentSession, effect, index) => {
    const eventWindow = context.poolKey === 'poolConcealed'
      ? SPECIAL_STAGE_EVENT_WINDOWS.AFTER_CONCEALED
      : context.poolKey === 'poolExposed'
        ? SPECIAL_STAGE_EVENT_WINDOWS.AFTER_EXPOSED
        : null;
    const stage = {
      key: LINKED_PROPAGATED_EFFECT_STAGE.KEY,
      status: STAGE_STATUSES.ENABLED,
      actorIds: [],
      recipes: [],
      metadata: {
        catalogId: LINKED_PROPAGATED_EFFECT_STAGE.CATALOG_ID,
        ...(eventWindow ? { eventWindow } : {}),
        propagatedEffect: effect,
        sourceContext: {
          cycleId: context.cycleId ?? currentSession.cycle?.id ?? 0,
          poolKey: context.poolKey ?? null,
          stageId: context.stageId ?? null,
          stageKey: context.stageKey ?? null,
          stageCatalogId: context.stageCatalogId ?? null,
          recipeKey: context.recipeKey ?? null
        }
      }
    };

    return appendSpecialStage(currentSession, stage, {
      reason: LINKED_PROPAGATED_EFFECT_STAGE.RECIPE_KEY,
      index,
      causedBy: effect.causedBy ?? null,
      derivedFrom: effect.derivedFrom ?? null,
      causalCondition: effect.causalCondition ?? null,
      targetId: effect.targetId ?? null
    });
  }, session);
}

function sameRoleIdSet(left = [], right = []) {
  const leftIds = [...new Set(left ?? [])].sort();
  const rightIds = [...new Set(right ?? [])].sort();
  return leftIds.length === rightIds.length && leftIds.every((roleId, index) => roleId === rightIds[index]);
}

function findGroupCreatedBySetGroupEffect(session = {}, effect = {}) {
  const roleIds = effect.roleIds ?? [];
  const groupType = effect.groupType ?? null;

  return (session.groups ?? []).find((group) =>
    group.type === groupType &&
    sameRoleIdSet(group.roleIds ?? [], roleIds)
  ) ?? null;
}

function appendLinkedTargetRecognitionHistory({
  session = {},
  action = {},
  actor = null,
  context = {},
  currentCycleId = 0,
  group = null
} = {}) {
  if (!group || (group.roleIds ?? []).length === 0) return session;

  const memberRoleIds = [...(group.roleIds ?? [])];

  return appendRecipeHistory(session, {
    cycleId: currentCycleId,
    poolKey: context.poolKey ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    stageCatalogId: context.stageCatalogId ?? null,
    recipeKey: ACTION_IDS.LINKED_TARGET_RECOGNITION,
    actionId: ACTION_IDS.LINKED_TARGET_RECOGNITION,
    actionSignature: ACTION_IDS.LINKED_TARGET_RECOGNITION,
    actorIds: actor ? [actor.id] : [],
    targetIds: memberRoleIds,
    proposedEffects: [],
    finalEffects: [],
    blockedEffects: [],
    result: HISTORY_RESULTS.NO_EFFECT,
    metadata: {
      visibility: 'linked_members',
      audienceRoleIds: memberRoleIds,
      directorVisible: true,
      causedBy: {
        recipeKey: context.recipeKey ?? action.key ?? action.id,
        actionId: action.id ?? null,
        actorId: actor?.id ?? null,
        groupId: group.id
      },
      derivedFrom: {
        type: MECHANICAL_ENTITY_TYPES.GROUP,
        id: group.id,
        groupType: group.type ?? null,
        sourceActionId: group.sourceActionId ?? null
      },
      reveals: {
        groupId: group.id,
        memberRoleIds
      }
    }
  });
}

// Resuelve la consecuencia principal de set_in_play.
//
// Distincion importante:
// - La accion SI se produce como intento.
// - Si el objetivo ya tenia bloqueada esta accion, el intento falla para ese
//   objetivo.
// - En ese caso NO se propone set_property.
// - Si no estaba bloqueada, propone y aplica set_property inPlay=value.
export function resolveSetInPlayEffect({ session, action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const causedBy = getImmediateCause(actor, context);
  const proposedEffects = targets.map((target) => ({
    ...action.effect,
    causedBy,
    targetId: target.id
  }));
  const effectResolution = resolveProposedEffects({ session, proposedEffects });
  const { finalEffects, blockedEffects, linkedPropagatedEffects } = effectResolution;
  const preventedPropertyChanges = blockedEffects
    .filter((effect) => effect.type === EFFECT_TYPES.SET_PROPERTY)
    .map((effect) => ({
      property: effect.property,
      value: effect.value,
      reason: effect.reason,
      targetId: effect.targetId,
      causedBy: effect.causedBy ?? null
    }));
  const blockedTargetIds = new Set(
    preventedPropertyChanges.map((change) => change.targetId)
  );
  const sessionAfterEffects = applyFinalEffects({ session, finalEffects });
  const sessionWithLinkedPropagationStages = appendLinkedPropagatedEffectStages(
    sessionAfterEffects,
    linkedPropagatedEffects,
    {
      ...context,
      cycleId: currentCycleId
    }
  );
  const nextSession = appendRecipeHistory(sessionWithLinkedPropagationStages, {
    cycleId: currentCycleId,
    poolKey: context.poolKey ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    stageCatalogId: context.stageCatalogId ?? null,
    recipeKey: context.recipeKey ?? action.key ?? action.id,
    actionId: action.id,
    actionSignature: getRecipeHistorySignature(action),
    actorIds: actor ? [actor.id] : [],
    ...getHistoryContracts(context),
    targetIds: targets.map((target) => target.id),
    proposedEffects,
    finalEffects,
    preventedPropertyChanges,
    blockedEffects,
    result: getHistoryResultFromResolution({
      finalEffects,
      preventedPropertyChanges
    })
  });

  return {
    session: nextSession,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: actor ? [actor.id] : [],
      targets: targets.map((target) => ({
        targetId: target.id,
        actionAttempted: true,
        propertyChangePrevented: blockedTargetIds.has(target.id),
        failureReason: blockedTargetIds.has(target.id) ? 'blocked_property_change' : null
      })),
      proposedEffects,
      finalEffects,
      causedBy,
      preventedPropertyChanges,
      blockedEffects,
      linkedPropagatedEffects
    }
  };
}

export function applyPropertyBlock({ session, action, actor, targets, context = {} }) {
  const blockedPropertyChange = action.effect?.blockedPropertyChange ?? {};
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const causedBy = getImmediateCause(actor, context);
  const targetIds = new Set(targets.map((target) => target.id));
  const blockedFor = action.effect?.blockedFor ?? { actorIds: [] };
  const expiresAt = action.effect?.expiresAt ?? {
    type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION
  };

  const sessionWithBlock = {
    ...session,
    roles: (session.roles ?? []).map((role) => {
      if (!targetIds.has(role.id)) return role;
      return addBlockedPropertyChange(role, {
        property: blockedPropertyChange.property,
        value: blockedPropertyChange.value,
        blockedFor,
        expiresAt,
        metadata: {
          createdByRoleId: actor?.id ?? null,
          recipeKey: context.recipeKey ?? action.key ?? action.id
        }
      });
    })
  };
  const nextSession = appendRecipeHistory(sessionWithBlock, {
    cycleId: currentCycleId,
    poolKey: context.poolKey ?? null,
    stageId: context.stageId ?? null,
    stageKey: context.stageKey ?? null,
    stageCatalogId: context.stageCatalogId ?? null,
    recipeKey: context.recipeKey ?? action.key ?? action.id,
    actionId: action?.id ?? ACTION_IDS.BLOCK_PROPERTY_CHANGE,
    actionSignature: getRecipeHistorySignature(action),
    actorIds: [actor.id],
    ...getHistoryContracts(context),
    targetIds: targets.map((target) => target.id),
    result: HISTORY_RESULTS.APPLIED
  });

  return {
    session: nextSession,
    result: {
      type: EFFECT_TYPES.BLOCK_PROPERTY_CHANGE,
      visibility,
      actorIds: [actor.id],
      blockedPropertyChange,
      blockedFor,
      expiresAt,
      causedBy,
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetId: target.id,
        blockedPropertyChange
      }))
    }
  };
}

// Aplica un grupo creado por link_targets.
//
// Separacion conceptual:
// - link_targets es la accion: alguien intenta enlazar objetivos.
// - set_group es el efecto final: se escribe un grupo en la sesion.
// - las groupRules materializadas deciden despues si un cambio se propaga.
export function applyLinkTargets({ session, action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const proposedEffects = [
    {
      ...action.effect,
      causedBy: actor?.id ? { type: MECHANICAL_ENTITY_TYPES.ROLE, id: actor.id } : null,
      roleIds: targets.map((target) => target.id),
      sourceActionId: action.id
    }
  ];
  const effectResolution = resolveProposedEffects({ session, proposedEffects });
  const sessionAfterEffects = applyFinalEffects({ session, finalEffects: effectResolution.finalEffects });
  const sessionWithLinkHistory = appendRecipeHistory(
    sessionAfterEffects,
    {
      cycleId: currentCycleId,
      poolKey: context.poolKey ?? null,
      stageId: context.stageId ?? null,
      stageKey: context.stageKey ?? null,
      stageCatalogId: context.stageCatalogId ?? null,
      recipeKey: context.recipeKey ?? action.key ?? action.id,
      actionId: action.id,
      actionSignature: getRecipeHistorySignature(action),
      actorIds: actor ? [actor.id] : [],
      ...getHistoryContracts(context),
      targetIds: targets.map((target) => target.id),
      proposedEffects: effectResolution.proposedEffects,
      finalEffects: effectResolution.finalEffects,
      blockedEffects: effectResolution.blockedEffects,
      result: getHistoryResultFromResolution({
        finalEffects: effectResolution.finalEffects,
        preventedPropertyChanges: []
      })
    }
  );
  const nextSession = effectResolution.finalEffects
    .filter((effect) => effect.type === EFFECT_TYPES.SET_GROUP)
    .reduce((currentSession, effect) =>
      appendLinkedTargetRecognitionHistory({
        session: currentSession,
        action,
        actor,
        context,
        currentCycleId,
        group: findGroupCreatedBySetGroupEffect(sessionAfterEffects, effect)
      }), sessionWithLinkHistory);

  return {
    session: nextSession,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: [actor.id],
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetId: target.id
      })),
      proposedEffects: effectResolution.proposedEffects,
      finalEffects: effectResolution.finalEffects,
      blockedEffects: effectResolution.blockedEffects
    }
  };
}

function getForcedAssumableRoleTarget(session = {}, forcedWhen = {}) {
  const assumableRoleIds = session.assumableRoles ?? [];
  if (assumableRoleIds.length !== 2) return null;

  const assumableRoles = assumableRoleIds
    .map((roleId) => findRole(session, roleId))
    .filter(Boolean);
  if (assumableRoles.length !== 2) return null;

  if (forcedWhen.allAssumableRolesHaveRoleKey) {
    const roleKey = forcedWhen.allAssumableRolesHaveRoleKey;
    if (!assumableRoles.every((role) => role.roleKey === roleKey)) return null;
    return assumableRoles[0];
  }

  return null;
}

function getReplaceRoleIdentityTargetIds(session = {}, action = {}, input = {}) {
  const explicitTargetIds = input.targetIds ?? [];
  if (explicitTargetIds.length > 0) return { targetIds: explicitTargetIds, forced: false };

  // Las reglas forzadas siguen requiriendo feedback humano minimo: la UI debe
  // mostrar las opciones y enviar acknowledged=true antes de que el motor asigne.
  if (input.acknowledged !== true) return { targetIds: [], forced: false };

  const forcedTarget = getForcedAssumableRoleTarget(session, action.effect?.forcedWhen ?? {});
  return {
    targetIds: forcedTarget ? [forcedTarget.id] : [],
    forced: !!forcedTarget
  };
}

export function applyReplaceRoleIdentity({ session, action, actor, targets, context = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const target = targets[0] ?? null;
  const proposedEffects = [
    {
      ...action.effect,
      actorRoleId: actor.id,
      targetId: target.id,
      recipeKey: context.recipeKey ?? action.key ?? action.id,
      causedBy: actor?.id ? { type: MECHANICAL_ENTITY_TYPES.ROLE, id: actor.id } : null
    }
  ];
  const finalEffects = proposedEffects;
  const nextSession = appendRecipeHistory(
    applyFinalEffects({ session, finalEffects }),
    {
      cycleId: currentCycleId,
      poolKey: context.poolKey ?? null,
      stageId: context.stageId ?? null,
      stageKey: context.stageKey ?? null,
      stageCatalogId: context.stageCatalogId ?? null,
      recipeKey: context.recipeKey ?? action.key ?? action.id,
      actionId: action.id,
      actionSignature: getRecipeHistorySignature(action),
      actorIds: [actor.id],
      ...getHistoryContracts(context),
      targetIds: [target.id],
      proposedEffects,
      finalEffects,
      blockedEffects: [],
      result: HISTORY_RESULTS.APPLIED
    }
  );

  return {
    session: nextSession,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorIds: [actor.id],
      targetIds: [target.id],
      proposedEffects,
      finalEffects,
      blockedEffects: []
    }
  };
}

// Resuelve una seleccion pura.
//
// selectionModel solo cuenta selecciones y decide chosen/empate/nulo. No aplica efectos.
// Si un stage quiere hacer algo con el chosen, stageModel aplicara despues la
// receta normal configurada en ese stage.
export function applySelection({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  const selectionResolution = resolveSelectionRound({
    session,
    selectorIds: input.selectorIds ?? input.actorIds ?? [],
    selections: input.selections ?? [],
    selectionRules: input.selectionRules ?? action?.selectionRules ?? {},
    roundType: input.roundType ?? SELECTION_ROUND_TYPES.INITIAL,
    roundIndex: input.roundIndex ?? 0
  });

  if (!selectionResolution.ok) {
    return {
      ok: false,
      errors: selectionResolution.errors,
      session,
      result: null
    };
  }

  if (selectionResolution.result.type !== SELECTION_OUTCOME_TYPES.CHOSEN) {
    return {
      ok: true,
      errors: [],
      session,
      result: {
        type: 'action_resolution',
        visibility,
        actionId: action.id,
        selection: selectionResolution.result,
        proposedEffects: [],
        finalEffects: [],
        blockedEffects: []
      }
    };
  }

  return {
    ok: true,
    errors: [],
    session,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      selection: selectionResolution.result,
      proposedEffects: [],
      finalEffects: [],
      blockedEffects: []
    }
  };
}

// Prepara un nuevo ciclo.
//
// En esta version todavia no tenemos una cola real de efectos pendientes. Las
// acciones actuales resuelven y aplican sus efectos inmediatamente. Aun asi,
// mantenemos esta accion de sistema para limpiar bloqueos temporales y avanzar
// cycle.id antes del siguiente poolConcealed.
//
// Limpia flags temporales para empezar el siguiente ciclo sin basura:
// - preventedPropertyChanges.
// Ejecuta conclude_play.
//
// Esta accion la dispara una operacion de pool.onExit cuando el playOutcome es
// estable. No se encola en specialStages.
export function applyConcludePlayAction({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  return applyConcludePlayFromModel({
    session,
    visibility,
    playOutcome:
      input.playOutcome ??
      action?.effect?.playOutcome ??
      session?.playOutcome ??
      session?.metadata?.pendingPlayOutcome ??
      null
  });
}

// Ejecuta inspect_role.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca los objetivos.
// 3. Valida que los objetivos cumplen count + filtros.
// 4. Devuelve un resultado reveal_property.
//
// No modifica la sesion porque inspeccionar solo revela informacion.
export function resolveInspectRole(session, action, input = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.INSPECT_ROLE,
      errors: validation.errors,
      session,
      result: null
    };
  }

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session,
    result: applyRevealPropertyEffect({ action, actor, targets })
  };
}

// Ejecuta set_in_play.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count + filtros, por ejemplo in_play y not_same_alignment.
// 4. Ejecuta el intento de cambiar inPlay.
// 5. Si el objetivo tenia bloqueada esa accion, no genera efecto final.
// 6. Si no estaba bloqueada, aplica set_property inPlay=value.
export function resolveSetInPlay(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({
    session,
    action,
    actor,
    targets
  });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SET_IN_PLAY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = resolveSetInPlayEffect({
    session,
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

export function resolveSetProperty(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({
    session,
    action,
    actor,
    targets
  });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SET_PROPERTY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = resolveSetInPlayEffect({
    session,
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta block_property_change o una receta basada en esa primitiva.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count y filtros. Las restricciones ya las valido recipeModel.
// 4. Marca al objetivo como prevenido contra la accion indicada.
// 5. Registra el bloqueo aplicado en session.recipeHistory.
export function resolveBlockPropertyChange(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.BLOCK_PROPERTY_CHANGE,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyPropertyBlock({
    session,
    action,
    actor,
    targets,
    context
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta link_targets.
//
// Esta accion no decide que significa narrativamente el vinculo. Solo crea un
// grupo mecanico en session.groups. Por ejemplo, una skin podria llamarlo
// enamorar, sincronizar, esposar, conectar destinos o cualquier otra fantasia.
export function resolveLinkTargets(session, action, input = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.LINK_TARGETS,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyLinkTargets({ session, action, actor, targets, context: input.context ?? {} });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

export function resolveReplaceRoleIdentity(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targetSelection = getReplaceRoleIdentityTargetIds(session, action, input);
  const targetIds = targetSelection.targetIds;
  const targets = targetIds.map((id) => findRole(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.REPLACE_ROLE_IDENTITY,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyReplaceRoleIdentity({ session, action, actor, targets, context });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: {
      ...applied.result,
      forced: targetSelection.forced
    }
  };
}

// Ejecuta select.
//
// La accion no recibe un actor unico porque representa una ronda de seleccion.
// Cada seleccion individual ya trae su selectorId.
export function resolveSelection(session, action, input = {}) {
  const definitionValidation = validateActionDefinition(action);

  if (!definitionValidation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.SELECT,
      errors: definitionValidation.errors,
      session,
      result: null
    };
  }

  const applied = applySelection({ session, action, input });

  return {
    ok: applied.ok,
    actionId: action.id,
    errors: applied.errors,
    session: applied.session,
    result: applied.result
  };
}

export function resolveConcludePlay(session, action, input = {}) {
  const definitionValidation = validateActionDefinition(action);

  if (!definitionValidation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
      errors: definitionValidation.errors,
      session,
      result: null
    };
  }

  const applied = applyConcludePlayAction({ session, action, input });

  return {
    ok: true,
    actionId: action?.id ?? ACTION_IDS.CONCLUDE_PLAY,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Punto de entrada generico para resolver acciones.
//
// Por ahora entiende:
// - inspect_role
// - set_in_play
// - block_property_change
// - block_out_of_play
// - link_targets
// - select
//
// Las proximas acciones genericas se conectaran aqui.
export function resolveAction(session, action, input = {}, context = {}) {
  if (action?.id === ACTION_IDS.INSPECT_ROLE) {
    return resolveInspectRole(session, action, input);
  }
  if (action?.id === ACTION_IDS.SET_PROPERTY) {
    return resolveSetProperty(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.SET_IN_PLAY) {
    return resolveSetInPlay(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.BLOCK_PROPERTY_CHANGE) {
    return resolveBlockPropertyChange(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    return resolveLinkTargets(session, action, { ...input, context });
  }
  if (action?.id === ACTION_IDS.REPLACE_ROLE_IDENTITY) {
    return resolveReplaceRoleIdentity(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.SELECT) {
    return resolveSelection(session, action, input);
  }
  if (action?.id === ACTION_IDS.CONCLUDE_PLAY) {
    return resolveConcludePlay(session, action, input);
  }

  return {
    ok: false,
    actionId: action?.id ?? null,
    errors: [
      {
        code: 'action/unsupported',
        message: `unsupported action "${action?.id ?? 'unknown'}"`
      }
    ],
    session,
    result: null
  };
}

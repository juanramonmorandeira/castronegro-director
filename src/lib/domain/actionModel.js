// actionModel.js
// -----------------------------------------------------------------------------
// Este archivo ejecuta acciones genericas del motor.
//
// Acciones implementadas por ahora:
// - inspect_role: revela informacion.
// - set_in_play: intenta cambiar si un objetivo sigue en el juego principal.
// - block_action: bloquea una accion concreta contra un objetivo.
// - link_targets: crea una relacion mecanica entre varios objetivos.
// - vote: resuelve una votacion y devuelve ganador/empate/nulo.
// - resolve_pending_effects: cierra el ciclo y limpia efectos temporales.
//
// Importante:
// - No sabe que es "La Vidente".
// - No sabe que es "Hombre Lobo".
// - No pinta nada en pantalla.
// - No guarda nada en Firebase.
//
// Solo recibe datos y devuelve un resultado.
// -----------------------------------------------------------------------------

import {
  EFFECT_TYPES,
  applyResolvePendingEffects as applyResolvePendingEffectsFromModel,
  applySetRelationEffect,
  applySetPropertyEffect,
  getActionBlockKey,
  getCurrentCycleId,
  hasActionBlock
} from './effectModel.js';
import {
  HISTORY_RESULTS,
  appendActionHistory,
  getActionHistorySignature
} from './historyModel.js';
import { resolveProposedEffects } from './resolverModel.js';
import {
  VOTE_REQUIRED_POLICIES,
  VOTE_OUTCOME_TYPES,
  VOTE_ROUND_TYPES,
  VOTE_TIE_POLICIES,
  resolveVoteRound
} from './voteModel.js';

export const ACTION_IDS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  SET_IN_PLAY: 'set_in_play',
  BLOCK_ACTION: 'block_action',
  LINK_TARGETS: 'link_targets',
  VOTE: 'vote',
  RESOLVE_PENDING_EFFECTS: 'resolve_pending_effects'
});

export const VISIBILITY = Object.freeze({
  ACTOR_ONLY: 'actor_only',
  STORYTELLER_ONLY: 'storyteller_only',
  ALL: 'all',
  HIDDEN: 'hidden'
});

// Busca una instancia de rol por id dentro de una sesion.
//
// Una instancia de rol es una carta/personaje concreto en la partida:
// role_inspector-0, hidden_role-0, enemy-0, etc.
export function findRoleInstance(session, roleInstanceId) {
  return (session?.roleInstances ?? []).find((role) => role.id === roleInstanceId) ?? null;
}

export function getActionActor(session, action, actorRoleInstanceId) {
  return findRoleInstance(session, actorRoleInstanceId);
}

// Devuelve true si una accion puede ejecutarse usando el actorScope heredado
// del step en vez de un actor individual.
//
// Ejemplo: una votacion all_roles puede derivar un set_in_play(false). Esa
// accion no tiene un unico actorRoleInstanceId, pero si tiene un origen
// mecanico claro: el actorScope del step.
export function canUseActorScopeAsSource({ action, actorScope }) {
  if (!actorScope?.type) return false;

  const filters = action?.target?.filters ?? [];
  const needsIndividualActor = filters.includes('not_self') || filters.includes('not_same_faction');

  return !needsIndividualActor;
}

// Comprueba si un objetivo cumple un filtro.
//
// Por ahora implementamos solo los filtros que necesitan inspect_role y
// set_in_play y block_action:
// - in_play: el objetivo debe seguir participando en la partida principal.
// - not_self: el actor no puede elegirse a si mismo.
// - not_same_faction: actor y objetivo no pueden pertenecer a la misma faccion.
// - distinct: se valida en validateActionTargets porque necesita ver toda la
//   lista de objetivos, no un objetivo aislado.
//
// Iremos anadiendo filtros cuando haya reglas reales que los necesiten.
export function targetMatchesFilter({ filter, actor, target, session, action }) {
  if (filter === 'in_play') return target?.inPlay === true;
  if (filter === 'not_self') return actor?.id !== target?.id;
  if (filter === 'not_same_faction') return actor?.factionId !== target?.factionId;
  return true;
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
export function validateActionTargets({ session, action, actor, actorScope = null, targets }) {
  const errors = [];
  const expectedCount = action?.target?.count ?? 0;
  const filters = action?.target?.filters ?? [];

  if (!actor && !canUseActorScopeAsSource({ action, actorScope })) {
    errors.push({
      code: 'action/missing-actor',
      message: 'action has no actor role instance'
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

  if (filters.includes('distinct')) {
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

    filters.forEach((filter) => {
      if (!targetMatchesFilter({ filter, actor, target, session, action })) {
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

  if (action?.id === ACTION_IDS.SET_IN_PLAY) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_PROPERTY) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'set_in_play requires a set_property effect'
      });
    }
    if (effect.targetType !== 'role_instance') {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'set_in_play currently requires targetType "role_instance"'
      });
    }
    if (effect.property !== 'inPlay') {
      errors.push({
        code: 'action/invalid-effect-property',
        message: 'set_in_play requires effect.property "inPlay"'
      });
    }
    if (typeof effect.value !== 'boolean') {
      errors.push({
        code: 'action/invalid-effect-value',
        message: 'set_in_play requires a boolean effect.value'
      });
    }
  }

  if (action?.id === ACTION_IDS.BLOCK_ACTION) {
    const blockedAction = action?.effect?.blocks;
    if (action?.effect?.type !== EFFECT_TYPES.BLOCK_ACTION) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: `${action.id} requires a block_action effect`
      });
    }
    if (!blockedAction?.actionId) {
      errors.push({
        code: 'action/missing-blocked-action',
        message: `${action.id} requires effect.blocks.actionId`
      });
    }
  }

  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    const effect = action?.effect ?? {};
    if (effect.type !== EFFECT_TYPES.SET_RELATION) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'link_targets requires a set_relation effect'
      });
    }
    if (effect.targetType !== 'relation') {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'link_targets requires targetType "relation"'
      });
    }
    if (!effect.relationType) {
      errors.push({
        code: 'action/missing-relation-type',
        message: 'link_targets requires effect.relationType'
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
export function validateActionResolution({ session, action, actor, actorScope = null, targets }) {
  const definitionValidation = validateActionDefinition(action);
  const targetValidation = validateActionTargets({ session, action, actor, actorScope, targets });
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
// reveal_property roleId sobre hidden_role-0 devuelve que su roleId es enemy.
export function applyRevealPropertyEffect({ action, actor, targets }) {
  const property = action?.effect?.property;
  const visibility = action?.visibility ?? VISIBILITY.ACTOR_ONLY;

  return {
    type: EFFECT_TYPES.REVEAL_PROPERTY,
    visibility,
    actorRoleInstanceId: actor.id,
    reveals: targets.map((target) => ({
      targetRoleInstanceId: target.id,
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
export function getBlockableActionDescriptor(action) {
  if (action?.id === ACTION_IDS.SET_IN_PLAY) {
    return {
      actionId: action.id,
      params: {
        property: action?.effect?.property ?? 'inPlay',
        value: action?.effect?.value
      }
    };
  }

  return {
    actionId: action?.id ?? 'unknown',
    params: action?.params ?? {}
  };
}

// Devuelve la descripcion de accion que un bloqueo guarda como bloqueada.
//
// Ejemplo conceptual:
// block_action(set_in_play, { property: 'inPlay', value: false }; target)
//
// En datos queda dividido asi:
// - action.effect.blocks guarda set_in_play + params;
// - input.targetRoleInstanceIds guarda target;
// - role.flags.blockedActions guarda la clave en el propio objetivo.
export function getBlockedActionDescriptor(action) {
  return action?.effect?.blocks ?? {
    actionId: 'unknown',
    params: {}
  };
}

// Devuelve true si el objetivo tiene bloqueada esta accion concreta.
export function isActionBlockedForTarget({ action, target }) {
  return hasActionBlock(target, getBlockableActionDescriptor(action));
}

// Traduce efectos/bloqueos a un resultado resumido de historial.
//
// El detalle completo queda guardado en proposedEffects, finalEffects y
// blockedActions. Este campo sirve para consultas rapidas.
export function getHistoryResultFromResolution({ finalEffects = [], blockedActions = [] } = {}) {
  const hasFinalEffects = (finalEffects ?? []).length > 0;
  const hasBlockedActions = (blockedActions ?? []).length > 0;

  if (hasFinalEffects && hasBlockedActions) return HISTORY_RESULTS.PARTIAL;
  if (hasFinalEffects) return HISTORY_RESULTS.APPLIED;
  if (hasBlockedActions) return HISTORY_RESULTS.BLOCKED;
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
    if (effect?.type === EFFECT_TYPES.SET_RELATION) {
      return applySetRelationEffect({ session: currentSession, effect });
    }
    return currentSession;
  }, session);
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
  const actorScope = context.actorScope ?? null;
  const blockedTargetIds = new Set(
    targets
      .filter((target) => isActionBlockedForTarget({ action, target }))
      .map((target) => target.id)
  );
  const proposedEffects = targets
    .filter((target) => !blockedTargetIds.has(target.id))
    .map((target) => ({
      ...action.effect,
      targetId: target.id
  }));
  const effectResolution = resolveProposedEffects({ session, proposedEffects });
  const { finalEffects } = effectResolution;
  const blockedActions = [...blockedTargetIds].map((targetId) => ({
    actionId: action.id,
    reason: 'blocked_action',
    targetId
  }));
  const nextSession = appendActionHistory(applyFinalEffects({ session, finalEffects }), {
    cycleId: currentCycleId,
    poolKey: context.poolKey ?? null,
    stepKey: context.stepKey ?? null,
    actionKey: context.actionKey ?? action.key ?? action.id,
    actionId: action.id,
    actionSignature: getActionHistorySignature(action),
    actorRoleInstanceId: actor?.id ?? null,
    actorScope,
    targetRoleInstanceIds: targets.map((target) => target.id),
    proposedEffects,
    finalEffects,
    blockedActions,
    blockedEffects: effectResolution.blockedEffects,
    result: getHistoryResultFromResolution({
      finalEffects,
      blockedActions
    })
  });

  return {
    session: nextSession,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorRoleInstanceId: actor?.id ?? null,
      actorScope,
      targets: targets.map((target) => ({
        targetRoleInstanceId: target.id,
        actionAttempted: true,
        actionBlocked: blockedTargetIds.has(target.id),
        failureReason: blockedTargetIds.has(target.id) ? 'blocked_action' : null
      })),
      proposedEffects,
      finalEffects,
      blockedActions,
      blockedEffects: effectResolution.blockedEffects
    }
  };
}

// Aplica un bloqueo temporal contra una accion.
//
// block_action es la primitiva del motor. Una receta como block_out_of_play
// puede definirse encima de ella indicando:
//
// {
//   actionId: 'set_in_play',
//   params: { property: 'inPlay', value: false }
// }
//
// Esta accion es anticipada, no reactiva:
// - Si se aplica antes de set_in_play, ese intento falla contra el objetivo.
// - Si el objetivo ya no esta en juego, el filtro in_play la rechaza.
export function applyBlockAction({ session, action, actor, targets, context = {} }) {
  const blockedAction = getBlockedActionDescriptor(action);
  const blockKey = getActionBlockKey(blockedAction);
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const targetIds = new Set(targets.map((target) => target.id));

  const sessionWithBlock = {
    ...session,
    roleInstances: (session.roleInstances ?? []).map((role) => {
      if (!targetIds.has(role.id)) return role;

      const blockedActions = {
        ...(role.flags?.blockedActions ?? {}),
        [blockKey]: true
      };
      const nextFlags = {
        ...(role.flags ?? {}),
        blockedActions
      };

      return {
        ...role,
        flags: nextFlags
      };
    })
  };
  const nextSession = appendActionHistory(sessionWithBlock, {
    cycleId: currentCycleId,
    poolKey: context.poolKey ?? null,
    stepKey: context.stepKey ?? null,
    actionKey: context.actionKey ?? action.key ?? action.id,
    actionId: action?.id ?? ACTION_IDS.BLOCK_ACTION,
    actionSignature: getActionHistorySignature(action),
    actorRoleInstanceId: actor.id,
    targetRoleInstanceIds: targets.map((target) => target.id),
    blockKey,
    blockedAction,
    result: HISTORY_RESULTS.APPLIED
  });

  return {
    session: nextSession,
    result: {
      type: EFFECT_TYPES.BLOCK_ACTION,
      visibility,
      actorRoleInstanceId: actor.id,
      blockKey,
      blockedAction,
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetRoleInstanceId: target.id,
        blockedAction: blockKey
      }))
    }
  };
}

// Aplica una relacion creada por link_targets.
//
// Separacion conceptual:
// - link_targets es la accion: alguien intenta enlazar objetivos.
// - set_relation es el efecto final: se escribe una relacion en la sesion.
// - linked se interpreta despues en resolverModel cuando otro efecto lo active.
export function applyLinkTargets({ session, action, actor, targets }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const proposedEffects = [
    {
      ...action.effect,
      roleInstanceIds: targets.map((target) => target.id),
      sourceActionId: action.id
    }
  ];
  const effectResolution = resolveProposedEffects({ session, proposedEffects });
  const nextSession = applyFinalEffects({ session, finalEffects: effectResolution.finalEffects });

  return {
    session: nextSession,
    result: {
      type: 'action_resolution',
      visibility,
      actionId: action.id,
      actorRoleInstanceId: actor.id,
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetRoleInstanceId: target.id
      })),
      proposedEffects: effectResolution.proposedEffects,
      finalEffects: effectResolution.finalEffects,
      blockedEffects: effectResolution.blockedEffects
    }
  };
}

// Resuelve una votacion pura.
//
// voteModel solo cuenta votos y decide ganador/empate/nulo. No aplica efectos.
// Si una receta quiere hacer algo con el ganador, debe definir onWinnerAction y
// dejar que recipeModel ejecute esa accion despues.
export function applyVote({ session, action, input = {} }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  const voteResolution = resolveVoteRound({
    session,
    votes: input.votes ?? [],
    tiePolicy: action?.tiePolicy ?? input.tiePolicy ?? VOTE_TIE_POLICIES.NULL_ON_TIE,
    roundType: input.roundType ?? VOTE_ROUND_TYPES.INITIAL,
    allowedTargetRoleInstanceIds:
      input.allowedTargetRoleInstanceIds ?? action?.allowedTargetRoleInstanceIds ?? null,
    requiredVotes: action?.requiredVotes ?? input.requiredVotes ?? VOTE_REQUIRED_POLICIES.OPTIONAL,
    relationRestrictions: action?.relationRestrictions ?? input.relationRestrictions ?? []
  });

  if (!voteResolution.ok) {
    return {
      ok: false,
      errors: voteResolution.errors,
      session,
      result: null
    };
  }

  if (voteResolution.result.type !== VOTE_OUTCOME_TYPES.WINNER) {
    return {
      ok: true,
      errors: [],
      session,
      result: {
        type: 'action_resolution',
        visibility,
        actionId: action.id,
        vote: voteResolution.result,
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
      vote: voteResolution.result,
      proposedEffects: [],
      finalEffects: [],
      blockedEffects: []
    }
  };
}

// Cierra la cola de efectos pendientes del ciclo actual.
//
// En esta version todavia no tenemos una cola real de efectos pendientes. Las
// acciones actuales resuelven y aplican sus efectos inmediatamente. Aun asi,
// mantenemos esta accion de sistema para cerrar ciclo, limpiar bloqueos
// temporales y avanzar currentCycleId.
//
// Despues limpia flags temporales para empezar el siguiente ciclo sin basura:
// - blockedActions.
export function applyResolvePendingEffects({ session, action }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  return applyResolvePendingEffectsFromModel({ session, visibility });
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
  const actor = getActionActor(session, action, input.actorRoleInstanceId);
  const targets = (input.targetRoleInstanceIds ?? []).map((id) => findRoleInstance(session, id));
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
// 3. Valida count + filtros, por ejemplo in_play y not_same_faction.
// 4. Ejecuta el intento de cambiar inPlay.
// 5. Si el objetivo tenia bloqueada esa accion, no genera efecto final.
// 6. Si no estaba bloqueada, aplica set_property inPlay=value.
export function resolveSetInPlay(session, action, input = {}, context = {}) {
  const actor = getActionActor(session, action, input.actorRoleInstanceId);
  const targets = (input.targetRoleInstanceIds ?? []).map((id) => findRoleInstance(session, id));
  const actorScope = input.actorScope ?? context.actorScope ?? action.actorScope ?? null;
  const validation = validateActionResolution({ session, action, actor, actorScope, targets });

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
    context: {
      ...context,
      actorScope
    }
  });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta block_action o una receta basada en block_action.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count y filtros. Las restricciones ya las valido recipeModel.
// 4. Marca al objetivo como prevenido contra la accion indicada.
// 5. Registra el bloqueo aplicado en session.actionHistory.
export function resolveBlockAction(session, action, input = {}, context = {}) {
  const actor = getActionActor(session, action, input.actorRoleInstanceId);
  const targets = (input.targetRoleInstanceIds ?? []).map((id) => findRoleInstance(session, id));
  const validation = validateActionResolution({ session, action, actor, targets });

  if (!validation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.BLOCK_ACTION,
      errors: validation.errors,
      session,
      result: null
    };
  }

  const applied = applyBlockAction({ session, action, actor, targets, context });

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
// Esta accion no decide que significa narrativamente el vinculo. Solo crea una
// relacion mecanica en session.relations. Por ejemplo, una skin podria llamarlo
// enamorar, sincronizar, esposar, conectar destinos o cualquier otra fantasia.
export function resolveLinkTargets(session, action, input = {}) {
  const actor = getActionActor(session, action, input.actorRoleInstanceId);
  const targets = (input.targetRoleInstanceIds ?? []).map((id) => findRoleInstance(session, id));
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

  const applied = applyLinkTargets({ session, action, actor, targets });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta vote.
//
// La accion no recibe un actor unico porque representa una ronda colectiva de
// votos. Cada voto individual ya trae su actorRoleInstanceId.
export function resolveVote(session, action, input = {}) {
  const definitionValidation = validateActionDefinition(action);

  if (!definitionValidation.ok) {
    return {
      ok: false,
      actionId: action?.id ?? ACTION_IDS.VOTE,
      errors: definitionValidation.errors,
      session,
      result: null
    };
  }

  const applied = applyVote({ session, action, input });

  return {
    ok: applied.ok,
    actionId: action.id,
    errors: applied.errors,
    session: applied.session,
    result: applied.result
  };
}

// Ejecuta resolve_pending_effects.
//
// Esta accion normalmente la ejecutara el sistema al final de la noche o al
// inicio del dia. Por eso no exige actor ni objetivos manuales.
export function resolvePendingEffects(session, action) {
  const applied = applyResolvePendingEffects({ session, action });

  return {
    ok: true,
    actionId: action?.id ?? ACTION_IDS.RESOLVE_PENDING_EFFECTS,
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
// - block_action
// - block_out_of_play
// - link_targets
// - vote
// - resolve_pending_effects
//
// Las proximas acciones genericas se conectaran aqui.
export function resolveAction(session, action, input = {}, context = {}) {
  if (action?.id === ACTION_IDS.INSPECT_ROLE) {
    return resolveInspectRole(session, action, input);
  }
  if (action?.id === ACTION_IDS.SET_IN_PLAY) {
    return resolveSetInPlay(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.BLOCK_ACTION) {
    return resolveBlockAction(session, action, input, context);
  }
  if (action?.id === ACTION_IDS.LINK_TARGETS) {
    return resolveLinkTargets(session, action, input);
  }
  if (action?.id === ACTION_IDS.VOTE) {
    return resolveVote(session, action, input);
  }
  if (action?.id === ACTION_IDS.RESOLVE_PENDING_EFFECTS) {
    return resolvePendingEffects(session, action);
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

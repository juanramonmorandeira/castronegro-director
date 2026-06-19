// actionModel.js
// -----------------------------------------------------------------------------
// Este archivo ejecuta acciones genericas del motor.
//
// Acciones implementadas por ahora:
// - inspect_role: revela informacion.
// - set_in_play: intenta cambiar si un objetivo sigue en el juego principal.
// - block_action: bloquea una accion concreta contra un objetivo.
// - link_targets: crea un grupo mecanico entre varios objetivos.
// - select: resuelve una seleccion y devuelve chosen/empate/nulo.
// - start_cycle: prepara un nuevo ciclo y limpia efectos temporales.
// - conclude_play: concluye la parte jugable desde una automaticStage final.
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
  applyConcludePlay as applyConcludePlayFromModel,
  applyStartCycle as applyStartCycleFromModel,
  applySetGroupEffect,
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
  SELECTION_OUTCOME_TYPES,
  SELECTION_ROUND_TYPES,
  resolveSelectionRound
} from './selectionModel.js';

export const ACTION_IDS = Object.freeze({
  INSPECT_ROLE: 'inspect_role',
  SET_IN_PLAY: 'set_in_play',
  BLOCK_ACTION: 'block_action',
  LINK_TARGETS: 'link_targets',
  SELECT: 'select',
  START_CYCLE: 'start_cycle',
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
  const needsIndividualActor = filters.includes('not_self') || filters.includes('not_same_alignment');

  return !needsIndividualActor;
}

// Comprueba si un objetivo cumple un filtro.
//
// Por ahora implementamos solo los filtros que necesitan inspect_role y
// set_in_play y block_action:
// - in_play: el objetivo debe seguir participando en la partida principal.
// - not_self: el actor no puede elegirse a si mismo.
// - not_same_alignment: actor y objetivo no pueden pertenecer al mismo alignment.
// - distinct: se valida en validateActionTargets porque necesita ver toda la
//   lista de objetivos, no un objetivo aislado.
//
// Iremos anadiendo filtros cuando haya reglas reales que los necesiten.
export function targetMatchesFilter({ filter, actor, target, session, action }) {
  if (filter === 'in_play') return target?.inPlay === true;
  if (filter === 'not_self') return actor?.id !== target?.id;
  if (filter === 'not_same_alignment') {
    return actor?.alignmentId !== target?.alignmentId;
  }
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
export function validateActionTargets({
  session,
  action,
  actor,
  targets
}) {
  const errors = [];
  const expectedCount = action?.target?.count ?? 0;
  const filters = action?.target?.filters ?? [];

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
    if (effect.targetType !== 'role') {
      errors.push({
        code: 'action/invalid-effect-target-type',
        message: 'set_in_play currently requires targetType "role"'
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
    if (effect.type !== EFFECT_TYPES.SET_GROUP) {
      errors.push({
        code: 'action/invalid-effect-type',
        message: 'link_targets requires a set_group effect'
      });
    }
    if (effect.targetType !== 'group') {
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
// - input.targetIds guarda target;
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
    if (effect?.type === EFFECT_TYPES.SET_GROUP) {
      return applySetGroupEffect({ session: currentSession, effect });
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
    stageKey: context.stageKey ?? null,
    actionKey: context.actionKey ?? action.key ?? action.id,
    actionId: action.id,
    actionSignature: getActionHistorySignature(action),
    actorIds: actor ? [actor.id] : [],
    targetIds: targets.map((target) => target.id),
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
      actorIds: actor ? [actor.id] : [],
      targets: targets.map((target) => ({
        targetId: target.id,
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
    roles: (session.roles ?? []).map((role) => {
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
    stageKey: context.stageKey ?? null,
    actionKey: context.actionKey ?? action.key ?? action.id,
    actionId: action?.id ?? ACTION_IDS.BLOCK_ACTION,
    actionSignature: getActionHistorySignature(action),
    actorIds: [actor.id],
    targetIds: targets.map((target) => target.id),
    blockKey,
    blockedAction,
    result: HISTORY_RESULTS.APPLIED
  });

  return {
    session: nextSession,
    result: {
      type: EFFECT_TYPES.BLOCK_ACTION,
      visibility,
      actorIds: [actor.id],
      blockKey,
      blockedAction,
      cycleId: currentCycleId,
      targets: targets.map((target) => ({
        targetId: target.id,
        blockedAction: blockKey
      }))
    }
  };
}

// Aplica un grupo creado por link_targets.
//
// Separacion conceptual:
// - link_targets es la accion: alguien intenta enlazar objetivos.
// - set_group es el efecto final: se escribe un grupo en la sesion.
// - linked se interpreta despues en resolverModel cuando otro efecto lo active.
export function applyLinkTargets({ session, action, actor, targets }) {
  const visibility = action?.visibility ?? VISIBILITY.STORYTELLER_ONLY;
  const currentCycleId = getCurrentCycleId(session);
  const proposedEffects = [
    {
      ...action.effect,
      roleIds: targets.map((target) => target.id),
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
    roundType: input.roundType ?? SELECTION_ROUND_TYPES.INITIAL
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
// currentCycleId antes del siguiente poolConcealed.
//
// Limpia flags temporales para empezar el siguiente ciclo sin basura:
// - blockedActions.
export function applyStartCycleAction({ session, action }) {
  const visibility = action?.visibility ?? VISIBILITY.ALL;
  return applyStartCycleFromModel({ session, visibility });
}

// Ejecuta conclude_play.
//
// Esta accion la dispara una automaticStage final cuando el playOutcome ya es
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

// Ejecuta block_action o una receta basada en block_action.
//
// Flujo:
// 1. Busca al actor.
// 2. Busca el objetivo.
// 3. Valida count y filtros. Las restricciones ya las valido recipeModel.
// 4. Marca al objetivo como prevenido contra la accion indicada.
// 5. Registra el bloqueo aplicado en session.actionHistory.
export function resolveBlockAction(session, action, input = {}, context = {}) {
  const actors = getActionActors(session, input.actorIds ?? []);
  const actor = actors[0] ?? null;
  const targets = (input.targetIds ?? []).map((id) => findRole(session, id));
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

  const applied = applyLinkTargets({ session, action, actor, targets });

  return {
    ok: true,
    actionId: action.id,
    errors: [],
    session: applied.session,
    result: applied.result
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

// Ejecuta start_cycle.
//
// Esta accion normalmente la ejecutara el sistema al comenzar un ciclo normal.
// Por eso no exige actor ni objetivos manuales.
export function resolveStartCycle(session, action) {
  const applied = applyStartCycleAction({ session, action });

  return {
    ok: true,
    actionId: action?.id ?? ACTION_IDS.START_CYCLE,
    errors: [],
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
// - block_action
// - block_out_of_play
// - link_targets
// - select
// - start_cycle
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
  if (action?.id === ACTION_IDS.SELECT) {
    return resolveSelection(session, action, input);
  }
  if (action?.id === ACTION_IDS.START_CYCLE) {
    return resolveStartCycle(session, action);
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

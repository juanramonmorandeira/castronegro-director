// effectResolver.js
// -----------------------------------------------------------------------------
// Este archivo contiene el resolver de efectos propuestos.
//
// Responsabilidad:
// - recibe efectos propuestos por una accion;
// - decide cuales generan consecuencias sistemicas;
// - devuelve efectos finales y explicaciones.
//
// No aplica cambios en la sesion. Eso pertenece a effectModel.js.
// No valida inputs de acciones. Eso pertenece a actionModel.js.
// -----------------------------------------------------------------------------

import { EFFECT_TYPES } from './effectModel.js';
import { getGroupRuleEffects, getLinkedPropagatedEffects } from './groupModel.js';
import { isPropertyChangeBlocked } from './roleModel.js';

// Resuelve una lista de efectos propuestos contra el estado actual.
//
// Flujo:
// 1. Toma los efectos propuestos por una accion.
// 2. Acepta los efectos propuestos como efectos finales.
// 3. Consulta las groupRules de los groups afectados.
// 4. Encola las consecuencias derivadas que no esten bloqueadas ni duplicadas.
export function resolveProposedEffects({ session, proposedEffects = [] } = {}) {
  const finalEffects = [];
  const blockedEffects = [];
  const linkedPropagatedEffects = [];
  const queuedEffects = [...(proposedEffects ?? [])];
  const seenAttemptKeys = new Set();
  const acceptedEffectKeys = new Set();

  while (queuedEffects.length > 0) {
    const effect = queuedEffects.shift();
    const attemptKey = getEffectKey(effect);
    if (seenAttemptKeys.has(attemptKey)) continue;
    seenAttemptKeys.add(attemptKey);

    const target = findEffectTarget(session, effect);
    const responsibleActorId = effect.causedBy?.id ?? null;
    if (
      effect.type === EFFECT_TYPES.SET_PROPERTY &&
      target &&
      isPropertyChangeBlocked(target, {
        property: effect.property,
        value: effect.value,
        actorIds: responsibleActorId ? [responsibleActorId] : []
      })
    ) {
      blockedEffects.push({
        ...effect,
        reason: 'blocked_property_change'
      });
      continue;
    }

    const acceptedEffectKey = getEffectStateKey(effect);
    if (acceptedEffectKeys.has(acceptedEffectKey)) continue;
    acceptedEffectKeys.add(acceptedEffectKey);
    finalEffects.push(effect);
    linkedPropagatedEffects.push(...getLinkedPropagatedEffects({ session, effect }));

    getGroupRuleEffects({ session, effect }).forEach((derivedEffect) => {
      if (!seenAttemptKeys.has(getEffectKey(derivedEffect))) {
        queuedEffects.push(derivedEffect);
      }
    });
  }

  return {
    proposedEffects: [...(proposedEffects ?? [])],
    finalEffects,
    blockedEffects,
    linkedPropagatedEffects
  };
}

// Busca el objetivo principal de un efecto.
//
// Por ahora solo resolvemos role porque es lo unico que usan las demos.
// Cuando existan efectos sobre sesion, alignment o relaciones, se ampliara aqui.
export function findEffectTarget(session, effect) {
  if (effect?.targetType !== 'role') return null;
  return (session?.roles ?? []).find((role) => role.id === effect.targetId) ?? null;
}

// Genera una clave para no resolver el mismo cambio dos veces.
//
// Es especialmente importante en propagaciones: A puede producir un cambio en
// B y una segunda regla intentar producir el mismo cambio de vuelta en A.
export function getEffectKey(effect = {}) {
  return [
    effect.type ?? '',
    effect.targetType ?? '',
    effect.targetId ?? '',
    effect.property ?? '',
    String(effect.value),
    effect.causedBy?.type ?? '',
    effect.causedBy?.id ?? '',
    effect.groupType ?? '',
    (effect.roleIds ?? []).slice().sort().join(',')
  ].join(':');
}

// Identidad del cambio final, independiente de quien lo haya causado.
//
// Dos causas pueden intentar el mismo cambio. Si la primera queda bloqueada, la
// segunda todavia debe evaluarse. Cuando una causa ya fue aceptada, no volvemos
// a aplicar ni a publicar el mismo estado final.
export function getEffectStateKey(effect = {}) {
  return [
    effect.type ?? '',
    effect.targetType ?? '',
    effect.targetId ?? '',
    effect.property ?? '',
    String(effect.value),
    effect.groupType ?? '',
    (effect.roleIds ?? []).slice().sort().join(',')
  ].join(':');
}

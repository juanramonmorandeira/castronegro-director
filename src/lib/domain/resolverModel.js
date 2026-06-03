// resolverModel.js
// -----------------------------------------------------------------------------
// Este archivo contiene el resolver del motor.
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
import { RELATION_TYPES, getRelatedRoleInstanceIds } from './sessionModel.js';

// Resuelve una lista de efectos propuestos contra el estado actual.
//
// Flujo:
// 1. Toma los efectos propuestos por una accion.
// 2. Acepta los efectos propuestos como efectos finales.
// 3. Si un efecto final hace inPlay=false, genera efectos derivados para los
//    roles linked al objetivo.
//
// Importante: linked solo se propaga desde efectos aceptados. Si una accion fue
// bloqueada antes de proponer efectos, no hay inPlay=false final y por tanto no
// hay salida vinculada.
export function resolveProposedEffects({ session, proposedEffects = [] } = {}) {
  const finalEffects = [];
  const queuedEffects = [...(proposedEffects ?? [])];
  const seenEffectKeys = new Set(queuedEffects.map(getEffectKey));

  while (queuedEffects.length > 0) {
    const effect = queuedEffects.shift();
    finalEffects.push(effect);

    getLinkedSetInPlayFalseEffects({ session, effect, seenEffectKeys }).forEach((linkedEffect) => {
      queuedEffects.push(linkedEffect);
      seenEffectKeys.add(getEffectKey(linkedEffect));
    });
  }

  return {
    proposedEffects: [...(proposedEffects ?? [])],
    finalEffects,
    // Mantenemos este campo para que la forma del reporte pueda crecer sin
    // romper demos/UI cuando existan bloqueos de efectos reales.
    blockedEffects: []
  };
}

// Busca el objetivo principal de un efecto.
//
// Por ahora solo resolvemos role_instance porque es lo unico que usan las demos.
// Cuando existan efectos sobre sesion, alignment o relaciones, se ampliara aqui.
export function findEffectTarget(session, effect) {
  if (effect?.targetType !== 'role_instance') return null;
  return (session?.roleInstances ?? []).find((role) => role.id === effect.targetId) ?? null;
}

// Devuelve true si el efecto significa "este roleInstance sale del juego activo".
//
// No lo llamamos kill_target porque no describe una accion narrativa. Describe
// el cambio mecanico que el aplicador podra escribir en la sesion.
export function isSetInPlayFalseEffect(effect) {
  return (
    effect?.type === EFFECT_TYPES.SET_PROPERTY &&
    effect?.targetType === 'role_instance' &&
    effect?.property === 'inPlay' &&
    effect?.value === false &&
    !!effect?.targetId
  );
}

// Crea efectos derivados por la relacion linked.
//
// Ejemplo:
// - efecto final: set_property role_a-0.inPlay=false
// - relacion: linked [role_a-0, role_b-0]
// - derivado: set_property role_b-0.inPlay=false
//
// Estos efectos derivados vuelven a pasar por el mismo resolver. Eso importa
// porque un derivado tambien puede propagar a otro
// linked en relaciones mas amplias.
export function getLinkedSetInPlayFalseEffects({ session, effect, seenEffectKeys = new Set() }) {
  if (!isSetInPlayFalseEffect(effect)) return [];

  return getRelatedRoleInstanceIds(session, effect.targetId, RELATION_TYPES.LINKED)
    .map((targetId) => ({
      ...effect,
      targetId,
      derivedFrom: {
        type: 'relation',
        relationType: RELATION_TYPES.LINKED,
        sourceTargetId: effect.targetId
      }
    }))
    .filter((linkedEffect) => !seenEffectKeys.has(getEffectKey(linkedEffect)));
}

// Genera una clave para no resolver el mismo cambio dos veces.
//
// Es especialmente importante con linked: A puede apuntar a B y B puede apuntar
// de vuelta a A. Sin esta clave, la propagacion entraria en bucle.
export function getEffectKey(effect = {}) {
  return [
    effect.type ?? '',
    effect.targetType ?? '',
    effect.targetId ?? '',
    effect.property ?? '',
    String(effect.value),
    effect.relationType ?? '',
    (effect.roleInstanceIds ?? []).slice().sort().join(',')
  ].join(':');
}

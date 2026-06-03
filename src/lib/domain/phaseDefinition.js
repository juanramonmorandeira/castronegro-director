// phaseDefinition.js
// -----------------------------------------------------------------------------
// Organizador/validador de definiciones de fase por skin/flavor.
//
// Responsabilidad:
// - recibir steps ya construidos;
// - validar el uso de order;
// - ordenar steps dentro de pools configurables;
// - crear phasePools listos para que phaseModel los ejecute.
//
// No construye el contenido de un step. Eso pertenece a
// stepDefinition.js.
// -----------------------------------------------------------------------------

import { createPhasePoolsFromDefinition } from './phaseModel.js';
import { POOL_KEYS } from './sessionModel.js';

// Pools cuyo orden interno podria ser configurable por skin/flavor.
//
// poolSpecial queda fuera deliberadamente: sus reglas son interrupciones
// o resoluciones especiales del motor y no deberian reordenarse por flavor.
export const CONFIGURABLE_STEP_ORDER_POOLS = Object.freeze([
  POOL_KEYS.POOL_EXPOSED,
  POOL_KEYS.POOL_CONCEALED
]);

// Nombre recomendado para la propiedad de orden declarativo.
//
// Preferimos "order" a "weight" porque no pondera nada. Indica una posicion de
// construccion. Dos steps del mismo pool no pueden compartir el mismo order.
export const PHASE_DEFINITION_ORDER_FIELD = 'order';

export const PHASE_DEFINITION_ERRORS = Object.freeze({
  ORDER_NOT_ALLOWED: 'phase-definition/order-not-allowed',
  INVALID_ORDER: 'phase-definition/invalid-order',
  DUPLICATE_ORDER: 'phase-definition/duplicate-order'
});

export function isConfigurableStepOrderPool(poolKey) {
  return CONFIGURABLE_STEP_ORDER_POOLS.includes(poolKey);
}

// Valida el uso de order dentro de una definicion de pools.
//
// Si hay orders duplicados, es error de definicion de skin. No hay empate ni
// desempate automatico.
export function validatePhaseDefinitionOrder(definition = {}) {
  const errors = [];
  const pools = definition.pools ?? {};

  Object.entries(pools).forEach(([poolKey, steps = []]) => {
    const seenOrders = new Map();

    (steps ?? []).forEach((step = {}, index) => {
      const hasOrder =
        step[PHASE_DEFINITION_ORDER_FIELD] !== undefined &&
        step[PHASE_DEFINITION_ORDER_FIELD] !== null;
      if (!hasOrder) return;

      if (!isConfigurableStepOrderPool(poolKey)) {
        errors.push({
          code: PHASE_DEFINITION_ERRORS.ORDER_NOT_ALLOWED,
          message: `pool "${poolKey}" does not accept configurable step order`,
          poolKey,
          stepKey: step.key ?? null,
          index
        });
        return;
      }

      const order = step[PHASE_DEFINITION_ORDER_FIELD];
      if (!Number.isFinite(order)) {
        errors.push({
          code: PHASE_DEFINITION_ERRORS.INVALID_ORDER,
          message: `step "${step.key ?? index}" has invalid order`,
          poolKey,
          stepKey: step.key ?? null,
          index,
          order
        });
        return;
      }

      if (seenOrders.has(order)) {
        errors.push({
          code: PHASE_DEFINITION_ERRORS.DUPLICATE_ORDER,
          message: `pool "${poolKey}" has duplicated order "${order}"`,
          poolKey,
          stepKey: step.key ?? null,
          index,
          order,
          firstIndex: seenOrders.get(order)
        });
        return;
      }

      seenOrders.set(order, index);
    });
  });

  return {
    ok: errors.length === 0,
    errors
  };
}

// Ordena solo los pools configurables. El resto conserva el orden declarado.
export function sortPhaseDefinitionPools(definition = {}) {
  const poolOrder = definition.poolOrder ?? Object.keys(definition.pools ?? {});
  const pools = poolOrder.reduce((acc, poolKey) => {
    const steps = [...(definition.pools?.[poolKey] ?? [])];

    acc[poolKey] = isConfigurableStepOrderPool(poolKey)
      ? steps.sort((a, b) => {
          const aOrder = Number.isFinite(a?.order) ? a.order : Number.POSITIVE_INFINITY;
          const bOrder = Number.isFinite(b?.order) ? b.order : Number.POSITIVE_INFINITY;
          return aOrder - bOrder;
        })
      : steps;

    return acc;
  }, {});

  return {
    ...definition,
    poolOrder,
    pools
  };
}

// Crea phasePools desde una definicion de skin/flavor ya compuesta de steps.
//
// stepDefinition construye cada step.
// phaseDefinition los ordena por pool.
export function createPhasePoolsFromSkinDefinition(definition = {}) {
  const validation = validatePhaseDefinitionOrder(definition);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      phasePools: null
    };
  }

  return {
    ok: true,
    errors: [],
    phasePools: createPhasePoolsFromDefinition(sortPhaseDefinitionPools(definition))
  };
}

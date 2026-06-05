// poolDefinition.js
// -----------------------------------------------------------------------------
// Constructor y organizador del contenedor runtime de pools.
//
// Un pool contiene steps ya creados. Este archivo no decide que hace cada step:
// solo prepara y ordena la estructura que poolCursorModel necesita para mover el
// cursor.
// -----------------------------------------------------------------------------

import { createStep } from './stepDefinition.js';
import { getGroupRoleIds } from './groupModel.js';
import { DEFAULT_POOL_ORDER, STEP_STATUSES, POOL_KEYS, normalizeId } from './sessionModel.js';

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
export const POOL_DEFINITION_ORDER_FIELD = 'order';

export const POOL_DEFINITION_ERRORS = Object.freeze({
  ORDER_NOT_ALLOWED: 'pool-definition/order-not-allowed',
  INVALID_ORDER: 'pool-definition/invalid-order',
  DUPLICATE_ORDER: 'pool-definition/duplicate-order',
  MISSING_POOL_KEY: 'pool-definition/missing-pool-key',
  EMPTY_ACTOR_IDS: 'pool-definition/empty-actor-ids'
});

// Normaliza un step antes de meterlo dentro del contenedor runtime de pools.
//
// createStep, en stepDefinition.js, es el unico constructor conceptual de
// steps. Esta funcion no se exporta porque no queremos dos puertas publicas
// para crear el mismo tipo de objeto. Solo conserva compatibilidad con datos
// antiguos que todavia traen `action` en vez de `actions`.
function normalizePoolStep({
  key,
  status = STEP_STATUSES.DISABLED,
  actorIds = [],
  action = null,
  actions = null,
  completion = null,
  voteRules = null,
  order = null,
  metadata = {}
} = {}) {
  const normalizedActions = Array.isArray(actions)
    ? actions.map((entry) => ({ ...entry }))
    : action
      ? [{ ...action }]
      : [];

  return {
    key: normalizeId(key),
    status,
    actorIds: [...(actorIds ?? [])],
    completion: completion
      ? {
          ...completion,
          allowedRequesters: Array.isArray(completion.allowedRequesters)
            ? [...completion.allowedRequesters]
            : []
        }
      : null,
    voteRules: voteRules
      ? {
          ...voteRules,
          relationRestrictions: (voteRules.relationRestrictions ?? []).map((restriction) => ({
            ...restriction
          })),
          candidateIds: Array.isArray(voteRules.candidateIds)
            ? [...voteRules.candidateIds]
            : null
        }
      : null,
    actions: normalizedActions,
    action: action ? { ...action } : null,
    order: Number.isFinite(order) ? order : null,
    metadata: { ...metadata }
  };
}

export function createPool({
  poolOrder = DEFAULT_POOL_ORDER,
  poolCurrent = poolOrder[0],
  poolPrevious = null,
  poolNext = poolOrder[1] ?? null,
  poolCurrentStepIndex = 0,
  pools = {}
} = {}) {
  const normalizedOrder = poolOrder.map(String);
  const normalizedPools = normalizedOrder.reduce((acc, poolKey) => {
    acc[poolKey] = (pools[poolKey] ?? []).map(normalizePoolStep);
    return acc;
  }, {});

  return {
    poolOrder: normalizedOrder,
    poolCurrent,
    poolPrevious,
    poolNext,
    poolCurrentStepIndex,
    pools: normalizedPools
  };
}

// Construye los steps de un unico pool.
//
// buildStepPool no decide orden global ni mueve cursores. Solo garantiza que
// cada step queda construido con createStep y asociado al pool indicado.
export function buildStepPool({ poolKey, steps = [] } = {}) {
  return (steps ?? []).map((step) =>
    createStep({
      ...step,
      poolKey: step.poolKey ?? poolKey
    })
  );
}

function getDefinitionList(definitions = []) {
  if (Array.isArray(definitions)) return definitions;
  return Object.values(definitions ?? {});
}

function getStepDefinitionsFromSources(sources = []) {
  return sources.flatMap((source = {}) => source.stepDefinitions ?? []);
}

function createStepWithActors(stepDefinition = {}, actorIds = [], source = {}) {
  return createStep({
    ...stepDefinition,
    actorIds,
    metadata: {
      ...(stepDefinition.metadata ?? {}),
      source
    }
  });
}

function getRoleDefinitionSteps(session = {}, roleDefinitions = []) {
  const roles = session.roles ?? [];

  return getDefinitionList(roleDefinitions).flatMap((roleDefinition = {}) => {
    const matchingRoles = roles.filter((role) => role.roleKey === roleDefinition.key);

    return matchingRoles.flatMap((role) =>
      (roleDefinition.stepDefinitions ?? []).map((stepDefinition) =>
        createStepWithActors(stepDefinition, [role.id], {
          type: 'role',
          id: role.id,
          key: roleDefinition.key
        })
      )
    );
  });
}

function getGroupDefinitionSteps(session = {}, groupDefinitions = []) {
  return getDefinitionList(groupDefinitions).flatMap((groupDefinition = {}) => {
    const groupId = groupDefinition.id ?? groupDefinition.key;
    const actorIds = getGroupRoleIds(session, groupId);

    return (groupDefinition.stepDefinitions ?? []).map((stepDefinition) =>
      createStepWithActors(stepDefinition, actorIds, {
        type: 'group',
        id: groupId,
        key: groupDefinition.key
      })
    );
  });
}

function getDirectSteps(steps = [], sourceType = 'direct') {
  return (steps ?? []).map((stepDefinition) =>
    createStepWithActors(stepDefinition, stepDefinition.actorIds ?? [], {
      type: sourceType
    })
  );
}

function getAbstractSourceSteps(sources = []) {
  return getStepDefinitionsFromSources(getDefinitionList(sources)).map(createStep);
}

function isSystemStep(step = {}) {
  return step.metadata?.source?.type === 'system';
}

function getStepDefinitionErrors(steps = []) {
  return (steps ?? []).flatMap((step, index) => {
    const errors = [];

    if (!step.poolKey) {
      errors.push({
        code: POOL_DEFINITION_ERRORS.MISSING_POOL_KEY,
        message: `step "${step.key ?? index}" has no poolKey`,
        stepKey: step.key ?? null,
        index
      });
    }

    if (
      step.status === STEP_STATUSES.ENABLED &&
      !isSystemStep(step) &&
      (step.actorIds ?? []).length === 0
    ) {
      errors.push({
        code: POOL_DEFINITION_ERRORS.EMPTY_ACTOR_IDS,
        message: `step "${step.key ?? index}" is enabled but has no actorIds`,
        stepKey: step.key ?? null,
        index,
        source: step.metadata?.source ?? null
      });
    }

    return errors;
  });
}

// Ensambla stepPools desde steps de sistema, roles y grupos.
//
// La construccion de cada step sigue perteneciendo a createStep. buildPools solo
// junta contribuciones, exige poolKey y delega validacion/orden en
// organizePoolSteps.
export function buildPools({
  poolOrder = DEFAULT_POOL_ORDER,
  defaultSteps = [],
  systemSteps = [],
  roleDefinitions = [],
  groupDefinitions = [],
  session = null
} = {}) {
  const allSteps = [
    ...getDirectSteps(defaultSteps, 'default'),
    ...getDirectSteps(systemSteps, 'system'),
    ...(session
      ? getRoleDefinitionSteps(session, roleDefinitions)
      : getAbstractSourceSteps(roleDefinitions)),
    ...(session
      ? getGroupDefinitionSteps(session, groupDefinitions)
      : getAbstractSourceSteps(groupDefinitions))
  ];
  const errors = getStepDefinitionErrors(allSteps);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      stepPools: null
    };
  }

  const pools = poolOrder.reduce((acc, poolKey) => {
    acc[poolKey] = buildStepPool({
      poolKey,
      steps: allSteps.filter((step) => step.poolKey === poolKey)
    });
    return acc;
  }, {});

  return organizePoolSteps({
    poolOrder,
    pools
  });
}

function isConfigurableStepOrderPool(poolKey) {
  return CONFIGURABLE_STEP_ORDER_POOLS.includes(poolKey);
}

// Valida el uso de order dentro de una definicion de pools.
//
// Si hay orders duplicados, es error de definicion de skin. No hay empate ni
// desempate automatico.
function validateStepsOrder(definition = {}) {
  const errors = [];
  const pools = definition.pools ?? {};

  Object.entries(pools).forEach(([poolKey, steps = []]) => {
    const seenOrders = new Map();

    (steps ?? []).forEach((step = {}, index) => {
      const hasOrder =
        step[POOL_DEFINITION_ORDER_FIELD] !== undefined &&
        step[POOL_DEFINITION_ORDER_FIELD] !== null;
      if (!hasOrder) return;

      if (!isConfigurableStepOrderPool(poolKey)) {
        errors.push({
          code: POOL_DEFINITION_ERRORS.ORDER_NOT_ALLOWED,
          message: `pool "${poolKey}" does not accept configurable step order`,
          poolKey,
          stepKey: step.key ?? null,
          index
        });
        return;
      }

      const order = step[POOL_DEFINITION_ORDER_FIELD];
      if (!Number.isFinite(order)) {
        errors.push({
          code: POOL_DEFINITION_ERRORS.INVALID_ORDER,
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
          code: POOL_DEFINITION_ERRORS.DUPLICATE_ORDER,
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
function getOrderedPoolSteps(definition = {}) {
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

// Organiza una definicion declarativa de pools ya compuesta de steps.
//
// stepDefinition construye cada step.
// poolDefinition los valida, los ordena y crea el contenedor runtime.
export function organizePoolSteps(definition = {}) {
  const validation = validateStepsOrder(definition);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      stepPools: null
    };
  }

  return {
    ok: true,
    errors: [],
    stepPools: createPool(getOrderedPoolSteps(definition))
  };
}

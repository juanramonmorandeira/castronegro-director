// poolDefinition.js
// -----------------------------------------------------------------------------
// Constructor y organizador de pools runtime.
//
// Un pool contiene stages ya creados. Este archivo no decide que hace cada stage:
// solo prepara y ordena la estructura que poolCursorModel necesita para mover el
// cursor.
// -----------------------------------------------------------------------------

import { assignUniqueStageIds, createStage, STAGE_SOURCE_TYPES } from './stageDefinition.js';
import { getGroupRoleIds } from './groupModel.js';
import { DEFAULT_POOL_ORDER, STAGE_STATUSES, POOL_KEYS, normalizeId } from './sessionModel.js';

// Pools cuyo orden interno puede ser configurable por ruleSet.
export const CONFIGURABLE_STAGE_ORDER_POOLS = Object.freeze([
  POOL_KEYS.POOL_EXPOSED,
  POOL_KEYS.POOL_CONCEALED
]);

// Nombre recomendado para la propiedad de orden declarativo.
//
// Preferimos "order" a "weight" porque no pondera nada. Indica una posicion de
// construccion. Dos stages del mismo pool no pueden compartir el mismo order.
export const POOL_DEFINITION_ORDER_FIELD = 'order';

export const POOL_DEFINITION_ERRORS = Object.freeze({
  ORDER_NOT_ALLOWED: 'pool-definition/order-not-allowed',
  INVALID_ORDER: 'pool-definition/invalid-order',
  DUPLICATE_ORDER: 'pool-definition/duplicate-order',
  MISSING_POOL_KEY: 'pool-definition/missing-pool-key',
  EMPTY_ACTOR_IDS: 'pool-definition/empty-actor-ids'
});

export const POOL_LIFECYCLE_OPERATION_TYPES = Object.freeze({
  REVIEW_PROPERTY_BLOCKS: 'review_property_blocks',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

function createLifecycleOperation(type, metadata = {}) {
  return {
    type: normalizeId(type),
    metadata: { ...metadata }
  };
}

function getDefaultLifecycleOperations() {
  return {
    onEnter: [],
    onExit: [
      createLifecycleOperation(POOL_LIFECYCLE_OPERATION_TYPES.REVIEW_PROPERTY_BLOCKS, {
        boundary: 'after'
      }),
      createLifecycleOperation(POOL_LIFECYCLE_OPERATION_TYPES.CHECK_OBJECTIVES, {
        reason: 'pool_completed'
      })
    ]
  };
}

function normalizeLifecycleOperations({ onEnter, onExit } = {}) {
  const defaults = getDefaultLifecycleOperations();
  return {
    onEnter: (onEnter ?? defaults.onEnter).map((operation) =>
      createLifecycleOperation(operation.type, operation.metadata)
    ),
    onExit: (onExit ?? defaults.onExit).map((operation) =>
      createLifecycleOperation(operation.type, operation.metadata)
    )
  };
}

export function createPool({
  key,
  stages = [],
  onEnter = null,
  onExit = null
} = {}) {
  const normalizedKey = String(key ?? '');

  const lifecycle = normalizeLifecycleOperations({ onEnter, onExit });
  return {
    key: normalizedKey,
    stages: assignUniqueStageIds(
      (stages ?? []).map((stage) =>
        createStage({
          ...stage,
          poolKey: stage.poolKey ?? normalizedKey
        })
      )
    ),
    onEnter: lifecycle.onEnter,
    onExit: lifecycle.onExit,
    currentStageIndex: 0
  };
}

function getDefinitionList(definitions = []) {
  if (Array.isArray(definitions)) return definitions;
  return Object.values(definitions ?? {});
}

function getStageDefinitionsFromSources(sources = []) {
  return sources.flatMap((source = {}) => source.stageDefinitions ?? []);
}

function getInterPoolStageDefinitionsFromSources(sources = []) {
  return sources.flatMap((source = {}) => source.interPoolStageDefinitions ?? []);
}

function createStageWithActors(stageDefinition = {}, actorIds = [], source = {}) {
  return createStage({
    ...stageDefinition,
    actorIds,
    metadata: {
      ...(stageDefinition.metadata ?? {}),
      source
    }
  });
}

function getRoleDefinitionStages(session = {}, roleDefinitions = []) {
  const roles = session.roles ?? [];

  return getDefinitionList(roleDefinitions).flatMap((roleDefinition = {}) => {
    const matchingRoles = roles.filter((role) => role.roleKey === roleDefinition.key);

    return matchingRoles.flatMap((role) =>
      (roleDefinition.stageDefinitions ?? []).map((stageDefinition) =>
        createStageWithActors(stageDefinition, [role.id], {
          type: STAGE_SOURCE_TYPES.ROLE,
          id: role.id,
          key: roleDefinition.key
        })
      )
    );
  });
}

function getRoleDefinitionInterPoolStages(session = {}, roleDefinitions = []) {
  const roles = session.roles ?? [];

  return getDefinitionList(roleDefinitions).flatMap((roleDefinition = {}) => {
    const matchingRoles = roles.filter((role) => role.roleKey === roleDefinition.key);

    return matchingRoles.flatMap((role) =>
      (roleDefinition.interPoolStageDefinitions ?? []).map((stageDefinition) =>
        createStageWithActors(stageDefinition, [role.id], {
          type: STAGE_SOURCE_TYPES.ROLE,
          id: role.id,
          key: roleDefinition.key
        })
      )
    );
  });
}

function getGroupDefinitionStages(session = {}, groupDefinitions = []) {
  return getDefinitionList(groupDefinitions).flatMap((groupDefinition = {}) => {
    const groupId = groupDefinition.id ?? groupDefinition.key;
    const actorIds = getGroupRoleIds(session, groupId);

    return (groupDefinition.stageDefinitions ?? []).map((stageDefinition) =>
      createStageWithActors(stageDefinition, actorIds, {
        type: STAGE_SOURCE_TYPES.GROUP,
        id: groupId,
        key: groupDefinition.key
      })
    );
  });
}

function getAbstractSourceStages(sources = []) {
  return getStageDefinitionsFromSources(getDefinitionList(sources)).map(createStage);
}

function getAbstractSourceInterPoolStages(sources = []) {
  return getInterPoolStageDefinitionsFromSources(getDefinitionList(sources)).map(createStage);
}

function getStageDefinitionErrors(stages = [], { requirePoolKey = true } = {}) {
  return (stages ?? []).flatMap((stage, index) => {
    const errors = [];

    if (requirePoolKey && !stage.poolKey) {
      errors.push({
        code: POOL_DEFINITION_ERRORS.MISSING_POOL_KEY,
        message: `stage "${stage.key ?? index}" has no poolKey`,
        stageKey: stage.key ?? null,
        index
      });
    }

    if (
      stage.status === STAGE_STATUSES.ENABLED &&
      (stage.actorIds ?? []).length === 0
    ) {
      errors.push({
        code: POOL_DEFINITION_ERRORS.EMPTY_ACTOR_IDS,
        message: `stage "${stage.key ?? index}" is enabled but has no actorIds`,
        stageKey: stage.key ?? null,
        index,
        source: stage.metadata?.source ?? null
      });
    }

    return errors;
  });
}

// Ensambla el mapa de pools y la cola inicial desde roles y grupos.
//
// La construccion de cada stage sigue perteneciendo a createStage. buildPools solo
// junta contribuciones, exige poolKey y delega validacion/orden en
// organizePoolStages.
export function buildPools({
  poolOrder = DEFAULT_POOL_ORDER,
  roleDefinitions = [],
  groupDefinitions = [],
  session = null
} = {}) {
  const poolStages = [
    ...(session
      ? getRoleDefinitionStages(session, roleDefinitions)
      : getAbstractSourceStages(roleDefinitions)),
    ...(session
      ? getGroupDefinitionStages(session, groupDefinitions)
      : getAbstractSourceStages(groupDefinitions))
  ];
  const interPoolQueue = session
    ? getRoleDefinitionInterPoolStages(session, roleDefinitions)
    : getAbstractSourceInterPoolStages(roleDefinitions);
  const errors = [
    ...getStageDefinitionErrors(poolStages),
    ...getStageDefinitionErrors(interPoolQueue, { requirePoolKey: false })
  ];

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      pools: null
    };
  }

  const pools = poolOrder.reduce((acc, poolKey) => {
    acc[poolKey] = poolStages.filter((stage) => stage.poolKey === poolKey);
    return acc;
  }, {});

  return organizePoolStages({
    poolOrder,
    pools,
    interPoolQueue
  });
}

function isConfigurableStageOrderPool(poolKey) {
  return CONFIGURABLE_STAGE_ORDER_POOLS.includes(poolKey);
}

// Valida el uso de order dentro de una definicion de pools.
//
// Si hay orders duplicados, es error de definicion de skin. No hay empate ni
// desempate automatico.
function validateStagesOrder(definition = {}) {
  const errors = [];
  const pools = definition.pools ?? {};

  Object.entries(pools).forEach(([poolKey, stages = []]) => {
    const seenOrders = new Map();

    (stages ?? []).forEach((stage = {}, index) => {
      const hasOrder =
        stage[POOL_DEFINITION_ORDER_FIELD] !== undefined &&
        stage[POOL_DEFINITION_ORDER_FIELD] !== null;
      if (!hasOrder) return;

      if (!isConfigurableStageOrderPool(poolKey)) {
        errors.push({
          code: POOL_DEFINITION_ERRORS.ORDER_NOT_ALLOWED,
          message: `pool "${poolKey}" does not accept configurable stage order`,
          poolKey,
          stageKey: stage.key ?? null,
          index
        });
        return;
      }

      const order = stage[POOL_DEFINITION_ORDER_FIELD];
      if (!Number.isFinite(order)) {
        errors.push({
          code: POOL_DEFINITION_ERRORS.INVALID_ORDER,
          message: `stage "${stage.key ?? index}" has invalid order`,
          poolKey,
          stageKey: stage.key ?? null,
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
          stageKey: stage.key ?? null,
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
function getOrderedPoolStages(definition = {}) {
  const poolOrder = definition.poolOrder ?? Object.keys(definition.pools ?? {});
  const pools = poolOrder.reduce((acc, poolKey) => {
    const stages = [...(definition.pools?.[poolKey] ?? [])];

    acc[poolKey] = isConfigurableStageOrderPool(poolKey)
      ? stages.sort((a, b) => {
          const aOrder = Number.isFinite(a?.order) ? a.order : Number.POSITIVE_INFINITY;
          const bOrder = Number.isFinite(b?.order) ? b.order : Number.POSITIVE_INFINITY;
          return aOrder - bOrder;
        })
      : stages;

    return acc;
  }, {});

  return {
    ...definition,
    poolOrder,
    pools
  };
}

// Organiza una definicion declarativa de pools ya compuesta de stages.
//
// stageDefinition construye cada stage.
// poolDefinition los valida, los ordena y crea el contenedor runtime.
export function organizePoolStages(definition = {}) {
  const validation = validateStagesOrder(definition);
  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      pools: null
    };
  }

  return {
    ok: true,
    errors: [],
    pools: Object.fromEntries(
      Object.entries(getOrderedPoolStages(definition).pools).map(([poolKey, stages]) => [
        poolKey,
        createPool({ key: poolKey, stages })
      ])
    ),
    interPoolQueue: assignUniqueStageIds(
      (definition.interPoolQueue ?? []).map((stage) => createStage(stage))
    )
  };
}

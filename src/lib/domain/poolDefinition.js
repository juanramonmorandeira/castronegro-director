// poolDefinition.js
// -----------------------------------------------------------------------------
// Constructor y organizador del contenedor runtime de pools.
//
// Un pool contiene stages ya creados. Este archivo no decide que hace cada stage:
// solo prepara y ordena la estructura que poolCursorModel necesita para mover el
// cursor.
// -----------------------------------------------------------------------------

import { createStage } from './stageDefinition.js';
import { getGroupRoleIds } from './groupModel.js';
import { DEFAULT_POOL_ORDER, STAGE_STATUSES, POOL_KEYS, normalizeId } from './sessionModel.js';

// Pools cuyo orden interno podria ser configurable por skin/flavor.
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

export const AUTOMATIC_STAGE_KEYS = Object.freeze({
  START_CYCLE: 'start_cycle',
  CHECK_OBJECTIVES: 'check_objectives',
  CONCLUDE_PLAY: 'conclude_play'
});

function createAutomaticStageDefinition(key, metadata = {}) {
  return {
    key: normalizeId(key),
    metadata: { ...metadata }
  };
}

function getDefaultAutomaticStages(poolOrder = DEFAULT_POOL_ORDER) {
  return poolOrder.reduce((acc, poolKey) => {
    acc[poolKey] = {
      onEnter:
        poolKey === POOL_KEYS.POOL_CONCEALED
          ? [
              createAutomaticStageDefinition(AUTOMATIC_STAGE_KEYS.START_CYCLE, {
                reason: 'prepare_normal_cycle'
              })
            ]
          : [],
      onExit: [
        createAutomaticStageDefinition(AUTOMATIC_STAGE_KEYS.CHECK_OBJECTIVES, {
          reason: 'pool_completed'
        })
      ]
    };
    return acc;
  }, {});
}

function normalizeAutomaticStages(automaticStages = {}, poolOrder = DEFAULT_POOL_ORDER) {
  const defaults = getDefaultAutomaticStages(poolOrder);

  return poolOrder.reduce((acc, poolKey) => {
    const override = automaticStages[poolKey] ?? {};
    acc[poolKey] = {
      onEnter: (override.onEnter ?? defaults[poolKey]?.onEnter ?? []).map((stage) =>
        createAutomaticStageDefinition(stage.key, stage.metadata)
      ),
      onExit: (override.onExit ?? defaults[poolKey]?.onExit ?? []).map((stage) =>
        createAutomaticStageDefinition(stage.key, stage.metadata)
      )
    };
    return acc;
  }, {});
}

// Normaliza un stage antes de meterlo dentro del contenedor runtime de pools.
//
// createStage, en stageDefinition.js, es el unico constructor conceptual de
// stages. Esta funcion no se exporta porque no queremos dos puertas publicas
// para crear el mismo tipo de objeto. Solo conserva compatibilidad con datos
// antiguos que todavia traen `action` en vez de `actions`.
function normalizePoolStage({
  key,
  special = false,
  status = STAGE_STATUSES.DISABLED,
  actorIds = [],
  action = null,
  actions = null,
  completion = null,
  selectionRules = null,
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
    special: special === true,
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
    selectionRules: selectionRules
      ? {
          ...selectionRules,
          groupRestrictions: (selectionRules.groupRestrictions ?? []).map((restriction) => ({
            ...restriction
          })),
          candidateIds: Array.isArray(selectionRules.candidateIds)
            ? [...selectionRules.candidateIds]
            : null,
          candidateRules: (selectionRules.candidateRules ?? []).map((rule) => ({ ...rule }))
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
  poolCurrentStageIndex = 0,
  pools = {},
  automaticStages = {}
} = {}) {
  const normalizedOrder = poolOrder.map(String);
  const normalizedPools = normalizedOrder.reduce((acc, poolKey) => {
    acc[poolKey] = (pools[poolKey] ?? []).map(normalizePoolStage);
    return acc;
  }, {});
  const initialNormalPool = normalizedOrder.includes(poolCurrent)
    ? poolCurrent
    : normalizedOrder[0] ?? null;

  return {
    poolOrder: normalizedOrder,
    poolCurrent: initialNormalPool,
    poolPrevious,
    poolNext: poolNext ?? normalizedOrder[1] ?? normalizedOrder[0] ?? null,
    poolCurrentStageIndex,
    pools: normalizedPools,
    automaticStages: normalizeAutomaticStages(automaticStages, normalizedOrder)
  };
}

// Construye los stages de un unico pool.
//
// buildStagePool no decide orden global ni mueve cursores. Solo garantiza que
// cada stage queda construido con createStage y asociado al pool indicado.
export function buildStagePool({ poolKey, stages = [] } = {}) {
  return (stages ?? []).map((stage) =>
    createStage({
      ...stage,
      poolKey: stage.poolKey ?? poolKey
    })
  );
}

function getDefinitionList(definitions = []) {
  if (Array.isArray(definitions)) return definitions;
  return Object.values(definitions ?? {});
}

function getStageDefinitionsFromSources(sources = []) {
  return sources.flatMap((source = {}) => source.stageDefinitions ?? []);
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
          type: 'role',
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
        type: 'group',
        id: groupId,
        key: groupDefinition.key
      })
    );
  });
}

function getDirectStages(stages = [], sourceType = 'direct') {
  return (stages ?? []).map((stageDefinition) =>
    createStageWithActors(stageDefinition, stageDefinition.actorIds ?? [], {
      type: sourceType
    })
  );
}

function getAbstractSourceStages(sources = []) {
  return getStageDefinitionsFromSources(getDefinitionList(sources)).map(createStage);
}

function isSystemStage(stage = {}) {
  return stage.metadata?.source?.type === 'system';
}

function getStageDefinitionErrors(stages = []) {
  return (stages ?? []).flatMap((stage, index) => {
    const errors = [];

    if (!stage.poolKey && stage.special !== true) {
      errors.push({
        code: POOL_DEFINITION_ERRORS.MISSING_POOL_KEY,
        message: `stage "${stage.key ?? index}" has no poolKey`,
        stageKey: stage.key ?? null,
        index
      });
    }

    if (
      stage.status === STAGE_STATUSES.ENABLED &&
      !isSystemStage(stage) &&
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

// Ensambla stagePools desde stages de sistema, roles y grupos.
//
// La construccion de cada stage sigue perteneciendo a createStage. buildPools solo
// junta contribuciones, exige poolKey y delega validacion/orden en
// organizePoolStages.
export function buildPools({
  poolOrder = DEFAULT_POOL_ORDER,
  defaultStages = [],
  systemStages = [],
  roleDefinitions = [],
  groupDefinitions = [],
  session = null
} = {}) {
  const allStages = [
    ...getDirectStages(defaultStages, 'default'),
    ...getDirectStages(systemStages, 'system'),
    ...(session
      ? getRoleDefinitionStages(session, roleDefinitions)
      : getAbstractSourceStages(roleDefinitions)),
    ...(session
      ? getGroupDefinitionStages(session, groupDefinitions)
      : getAbstractSourceStages(groupDefinitions))
  ];
  const errors = getStageDefinitionErrors(allStages);

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      stagePools: null
    };
  }

  const specialStages = allStages.filter((stage) => stage.special === true);
  const pools = poolOrder.reduce((acc, poolKey) => {
    acc[poolKey] = buildStagePool({
      poolKey,
      stages: allStages.filter((stage) => stage.poolKey === poolKey)
    });
    return acc;
  }, {});

  return organizePoolStages({
    poolOrder,
    pools,
    specialStages
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
      stagePools: null
    };
  }

  return {
    ok: true,
    errors: [],
    stagePools: createPool(getOrderedPoolStages(definition)),
    specialStages: [...(definition.specialStages ?? [])]
  };
}

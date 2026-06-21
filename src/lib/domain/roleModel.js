// roleModel.js
// -----------------------------------------------------------------------------
// Gestiona estado runtime propio de roles.
//
// Los bloqueos se expresan sobre cambios de propiedad, no sobre acciones. Una
// action puede intentar producir el mismo cambio que otra action diferente y
// ambas deben consultar el mismo estado mecanico del role.
// -----------------------------------------------------------------------------

export const PROPERTY_BLOCK_EXPIRATION_TYPES = Object.freeze({
  STAGE_BOUNDARY: 'stage_boundary',
  POOL_BOUNDARY: 'pool_boundary',
  CYCLE_BOUNDARY: 'cycle_boundary',
  SESSION: 'session'
});

export const PROPERTY_BLOCK_DURATION_UNITS = Object.freeze({
  STAGE: 'stage',
  POOL: 'pool',
  CYCLE: 'cycle',
  SESSION: 'session'
});

export const PROPERTY_BLOCK_BOUNDARIES = Object.freeze({
  BEFORE: 'before',
  AFTER: 'after'
});

function uniqueSortedIds(ids = []) {
  return [...new Set((ids ?? []).filter(Boolean).map(String))].sort();
}

function normalizeBlockedFor(blockedFor = {}) {
  return {
    actorIds: uniqueSortedIds(blockedFor.actorIds)
  };
}

function normalizeExpiresAt(expiresAt = {}) {
  return {
    type: expiresAt.type ?? PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION,
    cycleId: Number.isInteger(expiresAt.cycleId) ? expiresAt.cycleId : null,
    poolKey: expiresAt.poolKey ?? null,
    stageId: expiresAt.stageId ?? null,
    boundary: expiresAt.boundary ?? null
  };
}

function getPropertyBlockSignature(block = {}) {
  return JSON.stringify({
    property: block.property ?? null,
    value: block.value,
    blockedFor: normalizeBlockedFor(block.blockedFor),
    expiresAt: normalizeExpiresAt(block.expiresAt)
  });
}

export function createBlockedPropertyChange({
  id = null,
  property,
  value,
  blockedFor = {},
  expiresAt = {},
  metadata = {}
} = {}) {
  const normalized = {
    property: property ?? null,
    value,
    blockedFor: normalizeBlockedFor(blockedFor),
    expiresAt: normalizeExpiresAt(expiresAt),
    metadata: { ...metadata }
  };

  return {
    id: id ?? `property-block-${getPropertyBlockSignature(normalized)}`,
    ...normalized
  };
}

export function addBlockedPropertyChange(role = {}, block = {}) {
  const normalizedBlock = createBlockedPropertyChange(block);
  const currentBlocks = role.blockedPropertyChanges ?? [];
  const signature = getPropertyBlockSignature(normalizedBlock);

  if (currentBlocks.some((entry) => getPropertyBlockSignature(entry) === signature)) {
    return role;
  }

  return {
    ...role,
    blockedPropertyChanges: [...currentBlocks, normalizedBlock]
  };
}

export function isPropertyChangeBlocked(
  role = {},
  { property, value, actorIds = [] } = {}
) {
  const responsibleActorIds = new Set(uniqueSortedIds(actorIds));
  if (responsibleActorIds.size === 0) return false;

  return (role.blockedPropertyChanges ?? []).some((block) => {
    if (block.property !== property || block.value !== value) return false;
    return (block.blockedFor?.actorIds ?? []).some((actorId) =>
      responsibleActorIds.has(actorId)
    );
  });
}

function hasReachedExpiration(expiresAt = {}, point = {}) {
  if (expiresAt.type === PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION) return false;

  if (expiresAt.type !== point.type || expiresAt.boundary !== point.boundary) return false;
  if (expiresAt.cycleId !== point.cycleId) return false;
  if (expiresAt.type === PROPERTY_BLOCK_EXPIRATION_TYPES.CYCLE_BOUNDARY) return true;
  if (expiresAt.poolKey !== point.poolKey) return false;
  if (expiresAt.type === PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY) return true;
  return expiresAt.stageId === point.stageId;
}

export function reviewPropertyBlocks(session = {}, point = {}) {
  const removedBlockIds = [];
  const roles = (session.roles ?? []).map((role) => {
    const currentBlocks = role.blockedPropertyChanges ?? [];
    const retainedBlocks = currentBlocks.filter((block) => {
      const expired = hasReachedExpiration(block.expiresAt, point);
      if (expired) removedBlockIds.push(block.id);
      return !expired;
    });

    return retainedBlocks.length === currentBlocks.length
      ? role
      : { ...role, blockedPropertyChanges: retainedBlocks };
  });

  return {
    session: { ...session, roles },
    removedBlockIds
  };
}

function getDurationError(code, message, duration = {}) {
  return {
    code,
    message,
    duration: { ...duration }
  };
}

function getCurrentPoolContext(session = {}, context = {}) {
  const cycle = session.cycle ?? {};
  const poolKey = context.poolKey ?? cycle.poolCurrent ?? null;
  return {
    cycle,
    poolKey,
    pool: cycle.pools?.[poolKey] ?? null
  };
}

function getStageExpiration(session = {}, duration = {}, context = {}) {
  const { cycle, poolKey, pool } = getCurrentPoolContext(session, context);
  const currentStageId = context.stageId ?? null;
  const currentIndex = (pool?.stages ?? []).findIndex((stage) => stage.id === currentStageId);
  if (!pool || currentIndex < 0) {
    return {
      ok: false,
      errors: [
        getDurationError(
          'property-block/missing-current-stage',
          'stage duration requires the current runtime stage',
          duration
        )
      ]
    };
  }

  const pendingStages = (pool.stages ?? [])
    .slice(currentIndex + 1)
    .filter((stage) => stage.status === 'enabled');
  const offset = duration.offset ?? 0;
  const targetStage =
    duration.boundary === PROPERTY_BLOCK_BOUNDARIES.AFTER
      ? offset === 0
        ? pool.stages[currentIndex]
        : pendingStages[offset - 1]
      : pendingStages[offset - 1];

  if (!targetStage) {
    return {
      ok: true,
      errors: [],
      expiresAt: {
        type: PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY,
        cycleId: cycle.id ?? 0,
        poolKey,
        stageId: null,
        boundary: PROPERTY_BLOCK_BOUNDARIES.AFTER
      }
    };
  }

  return {
    ok: true,
    errors: [],
    expiresAt: {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.STAGE_BOUNDARY,
      cycleId: cycle.id ?? 0,
      poolKey,
      stageId: targetStage.id,
      boundary: duration.boundary
    }
  };
}

function getPoolExpiration(session = {}, duration = {}, context = {}) {
  const { cycle, poolKey } = getCurrentPoolContext(session, context);
  const poolOrder = cycle.poolOrder ?? [];
  const currentPoolIndex = poolOrder.indexOf(poolKey);
  if (currentPoolIndex < 0 || poolOrder.length === 0) {
    return {
      ok: false,
      errors: [
        getDurationError(
          'property-block/missing-current-pool',
          'pool duration requires the current pool in cycle.poolOrder',
          duration
        )
      ]
    };
  }

  const absoluteIndex = currentPoolIndex + (duration.offset ?? 0);
  const cycleOffset = Math.floor(absoluteIndex / poolOrder.length);

  return {
    ok: true,
    errors: [],
    expiresAt: {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.POOL_BOUNDARY,
      cycleId: (cycle.id ?? 0) + cycleOffset,
      poolKey: poolOrder[absoluteIndex % poolOrder.length],
      stageId: null,
      boundary: duration.boundary
    }
  };
}

function getCycleExpiration(session = {}, duration = {}) {
  return {
    ok: true,
    errors: [],
    expiresAt: {
      type: PROPERTY_BLOCK_EXPIRATION_TYPES.CYCLE_BOUNDARY,
      cycleId: (session.cycle?.id ?? 0) + (duration.offset ?? 0),
      poolKey: null,
      stageId: null,
      boundary: duration.boundary
    }
  };
}

export function materializePropertyBlockExpiration(
  session = {},
  duration = {},
  context = {}
) {
  const unit = duration.unit ?? PROPERTY_BLOCK_DURATION_UNITS.SESSION;
  const offset = duration.offset ?? 0;
  const boundary = duration.boundary ?? null;

  if (!Number.isInteger(offset) || offset < 0) {
    return {
      ok: false,
      errors: [
        getDurationError(
          'property-block/invalid-duration-offset',
          'property block duration offset must be a non-negative integer',
          duration
        )
      ]
    };
  }

  if (unit === PROPERTY_BLOCK_DURATION_UNITS.SESSION) {
    return {
      ok: true,
      errors: [],
      expiresAt: {
        type: PROPERTY_BLOCK_EXPIRATION_TYPES.SESSION,
        cycleId: null,
        poolKey: null,
        stageId: null,
        boundary: null
      }
    };
  }

  if (!Object.values(PROPERTY_BLOCK_BOUNDARIES).includes(boundary)) {
    return {
      ok: false,
      errors: [
        getDurationError(
          'property-block/invalid-duration-boundary',
          'property block duration requires boundary before or after',
          duration
        )
      ]
    };
  }

  if (boundary === PROPERTY_BLOCK_BOUNDARIES.BEFORE && offset === 0) {
    return {
      ok: false,
      errors: [
        getDurationError(
          'property-block/invalid-before-current-boundary',
          'boundary before is incompatible with offset 0',
          duration
        )
      ]
    };
  }

  if (unit === PROPERTY_BLOCK_DURATION_UNITS.STAGE) {
    return getStageExpiration(session, { ...duration, offset, boundary }, context);
  }
  if (unit === PROPERTY_BLOCK_DURATION_UNITS.POOL) {
    return getPoolExpiration(session, { ...duration, offset, boundary }, context);
  }
  if (unit === PROPERTY_BLOCK_DURATION_UNITS.CYCLE) {
    return getCycleExpiration(session, { ...duration, offset, boundary });
  }

  return {
    ok: false,
    errors: [
      getDurationError(
        'property-block/unknown-duration-unit',
        `unknown property block duration unit "${unit}"`,
        duration
      )
    ]
  };
}

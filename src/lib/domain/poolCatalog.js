// poolCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de pools mecanicos conocidos por el motor.
//
// poolDefinition define la forma de un pool.
// poolModel ejecuta sus mecanicas runtime.
// Este archivo declara que pools existen de base.
// -----------------------------------------------------------------------------

export const POOL_KEYS = Object.freeze({
  POOL_CONCEALED: 'poolConcealed',
  POOL_EXPOSED: 'poolExposed'
});

export const POOL_SURFACE_PHASES = Object.freeze({
  PRIVATE: 'private',
  PUBLIC: 'public'
});

export const DEFAULT_POOL_ORDER = Object.freeze([
  POOL_KEYS.POOL_CONCEALED,
  POOL_KEYS.POOL_EXPOSED
]);

export const POOL_CATALOG = Object.freeze({
  [POOL_KEYS.POOL_CONCEALED]: Object.freeze({
    key: POOL_KEYS.POOL_CONCEALED,
    surfacePhase: POOL_SURFACE_PHASES.PRIVATE
  }),
  [POOL_KEYS.POOL_EXPOSED]: Object.freeze({
    key: POOL_KEYS.POOL_EXPOSED,
    surfacePhase: POOL_SURFACE_PHASES.PUBLIC
  })
});

export function getCatalogPool(poolKey) {
  return POOL_CATALOG[poolKey] ?? null;
}

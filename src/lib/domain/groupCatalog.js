// groupCatalog.js
// -----------------------------------------------------------------------------
// Catalogo de grupos mecanicos predefinidos.
//
// El constructor unico de grupo es createGroup. El catalogo guarda grupos ya
// definidos para reutilizarlos al construir sesiones.
// -----------------------------------------------------------------------------

import { POOL_KEYS } from './sessionModel.js';
import { getCatalogStep, STEP_CATALOG_IDS } from './stepCatalog.js';
import { createGroup, GROUP_SELECTOR_TYPES } from './groupDefinition.js';

export const GROUP_CATALOG_IDS = Object.freeze({
  ALIGNMENT_SET_OUT_OF_PLAY: 'alignment_set_out_of_play'
});

export const GROUP_CATALOG = Object.freeze({
  [GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY]: createGroup({
    key: GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY,
    selector: {
      type: GROUP_SELECTOR_TYPES.ALIGNMENT,
      alignmentId: 'alignment_b'
    },
    stepDefinitions: [
      getCatalogStep(STEP_CATALOG_IDS.GROUP_SET_OUT_OF_PLAY, {
        poolKey: POOL_KEYS.POOL_CONCEALED,
        order: 30,
        metadata: {
          orderReason:
            'Runs after blockers and before inPlay control so blocked targets fail first and same-cycle restore can inspect the result.'
        }
      })
    ]
  })
});

function cloneCatalogValue(value) {
  if (Array.isArray(value)) return value.map(cloneCatalogValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, cloneCatalogValue(entryValue)])
    );
  }
  return value;
}

export function getCatalogGroup(groupCatalogId, overrides = {}) {
  const baseGroup = GROUP_CATALOG[groupCatalogId];
  if (!baseGroup) return null;

  return createGroup({
    ...cloneCatalogValue(baseGroup),
    ...overrides,
    selector: overrides.selector
      ? cloneCatalogValue(overrides.selector)
      : cloneCatalogValue(baseGroup.selector),
    stepDefinitions: overrides.stepDefinitions
      ? cloneCatalogValue(overrides.stepDefinitions)
      : cloneCatalogValue(baseGroup.stepDefinitions),
    metadata: {
      ...cloneCatalogValue(baseGroup.metadata ?? {}),
      ...(overrides.metadata ?? {})
    }
  });
}

export function getCoreGroupCatalog() {
  return [getCatalogGroup(GROUP_CATALOG_IDS.ALIGNMENT_SET_OUT_OF_PLAY)];
}

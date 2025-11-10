// src/lib/navigation.js
// ───────────────────────────────────────────────────────────
// Catálogo centralizado de intenciones de navegación y metadatos
// asociados para que todos los botones/enlaces compartan copy,
// estilo y semántica.

export const NAV_INTENT = {
  BACK_TO_LOGIN: 'nav/back-to-login',
  BACK_TO_DASHBOARD: 'nav/back-to-dashboard'
};

const NAV_ACTIONS = {
  [NAV_INTENT.BACK_TO_LOGIN]: {
    labelKey: 'navigation.back_to_login',
    variant: 'link',
    size: 'sm'
  },
  [NAV_INTENT.BACK_TO_DASHBOARD]: {
    labelKey: 'navigation.back_to_dashboard',
    variant: 'link',
    size: 'sm'
  }
};

/**
 * Devuelve la definición de una intent (sin traducir).
 */
export function getNavigationAction(intent) {
  return NAV_ACTIONS[intent] ?? null;
}

/**
 * Resuelve una lista de intents preservando el orden original.
 */
export function resolveNavigationActions(intents = []) {
  return intents
    .map((intent) => {
      const meta = getNavigationAction(intent);
      return meta
        ? {
            intent,
            ...meta
          }
        : null;
    })
    .filter(Boolean);
}

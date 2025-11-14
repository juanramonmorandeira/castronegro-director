// src/lib/navigation.js
// Shared helpers for view routing and navigation metadata.

export const APP_VIEWS = Object.freeze({
  LOGIN: 'login',
  REGISTRATION: 'registration',
  LANDING: 'landing',
  PLAYER_SELECTION: 'player-selection',
  CONFIGURE: 'configure',
  WAITING: 'waiting',
  SESSION: 'session',
  PROFILE: 'profile'
});

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

export function getNavigationAction(intent) {
  return NAV_ACTIONS[intent] ?? null;
}

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

export function resolveInitialView(pathname = '/', searchParams = new URLSearchParams()) {
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  if (mode === 'verifyEmail' || pathname === '/verify') {
    return {
      view: APP_VIEWS.LOGIN,
      pendingVerificationCode: oobCode,
      shouldProcessVerification: true
    };
  }

  if (pathname === '/registration') {
    return {
      view: APP_VIEWS.REGISTRATION,
      pendingVerificationCode: null,
      shouldProcessVerification: false
    };
  }

  if (pathname === '/login') {
    return {
      view: APP_VIEWS.LOGIN,
      pendingVerificationCode: null,
      shouldProcessVerification: false
    };
  }

  return {
    view: APP_VIEWS.LOGIN,
    pendingVerificationCode: null,
    shouldProcessVerification: false
  };
}

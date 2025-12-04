import { get, writable } from 'svelte/store';

// rolePositionsStore structure:
// { [sessionId]: { [tokenId]: { x: number, y: number } } }
export const rolePositionsStore = writable({});

export function getSessionPositions(sessionId = 'default') {
  const snapshot = get(rolePositionsStore) || {};
  return snapshot[sessionId] || {};
}

export function setRolePosition(sessionId = 'default', tokenId, position) {
  if (!tokenId || !position) return;
  rolePositionsStore.update((state) => {
    const next = { ...state };
    const sessionPositions = { ...(next[sessionId] || {}) };
    sessionPositions[tokenId] = position;
    next[sessionId] = sessionPositions;
    return next;
  });
}

export function setSessionPositions(sessionId = 'default', positions = {}) {
  rolePositionsStore.update((state) => ({
    ...state,
    [sessionId]: { ...positions }
  }));
}

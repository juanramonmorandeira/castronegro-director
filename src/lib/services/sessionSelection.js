// src/lib/services/sessionSelection.js
// Helpers that orchestrate the player session selection flow.

import { listActiveSessions, getSessionByGameId, connectPlayerToSession } from '../db.js';

export async function fetchActiveSessions(limit = 10) {
  return listActiveSessions(limit);
}

export function formatGameCode(value = '') {
  const cleaned = String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  if (!cleaned) return '';
  const groups = cleaned.match(/.{1,3}/g) ?? [];
  return groups.join(' ');
}

export function normalizeGameCode(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export async function connectUsingGameCode(gameCode, user) {
  const normalized = normalizeGameCode(gameCode);
  if (!normalized) {
    const error = new Error('missing game code');
    error.code = 'session/missing-code';
    throw error;
  }

  const session = await getSessionByGameId(normalized);
  if (!session) {
    const error = new Error('session not found');
    error.code = 'session/not-found';
    throw error;
  }

  await connectPlayerToSession(session.id, user);
  return session;
}

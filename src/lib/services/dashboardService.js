// src/lib/services/dashboardService.js
// Helper utilities for the storyteller dashboard (landing) view.

import { normalizeStatus } from '../utils.js';
import { getCurrentSession, listSessionHistory, createSessionDraft, deleteSessionIfCreator } from '../db.js';

const CONFIG_STATUSES = new Set(['draft', 'shared', 'waiting']);
const LIVE_STATUSES = new Set(['in_progress', 'paused']);

export function getViewerContext(user) {
  if (!user) return null;
  const uid = user.uid ?? user.auth_uid ?? null;
  const email = user.email ? String(user.email).toLowerCase() : null;
  if (!uid && !email) return null;
  return { uid, email };
}

export function sessionOwnedByViewer(session, viewer) {
  if (!session || !viewer) return false;
  const rawOwner = session.created_by;
  let ownerUid = null;
  let ownerEmail = null;
  if (typeof rawOwner === 'string') {
    ownerUid = rawOwner;
  } else if (rawOwner && typeof rawOwner === 'object') {
    ownerUid = rawOwner.uid ?? null;
    ownerEmail = rawOwner.email ? String(rawOwner.email).toLowerCase() : null;
  }
  const viewerUid = viewer.uid ?? null;
  const viewerEmail = viewer.email ?? null;
  if (ownerUid && viewerUid) return ownerUid === viewerUid;
  if (ownerEmail && viewerEmail) return ownerEmail === viewerEmail;
  return false;
}

export function resolveViewTarget(status) {
  if (!status) return null;
  if (CONFIG_STATUSES.has(status)) return 'configure';
  if (LIVE_STATUSES.has(status)) return 'session';
  return null;
}

export async function loadDashboardData(historyLimit = 20) {
  const [current, historyDocs] = await Promise.all([
    getCurrentSession(),
    listSessionHistory(historyLimit)
  ]);
  return {
    current: current ?? null,
    historyDocs: historyDocs ?? []
  };
}

export async function createDraftSession({ language, viewer }) {
  return createSessionDraft({
    language,
    creatorUid: viewer?.uid ?? null
  });
}

export async function removeHistorySession(id, viewer) {
  if (!id) return false;
  await deleteSessionIfCreator(id, viewer);
  return true;
}

export function normalizeHistoryDoc(doc, user) {
  const winners = Array.isArray(doc.winners)
    ? doc.winners
    : doc.winners
    ? [doc.winners]
    : [];

  const actualPlayers =
    doc.players && typeof doc.players === 'object'
      ? Object.keys(doc.players).length
      : Array.isArray(doc.players)
        ? doc.players.length
        : null;

  const creator = doc.created_by;
  const ownerUid = typeof creator === 'string' ? creator : creator?.uid ?? null;
  const ownerEmail =
    typeof creator === 'object' ? (creator?.email ?? '').toLowerCase() : '';
  const viewerUid = user?.uid ?? user?.auth_uid ?? null;
  const viewerEmail = (user?.email ?? '').toLowerCase();
  const canDelete =
    ownerUid && viewerUid
      ? ownerUid === viewerUid
      : ownerEmail && viewerEmail
        ? ownerEmail === viewerEmail
        : false;

  return {
    id: doc.id,
    title: doc.title ?? doc.settings?.name ?? '—',
    numPlayers: actualPlayers ?? Number(doc.settings?.players_expected ?? 0),
    winners,
    date: doc.updated_at ?? doc.created_at ?? doc.date ?? null,
    status: normalizeStatus(doc.status),
    createdBy: creator,
    canDelete
  };
}

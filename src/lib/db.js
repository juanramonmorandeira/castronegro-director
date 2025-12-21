// src/lib/db.js
// ───────────────────────────────────────────────────────────
// Capa de acceso a datos (Firestore). Todas las operaciones CRUD
// se centralizan aquí para mantener los componentes limpios.
// ───────────────────────────────────────────────────────────

import { db } from "./firebase.js";
import gamesMetadata from '../../reference-data/metadata/games.json' assert { type: 'json' };
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot,
  runTransaction,
  deleteField
} from "firebase/firestore";
import { normalizeStatus } from './utils.js';
import {
  resolvePlayerKey,
  derivePlayerAlias,
  resolvePlayerAvatar,
  computePlayerCounts
} from './players.js';
import { slugifyRole } from './roles.js';

// Estados considerados "activos" para unirse como jugador.
const ACTIVE_STATES = ['shared', 'waiting', 'in_progress', 'paused'];

const MIN_PLAYERS = 5;
const MAX_PLAYERS = 15;
const JOINABLE_STATES = new Set(['shared', 'waiting', 'in_progress', 'paused']);
const MAX_WAITING_MESSAGES = 50;
const MAX_CHAT_LENGTH = 280;

const clampPlayers = (value = MIN_PLAYERS) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MIN_PLAYERS;
  return Math.min(Math.max(numeric, MIN_PLAYERS), MAX_PLAYERS);
};

const buildError = (code, message) => {
  const error = new Error(message || code);
  error.code = code;
  return error;
};

function randomGroup() {
  return String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function formatGameId() {
  return `${randomGroup()} ${randomGroup()} ${randomGroup()}`;
}

async function generateUniqueGameId() {
  const sessionsCol = collection(db, 'sessions');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = formatGameId();
    const q = query(sessionsCol, where('game_id', '==', candidate));
    const snap = await getDocs(q);
    if (snap.empty) {
      return candidate;
    }
  }
  // Fallback: timestamp-based suffix
  const stamp = Date.now().toString().slice(-9);
  return `${stamp.slice(0, 3)} ${stamp.slice(3, 6)} ${stamp.slice(6)}`;
}

/** Lista sesiones activas. Devuelve array de { id, ...data } */
export async function listActiveSessions(limitCount = 10) {
  const colRef = collection(db, 'sessions');
  // where "in" no admite más de 10 valores (estamos dentro del límite).
  // Evitamos orderBy para no requerir índice compuesto.
  const q = query(colRef, where('status', 'in', ACTIVE_STATES));
  const snap = await getDocs(q);
  const out = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Ordenación en cliente por updated_at desc (fallback a created_at)
  out.sort((a, b) => {
    const ta = (a.updated_at?.seconds ?? a.created_at?.seconds ?? 0);
    const tb = (b.updated_at?.seconds ?? b.created_at?.seconds ?? 0);
    return tb - ta;
  });
  return out.slice(0, limitCount);
}

/** Obtiene una sesión por ID. Devuelve null si no existe */
export async function getSessionById(id) {
  if (!id) return null;
  const ref = doc(db, 'sessions', id);
  const d = await getDoc(ref);
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

export async function getSessionByGameId(gameId) {
  const normalized = (gameId ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const col = collection(db, 'sessions');
  const q = query(col, where('game_id', '==', normalized));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

export function subscribeToSession(sessionId, callback) {
  if (!sessionId || typeof callback !== 'function') return () => {};
  const ref = doc(db, 'sessions', sessionId);
  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback({ id: snap.id, ...snap.data() });
    },
    (error) => {
      console.error('[db] session subscription failed', error);
      callback(null);
    }
  );
  return unsubscribe;
}

export async function connectPlayerToSession(sessionId, playerProfile = {}) {
  if (!sessionId) throw buildError('session/missing-id', 'Missing session ID');
  const playerId = resolvePlayerKey(playerProfile);
  if (!playerId) {
    throw buildError('session/missing-player', 'Missing player identity');
  }

  return runTransaction(db, async (transaction) => {
    const ref = doc(db, 'sessions', sessionId);
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      throw buildError('session/not-found', 'Session not found');
    }

    const data = snap.data() ?? {};
    const status = normalizeStatus(data.status);
    if (!JOINABLE_STATES.has(status)) {
      throw buildError('session/unavailable', 'Session is not accepting players');
    }

    const settings = data.settings ?? {};
    const expected = clampPlayers(settings.players_expected ?? MIN_PLAYERS);
    const players =
      data.players && typeof data.players === 'object'
        ? { ...data.players }
        : {};
    const entryKeys = Object.keys(players);
    const existingEntry = players[playerId];
    const counts = computePlayerCounts(players);
    const alreadyCounted =
      existingEntry &&
      (existingEntry.status === 'connected' || existingEntry.status === 'ready');

    if (!alreadyCounted && counts.connected >= expected) {
      throw buildError('session/full', 'Session already reached the maximum number of players');
    }

    const alias = derivePlayerAlias(playerProfile, existingEntry?.alias, entryKeys.length);
    const avatarURL = resolvePlayerAvatar(playerProfile, existingEntry?.avatarURL);
    const now = serverTimestamp();
    const isReady = existingEntry?.status === 'ready';
    const entry = {
      alias,
      avatarURL: avatarURL ?? null,
      status: isReady ? 'ready' : 'connected',
      ready: isReady,
      user_id: playerId,
      email: playerProfile?.email ?? existingEntry?.email ?? null,
      generic_alias: !playerProfile?.alias,
      connected_at: existingEntry?.connected_at ?? now,
      updated_at: now
    };

    const updates = {
      [`players.${playerId}`]: entry,
      updated_at: now
    };

    if (entry.status === 'ready') {
      updates[`players_ready.${playerId}`] = true;
      updates[`players.${playerId}.ready_at`] = existingEntry?.ready_at ?? now;
    } else {
      updates[`players_ready.${playerId}`] = deleteField();
    }

    transaction.update(ref, updates);
    return { playerId, player: entry, sessionStatus: status };
  });
}

export async function updatePlayerReadyStatus(sessionId, playerId, ready = true) {
  if (!sessionId) throw buildError('session/missing-id', 'Missing session ID');
  if (!playerId) throw buildError('session/missing-player', 'Missing player identity');
  const ref = doc(db, 'sessions', sessionId);
  const now = serverTimestamp();
  const status = ready ? 'ready' : 'connected';
  const updates = {
    [`players.${playerId}.status`]: status,
    [`players.${playerId}.ready`]: !!ready,
    [`players.${playerId}.updated_at`]: now,
    updated_at: now
  };
  if (ready) {
    updates[`players_ready.${playerId}`] = true;
    updates[`players.${playerId}.ready_at`] = now;
  } else {
    updates[`players_ready.${playerId}`] = deleteField();
  }
  await updateDoc(ref, updates);
  return true;
}

export async function disconnectPlayerFromSession(sessionId, playerId) {
  if (!sessionId || !playerId) return false;
  const ref = doc(db, 'sessions', sessionId);
  await updateDoc(ref, {
    [`players.${playerId}`]: deleteField(),
    [`players_ready.${playerId}`]: deleteField(),
    updated_at: serverTimestamp()
  });
  return true;
}

export function subscribeWaitingRoomMessages(sessionId, callback, maxMessages = MAX_WAITING_MESSAGES) {
  if (!sessionId || typeof callback !== 'function') return () => {};
  const col = collection(db, 'sessions', sessionId, 'waiting_chat');
  const capped = Math.max(1, Math.min(maxMessages ?? MAX_WAITING_MESSAGES, 200));
  const q = query(col, orderBy('created_at', 'asc'), limit(capped));
  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(messages);
    },
    (error) => {
      console.error('[db] waiting-room chat subscription failed', error);
      callback([]);
    }
  );
  return unsubscribe;
}

export async function sendWaitingRoomMessage(sessionId, message = {}) {
  if (!sessionId) throw buildError('session/missing-id', 'Missing session ID');
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  if (!text) {
    throw buildError('chat/empty', 'Cannot send an empty message');
  }
  const trimmed = text.slice(0, MAX_CHAT_LENGTH);
  const col = collection(db, 'sessions', sessionId, 'waiting_chat');
  await addDoc(col, {
    message: trimmed,
    alias: message.alias?.trim() || 'Player',
    user_id: message.playerId ?? message.userId ?? null,
    avatar_url: message.avatarURL ?? message.avatar ?? null,
    created_at: serverTimestamp()
  });
  return true;
}

export async function savePlayerRoleAssignments(sessionId, assignments = {}) {
  if (!sessionId) throw buildError('session/missing-id', 'Missing session ID');
  const normalized = {};
  if (assignments && typeof assignments === 'object') {
    Object.entries(assignments).forEach(([playerId, roleInfo]) => {
      if (!playerId || !roleInfo || !roleInfo.role) return;
      const alias =
        typeof roleInfo.alias === 'string'
          ? roleInfo.alias.trim()
          : typeof roleInfo.player === 'string'
            ? roleInfo.player.trim()
            : null;
      normalized[playerId] = {
        role: roleInfo.role,
        slug: slugifyRole(roleInfo.role),
        category: roleInfo.category ?? null,
        alias: alias || null,
        player: alias || roleInfo.player || null,
        updated_at: serverTimestamp()
      };
    });
  }
  const ref = doc(db, 'sessions', sessionId);
  await updateDoc(ref, {
    player_roles: normalized,
    updated_at: serverTimestamp()
  });
  return normalized;
}

/**
 * clearCurrentFlag()
 * ───────────────────────────────────────────────────────────
 * Asegura que SOLO haya una sesión marcada como is_current=true.
 * - Busca todas las sesiones con is_current==true y las desmarca.
 * - Usa writeBatch para hacerlo atómico y más eficiente.
 */
async function clearCurrentFlag() {
  const col = collection(db, "sessions");
  const q = query(col, where("is_current", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { is_current: false, updated_at: serverTimestamp() });
  });
  await batch.commit();
}
/**
 * getCurrentSession()
 * ───────────────────────────────────────────────────────────
 * Devuelve la sesión marcada como current (si hay).
 * Nota: Para evitar requerir índice compuesto, NO usamos orderBy aquí.
 * Si en el futuro quieres la "más reciente", añade un índice compuesto:
 *   sessions: where is_current==true + orderBy created_at desc
 * y entonces reintroduce orderBy("created_at", "desc").
 */
export async function getCurrentSession() {
  const col = collection(db, "sessions");
  // Sin orderBy para no requerir índice compuesto con where(is_current==true)
  const q = query(col, where("is_current", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]; // Debe existir solo una por clearCurrentFlag()
  return { id: d.id, ...d.data() };
}

/**
 * listSessionHistory(max)
 * ───────────────────────────────────────────────────────────
 * Lista las últimas 'max' sesiones ordenadas por fecha de creación (desc).
 * Esta consulta podría pedir un índice si combinas más filtros.
 */
export async function listSessionHistory(max = 20) {
  const col = collection(db, "sessions");
  const q = query(col, orderBy("created_at", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * getBalanceTable()
 * ───────────────────────────────────────────────────────────
 * Devuelve la tabla de balance de roles.
 * Estructura esperada: { distribution_table: { "5": {...}, ... } }
 */
export async function getBalanceTable() {
  const ref = doc(db, "rulesets", "balance_table");
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("rulesets/balance_table not found");
  return snap.data(); 
}

/**
 * createSessionDraft({ title, language, creatorUid })
 * ───────────────────────────────────────────────────────────
 * Crea una nueva sesión en estado 'draft', la marca como 'current'
 * y garantiza que no existan otras 'current'.
 */
export async function createSessionDraft({ title, language, creatorUid } = {}) {
  await clearCurrentFlag();

  const defaults = gamesMetadata?.defaults ?? {};
  const statusDefault = defaults.status ?? 'draft';
  const rulesetDefault =
    defaults.rulesets ??
    gamesMetadata?.rulesets_values?.[0] ??
    'basic';
  const storytellerDefault =
    defaults.storyteller ??
    gamesMetadata?.storyteller_values?.[0] ??
    'human';
  const languageDefault =
    language ??
    defaults.language ??
    gamesMetadata?.language_values?.[0] ??
    'en';
  const playersExpectedDefault = clampPlayers(defaults.players_expected);
  const assistEnabledDefault = defaults.assist_enabled ?? false;
  const gamePhaseDefault =
    defaults.game_phase ??
    gamesMetadata?.game_phase_values?.[0] ??
    'Introduction';

  const timestampSuffix = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const computedTitle = title?.trim() || `Game session ${timestampSuffix}`;
  const gameId = await generateUniqueGameId();
  const assistEnabled =
    storytellerDefault === 'human'
      ? false
      : storytellerDefault === 'AI'
        ? true
        : assistEnabledDefault;
  const assistTasksDefault =
    assistEnabled && storytellerDefault === 'AI'
      ? [...(gamesMetadata?.assist_tasks_values ?? [])]
      : [];
  const creatorData = creatorUid ?? null;

  const payload = {
    title: computedTitle,
    status: statusDefault,
    is_current: true,
    game_id: gameId,
    created_by: creatorData,
    settings: {
      rulesets: rulesetDefault,
      storyteller: storytellerDefault,
      players_expected: playersExpectedDefault,
      roles_in_play: {},
      assist_enabled: assistEnabled,
      language: languageDefault,
      assist_tasks: assistTasksDefault
    },
    players: {},
    game_phases: {
      previous: null,
      current: gamePhaseDefault,
      next: 'undetermined',
      phase_summary: [],
      pending_interphases: []
    },
    logs: [],
    meta: gamesMetadata?.meta ?? { version: 1, schema: 'game_schema' },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };

  const ref = await addDoc(collection(db, "sessions"), payload);
  return { id: ref.id, ...payload };
}

export async function updateSession(sessionId, data = {}) {
  if (!sessionId || !data) return;
  const ref = doc(db, 'sessions', sessionId);
  await updateDoc(ref, { ...data, updated_at: serverTimestamp() });
}

export async function deleteSessionIfCreator(sessionId, viewer = {}) {
  if (!sessionId) throw new Error('missing_session_id');
  const viewerUid =
    typeof viewer === 'string'
      ? viewer
      : viewer?.uid ?? viewer?.auth_uid ?? null;
  const viewerEmail =
    typeof viewer === 'object' && viewer?.email
      ? String(viewer.email).toLowerCase()
      : null;
  if (!viewerUid && !viewerEmail) throw new Error('missing_user_identity');

  const ref = doc(db, 'sessions', sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('session_not_found');
  }

  const data = snap.data() ?? {};
  const rawOwner = data.created_by;
  let ownerUid = null;
  let ownerEmail = null;
  if (typeof rawOwner === 'string') {
    ownerUid = rawOwner;
  } else if (rawOwner && typeof rawOwner === 'object') {
    ownerUid = rawOwner.uid ?? null;
    ownerEmail = rawOwner.email ? String(rawOwner.email).toLowerCase() : null;
  }

  const isOwner =
    (ownerUid && viewerUid && ownerUid === viewerUid) ||
    (!ownerUid && ownerEmail && viewerEmail && ownerEmail === viewerEmail);

  if (!isOwner) {
    const error = new Error('not_authorized');
    error.code = 'sessions/not-owner';
    throw error;
  }

  await deleteDoc(ref);
  return true;
}

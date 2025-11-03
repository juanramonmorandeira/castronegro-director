// src/lib/db.js
// ───────────────────────────────────────────────────────────
// Capa de acceso a datos (Firestore). Todas las operaciones CRUD
// se centralizan aquí para mantener los componentes limpios.
// ───────────────────────────────────────────────────────────

import { db } from "./firebase.js";
import { normalizeStatus } from "./utils.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, serverTimestamp, writeBatch
} from "firebase/firestore";

const PLAYER_JOIN_STATUSES = ['share', 'in_progress', 'paused'];

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
 * createSessionDraft({ title, language })
 * ───────────────────────────────────────────────────────────
 * Crea una nueva sesión en estado 'draft', la marca como 'current'
 * y garantiza que no existan otras 'current'.
 */
export async function createSessionDraft({ title = "Untitled session", language = "en" } = {}) {
  // si quieres garantizar 1 sola “current”
  await clearCurrentFlag();

  const payload = {
    title,
    status: "draft",
    is_current: true,
    language,
    set_reglas: "basic",
    director: "human",
    assist: { enabled: false, phases: [], rules: false },
    players_expected: 5,
    roles_selected: { villagers: [], ambiguous: [], outsiders: [], werewolves: [] },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };
  const ref = await addDoc(collection(db, "sessions"), payload);
  return ref.id;  
}

/**
 * getSessionById(sessionId)
 * ───────────────────────────────────────────────────────────
 * Devuelve la sesión si existe y su estado permite que un jugador se conecte.
 */
export async function getSessionById(sessionId) {
  if (!sessionId) return null;
  const ref = doc(db, "sessions", sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const status = normalizeStatus(data.status);
  if (!PLAYER_JOIN_STATUSES.includes(status)) {
    return null;
  }
  return { id: snap.id, ...data, status };
}

/**
 * listActiveSessions(max = 10)
 * ───────────────────────────────────────────────────────────
 * Lista hasta 'max' sesiones con estados en los que un jugador puede conectarse.
 */
export async function listActiveSessions(max = 10) {
  const col = collection(db, "sessions");
  // Nota: where con "in" (máx 10 valores). Puede requerir un índice compuesto si añades orderBy.
  const q = query(
    col,
    where("status", "in", PLAYER_JOIN_STATUSES),
    orderBy("updated_at", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data(), status: normalizeStatus(d.data().status) }));
}

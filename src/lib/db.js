// src/lib/db.js
// ───────────────────────────────────────────────────────────
// Capa de acceso a datos (Firestore). Todas las operaciones CRUD
// se centralizan aquí para mantener los componentes limpios.
// ───────────────────────────────────────────────────────────

import { db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, serverTimestamp, writeBatch, getFirestore
} from "firebase/firestore";

// Estados considerados "activos" para unirse como jugador.
const ACTIVE_STATES = ['share', 'in_progress', 'paused'];

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

// src/lib/db.js
import { db } from "./firebase.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  addDoc, updateDoc, serverTimestamp
} from "firebase/firestore";

// ya existentes: getCurrentSession, listSessionHistory, createSessionDraft ...

export async function getCurrentSession() {
  const col = collection(db, "sessions");
  const q = query(col, where("is_current", "==", true), orderBy("created_at", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function listSessionHistory(max = 20) {
  const col = collection(db, "sessions");
  const q = query(col, orderBy("created_at", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getBalanceTable() {
  const ref = doc(db, "rulesets", "balance_table");
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("rulesets/balance_table not found");
  return snap.data(); // espera { distribution_table: { "5": {...}, ... } }
}

// Crear sesión borrador y marcarla como current
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

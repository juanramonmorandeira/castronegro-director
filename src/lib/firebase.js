// src/lib/firebase.js
// ───────────────────────────────────────────────────────────
// ÚNICO punto de inicialización de Firebase en el cliente.
// - Carga la config desde firebaseapiconfig.js (solo exporta el objeto).
// - Inicializa Firestore y Auth.
// - Inicia sesión anónima para permitir lecturas/escrituras.
// ───────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { firebaseConfig } from "../../firebaseapiconfig.js"; // ← SOLO config, sin inicializar

// 1) Inicializa la app de Firebase
const app = initializeApp(firebaseConfig);

// 2) Servicios que exporta la app: Firestore y Auth
export const db = getFirestore(app);
export const auth = getAuth(app);

if (typeof window !== 'undefined') {
  // signInAnonymously(auth)
  //   .then(() => console.log("✅ Conectado a Firebase (auth anónima)"))
  //   .catch((error) => console.error("❌ Error de autenticación anónima:", error));

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Auth:", user.isAnonymous ? "anon" : "registered", user.uid);
    }
  });
}

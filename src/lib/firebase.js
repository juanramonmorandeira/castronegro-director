// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { firebaseConfig } from "../../firebaseapiconfig.js"; // tu config web

// 1️⃣ Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 2️⃣ Inicializa servicios de Firebase
export const db = getFirestore(app);
export const auth = getAuth(app);

// 3️⃣ Conéctate de forma anónima para poder usar Firestore sin login manual
signInAnonymously(auth)
  .then(() => console.log("✅ Conectado a Firebase correctamente"))
  .catch((error) => console.error("❌ Error de autenticación:", error));

  // 4) (Opcional) Log informativo para depurar
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Auth:", user.isAnonymous ? "anon" : "registered", user.uid);
  }
});
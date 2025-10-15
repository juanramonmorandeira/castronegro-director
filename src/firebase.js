// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBsxRmMjU9Dqev1siiyDM4ojEywNQ8QAEg",
  authDomain: "castro-director.firebaseapp.com",
  projectId: "castro-director",
  storageBucket: "castro-director.firebasestorage.app",
  messagingSenderId: "398370105943",
  appId: "1:398370105943:web:aa7019498f96e2d3e85112"
};

// 1️⃣ Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 2️⃣ Inicializa servicios de Firebase
export const db = getFirestore(app);
export const auth = getAuth(app);

// 3️⃣ Conéctate de forma anónima para poder usar Firestore sin login manual
signInAnonymously(auth)
  .then(() => console.log("✅ Conectado a Firebase correctamente"))
  .catch((error) => console.error("❌ Error de autenticación:", error));

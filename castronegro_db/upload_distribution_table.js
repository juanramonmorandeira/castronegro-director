/*import { initializeApp } from "firebase/app";
import { terminate } from "firebase/firestore";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import fs from "fs";

// ⚙️ Configura con tu proyecto
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsxRmMjU9Dqev1siiyDM4ojEywNQ8QAEg",
  authDomain: "castro-director.firebaseapp.com",
  projectId: "castro-director",
  storageBucket: "castro-director.firebasestorage.app",
  messagingSenderId: "398370105943",
  appId: "1:398370105943:web:aa7019498f96e2d3e85112"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 📥 Cargar JSON
const data = JSON.parse(fs.readFileSync("./distribution_table.json", "utf8"));

// 📤 Subir como un documento único
async function uploadTable() {
  const ref = doc(db, "rulesets", "balance_table");
  await setDoc(ref, { distribution_table: data });
  console.log("✅ Tabla subida correctamente a Firestore");

  // Cierra la conexión Firestore para devolver el control al sistema
  await terminate(db);
  process.exit(0);
}

uploadTable().catch(console.error);*/

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 🔍 Resolver ruta actual del script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📁 Ruta absoluta al serviceAccountKey en la raíz del proyecto
const serviceAccountPath = path.join(__dirname, "..", "serviceAccountKey.json");

// 🧾 Cargar la clave del servicio
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// 🚀 Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📊 Cargar la tabla de distribución
const dataPath = path.join(__dirname, "distribution_table.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

async function uploadTable() {
  const ref = db.collection("rulesets").doc("balance_table");
  await ref.set({ distribution_table: data });
  console.log("✅ Tabla subida correctamente a Firestore (modo admin)");
  process.exit(0);
}

uploadTable().catch(console.error);


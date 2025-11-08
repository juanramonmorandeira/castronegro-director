/**
 * 🧩 organize_datasets.js
 * Crea en Firestore la estructura limpia y jerárquica de datasets:
 * datasets/
 *   ├── roles/
 *   │   ├── ambiguous/
 *   │   ├── outsiders/
 *   │   ├── villagers/
 *   │   └── werewolves/
 *   ├── professions/
 *   └── honorary_positions/
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// 🗝️ Inicializar Firebase
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.HOME + "/proyectos/keys/serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📦 Cargar el fichero fuente
const filePath = path.resolve("../reference-data/datasets/data.json");
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

// ⚙️ Función para subir documentos
async function uploadCollection(basePath, items) {
  let collectionRef;

  const parts = basePath.split("/");

  // ✅ Si el path empieza por "datasets" y tiene exactamente 2 partes
  // usamos db.collection("datasets").doc("professions").collection("items")
  if (parts.length === 2 && parts[0] === "datasets") {
    const [root, sub] = parts;
    collectionRef = db.collection(root).doc(sub).collection(sub);
  }
  // ✅ Si tiene más profundidad (datasets/roles/villagers, etc.)
  else {
    collectionRef = db.collection(basePath);
  }

  for (const item of items) {
    const docRef = collectionRef.doc(item.id);
    await docRef.set(item);
    console.log(`✅ ${basePath}/${item.id} subido`);
  }
}


// 🚀 Proceso principal
async function organizeDatasets() {
  console.log("\n📦 Iniciando organización de datasets...\n");

  // --- 1️⃣ Roles ---
  const roleGroups = ["villagers", "werewolves", "ambiguous", "outsiders"];
  for (const group of roleGroups) {
    const roles = data.roles[group];
    const basePath = `datasets/roles/${group}`;
    await uploadCollection(basePath, roles);
  }

  // --- 2️⃣ Profesiones ---
  if (data.professions) {
    await uploadCollection("datasets/professions", data.professions);
  }

  // --- 3️⃣ Posiciones honorarias ---
  if (data.honorary_positions) {
    await uploadCollection("datasets/honorary_positions", data.honorary_positions);
  }

  console.log("\n🎉 Estructura datasets/ creada correctamente en Firestore\n");
  process.exit(0);
}

organizeDatasets().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});

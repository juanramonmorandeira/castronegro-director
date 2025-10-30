// firestore_uploader.js
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import readline from "readline";

// === CONFIGURA AQUÍ TU RUTA DE CLAVE ===
const SERVICE_KEY_PATH = process.env.HOME + "/proyectos/keys/serviceAccountKey.json";

// === Inicializa Firebase Admin ===
const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_KEY_PATH, "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// === Interfaz de consola ===
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  try {
    console.log("\n📦  Firestore Uploader — por Village\n");

    const jsonPath = await ask("Ruta del archivo JSON (relativa o absoluta): ");
    const collectionPath = await ask("Ruta en Firestore (ej. definitions/game_schema): ");
    console.log("");

    // 🔹 Carga el archivo
    const fileContent = fs.readFileSync(jsonPath.trim(), "utf8");
    const data = replaceSentinels(JSON.parse(fileContent));

    // 🔹 Divide ruta en colección/documento
    const [collection, doc] = collectionPath.trim().split("/");

    if (!collection || !doc) {
      console.error("❌ Ruta incorrecta. Usa el formato 'coleccion/documento'");
      rl.close();
      return;
    }

    // 🔹 Sube a Firestore
    await db.collection(collection).doc(doc).set(data);
    console.log(`✅ Subido correctamente a Firestore → ${collection}/${doc}`);

  } catch (error) {
    console.error("❌ Error al subir:", error);
  } finally {
    rl.close();
  }
}

function replaceSentinels(value) {
  if (Array.isArray(value)) {
    return value.map(replaceSentinels);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, replaceSentinels(val)])
    );
  }
  if (value === "__NOW__") {
    return FieldValue.serverTimestamp();
  }
  return value;
}

main();

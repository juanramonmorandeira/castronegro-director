import fs from "fs";
import admin from "firebase-admin";
import path from "path";

// 🔑 Cargar credenciales
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.HOME + "/proyectos/keys/serviceAccountKey.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📁 Cargar el fichero de imágenes real
const imagesPath = path.resolve("../village_db/images/images.json");
const images = JSON.parse(fs.readFileSync(imagesPath, "utf8"));

async function updateFirestore() {
  console.log("📦 Iniciando actualización de URLs de imágenes...\n");

  // ✅ Recorre directamente cada grupo: villagers, werewolves, ambiguous, outsiders
  for (const [group, roles] of Object.entries(images)) {
    const collectionPath = `datasets/roles/${group}`;
    console.log(`�� Actualizando grupo: ${collectionPath}`);

    for (const [id, imageUrl] of Object.entries(roles)) {
      const docRef = db.collection(collectionPath).doc(id);
      const doc = await docRef.get();

      if (doc.exists) {
        await docRef.update({ imageUrl });
        console.log(`✅ ${group}/${id} actualizado con su imagen`);
      } else {
        console.warn(`⚠️ ${group}/${id} no existe en Firestore`);
      }
    }
  }

  console.log("\n🎉 ¡Actualización completada correctamente!");
}

updateFirestore().catch(console.error);

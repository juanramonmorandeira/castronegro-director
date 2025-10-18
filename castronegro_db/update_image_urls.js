// update_image_urls.js
const admin = require("firebase-admin");
const fs = require("fs");

// 🔑 Inicializa Firebase
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 📁 Lee el fichero con las URLs
const images = JSON.parse(fs.readFileSync("./images.json", "utf-8"));

async function updateFirestore() {
  for (const [group, roles] of Object.entries(images)) {
    const collectionName = `roles_${group}`;

    console.log(`📂 Actualizando colección: ${collectionName}`);

    for (const [id, imageUrl] of Object.entries(roles)) {
      const docRef = db.collection(collectionName).doc(id);
      const doc = await docRef.get();

      if (doc.exists) {
        await docRef.update({ imageUrl });
        console.log(`✅ ${id} actualizado con su imagen.`);
      } else {
        console.warn(`⚠️ No existe el documento para ${id} en ${collectionName}`);
      }
    }
  }

  console.log("🎉 ¡Todas las imágenes se han vinculado correctamente!");
}

updateFirestore().catch((err) => console.error("❌ Error:", err));

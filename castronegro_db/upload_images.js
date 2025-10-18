// upload_images.js (versión CommonJS)
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// 🔹 Inicializa Firebase con tus credenciales
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.appspot.com`,
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

// 📁 Rutas de carpetas locales
const basePath = "./images";
const groups = ["villagers", "werewolves", "ambiguous", "outsiders"];

// 🚀 Subir imágenes y actualizar Firestore
async function uploadAllImages() {
  for (const group of groups) {
    const folderPath = path.join(basePath, group);
    if (!fs.existsSync(folderPath)) {
      console.warn(`⚠️ Carpeta no encontrada: ${folderPath}`);
      continue;
    }

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileName = `${group}/${file}`;

      console.log(`📤 Subiendo ${fileName}...`);
      const [uploadedFile] = await bucket.upload(filePath, {
        destination: fileName,
        resumable: false,
        public: true,
        metadata: { contentType: "image/png" },
      });

      // Obtener URL pública
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileName)}?alt=media`;

      // Obtener id (sin extensión)
      const id = path.parse(file).name;

      // Actualizar el documento Firestore correspondiente
      const docRef = db.collection(`roles_${group}`).doc(id);
      const doc = await docRef.get();

      if (doc.exists) {
        await docRef.update({ imageUrl: publicUrl });
        console.log(`✅ Actualizado ${id} con URL: ${publicUrl}`);
      } else {
        console.warn(`⚠️ No se encontró el rol ${id} en roles_${group}`);
      }
    }
  }

  console.log("🎉 Todas las imágenes subidas y asociadas correctamente.");
}

uploadAllImages().catch((err) => console.error("❌ Error:", err));


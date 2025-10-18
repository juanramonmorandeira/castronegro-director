// import_firestore.js
const fs = require("fs");
const admin = require("firebase-admin");

// 1️⃣ Inicializa Firebase con tu clave privada
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2️⃣ Lee tu fichero JSON
const data = JSON.parse(fs.readFileSync("castronegro_data.json", "utf8"));

// 3️⃣ Función para importar roles (agrupados por tipo)
async function importRoles() {
  for (const [group, roles] of Object.entries(data.roles)) {
    const collectionRef = db.collection(`roles_${group}`);
    for (const role of roles) {
      await collectionRef.doc(role.id).set(role);
      console.log(`✅ Added role: ${role.name} (${group})`);
    }
  }
}

// 4️⃣ Función genérica para arrays (honorary_positions y professions)
async function importArray(collectionName, array) {
  const collectionRef = db.collection(collectionName);
  for (const item of array) {
    await collectionRef.doc(item.id).set(item);
    console.log(`✅ Added ${collectionName}: ${item.name}`);
  }
}

// 5️⃣ Ejecuta todo
(async () => {
  console.log("🚀 Starting import...");
  await importRoles();
  await importArray("honorary_positions", data.honorary_positions);
  await importArray("professions", data.professions);
  console.log("🎉 Import completed successfully!");
  process.exit(0);
})();

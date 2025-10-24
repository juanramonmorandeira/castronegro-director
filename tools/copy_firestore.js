// tools/copy_firestore.js
import fs from "fs";
import admin from "firebase-admin";

// Carga credenciales
const oldCred = JSON.parse(fs.readFileSync("./keys/serviceAccountKey_old.json", "utf8"));
const newCred = JSON.parse(fs.readFileSync("./keys/serviceAccountKey.json", "utf8"));

// Dos apps Admin (orígenes y destino)
const oldApp = admin.initializeApp({ credential: admin.credential.cert(oldCred) }, "old");
const newApp = admin.initializeApp({ credential: admin.credential.cert(newCred) }, "new");

const oldDb = oldApp.firestore();
const newDb = newApp.firestore();

// Copia todos los docs de una colección (nivel raíz)
async function copyCollection(colPath) {
  const snap = await oldDb.collection(colPath).get();
  console.log(`\n[${colPath}] ${snap.size} docs`);
  for (const doc of snap.docs) {
    const data = doc.data();
    await newDb.collection(colPath).doc(doc.id).set(data, { merge: true });
  }
}

// Copia subcolecciones de roles (ambiguous/outsiders/villagers/werewolves)
async function copyRoles() {
  const groups = ["ambiguous", "outsiders", "villagers", "werewolves"];
  for (const g of groups) {
    const colPath = `datasets/roles/${g}`;
    const snap = await oldDb.collection(colPath).get();
    console.log(`\n[${colPath}] ${snap.size} docs`);
    for (const doc of snap.docs) {
      await newDb.collection(colPath).doc(doc.id).set(doc.data(), { merge: true });
    }
  }
}

(async () => {
  try {
    // Colecciones raíz que te interesan:
    await copyCollection("definitions");          // si guardas docs sueltos dentro
    await copyCollection("rulesets");             // balance_table vive aquí
    // Si en definitions/rulesets tienes SUBcolecciones anidadas, dímelo y extendemos

    // Roles por grupos:
    await copyRoles();

    console.log("\n✅ Copia terminada.");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

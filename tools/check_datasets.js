import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.HOME + "/proyectos/keys/serviceAccountKey.json", "utf8")
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function listDatasets() {
  console.log("📦 Listando colecciones principales...");
  const collections = await db.listCollections();
  for (const col of collections) {
    console.log(" -", col.id);
  }

  console.log("\n📂 Subcolecciones de 'datasets':");
  const datasets = db.collection("datasets");
  const subcollections = await datasets.listDocuments();
  for (const doc of subcollections) {
    console.log(" -", doc.id);
  }
}

listDatasets();

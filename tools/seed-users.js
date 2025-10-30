// tools/seed-users.js
// Populates Firestore with seed users defined in village_db/users/users.json.
// Uses Firebase Admin SDK so we can rely on serverTimestamp sentinels.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Allow overriding the service key via env; otherwise reuse the path used in firestore_uploader.
const SERVICE_KEY_PATH =
  process.env.FIREBASE_SERVICE_KEY ??
  path.join(process.env.HOME ?? '', 'proyectos/keys/serviceAccountKey.json');

const DEFAULT_JSON_PATH = path.resolve(__dirname, '../village_db/users/users.json');

function loadServiceAccount() {
  try {
    const raw = fs.readFileSync(SERVICE_KEY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Unable to read service account from ${SERVICE_KEY_PATH}. ` +
        `Set FIREBASE_SERVICE_KEY or create the file. Original error: ${error.message}`
    );
  }
}

function loadUsers(jsonPath) {
  const absolute = path.resolve(jsonPath ?? DEFAULT_JSON_PATH);
  const contents = fs.readFileSync(absolute, 'utf8');
  const data = JSON.parse(contents);
  if (!Array.isArray(data)) {
    throw new Error(`Seed file must export an array. Received: ${typeof data}`);
  }
  return data;
}

function normalizeTimestamp(value) {
  if (value == null) return null;
  if (value === '__NOW__') return FieldValue.serverTimestamp();
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return value;
}

async function seedUsers(users) {
  if (users.length === 0) {
    console.log('No users to seed.');
    return;
  }

  const serviceAccount = loadServiceAccount();
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const batch = db.batch();
  let total = 0;

  for (const entry of users) {
    const { userId, ...rest } = entry;
    if (!userId || typeof userId !== 'string') {
      throw new Error(`Each user needs a string "userId". Offending entry: ${JSON.stringify(entry)}`);
    }

    const docRef = db.collection('users').doc(userId);
    const payload = {
      userId,
      ...rest
    };

    // Normalize email casing to avoid duplicates.
    if (payload.email) {
      payload.email = payload.email.trim().toLowerCase();
    }

    payload.created_at =
      entry.created_at != null
        ? normalizeTimestamp(entry.created_at)
        : FieldValue.serverTimestamp();

    if (Object.prototype.hasOwnProperty.call(entry, 'last_login_at')) {
      payload.last_login_at =
        entry.last_login_at != null
          ? normalizeTimestamp(entry.last_login_at)
          : null;
    }

    payload.seeded_at = FieldValue.serverTimestamp();

    batch.set(docRef, payload, { merge: true });
    total += 1;
  }

  await batch.commit();
  console.log(`✅ Seeded ${total} user(s) into Firestore.`);
}

async function main() {
  try {
    const jsonPathArg = process.argv[2];
    const users = loadUsers(jsonPathArg);
    await seedUsers(users);
  } catch (error) {
    console.error('❌ Failed to seed users:', error);
    process.exitCode = 1;
  }
}

main();

import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';

// Load .env variables manually
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFileContent = fs.readFileSync(envPath, 'utf8');
    envFileContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  }
} catch (e) {}

const firebaseConfig = {
  apiKey: process.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyAbqAeDyNj7odD5mcv4K4RAIiiapY2g9Dw",
  authDomain: process.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "family-trust-therapy-portal.firebaseapp.com",
  projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || "family-trust-therapy-portal",
  storageBucket: process.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "family-trust-therapy-portal.firebasestorage.app",
  messagingSenderId: process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "776178397237",
  appId: process.env.PUBLIC_FIREBASE_APP_ID || "1:776178397237:web:e170fe0e682c59feffc17c"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const targetEmails = process.argv.slice(2);

if (targetEmails.length === 0) {
  console.error("Usage: npx tsx scripts/delete-client.ts <email1> [email2 ...]");
  process.exit(1);
}

async function deleteClientDataByEmail(email: string) {
  console.log(`\n🔍 Searching Firestore for user & client documents matching email: ${email}...`);
  let foundUids = new Set<string>();

  // 1. Check users collection
  try {
    const usersQ = query(collection(db, 'users'), where('email', '==', email));
    const usersSnap = await getDocs(usersQ);
    for (const d of usersSnap.docs) {
      foundUids.add(d.id);
      console.log(`🗑️ Deleting user document ${d.id} from 'users'...`);
      await deleteDoc(d.ref);
    }
  } catch (err: any) {
    console.warn(`Error searching 'users':`, err.message);
  }

  // 2. Check clients collection
  try {
    const clientsQ = query(collection(db, 'clients'), where('email', '==', email));
    const clientsSnap = await getDocs(clientsQ);
    for (const d of clientsSnap.docs) {
      foundUids.add(d.id);
      console.log(`🗑️ Deleting client document ${d.id} from 'clients'...`);
      await deleteDoc(d.ref);
    }
  } catch (err: any) {
    console.warn(`Error searching 'clients':`, err.message);
  }

  // 3. For all matching UIDs, delete records across all portal collections
  for (const uid of foundUids) {
    console.log(`🧹 Cleaning up associated records for UID ${uid}...`);

    // Delete direct doc references by UID
    try {
      await deleteDoc(doc(db, 'clients', uid));
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'intakeSubmissions', uid));
    } catch (e) {}

    // Query and delete by clientId
    const collectionsToClean = [
      'appointments',
      'signedDocuments',
      'invoices',
      'ledgerEntries',
      'practiceNotifications',
      'cancellationAlerts'
    ];

    for (const colName of collectionsToClean) {
      try {
        const q = query(collection(db, colName), where('clientId', '==', uid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          console.log(`🗑️ Deleting ${snap.size} doc(s) from '${colName}' for client ${uid}...`);
          for (const d of snap.docs) {
            await deleteDoc(d.ref);
          }
        }
      } catch (err: any) {
        console.warn(`Error cleaning collection '${colName}':`, err.message);
      }
    }
  }

  console.log(`✅ Finished processing database cleanup for: ${email}`);
}

async function main() {
  for (const email of targetEmails) {
    await deleteClientDataByEmail(email);
  }
}

main().catch((err) => {
  console.error("❌ Deletion script error:", err);
  process.exit(1);
});

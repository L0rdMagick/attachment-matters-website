/**
 * Practice Administrator Onboarding Script
 * Promotes a registered user to 'admin' or 'therapist' role via Firebase Admin SDK.
 * 
 * Usage:
 *   npx tsx scripts/seed-admin.ts <email-or-uid> [role]
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.PUBLIC_FIREBASE_PROJECT_ID || 'family-trust-therapy-portal'
  });
}

const inputIdentifier = process.argv[2];
const role = process.argv[3] || 'admin';

if (!inputIdentifier) {
  console.error("Usage: npx tsx scripts/seed-admin.ts <email-or-uid> [role]");
  process.exit(1);
}

if (!['admin', 'therapist'].includes(role)) {
  console.error("Role must be 'admin' or 'therapist'");
  process.exit(1);
}

async function main() {
  const auth = getAuth();
  let userRecord;

  if (inputIdentifier.includes('@')) {
    console.log(`Searching for user by email: ${inputIdentifier}...`);
    userRecord = await auth.getUserByEmail(inputIdentifier);
  } else {
    userRecord = await auth.getUser(inputIdentifier);
  }

  const uid = userRecord.uid;
  console.log(`Found user: ${userRecord.email} (UID: ${uid}). Setting custom claim role='${role}'...`);

  // Set Firebase Auth custom user claims
  await auth.setCustomUserClaims(uid, { role });

  // Update Firestore user document
  const db = getFirestore();
  await db.collection('users').doc(uid).set(
    {
      uid,
      email: userRecord.email,
      role,
      status: 'active',
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );

  console.log(`✅ Success! User ${userRecord.email} (UID: ${uid}) has been granted the '${role}' role.`);
}

main().catch((err) => {
  console.error("❌ Failed to set admin role:", err.message);
  process.exit(1);
});

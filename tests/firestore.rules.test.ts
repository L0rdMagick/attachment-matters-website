import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'family-trust-therapy-test';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080
    }
  });
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

describe('Firestore Security Rules Authorization Matrix', () => {
  
  test('Unauthenticated user cannot read clients or users', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(unauthDb.doc('clients/client_123').get());
    await assertFails(unauthDb.doc('users/user_123').get());
  });

  test('Client can read their own client doc, but CANNOT read another client doc', async () => {
    const aliceDb = testEnv.authenticatedContext('alice_uid', { role: 'client', email_verified: true }).firestore();

    // Alice setup own doc
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clients/alice_uid').set({ legalFirstName: 'Alice', assignedTherapistId: 'therapist_1' });
      await context.firestore().doc('clients/bob_uid').set({ legalFirstName: 'Bob', assignedTherapistId: 'therapist_1' });
    });

    // Alice reads own doc -> Succeeds
    await assertSucceeds(aliceDb.doc('clients/alice_uid').get());

    // Alice reads Bob's doc -> FAILS
    await assertFails(aliceDb.doc('clients/bob_uid').get());
  });

  test('Client CANNOT assign themselves the admin or therapist role', async () => {
    const aliceDb = testEnv.authenticatedContext('alice_uid', { role: 'client' }).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('users/alice_uid').set({ role: 'client', status: 'active' });
    });

    // Alice attempts to update her role to 'admin'
    await assertFails(aliceDb.doc('users/alice_uid').update({ role: 'admin' }));
  });

  test('CRITICAL: Client CAN NEVER read or write private clinical notes', async () => {
    const aliceDb = testEnv.authenticatedContext('alice_uid', { role: 'client' }).firestore();
    const docPath = 'privateClinicalNotes/note_001';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(docPath).set({
        clientId: 'alice_uid',
        therapistId: 'dr_smith',
        encryptedContent: 'Private DAP note content'
      });
    });

    // Client attempts to read private clinical note -> MUST FAIL
    await assertFails(aliceDb.doc(docPath).get());

    // Client attempts to write private clinical note -> MUST FAIL
    await assertFails(aliceDb.doc(docPath).set({ text: 'hacked note' }));
  });

  test('Therapist CAN read private clinical notes and client directory', async () => {
    const therapistDb = testEnv.authenticatedContext('dr_smith', { role: 'therapist' }).firestore();
    const docPath = 'privateClinicalNotes/note_001';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(docPath).set({
        clientId: 'alice_uid',
        therapistId: 'dr_smith',
        encryptedContent: 'DAP note'
      });
    });

    // Therapist reads note -> SUCCEEDS
    await assertSucceeds(therapistDb.doc(docPath).get());
  });

  test('Client can ONLY read shared notes when isPublished is true', async () => {
    const aliceDb = testEnv.authenticatedContext('alice_uid', { role: 'client' }).firestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('sharedNotes/draft_note').set({
        clientId: 'alice_uid',
        title: 'Draft Recap',
        isPublished: false
      });
      await context.firestore().doc('sharedNotes/pub_note').set({
        clientId: 'alice_uid',
        title: 'Published Recap',
        isPublished: true
      });
    });

    // Client reads draft -> FAILS
    await assertFails(aliceDb.doc('sharedNotes/draft_note').get());

    // Client reads published -> SUCCEEDS
    await assertSucceeds(aliceDb.doc('sharedNotes/pub_note').get());
  });
});

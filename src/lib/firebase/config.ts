import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Live Production Firebase Client Configuration
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || "AIzaSyAbqAeDyNj7odD5mcv4K4RAIiiapY2g9Dw",
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || "family-trust-therapy-portal.firebaseapp.com",
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || "family-trust-therapy-portal",
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || "family-trust-therapy-portal.firebasestorage.app",
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "776178397237",
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || "1:776178397237:web:e170fe0e682c59feffc17c"
};

// Initialize App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Local Emulator setup (Requires running 'npx firebase emulators:start' with JDK 21+)
if (import.meta.env.PUBLIC_USE_EMULATORS === 'true') {
  const emulatorHost = window.location.hostname || '127.0.0.1';
  
  // Prevent duplicate emulator connections
  if (!(auth as any)._emulatorConnected) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8085);
    connectStorageEmulator(storage, emulatorHost, 9199);
    (auth as any)._emulatorConnected = true;
  }
}

export { app, auth, db, storage };

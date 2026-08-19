import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  type User,
  getIdTokenResult
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

export type UserRole = 'client' | 'therapist' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'deactivated';
  emailVerified: boolean;
  legalFirstName?: string;
  legalLastName?: string;
  createdAt: any;
  updatedAt: any;
}

/**
 * Client Self-Registration
 */
export async function registerClient(email: string, pass: string, legalFirstName: string, legalLastName: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // 1. Write User record in Firestore immediately
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      role: 'client',
      status: 'active',
      emailVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error("Error creating users document during registration:", err);
  }

  // 2. Write Client profile document in Firestore immediately
  try {
    const clientRef = doc(db, 'clients', user.uid);
    await setDoc(clientRef, {
      uid: user.uid,
      legalFirstName: legalFirstName || 'Client',
      legalLastName: legalLastName || '',
      email,
      accountStatus: 'active',
      intakeStatus: 'not_started',
      consentStatus: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.error("Error creating clients document during registration:", err);
  }

  // 3. Attempt email verification send (safely non-blocking)
  try {
    await sendEmailVerification(user);
  } catch (emailErr) {
    console.warn("Email verification message skipped/deferred:", emailErr);
  }

  return user;
}

/**
 * Fetch Custom Claims or Firestore User Profile
 */
export async function getUserRoleAndProfile(user: User): Promise<{ role: UserRole; profile: UserProfile | null }> {
  // Check custom claims first
  const tokenResult = await getIdTokenResult(user, true);
  const claimRole = tokenResult.claims.role as UserRole | undefined;

  const userDocRef = doc(db, 'users', user.uid);
  const clientDocRef = doc(db, 'clients', user.uid);
  
  const [userSnap, clientSnap] = await Promise.all([
    getDoc(userDocRef),
    getDoc(clientDocRef)
  ]);
  
  // Practice Owner / Primary Developer auto-admin override
  const isOwnerEmail = user.email?.toLowerCase() === 'dev@austintarotreader.com';

  if (isOwnerEmail) {
    try {
      await setDoc(userDocRef, { role: 'admin', status: 'active' }, { merge: true });
    } catch (e) {
      console.warn("Owner role doc write skipped:", e);
    }
  }

  // Check if either document explicitly marks status as deleted or archived
  const userStatus = userSnap.exists() ? userSnap.data().status : null;
  const clientStatus = clientSnap.exists() ? clientSnap.data().accountStatus : null;

  if (userStatus === 'archived' || clientStatus === 'archived') {
    return {
      role: 'client',
      profile: {
        uid: user.uid,
        email: user.email || '',
        role: 'client',
        status: 'archived',
        emailVerified: user.emailVerified
      }
    };
  }

  if (userStatus === 'deleted' || clientStatus === 'deleted') {
    return {
      role: 'client',
      profile: {
        uid: user.uid,
        email: user.email || '',
        role: 'client',
        status: 'deleted',
        emailVerified: user.emailVerified
      }
    };
  }

  if (userSnap.exists()) {
    const profile = userSnap.data() as UserProfile;
    const resolvedRole = claimRole || (isOwnerEmail ? 'admin' : (profile.role || 'client'));
    return {
      role: resolvedRole,
      profile: { ...profile, role: resolvedRole }
    };
  }

  if (clientSnap.exists()) {
    const cData = clientSnap.data();
    const resolvedRole = claimRole || (isOwnerEmail ? 'admin' : 'client');
    return {
      role: resolvedRole,
      profile: {
        uid: user.uid,
        email: user.email || '',
        legalFirstName: cData.legalFirstName,
        legalLastName: cData.legalLastName,
        role: resolvedRole,
        status: cData.accountStatus || 'active',
        emailVerified: user.emailVerified
      }
    };
  }

  // For non-owner users, if neither userSnap nor clientSnap exists, mark as deleted
  if (!isOwnerEmail) {
    return {
      role: 'client',
      profile: {
        uid: user.uid,
        email: user.email || '',
        role: 'client',
        status: 'deleted',
        emailVerified: user.emailVerified
      }
    };
  }

  const defaultRole = claimRole || 'admin';
  return {
    role: defaultRole,
    profile: {
      uid: user.uid,
      email: user.email || '',
      role: defaultRole,
      status: 'active',
      emailVerified: user.emailVerified,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Professional Password Reset
 */
export async function requestPasswordReset(email: string) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Secure Logout
 */
export async function logoutUser() {
  await signOut(auth);
}

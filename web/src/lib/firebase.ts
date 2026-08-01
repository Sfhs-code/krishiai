import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Firebase access layer.
 *
 * The whole SDK is loaded with dynamic `import()` rather than a static one.
 * That keeps ~540 kB out of the first paint, which is the difference between a
 * usable and an unusable cold start on a 2G edge connection — and the app is
 * fully functional (weather, prices, scanning, offline cache) before Firebase
 * has loaded at all. Auth and Firestore pull it in on demand.
 *
 * Every call degrades to local-only mode instead of throwing.
 */

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCqeDB9tB06Y1WF42vwsB7mHT6OCtfKYFE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'krishisathi-sfhs.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'krishisathi-sfhs',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'krishisathi-sfhs.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '936060072912',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:936060072912:web:1a6ece31e0bfaf6af27fd5',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-G46Q0ZMXT6',
};

let appPromise: Promise<FirebaseApp | null> | null = null;

function ensureApp(): Promise<FirebaseApp | null> {
  if (appPromise) return appPromise;
  appPromise = (async () => {
    try {
      const { initializeApp } = await import('firebase/app');
      const app = initializeApp(firebaseConfig);
      // Analytics is optional and blocked by many privacy extensions — it must
      // never be able to break boot.
      void import('firebase/analytics')
        .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => ok && getAnalytics(app)))
        .catch(() => undefined);
      return app;
    } catch (err) {
      console.warn('[firebase] init failed, running local-only', err);
      return null;
    }
  })();
  return appPromise;
}

let authPromise: Promise<Auth | null> | null = null;

export function getFirebaseAuth(): Promise<Auth | null> {
  if (authPromise) return authPromise;
  authPromise = (async () => {
    const app = await ensureApp();
    if (!app) return null;
    try {
      const { getAuth } = await import('firebase/auth');
      return getAuth(app);
    } catch {
      return null;
    }
  })();
  return authPromise;
}

let dbPromise: Promise<Firestore | null> | null = null;

export function getDb(): Promise<Firestore | null> {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const app = await ensureApp();
    if (!app) return null;
    try {
      const { getFirestore } = await import('firebase/firestore');
      return getFirestore(app);
    } catch {
      return null;
    }
  })();
  return dbPromise;
}

/** Subscribe to auth state. Returns an unsubscribe that is safe to call early. */
export function watchAuth(cb: (user: User | null) => void): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    const auth = await getFirebaseAuth();
    if (cancelled) return;
    if (!auth) {
      cb(null);
      return;
    }
    const { onAuthStateChanged } = await import('firebase/auth');
    if (cancelled) return;
    unsub = onAuthStateChanged(auth, cb, () => cb(null));
  })();

  return () => {
    cancelled = true;
    unsub?.();
  };
}

export async function signInWithGoogle(): Promise<User | null> {
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error('firebase-unavailable');
  const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  return cred.user;
}

export async function continueAsGuest(): Promise<User | null> {
  const auth = await getFirebaseAuth();
  if (!auth) throw new Error('firebase-unavailable');
  const { signInAnonymously } = await import('firebase/auth');
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function signOut(): Promise<void> {
  const auth = await getFirebaseAuth();
  if (!auth) return;
  const { signOut: fbSignOut } = await import('firebase/auth');
  await fbSignOut(auth);
}

/* -------------------------------------------------------------- firestore */

/** Best-effort cloud sync of the farm profile. Never throws. */
export async function syncFarmProfile(uid: string, profile: unknown): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
    await setDoc(doc(db, 'farmers', uid), { profile, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[firebase] profile sync skipped', err);
  }
}

export async function fetchFarmProfile<T>(uid: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'farmers', uid));
    return snap.exists() ? ((snap.data().profile as T) ?? null) : null;
  } catch {
    return null;
  }
}

export async function pushDiaryEntry(uid: string, entry: Record<string, unknown>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('firebase-unavailable');
  const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
  await addDoc(collection(db, 'farmers', uid, 'diary'), { ...entry, createdAt: serverTimestamp() });
}

export async function fetchDiary(uid: string, max = 50): Promise<Record<string, unknown>[]> {
  try {
    const db = await getDb();
    if (!db) return [];
    const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
    const q = query(collection(db, 'farmers', uid, 'diary'), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map((s) => ({ id: s.id, ...s.data() }));
  } catch {
    return [];
  }
}

export type { User };

// Firebase Admin সংযোগ: সার্ভার ছাড়া ডাটাবেসে কেউ ঢুকতে পারে না
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function loadServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT সেট করা নেই. Service account JSON এর base64 বসান।'
    );
  }
  // সরাসরি JSON অথবা base64 দুটোই চলবে
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT পড়া যাচ্ছে না. base64 ঠিক আছে কিনা দেখুন।');
  }
  if (json.private_key) json.private_key = json.private_key.replace(/\\n/g, '\n');
  return json;
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp({ credential: cert(loadServiceAccount()) });

export const db = getFirestore(app);
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // settings আগেই সেট হয়ে থাকলে সমস্যা নেই
}

export const auth = getAuth(app);
export { FieldValue, Timestamp };

// অ্যাডমিন চেনার নিয়ম: শুধু ADMIN_UIDS তালিকার UID
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const isAdminUid = (uid) => !!uid && ADMIN_UIDS.includes(uid);
export const adminCount = () => ADMIN_UIDS.length;

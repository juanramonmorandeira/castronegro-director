// src/lib/auth.js
// Thin wrappers around Firebase client Auth.

import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut
} from 'firebase/auth';

import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const FALLBACK_APP_URL = 'https://storyteller.morandeira.net';

function resolveAppUrl(path = '') {
  const base =
    typeof window !== 'undefined' && window?.location?.origin
      ? window.location.origin
      : FALLBACK_APP_URL;
  const normalizedBase = base.replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return normalizedPath ? `${normalizedBase}/${normalizedPath}` : normalizedBase;
}

export async function loginWithEmail(email, password) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('missing_credentials');
  }
  const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);

  // marca el último login (ignora si la colección no existe)
  try {
    await setDoc(
      doc(db, 'users', cred.user.uid),
      { last_login_at: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.warn('Unable to update last_login_at:', error);
  }
  return cred.user;
}

export async function registerWithEmail(email, password, profile = {}) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error('missing_credentials');
  }
  const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
  const uid = cred.user.uid;
  const trimmedName = profile.name?.trim() ?? '';
  const trimmedAlias = profile.alias?.trim() ?? '';
  const avatarUrl = profile.avatarURL?.trim() ?? '';

  // Actualiza el perfil visible en Firebase Auth (displayName + photoURL)
  try {
    await updateProfile(cred.user, {
      displayName: trimmedName || undefined,
      photoURL: avatarUrl || undefined
    });
  } catch (error) {
    console.warn('Unable to update auth profile:', error);
  }

  // Perfil mínimo (sin password)
  const payload = {
    auth_uid: uid,
    email: cred.user.email ?? normalizedEmail,
    name: trimmedName,
    alias: trimmedAlias,
    avatarURL: avatarUrl,
    status: 'inactive',
    created_at: serverTimestamp(),
    last_login_at: serverTimestamp()
  };
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
  return cred.user;
}

export async function sendPasswordResetIfExists(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const resetUrl = resolveAppUrl('login');
  try {
    const actionCodeSettings =
      typeof window !== 'undefined'
        ? {
            url: resetUrl,
            handleCodeInApp: false
          }
        : {
            url: resetUrl,
            handleCodeInApp: false
          };

    await sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);
    return true;
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return false;
    }
    throw error;
  }
}

// Enviar verificación al usuario actual
export async function sendVerificationEmail() {
  // auth viene de ./firebase.js (ya exportado en tu proyecto)
  if (!auth.currentUser) throw new Error('no_current_user');
  const actionCodeSettings = {
    url: resolveAppUrl('login'),
    handleCodeInApp: false
  };
  await sendEmailVerification(auth.currentUser, actionCodeSettings);
  return true;
}

async function reauthenticateIfNeeded(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('no_current_user');
  if (!currentPassword) {
    return user;
  }
  if (!user.email) throw new Error('missing_email');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return user;
}

export async function fetchCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const docRef = doc(db, 'users', user.uid);
  const snap = await getDoc(docRef);
  const data = snap.exists() ? snap.data() : {};
  return {
    uid: user.uid,
    email: user.email ?? data.email ?? '',
    name: data.name ?? user.displayName ?? '',
    alias: data.alias ?? '',
    avatarURL: data.avatarURL ?? '',
    status: data.status ?? 'inactive'
  };
}

export async function updateUserProfile(profile = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('no_current_user');
  const trimmedName = profile.name?.trim() ?? '';
  const trimmedAlias = profile.alias?.trim() ?? '';
  const avatarUrl = profile.avatarURL?.trim() ?? '';

  await updateProfile(user, {
    displayName: trimmedName || undefined,
    photoURL: avatarUrl || undefined
  });

  await setDoc(
    doc(db, 'users', user.uid),
    {
      name: trimmedName,
      alias: trimmedAlias,
      avatarURL: avatarUrl,
      updated_at: serverTimestamp()
    },
    { merge: true }
  );

  return fetchCurrentUserProfile();
}

export async function changeUserPassword(currentPassword, newPassword) {
  const user = await reauthenticateIfNeeded(currentPassword);
  if (!newPassword) throw new Error('missing_new_password');
  await updatePassword(user, newPassword);
  return true;
}

export async function changeUserEmail(currentPassword, newEmail) {
  const normalized = newEmail?.trim().toLowerCase();
  if (!normalized) throw new Error('missing_new_email');
  const user = await reauthenticateIfNeeded(currentPassword);
  await updateEmail(user, normalized);
  await setDoc(
    doc(db, 'users', user.uid),
    {
      email: normalized,
      status: 'inactive',
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
  await sendVerificationEmail();
  return true;
}

export async function signOutUser() {
  await signOut(auth);
}

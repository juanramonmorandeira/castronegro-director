// src/lib/auth.js
// Thin wrappers around Firebase client Auth.

import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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
    userId: uid,
    auth_uid: uid,
    email: cred.user.email ?? normalizedEmail,
    name: trimmedName,
    alias: trimmedAlias,
    avatarURL: avatarUrl,
    avatarDriveId: profile.avatarDriveId ?? '',
    status: 'inactive',
    created_at: serverTimestamp(),
    last_login_at: serverTimestamp()
  };
  await setDoc(doc(db, 'users', uid), payload, { merge: true });
  return cred.user;
}

export async function sendPasswordResetIfExists(email) {
  const normalizedEmail = email.trim().toLowerCase();
  try {
    const actionCodeSettings =
      typeof window !== 'undefined'
        ? {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false
          }
        : {
            url: 'https://village-storyteller.web.app/login',
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
  await sendEmailVerification(auth.currentUser);
  return true;
}

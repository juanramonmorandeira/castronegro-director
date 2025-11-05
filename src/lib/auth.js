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
  applyActionCode,
  checkActionCode,
  deleteUser,
  signOut
} from 'firebase/auth';

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs
} from 'firebase/firestore';

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
  const { user } = cred;

  if (!user.emailVerified) {
    await signOut(auth);
    const error = new Error('email_not_verified');
    error.code = 'auth/email-not-verified';
    throw error;
  }

  const userRef = doc(db, 'users', user.uid);
  let profileData = null;

  try {
    const snap = await getDoc(userRef);
    profileData = snap.exists() ? snap.data() : null;
  } catch (error) {
    console.warn('Unable to read user profile:', error);
  }

  let status = profileData?.status ?? 'inactive';
  const inactiveReason = profileData?.inactive_reason ?? null;
  const pendingVerification =
    status !== 'active' && (!inactiveReason || inactiveReason === 'pending_verification');

  const now = serverTimestamp();

  if (pendingVerification && user.emailVerified) {
    try {
      const updates = {
        status: 'active',
        inactive_reason: null,
        last_login_at: now,
        updated_at: now
      };
      if (!profileData?.activated_at) {
        updates.activated_at = now;
      }
      await setDoc(
        userRef,
        updates,
        { merge: true }
      );
      status = 'active';
    } catch (error) {
      console.warn('Unable to activate user profile during login:', error);
    }
  }

  if (status !== 'active') {
    await signOut(auth);
    const error = new Error('account_inactive');
    error.code = 'auth/user-inactive';
    error.details = { inactiveReason: inactiveReason ?? null };
    throw error;
  }

  if (!profileData) {
    try {
      await setDoc(
        userRef,
        {
          auth_uid: user.uid,
          email: user.email ?? normalizedEmail,
          status: 'active',
          inactive_reason: null,
          created_at: now,
          activated_at: now,
          last_login_at: now
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Unable to create user profile during login:', error);
    }
  } else {
    try {
      await setDoc(
        userRef,
        {
          last_login_at: now,
          updated_at: now
        },
        { merge: true }
      );
    } catch (error) {
      console.warn('Unable to update last_login_at:', error);
    }
  }

  return user;
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
    inactive_reason: 'pending_verification',
    activated_at: null,
    created_at: serverTimestamp(),
    last_login_at: null
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
    url: resolveAppUrl('verify'),
    handleCodeInApp: true
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
    status: data.status ?? 'inactive',
    inactiveReason: data.inactive_reason ?? null,
    activatedAt: data.activated_at ?? null,
    createdAt: data.created_at ?? null,
    lastLoginAt: data.last_login_at ?? null
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
      inactive_reason: 'pending_verification',
      activated_at: null,
      updated_at: serverTimestamp()
    },
    { merge: true }
  );
  await sendVerificationEmail();
  return true;
}

export async function confirmEmailVerification(oobCode) {
  if (!oobCode) {
    const error = new Error('missing_oob_code');
    error.code = 'auth/missing-oob-code';
    throw error;
  }

  let info;
  try {
    info = await checkActionCode(auth, oobCode);
  } catch (error) {
    throw error;
  }

  await applyActionCode(auth, oobCode);

  const emailFromCode = info?.data?.email ?? info?.data?.newEmail ?? null;
  const normalizedEmail = emailFromCode?.trim().toLowerCase() ?? null;
  let activated = false;

  if (normalizedEmail) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', normalizedEmail), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        const currentData = userDoc.data() ?? {};
        const updates = {
          status: 'active',
          inactive_reason: null,
          updated_at: serverTimestamp()
        };
        if (currentData.status !== 'active' || !currentData.activated_at) {
          updates.activated_at = serverTimestamp();
        }
        await setDoc(
          userDoc.ref,
          updates,
          { merge: true }
        );
        activated = true;
      } else {
        console.warn('No user profile found for verified email:', normalizedEmail);
      }
    } catch (error) {
      console.warn('Unable to update user profile after email verification:', error);
    }
  }

  return {
    email: normalizedEmail,
    activated
  };
}

export async function signOutUser() {
  await signOut(auth);
}

export async function deleteCurrentUser(currentPassword) {
  const user = await reauthenticateIfNeeded(currentPassword);
  if (!user) throw new Error('no_current_user');
  const uid = user.uid;

  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    console.warn('Unable to delete user profile document:', error);
  }

  await deleteUser(user);
  return true;
}

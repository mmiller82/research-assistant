export async function signInTestUser(apiKey, email, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(`Firebase sign-in failed: ${error?.message}`);
  }
  return res.json(); // { localId, email, idToken, refreshToken, expiresIn, ... }
}

export function buildFirebaseUser(apiKey, { localId, email, idToken, refreshToken, expiresIn }) {
  const now = Date.now();
  return {
    uid: localId,
    email,
    emailVerified: true,
    displayName: 'E2E Test User',
    isAnonymous: false,
    photoURL: null,
    providerData: [
      {
        uid: email,
        displayName: 'E2E Test User',
        photoURL: null,
        email,
        phoneNumber: null,
        providerId: 'password',
      },
    ],
    stsTokenManager: {
      refreshToken,
      accessToken: idToken,
      expirationTime: now + parseInt(expiresIn, 10) * 1000,
    },
    createdAt: String(now),
    lastLoginAt: String(now),
    apiKey,
    appName: '[DEFAULT]',
  };
}

import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider, signInWithPopup } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  apiGatewayKey: import.meta.env.VITE_API_GATEWAY_KEY,
  apiUrl: import.meta.env.VITE_API_GATEWAY_URL,
  cloudRunUrl: import.meta.env.VITE_CLOUD_RUN_URL,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

export const GithubAuthentication = async () => {
  const githubProvider = new GithubAuthProvider();

  try {
    // Sign in the user with GitHub popup
    const result = await signInWithPopup(auth, githubProvider);

    // This gives you a GitHub Access Token. You can use it to access the GitHub API.
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;

    // The signed-in user info.
    const user = result.user;
    console.log('User Info:', user);

    return {
      token,
      user: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      }
    };
  } catch (error) {
    // Handle Errors here.
    console.error('Authentication error:', error);
    const errorCode = error.code;
    const errorMessage = error.message;

    // Throw error with useful message
    throw new Error(`Authentication failed: ${errorMessage} (${errorCode})`);
  }
};

export const signOutUser = async () => {
  try {
    await auth.signOut();
    console.log('User signed out successfully');
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};





import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import Login from './Login';
import SignUp from './SignUp';
import BuyMeACoffeeButton from '../ui/BuyMeACoffeeButton';
import './Auth.css';

const getAuthErrorMessage = (error, action) => {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is incorrect.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a little before trying again.';
    case 'auth/network-request-failed':
      return 'Connection failed. Check your internet connection and try again.';
    case 'auth/popup-blocked':
      return 'Your browser blocked Google sign-in. Allow pop-ups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'Use the sign-in method you originally used for this account.';
    case 'auth/user-disabled':
      return 'This account is disabled. Contact support for help.';
    case 'auth/email-already-in-use':
      return 'Unable to create an account with this email. Try signing in or resetting your password.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    default:
      return action === 'reset'
        ? 'Unable to send a reset email right now. Please try again.'
        : 'Unable to continue right now. Please try again.';
  }
};

/**
 * Checks if a user profile document exists in Firestore for a given user.
 * If the profile does not exist, it creates a new one with default settings
 * and a default display name.
 * @param {object} user - The Firebase Authentication user object, obtained after sign-in.
 * @returns {Promise<void>} A promise that resolves once the check and potential creation are complete.
 */
const checkAndCreateUserProfile = async (user) => {
  const userDocRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userDocRef);
  
  if (!docSnap.exists()) {
    await setDoc(userDocRef, {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      createdAt: serverTimestamp(),
      gridWidth: 30,
      gridHeight: 10,
    });
    toast.success("Welcome! Your profile has been created.");
  }
};

/**
 * A component that handles the user authentication flow. It conditionally renders
 * either a Login or a Sign-Up form and provides the logic for switching between
 * them and for handling Google sign-in.
 * @param {object} props - The component props.
 * @param {Function} props.onShowPolicy - A callback function to show a policy document.
 * @returns {JSX.Element} The Login or SignUp component, based on the current state.
 */
export default function Auth({ onShowPolicy }) {
  const [showLogin, setShowLogin] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState('');
  const actionInProgress = useRef(false);

  const runAuthAction = async (action, operation) => {
    if (actionInProgress.current) return false;
    actionInProgress.current = true;
    setPendingAction(action);
    setError('');
    try {
      await operation();
      return true;
    } catch (err) {
      if (action === 'reset' && err.code === 'auth/user-not-found') return true;
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(getAuthErrorMessage(err, action));
      }
      return false;
    } finally {
      actionInProgress.current = false;
      setPendingAction(null);
    }
  };

  const switchView = (login) => {
    if (actionInProgress.current) return;
    setError('');
    setShowLogin(login);
  };

  const handleSignIn = (email, password) => runAuthAction('email', () =>
    signInWithEmailAndPassword(auth, email, password)
  );

  const handleResetPassword = (email) => runAuthAction('reset', () =>
    sendPasswordResetEmail(auth, email)
  );

  const handleGoogleSignIn = () => runAuthAction('google', async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await checkAndCreateUserProfile(result.user);
  });
  
  return (
    <>
      <div className="auth__form-container">
        {showLogin ? (
          <Login 
            onSwitchToSignUp={() => switchView(false)}
            onSignIn={handleSignIn}
            onResetPassword={handleResetPassword}
            onGoogleSignIn={handleGoogleSignIn}
            pendingAction={pendingAction}
            error={error}
            onClearError={() => setError('')}
          />
        ) : (
          <SignUp 
            onSwitchToLogin={() => switchView(true)}
            onShowPolicy={onShowPolicy}
            onGoogleSignIn={handleGoogleSignIn}
            runAuthAction={runAuthAction}
            pendingAction={pendingAction}
            error={error}
            onClearError={() => setError('')}
          />
        )}
      </div>
      <footer className="auth__footer">
        <BuyMeACoffeeButton />
      </footer>
    </>
  );
}
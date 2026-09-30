import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Login from './Login';
import SignUp from './SignUp';
import './Auth.css';

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

const BuyMeACoffeeButton = () => (
  <a 
    href="https://paypal.me/simonecervini" 
    target="_blank" 
    rel="noopener noreferrer"
    className="auth__support"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="auth__support-icon" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
      <path d="M2 10.5V15a2 2 0 002 2h12a2 2 0 002-2v-4.5A2.5 2.5 0 0017.5 8h-15A2.5 2.5 0 000 10.5zM10 13a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
    <span>Enjoying the app? Support the project!</span>
  </a>
);

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

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await checkAndCreateUserProfile(result.user);
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  return (
    <>
      <div className="auth__form-container">
        {showLogin ? (
          <Login 
            onSwitchToSignUp={() => setShowLogin(false)} 
            onGoogleSignIn={handleGoogleSignIn}
          />
        ) : (
          <SignUp 
            onSwitchToLogin={() => setShowLogin(true)} 
            onShowPolicy={onShowPolicy}
            onGoogleSignIn={handleGoogleSignIn}
          />
        )}
      </div>
      <BuyMeACoffeeButton />
    </>
  );
}
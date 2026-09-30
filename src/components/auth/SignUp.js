import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import './SignUp.css';

export default function SignUp({ onSwitchToLogin, onShowPolicy, onGoogleSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handles the user sign-up process with email and password.
   * On successful creation of the Firebase Auth user, it also creates a
   * corresponding user profile document in Firestore with default values.
   */
  const handleSignUp = async () => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.email.split('@')[0],
        gridWidth: 30,
        gridHeight: 10,
        createdAt: serverTimestamp(),
      });
      toast.success("Account created successfully!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sign-up">
      <h2 className="sign-up__title">
        Create Account
      </h2>
      <div className="sign-up__email">
        <label className="sign-up__label" htmlFor="signup-email">
          Email
        </label>
        <input
          className="sign-up__input"
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="sign-up__password">
        <label className="sign-up__label" htmlFor="signup-password">
          Password
        </label>
        <input
          className="sign-up__input"
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="sign-up__submit">
        <button
          className="sign-up__button"
          type="button"
          onClick={handleSignUp}
          disabled={loading}
        >
          {loading ? '...' : 'Sign Up'}
        </button>
      </div>

       <div className="sign-up__divider">
        <div className="sign-up__divider-line"></div>
        <span className="sign-up__divider-label">OR</span>
        <div className="sign-up__divider-line"></div>
      </div>
      
      <div>
        <button onClick={onGoogleSignIn} className="sign-up__google">
          <svg className="sign-up__google-icon" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.021,44,30.019,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg> 
          <span className="sign-up__google-label">Sign Up with Google</span>
        </button>
      </div>

      <p className="sign-up__footer-text">
        By signing up, you agree to our 
       <button onClick={onShowPolicy} className="sign-up__footer-link">
          Privacy Policy
        </button>.
      </p>
      <p className="sign-up__footer-text">
        Already have an account? 
        <button onClick={onSwitchToLogin} className="sign-up__footer-link">
          Login
        </button>
      </p>
    </div>
  );
}
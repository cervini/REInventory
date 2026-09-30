import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { auth } from '../../firebase';
import { signInWithEmailAndPassword } from "firebase/auth";
import './Login.css';

export default function Login({ onSwitchToSignUp, onGoogleSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Handles user sign-in using email and password with Firebase Authentication.
   */
  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Allows the user to submit the login form by pressing the 'Enter' key.
   * @param {React.KeyboardEvent} e - The keyboard event.
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSignIn();
    }
  };

  return (
    <div className="login">
      <h2 className="login__title">
        Login
      </h2>
      <div className="login__email">
        <label className="login__label" htmlFor="login-email">
          Email
        </label>
        <input
          className="login__input"
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="login__password">
        <label className="login__label" htmlFor="login-password">
          Password
        </label>
        <input
          className="login__input"
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="login__submit">
        <button
          className="login__sign-in"
          type="button"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? '...' : 'Sign In'}
        </button>
      </div>
      
      <div className="login__divider">
        <div className="login__divider-line"></div>
        <span className="login__divider-label">OR</span>
        <div className="login__divider-line"></div>
      </div>
      
      <div>
        <button onClick={onGoogleSignIn} className="login__google">
          <svg className="login__google-icon" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.021,44,30.019,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg> 
          <span className="login__google-label">Sign In with Google</span>
        </button>
      </div>

      <p className="login__signup">
        Don't have an account? 
        <button onClick={onSwitchToSignUp} className="login__signup-link">
          Sign Up
        </button>
      </p>
    </div>
  );
}
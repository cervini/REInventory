import React, { useRef, useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import './SignUp.css';

export default function SignUp({ onSwitchToLogin, onShowPolicy, onGoogleSignIn, runAuthAction, pendingAction, error, onClearError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const passwordInput = useRef(null);
  const confirmationInput = useRef(null);
  const loading = Boolean(pendingAction);
  const message = validationError || error;

  const clearErrors = () => {
    setValidationError('');
    onClearError();
  };

  /**
   * Handles the user sign-up process with email and password.
   * On successful creation of the Firebase Auth user, it also creates a
   * corresponding user profile document in Firestore with default values.
   */
  const handleSignUp = async (event) => {
    event.preventDefault();
    if (loading || !event.currentTarget.reportValidity()) return;
    clearErrors();
    if (password.length < 6) {
      setValidationError('Use at least 6 characters for your password.');
      passwordInput.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords don't match.");
      confirmationInput.current?.focus();
      return;
    }
    await runAuthAction('signup', async () => {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: user.email.split('@')[0],
        gridWidth: 30,
        gridHeight: 10,
        createdAt: serverTimestamp(),
      });
      toast.success("Account created successfully!");
    });
  };

  return (
    <form className="sign-up" onSubmit={handleSignUp} aria-labelledby="signup-title" aria-busy={loading}>
      <h2 className="sign-up__title" id="signup-title">
        Create Account
      </h2>
      {message && <p className="sign-up__message" id="signup-error" role="alert">{message}</p>}
      <div className="sign-up__email">
        <label className="sign-up__label" htmlFor="signup-email">
          Email
        </label>
        <input
          className="sign-up__input"
          id="signup-email"
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          readOnly={loading}
          aria-describedby={message ? 'signup-error' : undefined}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            clearErrors();
          }}
        />
      </div>
      <div className="sign-up__password">
        <label className="sign-up__label" htmlFor="signup-password">
          Password
        </label>
        <div className="sign-up__password-control">
          <input
            className="sign-up__input sign-up__input--password"
            id="signup-password"
            ref={passwordInput}
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            required
            minLength={6}
            readOnly={loading}
            aria-describedby={`signup-password-hint${message ? ' signup-error' : ''}`}
            aria-invalid={Boolean(validationError && password.length < 6) || undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearErrors();
            }}
          />
          <button
            className="sign-up__password-toggle"
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-controls="signup-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </button>
        </div>
        <p className="sign-up__hint" id="signup-password-hint">At least 6 characters.</p>
      </div>
      <div className="sign-up__confirmation">
        <label className="sign-up__label" htmlFor="signup-confirm-password">Confirm password</label>
        <div className="sign-up__password-control">
          <input
            className="sign-up__input sign-up__input--password"
            id="signup-confirm-password"
            ref={confirmationInput}
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            autoComplete="new-password"
            required
            readOnly={loading}
            aria-describedby={message ? 'signup-error' : undefined}
            aria-invalid={Boolean(validationError && password !== confirmPassword) || undefined}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearErrors();
            }}
          />
          <button
            className="sign-up__password-toggle"
            type="button"
            aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
            title={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
            aria-controls="signup-confirm-password"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="sign-up__submit">
        <button
          className="sign-up__button"
          type="submit"
          disabled={loading}
        >
          {pendingAction === 'signup' ? 'Creating account...' : 'Create account'}
        </button>
      </div>

      <div className="sign-up__divider" aria-hidden="true">
        <div className="sign-up__divider-line"></div>
        <span className="sign-up__divider-label">OR</span>
        <div className="sign-up__divider-line"></div>
      </div>
      
      <div>
        <button type="button" onClick={onGoogleSignIn} className="sign-up__google" disabled={loading}>
          <svg className="sign-up__google-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.021,44,30.019,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg> 
          <span className="sign-up__google-label">{pendingAction === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>
      </div>

      <p className="sign-up__footer-text sign-up__policy">
        By signing up, you agree to our{' '}
        <button type="button" onClick={onShowPolicy} className="sign-up__footer-link" disabled={loading}>
          Privacy Policy
        </button>.
      </p>
      <p className="sign-up__footer-text">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} className="sign-up__footer-link" disabled={loading}>
          Sign in
        </button>
      </p>
    </form>
  );
}
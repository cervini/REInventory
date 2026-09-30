import React, { useRef, useState } from 'react';
import { ArrowLeftIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import './Login.css';

export default function Login({ onSwitchToSignUp, onSignIn, onResetPassword, onGoogleSignIn, pendingAction, error, onClearError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const emailInput = useRef(null);
  const loading = Boolean(pendingAction);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading || !event.currentTarget.reportValidity()) return;
    if (resetMode) {
      if (resetSent) return;
      const sent = await onResetPassword(email.trim());
      setResetSent(sent);
    } else {
      await onSignIn(email.trim(), password);
    }
  };

  const switchMode = (reset) => {
    if (loading) return;
    onClearError();
    setResetSent(false);
    setResetMode(reset);
    emailInput.current?.focus();
  };

  return (
    <form className="login" onSubmit={handleSubmit} aria-labelledby="login-title" aria-busy={loading}>
      <h2 className="login__title" id="login-title">
        {resetMode ? 'Reset password' : 'Login'}
      </h2>
      {error && <p className="login__message login__message--error" id="login-error" role="alert">{error}</p>}
      {resetSent && (
        <p className="login__message login__message--success" role="status">
          If an account uses this email, you'll receive a password reset link. Check your inbox and spam folder.
        </p>
      )}
      <div className="login__email">
        <label className="login__label" htmlFor="login-email">
          Email
        </label>
        <input
          className="login__input"
          id="login-email"
          ref={emailInput}
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          readOnly={loading}
          aria-describedby={error ? 'login-error' : undefined}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setResetSent(false);
            onClearError();
          }}
        />
      </div>
      {!resetMode && (
      <div className="login__password">
        <div className="login__password-label">
          <label className="login__label" htmlFor="login-password">Password</label>
          <button className="login__text-button" type="button" onClick={() => switchMode(true)} disabled={loading}>
            Forgot password?
          </button>
        </div>
        <div className="login__password-control">
          <input
            className="login__input login__input--password"
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            required
            readOnly={loading}
            aria-describedby={error ? 'login-error' : undefined}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              onClearError();
            }}
          />
          <button
            className="login__password-toggle"
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            aria-controls="login-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeSlashIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
          </button>
        </div>
      </div>
      )}
      <div className="login__submit">
        <button
          className="login__sign-in"
          type="submit"
          disabled={loading || (resetMode && resetSent)}
        >
          {pendingAction === 'email' ? 'Signing in...'
            : pendingAction === 'reset' ? 'Sending reset link...'
            : resetMode ? (resetSent ? 'Reset link requested' : 'Send reset link') : 'Sign in'}
        </button>
      </div>
      
      {!resetMode && <>
      <div className="login__divider" aria-hidden="true">
        <div className="login__divider-line"></div>
        <span className="login__divider-label">OR</span>
        <div className="login__divider-line"></div>
      </div>
      
      <div>
        <button type="button" onClick={onGoogleSignIn} className="login__google" disabled={loading}>
          <svg className="login__google-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.021,44,30.019,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
          </svg> 
          <span className="login__google-label">{pendingAction === 'google' ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>
      </div>

      <p className="login__signup">
        Don't have an account? 
        <button type="button" onClick={onSwitchToSignUp} className="login__signup-link" disabled={loading}>
          Sign up
        </button>
      </p>
      </>}
      {resetMode && (
        <button className="login__back" type="button" onClick={() => switchMode(false)} disabled={loading}>
          <ArrowLeftIcon aria-hidden="true" />
          Back to login
        </button>
      )}
    </form>
  );
}
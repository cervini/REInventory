import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import Auth from '../components/auth/Auth';

jest.mock('../firebase', () => ({ auth: {}, db: {} }));
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

beforeEach(() => {
  jest.resetAllMocks();
  getDoc.mockResolvedValue({ exists: () => true });
});

const fillLogin = () => {
  userEvent.type(screen.getByLabelText('Email'), 'player@example.com');
  userEvent.type(screen.getByLabelText('Password'), 'correct horse battery staple');
};

test('uses the shared support link on the authentication page', () => {
  render(<Auth />);
  const supportLink = screen.getByRole('link', { name: 'Support the project' });
  expect(supportLink).toHaveClass('buy-me-a-coffee-button');
  expect(supportLink).toHaveAttribute('href', 'https://paypal.me/simonecervini');
  expect(supportLink).toHaveAttribute('target', '_blank');
  expect(supportLink).toHaveAttribute('rel', 'noopener noreferrer');
  expect(supportLink.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});

test('submits a validated login with Enter and preserves the password', async () => {
  signInWithEmailAndPassword.mockResolvedValue({});
  render(<Auth />);
  fillLogin();
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  userEvent.type(screen.getByLabelText('Password'), '{enter}');
  await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'player@example.com', 'correct horse battery staple'));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
});

test('does not submit empty or malformed email fields', () => {
  render(<Auth />);
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
  userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
  userEvent.type(screen.getByLabelText('Password'), 'password');
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByLabelText('Email').validity.valid).toBe(false);
  expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
});

test('toggles password visibility without changing its value', () => {
  render(<Auth />);
  userEvent.type(screen.getByLabelText('Password'), 'a secret');
  userEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText('Password')).toHaveValue('a secret');
  userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
});

test.each([
  ['auth/invalid-credential', 'Email or password is incorrect.'],
  ['auth/network-request-failed', 'Connection failed. Check your internet connection and try again.'],
  ['auth/too-many-requests', 'Too many attempts. Please wait a little before trying again.'],
  ['unknown', 'Unable to continue right now. Please try again.'],
])('shows a readable error for %s and allows retry', async (code, message) => {
  signInWithEmailAndPassword.mockRejectedValueOnce({ code, message: 'Raw Firebase details' }).mockResolvedValue({});
  render(<Auth />);
  fillLogin();
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(message);
  expect(screen.queryByText('Raw Firebase details')).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
});

test('locks all authentication actions and rejects duplicate form submissions', async () => {
  let finishSignIn;
  signInWithEmailAndPassword.mockImplementation(() => new Promise((resolve) => { finishSignIn = resolve; }));
  render(<Auth />);
  fillLogin();
  const form = screen.getByRole('form', { name: 'Login' });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(signInWithEmailAndPassword).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(signInWithPopup).not.toHaveBeenCalled();
  await act(async () => finishSignIn({}));
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

test('Google sign-in shares the busy state and preserves existing profile handling', async () => {
  let finishGoogle;
  signInWithPopup.mockImplementation(() => new Promise((resolve) => { finishGoogle = resolve; }));
  render(<Auth />);
  userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(screen.getByRole('button', { name: 'Connecting to Google...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  await act(async () => finishGoogle({ user: { uid: 'player', email: 'player@example.com' } }));
  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

test.each([
  ['auth/popup-closed-by-user', null],
  ['auth/popup-blocked', 'Your browser blocked Google sign-in. Allow pop-ups for this site and try again.'],
])('handles Google %s without leaking Firebase errors', async (code, message) => {
  signInWithPopup.mockRejectedValue({ code });
  render(<Auth />);
  userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
  if (message) expect(screen.getByRole('alert')).toHaveTextContent(message);
  else expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([false, true])('password reset confirms neutrally even when an account is missing: %s', async (missingAccount) => {
  if (missingAccount) sendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });
  else sendPasswordResetEmail.mockResolvedValue();
  render(<Auth />);
  userEvent.type(screen.getByLabelText('Email'), 'player@example.com');
  userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toHaveFocus();
  userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If an account uses this email');
  expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, 'player@example.com');
  expect(screen.getByRole('button', { name: 'Reset link requested' })).toBeDisabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Back to login' }));
  expect(screen.getByLabelText('Email')).toHaveValue('player@example.com');
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('password reset validates email, shows network failures and permits retry', async () => {
  sendPasswordResetEmail.mockRejectedValueOnce({ code: 'auth/network-request-failed' }).mockResolvedValue();
  render(<Auth />);
  userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
  userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  userEvent.type(screen.getByLabelText('Email'), 'player@example.com');
  userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.');
  userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  expect(await screen.findByRole('status')).toHaveTextContent('If an account uses this email');
});

test('signup also blocks email registration while Google sign-in is pending', async () => {
  let finishGoogle;
  signInWithPopup.mockImplementation(() => new Promise((resolve) => { finishGoogle = resolve; }));
  render(<Auth />);
  userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
  userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  await act(async () => finishGoogle({ user: { uid: 'player', email: 'player@example.com' } }));
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

const openSignup = (props = {}) => {
  render(<Auth {...props} />);
  userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
};

const fillSignup = (password = 'correct horse battery staple', confirmation = password) => {
  userEvent.type(screen.getByLabelText('Email'), 'player@example.com');
  userEvent.type(screen.getByLabelText('Password'), password);
  userEvent.type(screen.getByLabelText('Confirm password'), confirmation);
};

test('creates an account with Enter and saves the existing profile defaults', async () => {
  const profileRef = { id: 'player' };
  const timestamp = { seconds: 1 };
  doc.mockReturnValue(profileRef);
  serverTimestamp.mockReturnValue(timestamp);
  createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: 'player', email: 'player@example.com' } });
  setDoc.mockResolvedValue();
  openSignup();
  fillSignup();
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password');
  userEvent.type(screen.getByLabelText('Confirm password'), '{enter}');
  await waitFor(() => expect(setDoc).toHaveBeenCalledWith(profileRef, {
    email: 'player@example.com', displayName: 'player', gridWidth: 30, gridHeight: 10, createdAt: timestamp,
  }));
  expect(createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'player@example.com', 'correct horse battery staple');
  expect(doc).toHaveBeenCalledWith({}, 'users', 'player');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled());
});

test('signup rejects empty fields and malformed email before calling Firebase', () => {
  openSignup();
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  fillSignup();
  userEvent.clear(screen.getByLabelText('Email'));
  userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByLabelText('Email').validity.valid).toBe(false);
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
});

test('signup rejects short passwords before calling Firebase', () => {
  openSignup();
  fillSignup('short');
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Use at least 6 characters');
  expect(screen.getByLabelText('Password')).toHaveFocus();
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
});

test('signup rejects mismatched confirmation and clears its error after editing', () => {
  openSignup();
  fillSignup('long-password', 'different-password');
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(screen.getByRole('alert')).toHaveTextContent("Passwords don't match.");
  expect(screen.getByLabelText('Confirm password')).toHaveFocus();
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true');
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  userEvent.clear(screen.getByLabelText('Confirm password'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Confirm password')).not.toHaveAttribute('aria-invalid');
});

test('signup password fields have independent visibility toggles that do not submit', () => {
  openSignup();
  fillSignup();
  userEvent.click(screen.getByRole('button', { name: 'Show password', exact: true }));
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  userEvent.click(screen.getByRole('button', { name: 'Show confirmation password' }));
  expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text');
  userEvent.click(screen.getByRole('button', { name: 'Hide password', exact: true }));
  userEvent.click(screen.getByRole('button', { name: 'Hide confirmation password' }));
  expect(screen.getByLabelText('Password')).toHaveValue('correct horse battery staple');
  expect(screen.getByLabelText('Confirm password')).toHaveValue('correct horse battery staple');
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
});

test('signup network errors can be corrected and retried without raw Firebase messages', async () => {
  createUserWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/network-request-failed', message: 'Raw details' })
    .mockResolvedValue({ user: { uid: 'player', email: 'player@example.com' } });
  setDoc.mockResolvedValue();
  openSignup();
  fillSignup();
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection failed.');
  expect(screen.queryByText('Raw details')).not.toBeInTheDocument();
  userEvent.type(screen.getByLabelText('Email'), 'x');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  userEvent.clear(screen.getByLabelText('Email'));
  userEvent.type(screen.getByLabelText('Email'), 'player@example.com');
  userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
  expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled());
});

test('signup locks all actions and deduplicates account creation while pending', async () => {
  let finishSignup;
  createUserWithEmailAndPassword.mockImplementation(() => new Promise((resolve) => { finishSignup = resolve; }));
  setDoc.mockResolvedValue();
  openSignup();
  fillSignup();
  const form = screen.getByRole('form', { name: 'Create Account' });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(createUserWithEmailAndPassword).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Privacy Policy' })).toBeDisabled();
  expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
  await act(async () => finishSignup({ user: { uid: 'player', email: 'player@example.com' } }));
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

test('signup privacy and sign-in buttons do not submit the registration form', () => {
  const onShowPolicy = jest.fn();
  openSignup({ onShowPolicy });
  userEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
  expect(onShowPolicy).toHaveBeenCalledTimes(1);
  expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(screen.getByRole('form', { name: 'Login' })).toBeInTheDocument();
});
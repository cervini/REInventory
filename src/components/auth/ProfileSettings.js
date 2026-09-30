import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowLeftIcon, CheckIcon, ExclamationTriangleIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db, auth } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import './ProfileSettings.css';

export default function ProfileSettings({ user, userProfile, onClose }) {
  const savedName = userProfile?.displayName || user?.displayName || '';
  const [displayName, setDisplayName] = useState(savedName);
  const [pendingAction, setPendingAction] = useState(null);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [accountDeleted, setAccountDeleted] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const confirmationRef = useRef(null);
  const saveRef = useRef(null);
  const deleteRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const requestInProgress = useRef(false);
  const mountedRef = useRef(true);
  const formId = useId();
  const busy = pendingAction !== null;
  const identity = savedName || user?.email?.split('@')[0] || 'Account';
  const initials = identity.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const hasChanges = displayName.trim() !== savedName.trim();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (accountDeleted) deleteRef.current?.focus();
    else (confirmDelete ? confirmationRef : nameRef).current?.focus();
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (requestInProgress.current || accountDeleted) return;
        if (confirmDelete) {
          setConfirmDelete(false);
          setConfirmation('');
          setError('');
        } else onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmDelete, accountDeleted]);

  useEffect(() => {
    if (error && !busy) (confirmDelete ? deleteRef : saveRef).current?.focus();
  }, [error, busy, confirmDelete]);

  const handleClose = () => {
    if (!requestInProgress.current && !accountDeleted) onClose();
  };

  const handleSave = async event => {
    event.preventDefault();
    if (requestInProgress.current) return;
    setNameError('');
    setError('');
    if (!displayName.trim()) {
      setNameError('Enter a display name.');
      nameRef.current?.focus();
      return;
    }
    if (!event.currentTarget.reportValidity() || !hasChanges) return;
    requestInProgress.current = true;
    setPendingAction('save');
    try {
      await setDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() }, { merge: true });
      if (mountedRef.current) onClose();
    } catch (err) {
      if (mountedRef.current) setError('Could not save your profile. Please try again.');
    } finally {
      requestInProgress.current = false;
      if (mountedRef.current) setPendingAction(null);
    }
  };

  const handleDeleteAccount = async event => {
    event.preventDefault();
    if (requestInProgress.current || (!accountDeleted && confirmation !== 'DELETE')) return;
    requestInProgress.current = true;
    setPendingAction('delete');
    setError('');
    let deleted = accountDeleted;
    try {
      if (!deleted) {
        const currentUser = auth.currentUser;
        if (!currentUser || currentUser.uid !== user.uid) {
          if (mountedRef.current) setError('Sign in again before deleting your account.');
          return;
        }
        const token = await currentUser.getIdToken();
        const response = await fetch('https://us-central1-re-inventory-v2.cloudfunctions.net/deleteUserAccount', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          if (mountedRef.current) setError(response.status === 401 || response.status === 403
            ? 'Your session could not be verified. Sign out and sign in again before retrying.'
            : 'Account deletion could not finish. Some data may already have been removed. Try signing out and back in before retrying.');
          return;
        }
        deleted = true;
        if (mountedRef.current) setAccountDeleted(true);
      }
      await auth.signOut();
      if (mountedRef.current) onClose();
    } catch (err) {
      if (mountedRef.current) setError(deleted
        ? 'Your account was deleted, but sign-out failed. Try again to clear this session.'
        : 'Could not confirm account deletion. Check your connection before retrying.');
    } finally {
      requestInProgress.current = false;
      if (mountedRef.current) setPendingAction(null);
    }
  };

  return (
    <div className="profile-settings" onClick={event => { if (event.target === event.currentTarget) handleClose(); }}>
      <div ref={dialogRef} className="profile-settings__dialog" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} aria-busy={busy} tabIndex={-1}>
        <div className="profile-settings__header">
          <h2 className="profile-settings__title" id={`${formId}-title`}>{accountDeleted ? 'Account deleted' : confirmDelete ? 'Delete account' : 'Profile Settings'}</h2>
          <button type="button" onClick={handleClose} disabled={busy || accountDeleted} className="profile-settings__close" aria-label="Close profile settings" title="Close">
            <XMarkIcon className="profile-settings__icon" aria-hidden="true" />
          </button>
        </div>
        <div className="profile-settings__identity">
          <div className="profile-settings__avatar" aria-hidden="true">
            {user?.photoURL && !photoFailed ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setPhotoFailed(true)} /> : initials}
          </div>
          <div className="profile-settings__account">
            <p className="profile-settings__name">{identity}</p>
            {user?.email && <p className="profile-settings__email">{user.email}</p>}
          </div>
        </div>
        {confirmDelete ? (
          <form onSubmit={handleDeleteAccount} className="profile-settings__form" aria-label="Confirm account deletion" noValidate>
            {!accountDeleted && <>
              <p className="profile-settings__warning" id={`${formId}-warning`}><ExclamationTriangleIcon className="profile-settings__icon" aria-hidden="true" /><span>Your profile, campaign inventories, and campaigns you own will be removed. This cannot be undone.</span></p>
              <div>
                <label className="profile-settings__label" htmlFor={`${formId}-confirmation`}>Type DELETE to confirm</label>
                <input ref={confirmationRef} id={`${formId}-confirmation`} type="text" value={confirmation} onChange={event => { setConfirmation(event.target.value); setError(''); }} autoComplete="off" autoCapitalize="characters" spellCheck={false} readOnly={busy} aria-describedby={`${formId}-warning`} className="profile-settings__input" />
              </div>
            </>}
            {error && <p className="profile-settings__error" role="alert">{error}</p>}
            <div className="profile-settings__actions">
              {!accountDeleted && <button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setConfirmation(''); setError(''); }} className="profile-settings__button profile-settings__button--cancel"><ArrowLeftIcon className="profile-settings__icon" aria-hidden="true" />Go back</button>}
              <button ref={deleteRef} type="submit" disabled={busy || (!accountDeleted && confirmation !== 'DELETE')} className="profile-settings__button profile-settings__button--delete">
                {busy ? <ArrowPathIcon className="profile-settings__icon profile-settings__spinner" aria-hidden="true" /> : <TrashIcon className="profile-settings__icon" aria-hidden="true" />}
                {busy ? accountDeleted ? 'Signing out...' : 'Deleting...' : accountDeleted ? 'Sign out' : 'Delete account'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSave} className="profile-settings__form" aria-label="Profile settings" noValidate>
              <div>
                <label className="profile-settings__label" htmlFor={`${formId}-name`}>Display name</label>
                <input ref={nameRef} id={`${formId}-name`} name="displayName" type="text" autoComplete="nickname" required readOnly={busy} value={displayName} onChange={event => { setDisplayName(event.target.value); setNameError(''); setError(''); }} aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? `${formId}-name-error` : undefined} className="profile-settings__input" />
                {nameError && <p className="profile-settings__error" id={`${formId}-name-error`} role="alert">{nameError}</p>}
              </div>
              {error && <p className="profile-settings__error" role="alert">{error}</p>}
              <div className="profile-settings__actions">
                <button type="button" onClick={handleClose} disabled={busy} className="profile-settings__button profile-settings__button--cancel">Cancel</button>
                <button ref={saveRef} type="submit" disabled={busy || !hasChanges} className="profile-settings__button profile-settings__button--save">
                  {pendingAction === 'save' ? <ArrowPathIcon className="profile-settings__icon profile-settings__spinner" aria-hidden="true" /> : <CheckIcon className="profile-settings__icon" aria-hidden="true" />}
                  {pendingAction === 'save' ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
            <section className="profile-settings__danger" aria-labelledby={`${formId}-danger-title`}>
              <div><h3 id={`${formId}-danger-title`}>Delete account</h3><p>Permanently remove your account.</p></div>
              <button type="button" disabled={busy} onClick={() => { setConfirmDelete(true); setError(''); setNameError(''); }} className="profile-settings__button profile-settings__button--danger"><TrashIcon className="profile-settings__icon" aria-hidden="true" />Delete account</button>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
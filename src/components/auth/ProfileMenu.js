import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowPathIcon, ArrowRightOnRectangleIcon, BookOpenIcon, ChevronDownIcon, DocumentTextIcon, ShieldCheckIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import './ProfileMenu.css';

export default function ProfileMenu({ user, userProfile, onOpenProfile, onNavigate, onSignOut }) {
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [failedPhotoUrl, setFailedPhotoUrl] = useState(null);
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const signOutRef = useRef(null);
  const focusOnOpen = useRef(0);
  const signOutInProgress = useRef(false);
  const menuId = useId();
  const displayName = userProfile?.displayName?.trim() || user.displayName?.trim() || user.email?.split('@')[0] || 'Account';
  const nameParts = displayName.split(/\s+/);
  const initials = `${nameParts[0][0]}${nameParts.length > 1 ? nameParts[nameParts.length - 1][0] : ''}`.toUpperCase();

  useEffect(() => {
    if (!isOpen) return;
    const items = menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)');
    items[focusOnOpen.current === -1 ? items.length - 1 : 0]?.focus();

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (error && !signingOut) signOutRef.current?.focus();
  }, [error, signingOut]);

  const openMenu = (lastItem = false) => {
    focusOnOpen.current = lastItem ? -1 : 0;
    setError('');
    if (isOpen) {
      const items = menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)');
      items[lastItem ? items.length - 1 : 0]?.focus();
    } else {
      setIsOpen(true);
    }
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Tab') {
      if (event.shiftKey) event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement);
    const direction = event.key === 'ArrowUp' ? -1 : 1;
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (currentIndex + direction + items.length) % items.length;
    items[nextIndex].focus();
  };

  const handleAction = (action) => {
    setIsOpen(false);
    triggerRef.current?.focus();
    action();
  };

  const handleSignOut = async () => {
    if (signOutInProgress.current) return;
    signOutInProgress.current = true;
    setSigningOut(true);
    setError('');
    try {
      await onSignOut();
      setIsOpen(false);
    } catch {
      setError('Could not sign out. Please try again.');
      setIsOpen(true);
    } finally {
      signOutInProgress.current = false;
      setSigningOut(false);
    }
  };

  const avatar = (
    <span className="profile-menu__avatar" aria-hidden="true">
      {user.photoURL && failedPhotoUrl !== user.photoURL ? (
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhotoUrl(user.photoURL)} />
      ) : initials}
    </span>
  );

  return (
    <div
      ref={wrapperRef}
      className="profile-menu"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`profile-menu__trigger${isOpen ? ' profile-menu__trigger--open' : ''}`}
        aria-label={`Account menu for ${displayName}`}
        title="Account menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        disabled={signingOut}
        onClick={() => { if (isOpen) setIsOpen(false); else openMenu(); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu(event.key === 'ArrowUp');
          }
        }}
      >
        {avatar}
        <ChevronDownIcon className="profile-menu__chevron" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="profile-menu__panel" aria-busy={signingOut}>
          <div className="profile-menu__account">
            {avatar}
            <div className="profile-menu__identity">
              <strong className="profile-menu__name">{displayName}</strong>
              {user.email && <span className="profile-menu__email">{user.email}</span>}
            </div>
          </div>
          <div ref={menuRef} id={menuId} role="menu" aria-label="Account navigation" onKeyDown={handleMenuKeyDown}>
            <div className="profile-menu__group" role="group" aria-label="Account">
              <button type="button" role="menuitem" tabIndex={-1} disabled={signingOut} className="profile-menu__item" onClick={() => handleAction(onOpenProfile)}>
                <UserCircleIcon className="profile-menu__icon" aria-hidden="true" /><span>Profile settings</span>
              </button>
              <button type="button" role="menuitem" tabIndex={-1} disabled={signingOut} className="profile-menu__item" onClick={() => handleAction(() => onNavigate('compendium'))}>
                <BookOpenIcon className="profile-menu__icon" aria-hidden="true" /><span>Item compendium</span>
              </button>
            </div>
            <div className="profile-menu__group" role="group" aria-label="Policies">
              <button type="button" role="menuitem" tabIndex={-1} disabled={signingOut} className="profile-menu__item" onClick={() => handleAction(() => onNavigate('privacy'))}>
                <ShieldCheckIcon className="profile-menu__icon" aria-hidden="true" /><span>Privacy policy</span>
              </button>
              <button type="button" role="menuitem" tabIndex={-1} disabled={signingOut} className="profile-menu__item" onClick={() => handleAction(() => onNavigate('cookies'))}>
                <DocumentTextIcon className="profile-menu__icon" aria-hidden="true" /><span>Cookie policy</span>
              </button>
            </div>
            <div className="profile-menu__group" role="group" aria-label="Session">
              <button ref={signOutRef} type="button" role="menuitem" tabIndex={-1} disabled={signingOut} className="profile-menu__item profile-menu__item--sign-out" onClick={handleSignOut}>
                {signingOut ? <ArrowPathIcon className="profile-menu__icon profile-menu__spinner" aria-hidden="true" /> : <ArrowRightOnRectangleIcon className="profile-menu__icon" aria-hidden="true" />}
                <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
              </button>
            </div>
          </div>
          {error && <p className="profile-menu__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
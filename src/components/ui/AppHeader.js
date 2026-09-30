import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckIcon, ClipboardDocumentIcon, ShareIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ProfileMenu from '../auth/ProfileMenu';
import './AppHeader.css';

function CampaignShare({ campaignId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const wrapperRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const copyRef = useRef(null);
  const copying = useRef(false);
  const active = useRef(true);
  const copyTimer = useRef(null);
  const popupId = useId();
  const inputId = useId();

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
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
    if (copyState === 'error') copyRef.current?.focus();
  }, [copyState]);

  const handleCopy = async () => {
    if (copying.current) return;
    copying.current = true;
    clearTimeout(copyTimer.current);
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(campaignId);
      if (!active.current) return;
      setCopyState('copied');
      copyTimer.current = setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      if (active.current) setCopyState('error');
    } finally {
      copying.current = false;
    }
  };

  return (
    <div ref={wrapperRef} className="app-header__share" onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
    }}>
      <button
        ref={triggerRef}
        type="button"
        className={`app-header__icon-button${isOpen ? ' app-header__icon-button--active' : ''}`}
        aria-label="Share campaign"
        title="Share campaign code"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        onClick={() => setIsOpen(open => !open)}
      >
        <ShareIcon className="app-header__icon" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="app-header__share-panel" role="dialog" aria-label="Share campaign" id={popupId}>
          <div className="app-header__share-heading">
            <h2>Share campaign</h2>
            <button type="button" className="app-header__icon-button" aria-label="Close share panel" title="Close" onClick={() => { setIsOpen(false); triggerRef.current?.focus(); }}>
              <XMarkIcon className="app-header__icon" aria-hidden="true" />
            </button>
          </div>
          <label className="app-header__code-label" htmlFor={inputId}>Campaign code</label>
          <input ref={inputRef} id={inputId} className="app-header__code" value={campaignId} readOnly onFocus={event => event.currentTarget.select()} />
          <button ref={copyRef} type="button" className="app-header__copy" disabled={copyState === 'copying'} onClick={handleCopy}>
            {copyState === 'copied' ? <CheckIcon className="app-header__icon" aria-hidden="true" /> : <ClipboardDocumentIcon className="app-header__icon" aria-hidden="true" />}
            {copyState === 'copying' ? 'Copying...' : copyState === 'copied' ? 'Copied' : 'Copy code'}
          </button>
          <p className={`app-header__feedback${copyState === 'error' ? ' app-header__feedback--error' : ''}`} role={copyState === 'error' ? 'alert' : 'status'}>
            {copyState === 'copied' ? 'Campaign code copied.' : copyState === 'error' ? 'Could not copy the code. Select and copy it manually.' : ''}
          </p>
        </div>
      )}
    </div>
  );
}

const pageTitles = { compendium: 'Item compendium', privacy: 'Privacy policy', cookies: 'Cookie policy' };

export default function AppHeader({ user, userProfile, campaignId, campaignName, currentPage, onHome, onOpenProfile, onNavigate, onSignOut }) {
  const context = pageTitles[currentPage] || (campaignId ? campaignName || 'Campaign' : '');
  const canGoHome = Boolean(user) || currentPage !== 'main';
  const isLanding = !user && currentPage === 'main';
  const brand = <><span className="app-header__brand-accent">RE</span>Inventory</>;

  return (
    <header className={`app-header${isLanding ? ' app-header--landing' : ''}${context ? ' app-header--context' : ''}${campaignId ? ' app-header--campaign' : ''}`} aria-label="Application header">
      <h1 className="app-header__brand" aria-label="REInventory">
        {canGoHome ? (
          <button type="button" className="app-header__home" onClick={onHome} aria-label={user ? 'REInventory: Your campaigns' : 'REInventory: Back to login'} title={user ? 'Go to your campaigns' : 'Back to login'}>{brand}</button>
        ) : brand}
      </h1>
      <div className="app-header__context" title={context}>{context}</div>
      <div className="app-header__actions">
        {campaignId && <CampaignShare key={campaignId} campaignId={campaignId} />}
        {user && <ProfileMenu key={user.uid} user={user} userProfile={userProfile} onOpenProfile={onOpenProfile} onNavigate={onNavigate} onSignOut={onSignOut} />}
      </div>
    </header>
  );
}
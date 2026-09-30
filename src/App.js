import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { Tooltip } from 'react-tooltip';
import { Toaster } from 'react-hot-toast';
import { auth, db } from './firebase';
import './App.css';

// Component imports
import InventoryGrid from './components/inventory/InventoryGrid';
import Auth from './components/auth/Auth';
import CampaignSelector from './components/campaign/CampaignSelector';
import ProfileSettings from './components/auth/ProfileSettings';
import CookieBanner from './components/cookies/CookieBanner';
import PrivacyPolicy from './components/policies/PrivacyPolicy';
import CookiePolicy from './components/policies/CookiePolicy';
import Compendium from './components/compendium/Compendium';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState('main'); // 'main', 'privacy', 'cookies', 'compendium'
  const [hasCookieConsent, setHasCookieConsent] = useState(() => !!localStorage.getItem('cookieConsent'));
  
  const codeCloseTimer = useRef(null);
  
  /**
   * Monitor when the user logs in or logs out and set the related states accordingly
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserProfile(null);
        setCampaignId(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth(); // cleanup function
  }, []);

  /**
   * Listens for real-time updates to the user's profile document in Firestore
   * and updates the userProfile state accordingly.
   */
  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeProfile = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
          setUserProfile(doc.data());
        }
        setLoading(false);
      });
      // Clean up the Firestore listener when the component unmounts or the user changes.
      return () => unsubscribeProfile();
    }
  }, [user]);

  /**
   * Copies the current campaign ID to the clipboard and displays a confirmation state for 2 seconds.
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(campaignId).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // 2000 ms
    });
  };

  /**
   * Sets current campaing to null moving the user back to the campaign selection page.
   */
  const handleBackToCampaigns = () => {
    setCampaignId(null);
  };

  /**
   * Delays hiding the code for 1s on mouse leave to improve UX by giving the user a grace period.
   */
  const handleCodeMouseLeave = () => {
    codeCloseTimer.current = setTimeout(() => {
        setIsCodeVisible(false);
    }, 1000); // 1000 ms
  };

  /**
   * Saves the user consent of the cookie policy in local storage to show
   * the cookie banner only if the user hasn't consented
   */
  const handleCookieConsent = () => {
    localStorage.setItem('cookieConsent', 'true');
    setHasCookieConsent(true);
  };

  /**
   * Determines which main component to render based on the application's
   * current state (loading, auth, consent, and selected campaign).
   * @returns {JSX.Element} The React component to be displayed.
   */
  const renderContent = () => {
    // These pages are always accessible, as they are for informational purposes.
    if (currentPage === 'privacy') {
      return <PrivacyPolicy onClose={() => setCurrentPage('main')} />;
    }
    if (currentPage === 'cookies') {
      return <CookiePolicy onClose={() => setCurrentPage('main')} />;
    }

    // Handle the initial loading state.S
    if (loading) {
      return <div>Loading...</div>;
    }

    // If there is no user, show the login/signup form.
    if (!user) {
      return <Auth onShowPolicy={() => setCurrentPage('privacy')} />;
    }

    // --- Consent Check ---
    // If we have a user, but they haven't consented, show the consent message.
    if (!hasCookieConsent) {
      return (
        <div className="app__consent">
          <h2 className="app__consent-title">
            Almost there!
          </h2>
          <p className="app__consent-description">
            To access your campaigns and inventories, please accept our cookie policy by clicking the "Okay, I understand" button in the banner at the bottom of the screen.
          </p>
        </div>
      );
    }

    // --- Core App Logic (Requires User AND Consent) ---
    if (currentPage === 'compendium') {
        return <Compendium onClose={() => setCurrentPage('main')} />;
    }
    
    if (campaignId) {
      return <InventoryGrid 
        campaignId={campaignId} 
        user={user} 
        userProfile={userProfile}
      />;
    } else {
      // having no current campaingId shows the CamapaignSelector component
      // therefore setting campaignId as null load the component
      return <CampaignSelector onCampaignSelected={setCampaignId} />;
    }
  };

  return (
    <main className="app">
      
      {/* Global components (toasts, tooltips) */}
      <Toaster 
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'hsl(var(--color-surface))',
            color: 'hsl(var(--color-text-base))',
            border: '1px solid hsl(var(--color-accent) / 0.2)',
          },
        }}
      />
      <Tooltip
        id="item-tooltip"
        style={{ zIndex: 99, maxWidth: '300px' }}
        openOnClick={true}
        delayShow={200}
        clickable={true}
      />
      
      {/* Modals */}
      {showSettings && (
        <ProfileSettings 
          user={user}
          userProfile={userProfile}
          onClose={() => setShowSettings(false)}
        />
      )}

       <div className="app__content">
        {/* The header is now only visible on the main page */}
        {currentPage === 'main' && (
         <div className="app__header">
              
              {/* Left Slot */}
              <div className="app__header-left">
                {campaignId && (
                  <button onClick={handleBackToCampaigns} className="app__icon-button" aria-label="Back to campaigns">
                    <svg xmlns="http://www.w3.org/2000/svg" className="app__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </button>
                )}
                {campaignId && (
                  <div className="app__code-wrapper">
                    <button
                      className="app__icon-button"
                      onClick={() => setIsCodeVisible(true)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="app__icon app__icon--small" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" /></svg>
                    </button>
                    {isCodeVisible && (
                      <div
                        className="app__code-popup"
                        onMouseLeave={handleCodeMouseLeave}
                      >
                        <div className="app__code-row">
                          <span className="app__code-label">Code: <span className="app__code-value">{campaignId}</span></span>
                          <button onClick={handleCopy} className="app__copy">{isCopied ? 'Copied!' : 'Copy'}</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Center Slot - Title is only shown on the auth pages */}
              {!campaignId && (
                <div className="app__brand-wrapper">
                  <h1 className="app__brand"><span className="app__brand-accent">RE</span>Inventory</h1>
                </div>
              )}
              {/* Right Slot */}
              <div className="app__header-right">
                {user && (
                  <div className="app__profile-wrapper">
                    <button onClick={() => setIsUserMenuOpen(prev => !prev)} className="app__icon-button">
                      <svg xmlns="http://www.w3.org/2000/svg" className="app__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </button>
                    {isUserMenuOpen && (
                      <div className="app__menu" onMouseLeave={() => setIsUserMenuOpen(false)}>
                        <div className="app__menu-account">Signed in as<br/><strong className="app__menu-name">{userProfile?.displayName || user.email}</strong></div>
                        <button onClick={() => { setShowSettings(true); setIsUserMenuOpen(false); }} className="app__menu-item">Profile</button>
                        <button onClick={() => { auth.signOut(); setIsUserMenuOpen(false); }} className="app__menu-item">Sign Out</button>
                        <button 
                          onClick={() => { setCurrentPage('compendium'); setIsUserMenuOpen(false); }} 
                          className="app__menu-item"
                        >
                          Item Compendium
                        </button>
                        <div className="app__menu-divider" />
                        <button
                          onClick={() => { setCurrentPage('privacy'); setIsUserMenuOpen(false); }}
                          className="app__menu-item"
                        >
                          Privacy Policy
                        </button>
                        <button 
                          onClick={() => { setCurrentPage('cookies'); setIsUserMenuOpen(false); }} 
                          className="app__menu-item"
                        >
                          Cookie Policy
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
        )}

        {/* Dinamically rendered page content */}
        <div className="app__body">
            {renderContent()}
          {!hasCookieConsent && <div className="app__consent-spacer" />}
        </div>
      </div>
      
      {/* Persistent banner */}
      <CookieBanner 
        isVisible={!hasCookieConsent} 
        onAccept={handleCookieConsent}
        onShowPolicy={() => setCurrentPage('cookies')} 
      />
    </main>
  );
}
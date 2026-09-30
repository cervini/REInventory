import React, { useState, useEffect } from 'react';
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
import AppHeader from './components/ui/AppHeader';
import CookieBanner from './components/cookies/CookieBanner';
import PrivacyPolicy from './components/policies/PrivacyPolicy';
import CookiePolicy from './components/policies/CookiePolicy';
import Compendium from './components/compendium/Compendium';

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaignId, setCampaignId] = useState(null);
  const [campaignInfo, setCampaignInfo] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState('main'); // 'main', 'privacy', 'cookies', 'compendium'
  const [hasCookieConsent, setHasCookieConsent] = useState(() => !!localStorage.getItem('cookieConsent'));
  
  /**
   * Monitor when the user logs in or logs out and set the related states accordingly
   */
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserProfile(null);
        setCampaignId(null);
        setCampaignInfo(null);
        setShowSettings(false);
        setCurrentPage('main');
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

  useEffect(() => {
    if (!user || !campaignId) return;
    return onSnapshot(doc(db, 'campaigns', campaignId), (snapshot) => {
      setCampaignInfo({ id: campaignId, name: snapshot.exists() ? snapshot.data().name || 'Unnamed campaign' : 'Campaign unavailable' });
    }, () => {
      setCampaignInfo({ id: campaignId, name: 'Campaign' });
    });
  }, [user, campaignId]);

  const handleHome = () => {
    setCampaignId(null);
    setCampaignInfo(null);
    setCurrentPage('main');
    setShowSettings(false);
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
    <div className="app">
      
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
        <AppHeader
          user={user}
          userProfile={userProfile}
          campaignId={user && !loading && hasCookieConsent && currentPage === 'main' ? campaignId : null}
          campaignName={campaignInfo?.id === campaignId ? campaignInfo.name : 'Campaign'}
          currentPage={currentPage}
          onHome={handleHome}
          onOpenProfile={() => setShowSettings(true)}
          onNavigate={setCurrentPage}
          onSignOut={() => auth.signOut()}
        />

        {/* Dinamically rendered page content */}
        <main className="app__body">
            {renderContent()}
          {!hasCookieConsent && <div className="app__consent-spacer" />}
        </main>
      </div>
      
      {/* Persistent banner */}
      <CookieBanner 
        isVisible={!hasCookieConsent} 
        onAccept={handleCookieConsent}
        onShowPolicy={() => setCurrentPage('cookies')} 
      />
    </div>
  );
}
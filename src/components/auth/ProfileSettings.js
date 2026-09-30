import React, { useState } from 'react';
import { db, auth} from '../../firebase';
import { doc, setDoc } from "firebase/firestore";
import toast from 'react-hot-toast';
import './ProfileSettings.css';

export default function ProfileSettings({ user, userProfile, onClose }) {
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Saves the user's updated profile settings (e.g., display name) to their document in Firestore.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Display name cannot be empty.");
      return;
    }
    setLoading(true);
    setError('');

    const userDocRef = doc(db, 'users', user.uid);
    try {
      // Save all profile fields, including the new dimensions
      await setDoc(userDocRef, { 
        displayName,
      }, { merge: true });
      onClose();
    } catch (err) {
      setError("Failed to update profile. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Initiates the permanent deletion of the user's account and all associated data.
   * It gets an auth token and calls the `deleteUserAccount` Firebase Cloud Function.
   * It requires multiple confirmations from the user.
   */
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you ABSOLUTELY sure?") || !window.confirm("This cannot be undone. Proceed?")) return;
    
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be logged in.");
      }
      
      const token = await currentUser.getIdToken();
      sessionStorage.setItem('accountJustDeleted', 'true');
      
      const FIREBASE_REGION = 'us-central1'; // Make sure this region is correct
      // This is now the name of our new onRequest function
      const functionUrl = `https://${FIREBASE_REGION}-re-inventory-v2.cloudfunctions.net/deleteUserAccount`;
      

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          // Send the token in the Authorization header
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const result = await response.json();

      if (!response.ok) {
        sessionStorage.removeItem('accountJustDeleted');
        throw new Error(result.error.message || 'Failed to delete account.');
      }
      
      // We no longer need to manually sign out. The auth state change will be detected.
      onClose();

    } catch (err) {
      toast.error(err.message);
      setLoading(false);
      sessionStorage.removeItem('accountJustDeleted');
    }
  };

  return (
    <div className="profile-settings" onClick={onClose}>
      <div className="profile-settings__dialog" onClick={e => e.stopPropagation()}>
        
        <div className="profile-settings__header">
          <h3 className="profile-settings__title">
            Profile Settings
          </h3>
          <button onClick={onClose} className="profile-settings__close">
            <svg xmlns="http://www.w3.org/2000/svg" className="profile-settings__close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="profile-settings__form">
          <div>
            <label className="profile-settings__label">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="profile-settings__input"
            />
          </div>
          {error && <p className="profile-settings__error">{error}</p>}
          <div className="profile-settings__actions">
            <button type="button" onClick={onClose} disabled={loading} className="profile-settings__button profile-settings__button--cancel">Cancel</button>
            <button type="submit" disabled={loading} className="profile-settings__button profile-settings__button--save">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        <div className="profile-settings__danger">
          <button onClick={handleDeleteAccount} disabled={loading} className="profile-settings__button profile-settings__button--delete">
              {loading ? 'Deleting...' : 'Delete My Account'}
            </button>
        </div>
      </div>
    </div>
  );
}
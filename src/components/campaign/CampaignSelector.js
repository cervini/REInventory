import React, { useState, useEffect, useRef } from 'react';
import { ArrowPathIcon, ArrowRightOnRectangleIcon, ChevronRightIcon, ClipboardDocumentIcon, FolderIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { collection, doc, setDoc, getDoc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import JoinCampaign from './JoinCampaign';
import BuyMeACoffeeButton from '../ui/BuyMeACoffeeButton';
import WhatsNewModal, { whatsNewConfig } from '../ui/WhatsNewModal';
import { generateJoinCode } from '../../utils/codeGenerator';
import './CampaignSelector.css';

// Recieve a function from App.js to set the active campaign
export default function CampaignSelector({ onCampaignSelected }) {
  const [pendingAction, setPendingAction] = useState(null);
  const [fetchingCampaigns, setFetchingCampaigns] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [campaignName, setCampaignName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [search, setSearch] = useState('');
  const [createError, setCreateError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [actionError, setActionError] = useState('');
  const actionInProgress = useRef(false);
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [campaignToJoin, setCampaignToJoin] = useState(null);
  const [showAddCharacterModal, setShowAddCharacterModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [campaignForNewCharacter, setCampaignForNewCharacter] = useState(null);
  const loading = Boolean(pendingAction) || showJoinModal || showAddCharacterModal;
  const visibleCampaigns = myCampaigns
    .filter(campaign => `${campaign.name || ''} ${campaign.id}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((first, second) => (first.name || '').localeCompare(second.name || ''));

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setFetchingCampaigns(false);
      setFetchError('Sign in again to view your campaigns.');
      return;
    }

    let active = true;
    setFetchingCampaigns(true);
    setFetchError('');
    const campaignsRef = collection(db, 'campaigns');
    const joinedCampaigns = query(campaignsRef, where('players', 'array-contains', currentUser.uid));
    const ownedCampaigns = query(campaignsRef, where('dmId', '==', currentUser.uid));

    Promise.all([getDocs(joinedCampaigns), getDocs(ownedCampaigns)])
      .then((snapshots) => {
        if (!active) return;
        const campaigns = new Map();
        snapshots.forEach((snapshot) => {
          snapshot.forEach((campaignDoc) => {
            campaigns.set(campaignDoc.id, { ...campaignDoc.data(), id: campaignDoc.id });
          });
        });
        setMyCampaigns([...campaigns.values()]);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Error fetching user campaigns: ", error);
        setFetchError('Could not load your campaigns. Please try again.');
      })
      .finally(() => {
        if (active) setFetchingCampaigns(false);
      });
    return () => { active = false; };
  }, [reloadCount]);

  useEffect(() => {
    const { version, expiryDate } = whatsNewConfig;
    const storageKey = `reinventory-whats-new-${version}`;
    
    const hasSeen = localStorage.getItem(storageKey);
    
    // Check against the end of the day to make the expiry date inclusive.
    // This avoids timezone issues where the modal might expire prematurely.
    const isExpired = new Date() > new Date(`${expiryDate}T23:59:59`);
    
    if (!hasSeen && !isExpired) {
      setShowWhatsNew(true);
    }
  }, []); // Run only once on mount

  const handleCloseWhatsNew = () => {
    const { version } = whatsNewConfig;
    const storageKey = `reinventory-whats-new-${version}`;
    localStorage.setItem(storageKey, 'true');
    setShowWhatsNew(false);
  };

  /**
   * Asynchronously creates a new campaign in Firestore.
   * It sets the current user as the DM, creates a default inventory and backpack for them,
   * and then sets the newly created campaign as the active one.
   * @returns {Promise<void>} A promise that resolves when the campaign is created.
   */
  const handleCreateCampaign = async (event) => {
    event.preventDefault();
    if (loading || actionInProgress.current || !event.currentTarget.reportValidity()) return;
    setCreateError('');
    setActionError('');
    if (!campaignName.trim()) {
      setCreateError('Enter a campaign name.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setCreateError('Sign in again to create a campaign.');
      return;
    }
    actionInProgress.current = true;
    setPendingAction({ type: 'create' });

    try {
      // 1. Generate a human-readable ID
      let customId = generateJoinCode();
      let isUnique = false;
      let attempts = 0;

      // 2. Ensure it's unique (retry up to 5 times)
      while (!isUnique && attempts < 5) {
        const docRef = doc(db, 'campaigns', customId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          isUnique = true;
        } else {
          customId = generateJoinCode(); // Try again
          attempts++;
        }
      }

      if (!isUnique) {
        setCreateError('Could not generate a unique code. Please try again.');
        return;
      }

      // 3. Create the campaign with the custom ID using setDoc
      await setDoc(doc(db, "campaigns", customId), {
        dmId: currentUser.uid,
        name: campaignName.trim(),
        players: [currentUser.uid],
        layout: {
          order: [currentUser.uid],
          visible: { [currentUser.uid]: true }
        }
      });

      const inventoryDocRef = doc(db, "campaigns", customId, "inventories", currentUser.uid);
      await setDoc(inventoryDocRef, {
        characterName: "DM",
        ownerId: currentUser.uid,
        trayItems: [],
      });

      const backpackRef = doc(inventoryDocRef, "containers", "backpack");
      await setDoc(backpackRef, {
        name: "Backpack",
        gridItems: [],
        gridWidth: 10,
        gridHeight: 5,
      });

      onCampaignSelected(customId);

    } catch (error) {
      console.error("Error creating campaign: ", error);
      setCreateError('Could not create your campaign. Please try again.');
    } finally {
      actionInProgress.current = false;
      setPendingAction(null);
    }
  };

  /**
   * Asynchronously handles the process of joining a campaign.
   * It validates the provided join code (which is the campaign ID) and, if valid,
   * opens a modal for the user to enter their character details.
   * @returns {Promise<void>} A promise that resolves when the check is complete.
   */
  const handleJoinCampaign = async (event) => {
    event.preventDefault();
    if (loading || actionInProgress.current || !event.currentTarget.reportValidity()) return;
    setJoinError('');
    setActionError('');
    const code = joinCode.trim();
    if (!code || code.includes('/')) {
      setJoinError('Enter a valid campaign code.');
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setJoinError('Sign in again to join a campaign.');
      return;
    }
    actionInProgress.current = true;
    setPendingAction({ type: 'join' });
    try {
      const campaignDocRef = doc(db, 'campaigns', code);
      const campaignSnap = await getDoc(campaignDocRef);

      if (!campaignSnap.exists()) {
        setJoinError('Campaign not found. Check the code and try again.');
        return;
      }

      const campaign = campaignSnap.data();
      if (campaign.dmId === currentUser.uid || campaign.players?.includes(currentUser.uid)) {
        onCampaignSelected(code);
        return;
      }
      
      // If the code is valid, set the campaign ID and show the modal
      setCampaignToJoin(code);
      setShowJoinModal(true);
    } catch (error) {
      setJoinError('Could not check this code. Please try again.');
    } finally {
      actionInProgress.current = false;
      setPendingAction(null);
    }
  };

  /**
   * Asynchronously deletes a campaign and all its associated sub-collections from Firestore.
   * It first deletes all 'inventories' and their nested 'containers', then deletes the main campaign document.
   * A confirmation dialog is shown to the user before proceeding.
   * @param {string} campaignId - The ID of the campaign to delete.
   * @param {string} campaignName - The name of the campaign, used for the confirmation dialog.
   * @returns {Promise<void>} A promise that resolves when the deletion is complete.
   */
  const handleDeleteCampaign = async (campaignId, campaignName) => {
    if (loading || actionInProgress.current) return;
    const campaign = myCampaigns.find(entry => entry.id === campaignId);
    if (!auth.currentUser || campaign?.dmId !== auth.currentUser.uid) return;
    // Show a confirmation dialog before proceeding
    if (!window.confirm(`Are you sure you want to permanently delete the campaign "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    actionInProgress.current = true;
    setPendingAction({ type: 'delete', campaignId });
    setActionError('');
    try {
      const inventoriesRef = collection(db, 'campaigns', campaignId, 'inventories');
      const inventorySnapshot = await getDocs(inventoriesRef);
      
      // Use a batched write to delete all sub-collection documents first
      const batch = writeBatch(db);
      inventorySnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Now delete the main campaign document
      await deleteDoc(doc(db, 'campaigns', campaignId));

      // Update the UI locally to remove the campaign from the list
      setMyCampaigns(prev => prev.filter(c => c.id !== campaignId));
      toast.success(`Campaign "${campaignName}" deleted.`);

    } catch (error) {
      console.error("Error deleting campaign: ", error);
      setActionError('Could not delete this campaign. Please try again.');
    } finally {
      actionInProgress.current = false;
      setPendingAction(null);
    }
  };

  const handleCopyCode = async (code) => {
    setActionError('');
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Campaign code copied.');
    } catch {
      setActionError('Could not copy the code. Select and copy it manually.');
    }
  };

  return (
    <>
    {showWhatsNew && <WhatsNewModal onClose={handleCloseWhatsNew} />}
    <div className="campaign-selector">
      {showJoinModal && (
        <JoinCampaign
          campaignId={campaignToJoin}
          onClose={() => setShowJoinModal(false)}
          onJoinSuccess={onCampaignSelected}
        />
      )}
      {showAddCharacterModal && (
        <JoinCampaign
          campaignId={campaignForNewCharacter}
          onClose={() => setShowAddCharacterModal(false)}
          onJoinSuccess={() => {
            setShowAddCharacterModal(false);
            onCampaignSelected(campaignForNewCharacter);
          }}
          isDMAddingCharacter={true}
        />
      )}

      <section className="campaign-selector__campaigns" aria-labelledby="campaigns-title">
        <header className="campaign-selector__header">
          <h2 className="campaign-selector__title" id="campaigns-title">Your Campaigns</h2>
          {!fetchingCampaigns && !fetchError && (
            <span className="campaign-selector__count">{myCampaigns.length} {myCampaigns.length === 1 ? 'campaign' : 'campaigns'}</span>
          )}
        </header>
        {myCampaigns.length > 0 && (
          <div className="campaign-selector__search">
            <MagnifyingGlassIcon className="campaign-selector__icon" aria-hidden="true" />
            <input type="search" aria-label="Search campaigns" placeholder="Search campaigns" autoComplete="off" value={search} onChange={event => setSearch(event.target.value)} className="campaign-selector__input campaign-selector__search-input" />
          </div>
        )}
        {fetchingCampaigns && (
          <p className="campaign-selector__status" role="status">
            <ArrowPathIcon className="campaign-selector__icon campaign-selector__spinner" aria-hidden="true" />
            Loading your campaigns...
          </p>
        )}
        {fetchError && (
          <div className="campaign-selector__message" role="alert">
            <p>{fetchError}</p>
            <button type="button" className="campaign-selector__retry" onClick={() => setReloadCount(count => count + 1)} disabled={fetchingCampaigns || loading}>
              <ArrowPathIcon className="campaign-selector__icon" aria-hidden="true" />Retry
            </button>
          </div>
        )}
        {actionError && <p className="campaign-selector__message" role="alert">{actionError}</p>}
        {!fetchingCampaigns && !fetchError && myCampaigns.length === 0 && (
          <div className="campaign-selector__empty"><FolderIcon aria-hidden="true" /><p>You have no campaigns yet.</p></div>
        )}
        {!fetchingCampaigns && !fetchError && myCampaigns.length > 0 && visibleCampaigns.length === 0 && (
          <p className="campaign-selector__empty" role="status">No matching campaigns.</p>
        )}
        <ul className="campaign-selector__list" aria-label="Campaigns">
          {visibleCampaigns.map(campaign => {
            const isDM = auth.currentUser?.uid === campaign.dmId;
            const deleting = pendingAction?.type === 'delete' && pendingAction.campaignId === campaign.id;
            return (
              <li key={campaign.id} className="campaign-selector__row" aria-busy={deleting}>
                <button type="button" onClick={() => onCampaignSelected(campaign.id)} disabled={loading} className="campaign-selector__campaign-button" aria-label={`Open ${campaign.name || 'Unnamed campaign'}`}>
                  <span className="campaign-selector__campaign-info">
                    <span className="campaign-selector__name">{campaign.name || 'Unnamed campaign'}</span>
                    <span className="campaign-selector__metadata">
                      <span className={`campaign-selector__role${isDM ? ' campaign-selector__role--dm' : ''}`}>{isDM ? 'DM' : 'Player'}</span>
                      <span className="campaign-selector__code">{campaign.id}</span>
                    </span>
                  </span>
                  <ChevronRightIcon className="campaign-selector__icon" aria-hidden="true" />
                </button>
                <div className="campaign-selector__row-actions">
                  {deleting && <span className="campaign-selector__deleting" role="status">Deleting...</span>}
                  <button type="button" onClick={() => handleCopyCode(campaign.id)} disabled={loading} className="campaign-selector__row-button" aria-label={`Copy code for ${campaign.name || 'Unnamed campaign'}`} title="Copy campaign code">
                    <ClipboardDocumentIcon className="campaign-selector__icon" aria-hidden="true" />
                  </button>
                  {isDM && <>
                    <button type="button" onClick={() => { setCampaignForNewCharacter(campaign.id); setShowAddCharacterModal(true); }} disabled={loading} className="campaign-selector__row-button" aria-label={`Add a character to ${campaign.name}`} title="Add character">
                      <UserPlusIcon className="campaign-selector__icon" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => handleDeleteCampaign(campaign.id, campaign.name)} disabled={loading} className="campaign-selector__row-button campaign-selector__row-button--delete" aria-label={`Delete campaign ${campaign.name}`} title="Delete campaign">
                      <TrashIcon className="campaign-selector__icon" aria-hidden="true" />
                    </button>
                  </>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="campaign-selector__adventure" aria-labelledby="new-adventure-title">
        <h2 className="campaign-selector__title" id="new-adventure-title">New adventure</h2>
        <div className="campaign-selector__forms">
          <form className="campaign-selector__create" aria-labelledby="create-campaign-title" onSubmit={handleCreateCampaign} aria-busy={pendingAction?.type === 'create'}>
            <h3 className="campaign-selector__form-title" id="create-campaign-title">Create campaign</h3>
            <label className="campaign-selector__label" htmlFor="campaign-name">Campaign name</label>
            <input id="campaign-name" name="campaignName" type="text" placeholder="The Lost Kingdom" autoComplete="off" required readOnly={loading} value={campaignName} onChange={event => { setCampaignName(event.target.value); setCreateError(''); }} aria-describedby={createError ? 'create-campaign-error' : undefined} className="campaign-selector__input" />
            {createError && <p className="campaign-selector__field-error" id="create-campaign-error" role="alert">{createError}</p>}
            <button type="submit" disabled={loading} className="campaign-selector__form-button campaign-selector__form-button--primary">
              <PlusIcon className="campaign-selector__icon" aria-hidden="true" />
              {pendingAction?.type === 'create' ? 'Creating...' : 'Create campaign'}
            </button>
          </form>
          <form className="campaign-selector__join" aria-labelledby="join-campaign-title" onSubmit={handleJoinCampaign} aria-busy={pendingAction?.type === 'join'}>
            <h3 className="campaign-selector__form-title" id="join-campaign-title">Join campaign</h3>
            <label className="campaign-selector__label" htmlFor="campaign-code">Campaign code</label>
            <input id="campaign-code" name="joinCode" type="text" placeholder="ancient-dragon-keeper" autoComplete="off" autoCapitalize="none" spellCheck={false} required readOnly={loading} value={joinCode} onChange={event => { setJoinCode(event.target.value); setJoinError(''); }} aria-describedby={joinError ? 'join-campaign-error' : undefined} className="campaign-selector__input" />
            {joinError && <p className="campaign-selector__field-error" id="join-campaign-error" role="alert">{joinError}</p>}
            <button type="submit" disabled={loading} className="campaign-selector__form-button">
              <ArrowRightOnRectangleIcon className="campaign-selector__icon" aria-hidden="true" />
              {pendingAction?.type === 'join' ? 'Checking code...' : 'Join campaign'}
            </button>
          </form>
        </div>
      </section>
    </div>
    <footer className="campaign-selector__footer"><BuyMeACoffeeButton /></footer>
  </>
  );
}
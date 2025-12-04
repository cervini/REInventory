import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { collection, doc, setDoc, getDoc, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import JoinCampaign from './JoinCampaign';
import WhatsNewModal, { whatsNewConfig } from './WhatsNewModal';
import { generateJoinCode } from '../utils/codeGenerator';

const BuyMeACoffeeButton = () => (
  <a 
    href="https://paypal.me/simonecervini" 
    target="_blank"
    rel="noopener noreferrer"
    className="mt-8 flex items-center justify-center space-x-2 text-sm text-text-muted hover:text-accent transition-colors duration-200"
  >
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V5z" />
      <path d="M2 10.5V15a2 2 0 002 2h12a2 2 0 002-2v-4.5A2.5 2.5 0 0017.5 8h-15A2.5 2.5 0 000 10.5zM10 13a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
    <span>Enjoying the app? Support the project!</span>
  </a>
);

// Recieve a function from App.js to set the active campaign
export default function CampaignSelector({ onCampaignSelected }) {
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myCampaigns, setMyCampaigns] = useState([]);
  
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [campaignToJoin, setCampaignToJoin] = useState(null);
  const [showAddCharacterModal, setShowAddCharacterModal] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [campaignForNewCharacter, setCampaignForNewCharacter] = useState(null);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setLoading(true);
    // Create a query to find campaigns where the user's ID is in the 'players' array
    const campaignsRef = collection(db, 'campaigns');
    const q = query(campaignsRef, where('players', 'array-contains', currentUser.uid));

    getDocs(q)
      .then((querySnapshot) => {
        const campaigns = [];
        querySnapshot.forEach((doc) => {
          campaigns.push({ id: doc.id, ...doc.data() });
        });
        setMyCampaigns(campaigns);
      })
      .catch((error) => {
        console.error("Error fetching user campaigns: ", error);
        toast.error("Could not fetch your campaigns.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }
    setLoading(true);
    const currentUser = auth.currentUser;

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
        toast.error("Could not generate a unique code. Please try again.");
        setLoading(false);
        return;
      }

      // 3. Create the campaign with the custom ID using setDoc
      await setDoc(doc(db, "campaigns", customId), {
        dmId: currentUser.uid,
        name: campaignName,
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
      toast.error("Failed to create campaign.");
    } finally {
        setLoading(false);
    }
  };

  /**
   * Asynchronously handles the process of joining a campaign.
   * It validates the provided join code (which is the campaign ID) and, if valid,
   * opens a modal for the user to enter their character details.
   * @returns {Promise<void>} A promise that resolves when the check is complete.
   */
  const handleJoinCampaign = async () => {
    const code = joinCode.trim();
    if (!code) {
      toast.error("Please enter a campaign code.");
      return;
    }
    setLoading(true);
    try {
      const campaignDocRef = doc(db, 'campaigns', code);
      const campaignSnap = await getDoc(campaignDocRef);

      if (!campaignSnap.exists()) {
        toast.error("Campaign not found. Please check the code.");
        return;
      }
      
      // If the code is valid, set the campaign ID and show the modal
      setCampaignToJoin(code);
      setShowJoinModal(true);
    } catch (error) {
      toast.error("An error occurred while checking the code.");
    } finally {
      setLoading(false);
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
    // Show a confirmation dialog before proceeding
    if (!window.confirm(`Are you sure you want to permanently delete the campaign "${campaignName}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
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
      toast.error("Failed to delete campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {showWhatsNew && <WhatsNewModal onClose={handleCloseWhatsNew} />}
    <div className="w-full max-w-md mx-auto bg-surface shadow-lg shadow-accent/10 rounded-lg p-8 border border-accent/20">
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

      {/* --- Empty State --- */}
      {!loading && myCampaigns.length === 0 && (
        <div className="text-center text-text-muted mb-8 p-4 border border-dashed border-surface/50 rounded-lg">
          <p>You have no campaigns yet.</p>
          <p>Create a new one or join one below to begin your adventure!</p>
        </div>
      )}

      {/* --- Existing Campaigns List --- */}
      {myCampaigns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl text-center font-bold mb-4 text-accent font-fantasy">Your Campaigns</h2>
          <div className="space-y-2">
            {myCampaigns.map((campaign) => (
              <div key={campaign.id} className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  onClick={() => onCampaignSelected(campaign.id)}
                  className="flex-grow bg-background hover:bg-surface/80 text-text-base font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 text-left"
                >
                  {campaign.name}
                </button>
                {auth.currentUser?.uid === campaign.dmId && (
                  <div className="flex space-x-2 justify-end">
                    <button
                      onClick={() => {
                        setCampaignForNewCharacter(campaign.id);
                        setShowAddCharacterModal(true);
                      }}
                      disabled={loading}
                      className="p-3 bg-primary/80 hover:bg-primary text-text-base rounded focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors duration-200 flex-shrink-0"
                      aria-label={`Add a character to ${campaign.name}`}
                      title="Add Character"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 11a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1z" />
                      </svg>
                    </button>
                    <button onClick={() => handleDeleteCampaign(campaign.id, campaign.name)} disabled={loading} className="p-3 bg-destructive hover:bg-destructive/80 text-text-base rounded focus:outline-none focus:shadow-outline disabled:opacity-50 transition-colors duration-200 flex-shrink-0" aria-label={`Delete campaign ${campaign.name}`} title="Delete Campaign">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- Create/Join Section --- */}
      <h2 className="text-2xl text-center font-bold mb-4 text-accent font-fantasy">New adventure</h2>
      <div className="flex flex-col items-center space-y-4">
        {/* Create Campaign */}
        <div className="w-full space-y-4 p-4 border border-surface/50 rounded-lg">
            <input
              type="text"
              placeholder="Enter New Campaign Name"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={handleCreateCampaign}
              disabled={loading}
              className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-background font-bold py-2 px-4 rounded w-full transition-colors duration-200"
            >
              {loading ? 'Creating...' : 'Create New Campaign'}
            </button>
        </div>
        
        <div className="relative flex py-2 items-center w-full">
            <div className="flex-grow border-t border-surface/50"></div>
            <span className="flex-shrink mx-4 text-text-muted text-xs">OR</span>
            <div className="flex-grow border-t border-surface/50"></div>
        </div>

        {/* Join Campaign */}
        <div className="w-full space-y-4">
            <input
              type="text"
              placeholder="Enter Campaign Join Code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              onClick={handleJoinCampaign}
              disabled={loading}
              className="bg-transparent border border-primary text-primary hover:bg-primary hover:text-background font-bold py-2 px-4 rounded w-full transition-colors duration-200"
            >
              {loading ? 'Checking Code...' : 'Join Campaign'}
            </button>
        </div>
      </div>
    </div>
    <BuyMeACoffeeButton />
  </>
  );
}
import { create } from 'zustand';
import { db } from '../firebase';
import { doc, onSnapshot, collection, updateDoc, setDoc } from 'firebase/firestore'; // <--- Added updateDoc

export const useCampaignStore = create((set, get) => ({
  // --- STATE ---
  campaignData: null,
  inventories: {},
  isLoading: true,
  error: null,
  
  // To hold the Firestore listeners so we can unsubscribe later
  campaignListener: null,
  inventoriesListener: null,
  containerListeners: {},

  // --- ACTIONS ---
  
  /**
   * Fetches and listens to real-time updates for a specific campaign.
   * @param {string} campaignId - The ID of the campaign to fetch.
   */
  fetchCampaign: (campaignId) => {
    // Unsubscribe from any previous listeners before starting new ones
    get().clearCampaign();
    if (!campaignId) {
      return set({ isLoading: false, campaignData: null, inventories: {} });
    }

    set({ isLoading: true });

    // --- Main Campaign Listener ---
    const campaignDocRef = doc(db, 'campaigns', campaignId);
    const campaignUnsub = onSnapshot(campaignDocRef, (campaignDoc) => {
      // Include the ID in the data object so campaign.id is accessible in UI
      set({ campaignData: campaignDoc.exists() ? { id: campaignDoc.id, ...campaignDoc.data() } : null });
    }, (err) => {
      console.error("Error fetching campaign:", err);
      set({ error: 'Failed to fetch campaign.', isLoading: false });
    });

    // --- Inventories & Containers Listener ---
    const inventoriesColRef = collection(db, 'campaigns', campaignId, 'inventories');
    const inventoriesUnsub = onSnapshot(inventoriesColRef, (invSnapshot) => {
      const currentListeners = get().containerListeners;
      const newInventories = { ...get().inventories };
      const allPlayerIds = invSnapshot.docs.map(d => d.id);

      // Unsubscribe from players who left
      Object.keys(currentListeners).forEach(playerId => {
        if (!allPlayerIds.includes(playerId)) {
          currentListeners[playerId]();
          delete currentListeners[playerId];
        }
      });
      
      invSnapshot.forEach(invDoc => {
        const playerId = invDoc.id;
        const invData = invDoc.data();

        // Update top-level inventory data
        newInventories[playerId] = { ...(newInventories[playerId] || {}), ...invData, id: playerId };
        
        // Subscribe to container listeners for new players
        if (!currentListeners[playerId]) {
          const containersColRef = collection(invDoc.ref, 'containers');
          currentListeners[playerId] = onSnapshot(containersColRef, (containersSnap) => {
            const playerContainers = {};
            containersSnap.forEach(containerDoc => {
              playerContainers[containerDoc.id] = { id: containerDoc.id, ...containerDoc.data() };
            });
            
            // Update the state with the new container data for this player
            set(state => ({
              inventories: {
                ...state.inventories,
                [playerId]: { ...state.inventories[playerId], containers: playerContainers },
              }
            }));
          });
        }
      });

      set({ inventories: newInventories, isLoading: false, containerListeners: currentListeners });
    }, (err) => {
      console.error("Error fetching inventories:", err);
      set({ error: 'Failed to fetch inventories.', isLoading: false });
    });

    // Store the unsubscribe functions
    set({ campaignListener: campaignUnsub, inventoriesListener: inventoriesUnsub });
  },

  /**
   * Updates the currency for a specific player.
   * @param {string} campaignId 
   * @param {string} playerId 
   * @param {object} newCurrency - { gp: number, sp: number, cp: number }
   */
  updateCurrency: async (campaignId, playerId, newCurrency) => {
    if (!campaignId || !playerId) throw new Error("Missing ID");
    const invRef = doc(db, 'campaigns', campaignId, 'inventories', playerId);
    await updateDoc(invRef, { currency: newCurrency });
  },

  /**
   * Cleans up all Firestore listeners.
   */
  clearCampaign: () => {
    const { campaignListener, inventoriesListener, containerListeners } = get();
    if (campaignListener) campaignListener();
    if (inventoriesListener) inventoriesListener();
    Object.values(containerListeners).forEach(unsub => unsub());
    set({ 
      campaignData: null, 
      inventories: {}, 
      isLoading: true, 
      error: null,
      campaignListener: null,
      inventoriesListener: null,
      containerListeners: {}
    });
  },

  /**
   * Updates the inventories state locally for an optimistic UI update.
   * @param {object} newInventories - The complete, updated inventories object.
   */
  setInventoriesOptimistic: (newInventories) => {
    set({ inventories: newInventories });
  },

  /**
   * Toggles whether the loot pile is visible to non-DM players.
   */
  toggleLootPileVisibility: async (campaignId, currentVisibility) => {
    if (!campaignId) return;
    const lootRef = doc(db, 'campaigns', campaignId, 'inventories', 'public-loot');
    await updateDoc(lootRef, { isVisibleToPlayers: !currentVisibility });
  },

  /**
   * Ensures the public loot inventory exists.
   */
  createLootPile: async (campaignId) => {
    if (!campaignId) return;
    const lootRef = doc(db, 'campaigns', campaignId, 'inventories', 'public-loot');
    // Using setDoc with merge: true is safe; it won't overwrite if it exists
    await setDoc(lootRef, {
        characterName: "Loot Pile",
        ownerId: "public-loot",
        trayItems: [], // Items on the 'ground' of the loot pile
        isLootPile: true, // Marker to help UI identify it
        currency: { gp: 0, sp: 0, cp: 0 } // Loot piles can have money too!
    }, { merge: true });
  },
}));
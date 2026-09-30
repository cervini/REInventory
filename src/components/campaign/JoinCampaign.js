import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { getDoc } from "firebase/firestore";
import { useStarterPacks } from '../../hooks/useStarterPacks';
import './JoinCampaign.css';

export default function JoinCampaign({ campaignId, onClose, onJoinSuccess, isDMAddingCharacter = false }) {
  const [characterName, setCharacterName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('none');
  const [loading, setLoading] = useState(false);
  
  // Use the new hook to get the packs
  const { packs, isLoading: packsLoading } = useStarterPacks();

  /**
   * Handles the form submission for joining a campaign.
   * It creates the player's inventory document, including a default backpack and any
   * items from a selected starter pack, and adds the player to the campaign's roster.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!characterName.trim()) {
      toast.error("Please enter a character name.");
      return;
    }
    setLoading(true);
    const currentUser = auth.currentUser;
    
    let startingItems = [];
    if (selectedPackId !== 'none') {
        const selectedPack = packs.find(p => p.id === selectedPackId);
        if (selectedPack) {
            // THIS IS THE FIX (Part 1): Ensure every starter item has all the
            // necessary default properties to be rendered correctly.
            startingItems = selectedPack.items.map(item => ({
                name: "Unknown Item",
                w: 1, h: 1,
                type: 'Gear',
                stackable: item.quantity > 1,
                ...item, // The item's data from the pack will override defaults
                id: crypto.randomUUID()
            }));
        }
    }

    try {
      const campaignDocRef = doc(db, 'campaigns', campaignId);
      const campaignDoc = await getDoc(campaignDocRef);
      const campaignData = campaignDoc.data();

      const defaultBackpackSize = campaignData?.defaultBackpackSize || { width: 10, height: 5 };
      
      if (isDMAddingCharacter || campaignData?.dmId === currentUser.uid) {
        const newCharacterId = crypto.randomUUID();
        
        await updateDoc(campaignDocRef, {
          players: arrayUnion(newCharacterId),
          [`layout.order`]: arrayUnion(newCharacterId),
          [`layout.visible.${newCharacterId}`]: true
        });

        const inventoryDocRef = doc(db, "campaigns", campaignId, "inventories", newCharacterId);
        await setDoc(inventoryDocRef, {
          characterName: characterName.trim(),
          ownerId: currentUser.uid, // DM is the owner
          trayItems: startingItems,
          totalMaxWeight: 150,
          weightUnit: 'lbs',
          strength: 10,
          size: 'Medium',
          useCalculatedWeight: true,
          currency: { gp: 0, sp: 0, cp: 0 },
        });

        const backpackRef = doc(inventoryDocRef, "containers", "backpack");
        await setDoc(backpackRef, {
          name: "Backpack",
          gridItems: [],
          gridWidth: defaultBackpackSize.width,
          gridHeight: defaultBackpackSize.height,
          trackWeight: true,
        });

      } else {
        // Existing logic for a player joining
        await updateDoc(campaignDocRef, {
          players: arrayUnion(currentUser.uid),
          [`layout.order`]: arrayUnion(currentUser.uid),
          [`layout.visible.${currentUser.uid}`]: true
        });

        const inventoryDocRef = doc(db, "campaigns", campaignId, "inventories", currentUser.uid);
        await setDoc(inventoryDocRef, {
          characterName: characterName.trim(),
          ownerId: currentUser.uid,
          trayItems: startingItems,
          totalMaxWeight: 100,
          weightUnit: 'lbs',
          currency: { gp: 0, sp: 0, cp: 0 },
        });
        
        const backpackRef = doc(inventoryDocRef, "containers", "backpack");
        await setDoc(backpackRef, {
          name: "Backpack",
          gridItems: [], // The backpack starts empty
          gridWidth: defaultBackpackSize.width,
          gridHeight: defaultBackpackSize.height,
          trackWeight: true,
        });
      }

      toast.success(`Welcome, ${characterName.trim()}!`);
      onJoinSuccess(campaignId);

    } catch (error) {
      console.error("Error joining campaign: ", error);
      toast.error("Failed to join campaign.");
      setLoading(false);
    }
  };

  return (
    <div className="join-campaign" onClick={onClose}>
      <div className="join-campaign__dialog" onClick={e => e.stopPropagation()}>
        <h3 className="join-campaign__title">
          {isDMAddingCharacter ? 'Add New Character' : 'Join Campaign'}
        </h3>
        <p className="join-campaign__description">
          {isDMAddingCharacter ? 'Create a new character for this campaign.' : 'Create your character for this new adventure.'}
        </p>
        <form onSubmit={handleJoin} className="join-campaign__form">
          <div>
            <label className="join-campaign__label">Character Name</label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="join-campaign__field"
              placeholder="e.g., Billy Ray Valentine"
            />
          </div>
          <div>
            <label className="join-campaign__label">Starting Pack</label>
            <select 
                value={selectedPackId}
                onChange={(e) => setSelectedPackId(e.target.value)}
                disabled={packsLoading} 
                className="join-campaign__field"
            >
              <option value="none">Standard Equipment (None)</option>
              {packs.map(pack => (
                  <option key={pack.id} value={pack.id}>{pack.name}</option>
              ))}
            </select>
          </div>
          <div className="join-campaign__actions">
            <button type="button" onClick={onClose} disabled={loading} className="join-campaign__button join-campaign__button--cancel">Cancel</button>
            <button type="submit" disabled={loading} className="join-campaign__button join-campaign__button--submit">
              {loading ? 'Joining...' : 'Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
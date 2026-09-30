import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useCompendium } from '../../hooks/useCompendium';
import Spinner from '../ui/Spinner';
import { getColorForItemType } from '../../utils/itemUtils';
import './AddFromCompendium.css';

export default function AddFromCompendiumModal({ onClose, onAddItem, players, dmId, playerProfiles, user, inventories }) {
    const { allItems, isLoading } = useCompendium();
    const [selectedItem, setSelectedItem] = useState(null);
    const [quantity, setQuantity] = useState(1);
    
    // Check if the current user is the DM.
    const isDM = user.uid === dmId;

    // The list of players to show in the dropdown. If the user is the DM, show all players.
    // Otherwise, only show the current user's player ID.
    const targetablePlayers = isDM ? players : [user.uid];

    // Set the initial target to the DM if they are the one opening the modal,
    // otherwise default to the current user (the only option for a player).
    const [targetPlayerId, setTargetPlayerId] = useState(isDM ? dmId : user.uid);
    
    const [searchTerm, setSearchTerm] = useState('');

    const handleSelect = (item) => {
        setSelectedItem(item);
        setQuantity(item.quantity || 1);
    };

    const handleConfirm = () => {
        if (!selectedItem || !targetPlayerId) {
            toast.error("Please select an item and a player.");
            return;
        }
        
        const newItem = {
            ...selectedItem,
            id: crypto.randomUUID(),
            quantity: parseInt(quantity, 10),
        };
        onAddItem(newItem, targetPlayerId);
        onClose();
    };

    const filteredItems = allItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedItem) {
        return (
            <div className="add-from-compendium" onClick={onClose}>
                <div className="add-from-compendium__dialog add-from-compendium__dialog--selected" onClick={e => e.stopPropagation()}>
                    <h3 className="add-from-compendium__title">Add "{selectedItem.name}"</h3>
                    <div className="add-from-compendium__fields">
                        <div>
                            <label className="add-from-compendium__label">Quantity</label>
                            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="add-from-compendium__field" />
                        </div>
                        <div>
                            <label className="add-from-compendium__label">Add to Player</label>
                            {/* The dropdown is disabled for players,
                                and it maps over the filtered `targetablePlayers` list. */}
                            <select 
                                value={targetPlayerId} 
                                onChange={(e) => setTargetPlayerId(e.target.value)}
                                disabled={!isDM} 
                                className="add-from-compendium__field"
                            >
                                {targetablePlayers.map(pId => 
                                  <option key={pId} value={pId}>
                                    {inventories[pId]?.characterName || playerProfiles[pId]?.displayName || pId}
                                  </option>
                                )}
                            </select>
                        </div>
                    </div>
                    <div className="add-from-compendium__actions">
                        <button type="button" onClick={() => setSelectedItem(null)} className="add-from-compendium__button add-from-compendium__button--secondary">Back</button>
                        <button type="button" onClick={handleConfirm} className="add-from-compendium__button add-from-compendium__button--primary">Confirm Add</button>
                    </div>
                </div>
            </div>
        )
    }

    // Item browser
    return (
        <div className="add-from-compendium" onClick={onClose}>
            <div className="add-from-compendium__dialog add-from-compendium__dialog--browser" onClick={e => e.stopPropagation()}>
                <h3 className="add-from-compendium__title">Add from Compendium</h3>
                {/* Search bar */}
                <input type="text" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="add-from-compendium__field add-from-compendium__search" />
                <div className="add-from-compendium__results">
                    {/* Render filtered item or loading icon*/}
                    {isLoading ? <Spinner /> : (
                        <div className="add-from-compendium__grid">
                            {filteredItems.map(item => (
                                <button key={item.id} onClick={() => handleSelect(item)} className={`${getColorForItemType(item.type)} add-from-compendium__item`}>
                                    <div className="add-from-compendium__item-details">
                                        <h4 className="add-from-compendium__item-name" title={item.name}>{item.name}</h4>
                                        <p className="add-from-compendium__item-rarity">{item.rarity || 'Common'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Cancel button */}
                <div className="add-from-compendium__actions">
                    <button type="button" onClick={onClose} className="add-from-compendium__button add-from-compendium__button--secondary">Cancel</button>
                </div>
            </div>
        </div>
    );
}
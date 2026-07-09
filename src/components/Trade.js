import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, getDocs, collection, writeBatch, deleteDoc } from 'firebase/firestore';
import Spinner from './ui/Spinner';
import { generateItemTooltip } from '../utils/itemUtils';

/**
 * A simple component to render a single item in a list for the trade window.
 * It displays the item's name and quantity and includes a detailed tooltip.
 * @param {object} props - The component props.
 * @param {object} props.item - The item object to display.
 * @param {Function} props.onClick - The function to call when the item is clicked.
 * @returns {JSX.Element}
 */
function ItemListItem({ item, onClick }) {
  return (
    <button
      onClick={onClick}
      className="p-2 w-full text-left bg-surface/80 rounded-md flex justify-between items-center cursor-pointer hover:bg-surface transition-colors"
      data-tooltip-id="trade-item-tooltip"
      data-tooltip-html={generateItemTooltip(item)}
    >
      <span>{item.name} {item.quantity > 1 ? <span className="text-text-muted text-sm">x{item.quantity}</span> : ''}</span>
    </button>
  );
}

/**
 * A component that displays a list of items being offered in the trade.
 * @param {object} props - The component props.
 * @param {Array<object>} props.items - The array of item objects in the offer.
 * @param {Function} props.onItemClick - The function to call when an item in the offer is clicked.
 * @returns {JSX.Element}
 */
function TradeOffer({ items, onItemClick }) {
    return (
        <div className="bg-background/50 min-h-[5rem] h-20 sm:min-h-[6rem] sm:h-24 rounded-lg p-2 flex items-center space-x-2 overflow-x-auto border border-accent/20">
            {items.length === 0 ? (
                <p className="text-text-muted text-sm px-2 italic w-full text-center">Offer is empty.</p>
            ) : (
                items.map(item => (
                    <div
                        key={item.id}
                        className="w-20 h-full flex-shrink-0 sm:w-24"
                    >
                       <ItemListItem item={item} onClick={() => onItemClick(item)} />
                    </div>
                ))
            )}
        </div>
    );
}


export default function Trade({ onClose, tradeId, user, playerProfiles, inventories }) {
    const [tradeData, setTradeData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [localInventory, setLocalInventory] = useState([]);
    const [localOffer, setLocalOffer] = useState([]);
    const [otherPlayerOffer, setOtherPlayerOffer] = useState([]);
    const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);
    const snapshotUnsubscribe = useRef(null);

    useEffect(() => {
        const tradeDocRef = doc(db, 'trades', tradeId);
        /**
         * Subscribes to real-time updates for the current trade document.
         * Updates the local state (`tradeData`, `otherPlayerOffer`, `localOffer`) whenever the trade data changes in Firestore.
         * This keeps the UI in sync for both players.
         */
        snapshotUnsubscribe.current = onSnapshot(tradeDocRef, (doc) => {
            if (!doc.exists()) {
                onClose();
                return;
            }
            const updatedTradeData = doc.data();
            setTradeData(updatedTradeData);
            const isPlayerA = user.uid === updatedTradeData.playerA;
            setOtherPlayerOffer(isPlayerA ? updatedTradeData.offerB : updatedTradeData.offerA);
            setLocalOffer(isPlayerA ? updatedTradeData.offerA : updatedTradeData.offerB);
        }, (error) => {
            console.error("Snapshot listener error:", error);
            onClose();
        });
        return () => { if (snapshotUnsubscribe.current) snapshotUnsubscribe.current(); };
    }, [tradeId, user.uid, onClose]);

    useEffect(() => {
        if (!tradeData || isInventoryLoaded) return;
        /**
         * Fetches the user's complete inventory once when the trade window opens.
         * It aggregates items from the main tray and all containers, then filters out
         * any items that are already part of the initial trade offer.
         */
        const fetchInitialInventory = async () => {
            setIsLoading(true);
            try {
                const inventoryDocRef = doc(db, 'campaigns', tradeData.campaignId, 'inventories', user.uid);
                const inventorySnap = await getDoc(inventoryDocRef);
                if (inventorySnap.exists()) {
                    const inventoryData = inventorySnap.data();
                    let allItems = [...(inventoryData.trayItems || [])];
                    const containersColRef = collection(inventoryDocRef, 'containers');
                    const containersSnapshot = await getDocs(containersColRef);
                    containersSnapshot.forEach(doc => {
                        const d = doc.data();
                        if (d.gridItems) allItems = [...allItems, ...d.gridItems];
                        if (d.trayItems) allItems = [...allItems, ...d.trayItems];
                    });
                    const offerIds = new Set(localOffer.map(i => i.id));
                    setLocalInventory(allItems.filter(i => !offerIds.has(i.id)));
                    setIsInventoryLoaded(true);
                }
            } catch (e) { toast.error("Could not load inventory."); } 
            finally { setIsLoading(false); }
        };
        fetchInitialInventory();
    }, [tradeData, user.uid, localOffer, isInventoryLoaded]);

    /**
     * Handles moving an item between the user's available inventory and their current trade offer.
     * It updates the local state and then updates the user's offer in the Firestore trade document.
     * @param {object} item - The item being moved.
     * @param {('inventory'|'offer')} source - The area the item is being moved from.
     */
    const handleItemClick = async (item, source) => {
        let newLocalInventory, newLocalOffer;
        if (source === 'inventory') {
            newLocalInventory = localInventory.filter(i => i.id !== item.id);
            newLocalOffer = [...localOffer, item];
        } else {
            newLocalOffer = localOffer.filter(i => i.id !== item.id);
            newLocalInventory = [...localInventory, item];
        }
        setLocalInventory(newLocalInventory);
        setLocalOffer(newLocalOffer);
        const userOfferField = user.uid === tradeData.playerA ? 'offerA' : 'offerB';
        await updateDoc(doc(db, 'trades', tradeId), {
            [userOfferField]: newLocalOffer,
            acceptedA: false,
            acceptedB: false,
        });
    };

    /**
     * Marks the current user's side of the trade as 'accepted' in Firestore.
     * If both players have accepted, it triggers the trade finalization process.
     */
    const handleAcceptTrade = async () => {
        setIsSubmitting(true);
        const tradeDocRef = doc(db, 'trades', tradeId);
        const userAcceptField = user.uid === tradeData.playerA ? 'acceptedA' : 'acceptedB';
        try {
            await updateDoc(tradeDocRef, { [userAcceptField]: true });
            const updatedTradeSnap = await getDoc(tradeDocRef);
            const updatedTradeData = updatedTradeSnap.data();
            if (updatedTradeData.acceptedA && updatedTradeData.acceptedB) {
                setIsFinalizing(true);
                toast.success("Both players have accepted. Finalizing...");
                await finalizeTradeOnClient(updatedTradeData);
            }
        } catch (error) {
            toast.error("Failed to accept trade.");
            setIsSubmitting(false);
        }
    };
    
    /**
     * Finalizes the trade by performing the item swap between both players' inventories.
     * This function reads the final state of the trade, then uses a batched write to
     * remove items from the givers' inventories and add them to the receivers' trays.
     * It operates on the client-side for immediate feedback.
     * @param {object} finalTradeData - The complete trade data object when both players have accepted.
     */
    const finalizeTradeOnClient = async (finalTradeData) => {
        try {
            const { campaignId, playerA, playerB, offerA, offerB } = finalTradeData;
            const batch = writeBatch(db);

            // Handle removals and additions in separate, non-conflicting steps.
            const processPlayer = async (playerId, itemsToRemove, itemsToAdd) => {
                const invRef = doc(db, 'campaigns', campaignId, 'inventories', playerId);
                const invSnap = await getDoc(invRef);
                if (!invSnap.exists()) throw new Error("Inventory not found.");
                
                const invData = invSnap.data();
                const isDM = invData.characterName === "DM";
                const itemsToRemoveIds = new Set(itemsToRemove.map(i => i.id));
                const itemsWithStrippedCoords = itemsToAdd.map(({x, y, ...item}) => item);

                // --- Step 1: Process all REMOVALS ---
                // Remove from the player's main tray (if they are not a DM)
                if (!isDM) {
                    const newPlayerTray = (invData.trayItems || []).filter(i => !itemsToRemoveIds.has(i.id));
                    batch.update(invRef, { trayItems: newPlayerTray });
                }

                // Remove from all of the player's containers (grids and trays)
                const containersRef = collection(invRef, 'containers');
                const containersSnap = await getDocs(containersRef);
                containersSnap.forEach(containerDoc => {
                    const containerData = containerDoc.data();
                    const newGrid = (containerData.gridItems || []).filter(i => !itemsToRemoveIds.has(i.id));
                    const newTray = (containerData.trayItems || []).filter(i => !itemsToRemoveIds.has(i.id));
                    batch.update(containerDoc.ref, { gridItems: newGrid, trayItems: newTray });
                });


                // --- Step 2: Process all ADDITIONS ---
                if (isDM) {
                    // For the DM, add received items to their first container's tray
                    if (containersSnap.docs.length > 0) {
                        const firstContainerRef = containersSnap.docs[0].ref;
                        const firstContainerData = containersSnap.docs[0].data();
                        const finalDMTray = [...(firstContainerData.trayItems || []).filter(i => !itemsToRemoveIds.has(i.id)), ...itemsWithStrippedCoords];
                        batch.update(firstContainerRef, { trayItems: finalDMTray });
                    }
                } else {
                    // For a player, add received items to their main tray
                    const originalTray = invData.trayItems || [];
                    const filteredTray = originalTray.filter(i => !itemsToRemoveIds.has(i.id));
                    const finalPlayerTray = [...filteredTray, ...itemsWithStrippedCoords];
                    batch.update(invRef, { trayItems: finalPlayerTray });
                }
            };

            // Process both sides of the trade
            await processPlayer(playerA, offerA, offerB);
            await processPlayer(playerB, offerB, offerA);

            // Delete the trade document now that it's complete
            batch.delete(doc(db, 'trades', tradeId));
            await batch.commit();

            if (snapshotUnsubscribe.current) snapshotUnsubscribe.current();
            toast.success("Trade successful!");
            onClose();

        } catch (error) {
            toast.error(error.message || "Failed to finalize trade.");
            await updateDoc(doc(db, 'trades', tradeId), { acceptedA: false, acceptedB: false });
            setIsFinalizing(false);
            setIsSubmitting(false);
        }
    };

    /**
     * Cancels the trade by deleting the trade document from Firestore.
     * This closes the trade window for both participants.
     */
    const handleCancelTrade = async () => {
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, 'trades', tradeId));
            toast.error("Trade cancelled.");
            onClose();
        } catch (error) { toast.error(error.message); } 
        finally { setIsSubmitting(false); }
    };

    if (isLoading || !tradeData) {
        return <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-40 backdrop-blur-sm"><Spinner /></div>;
    }

    const isPlayerA = user.uid === tradeData.playerA;
    const yourData = { id: user.uid, accepted: isPlayerA ? tradeData.acceptedA : tradeData.acceptedB };
    const otherPlayer = { id: isPlayerA ? tradeData.playerB : tradeData.playerA, accepted: isPlayerA ? tradeData.acceptedB : tradeData.acceptedA };

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-40 backdrop-blur-sm p-4">
            <div className="bg-gradient-to-b from-surface to-background border border-accent/20 p-4 rounded-lg shadow-xl w-full h-full flex flex-col">
                <h3 className="text-2xl font-bold mb-4 font-fantasy text-accent text-center">Trading Table</h3>
                <div className="flex flex-col md:flex-row flex-grow overflow-auto gap-4 min-h-0">
                  <div className="flex flex-col space-y-4 md:w-1/3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-lg">{(inventories[yourData.id]?.characterName || playerProfiles[yourData.id]?.displayName) || 'Your'}'s Offer</h4>
                      </div>
                      <TradeOffer items={localOffer} onItemClick={(item) => handleItemClick(item, 'offer')} />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-lg">{(inventories[otherPlayer.id]?.characterName || playerProfiles[otherPlayer.id]?.displayName)}'s Offer</h4>
                          {otherPlayer.accepted && (
                            <span className="bg-green-800/80 text-text-base text-xs font-bold px-2 py-1 rounded-md">
                              Accepted
                            </span>
                          )}
                      </div>
                      <TradeOffer items={otherPlayerOffer} onItemClick={() => {}} />
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2 flex-grow md:w-2/3 min-h-0">
                    <h4 className="font-bold text-lg">Your Available Items</h4>
                    <div className="flex-grow overflow-auto border border-surface/50 rounded-lg p-2 space-y-2">
                        {localInventory.map(item => (
                            <ItemListItem
                                key={item.id}
                                item={item}
                                onClick={() => handleItemClick(item, 'inventory')}
                            />
                        ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4">
                    <button onClick={handleCancelTrade} disabled={isSubmitting || isFinalizing} className="bg-destructive/80 hover:bg-destructive text-text-base font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">
                        {isSubmitting ? '...' : 'Cancel Trade'}
                    </button>
                    <button onClick={handleAcceptTrade} disabled={yourData.accepted || isSubmitting || isFinalizing} className="bg-primary hover:bg-accent hover:text-background text-text-base font-bold py-2 px-4 rounded transition-colors disabled:opacity-50">
                        {isFinalizing ? 'Finalizing...' : (isSubmitting ? '...' : (yourData.accepted ? 'Waiting...' : 'Accept Trade'))}
                    </button>
                </div>
            </div>
        </div>
    );
}
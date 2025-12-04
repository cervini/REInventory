import React, { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { doc, updateDoc, writeBatch, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from '../firebase';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import PlayerInventoryGrid from './PlayerInventoryGrid';
import { findFirstAvailableSlot, onOtherItem, outOfBounds } from '../utils/gridUtils';
import AddItem from './AddItem';
import ContextMenu from './ContextMenu';
import SplitStack from './SplitStack';
import Spinner from './Spinner';
import ItemTray from './ItemTray';
import InventorySettings from './InventorySettings';
import { getColorForItemType } from '../utils/itemUtils';
import AddFromCompendium from './AddFromCompendium';
import StartTrade from './StartTrade';
import TradeNotifications from './TradeNotifications';
import Trade from './Trade';
import { useCampaignStore } from '../stores/useCampaignStore';
import { usePlayerProfiles } from '../hooks/usePlayerProfiles';
import CampaignLayout from './CampaignLayout';
import WeightCounter from './WeightCounter';

/**
 * Renders the complete inventory for a single player, including their character name,
 * weight display, settings button, all containers (grids), and the main item tray.
 * @param {object} props - The component props.
 * @returns {JSX.Element|null} The rendered player inventory or null if data is not ready.
 */
const PlayerInventory = ({
  playerId, inventoryData, campaign, playerProfiles, user,
  setEditingSettings, cellSizes, gridRefs, onContextMenu, onToggleEquipped, isEquippedVisible
}) => {
  // We use optional chaining (?.) to prevent errors if inventoryData is not ready.
  const containers = useMemo(() => Object.values(inventoryData?.containers || {}), [inventoryData]);

  const isViewerDM = campaign?.dmId === user.uid;

  const totalWeightLbs = useMemo(() => {
    if (!inventoryData) return 0;
    
    const containerGridItems = containers
      .filter(c => c.trackWeight ?? true)
      .flatMap(c => c.gridItems || []);
    const equippedItems = inventoryData.equippedItems || [];

    // Items on the floor/ground (playerTrayItems) should not count towards encumbrance.
    // Only items in containers and equipped items affect the character's weight.
    const allItems = [...containerGridItems, ...equippedItems];
    return allItems.reduce((total, item) => {
        const weightValue = parseFloat(item.weight);
        if (!isNaN(weightValue)) {
          return total + (weightValue * (item.quantity || 1));
        }
        return total;
      }, 0);
  }, [inventoryData, containers]);
  
  // The conditional return now correctly happens AFTER all hooks are called.
  if (!inventoryData) return null;

  const isPlayerDM = campaign?.dmId === playerId;
  const isMyInventory = user.uid === inventoryData.ownerId;

  return (
    <div className="bg-surface rounded-lg shadow-lg shadow-accent/10 border border-accent/20 overflow-hidden">
      <div className="w-full p-2 text-left bg-surface/80 flex flex-wrap justify-between items-center border-b border-surface/50 gap-2">
        <h2 className="text-xl font-bold text-accent font-fantasy tracking-wider truncate">
          {inventoryData.characterName || playerProfiles[playerId]?.displayName}
        </h2>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {!isPlayerDM && (
            <WeightCounter
              currentWeight={totalWeightLbs}
              maxWeight={inventoryData.totalMaxWeight || 0}
              unit={inventoryData.weightUnit || 'lbs'}
            />
          )}
          {!isPlayerDM && (
            <button
              onClick={onToggleEquipped}
              className="p-2 rounded-full hover:bg-background transition-colors"
              aria-label="Toggle equipped items view"
              title="Toggle Equipped Items"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.602-3.751m-.228-1.12A12.001 12.001 0 0012 2.75c-2.652 0-5.115 1.02-6.974 2.722" />
              </svg>
            </button>
          )}
          {isMyInventory && (
            <button
              onClick={() => setEditingSettings({
                playerId: playerId,
                currentSettings: inventoryData,
                isDMInventory: isPlayerDM
              })}
              className="p-2 rounded-full hover:bg-background transition-colors"
              aria-label="Edit character and inventory settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-muted" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Collapsible Equipped Items Tray */}
      {!isPlayerDM && (
        <div className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${isEquippedVisible ? 'max-h-96' : 'max-h-0 invisible'}`}>
          <div className="p-2 bg-background/50 border-b border-surface/50">
              <h3 className="font-bold font-fantasy text-text-muted px-2 text-sm">Equipped</h3>
              <div className="bg-background/50 rounded-lg p-2 border border-accent/10 shadow-inner">
                  <ItemTray
                      items={inventoryData.equippedItems || []}
                      containerId="equipped"
                      onContextMenu={onContextMenu}
                      playerId={playerId}
                      isViewerDM={isViewerDM}
                      emptyMessage="No items equipped."
                      source="equipped"
                      layout="horizontal"
                      disabled={!isEquippedVisible}
                  />
              </div>
          </div>
      </div>
      )}

      <div className="bg-background/50">
        <div className="p-2 space-y-4">
          {isPlayerDM ? (
              containers.map(container => (
                  <div key={container.id} className="bg-background/50 rounded-lg p-2 border border-accent/10 shadow-inner">
                    <ItemTray
                        items={container.trayItems || []}
                        containerId={container.id}
                        onContextMenu={onContextMenu}
                        playerId={playerId}
                        isViewerDM={isViewerDM}
                    />
                  </div>
              ))
          ) : (
              <>
                  <div className="flex flex-row flex-wrap gap-4">
                    {containers.map((container) => (
                      <div 
                        key={container.id} 
                        className="bg-surface/50 rounded-lg p-2 flex-grow"
                        style={{ flexBasis: `${container.gridWidth * 3.5}rem`, minWidth: '12rem' }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold text-text-muted">{container.name}</h3>
                        </div>
                        <PlayerInventoryGrid
                          items={container.gridItems || []}
                          gridWidth={container.gridWidth}
                          gridHeight={container.gridHeight}
                          containerId={container.id}
                          onContextMenu={onContextMenu}
                          playerId={playerId}
                          setGridRef={(node) => (gridRefs.current[container.id] = node)}
                          cellSize={cellSizes[container.id]}
                          isViewerDM={isViewerDM}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-2">
                      <h3 className="font-bold font-fantasy text-text-muted p-2 mt-2">Floor / Ground</h3>
                      <div className="bg-background/50 rounded-lg p-2 border border-accent/10 shadow-inner">
                        <ItemTray
                            items={inventoryData.trayItems || []}
                            containerId="tray" 
                            onContextMenu={onContextMenu}
                            playerId={playerId}
                            isViewerDM={isViewerDM}
                        />
                      </div>
                  </div>
              </>
          )}
        </div>
      </div>
    </div>
  );
};

export default function InventoryGrid({ campaignId, user, userProfile, isTrading, setIsTrading }) {

  const {
    inventories,
    campaignData: campaign,
    isLoading: inventoriesLoading,
    setInventoriesOptimistic,
    fetchCampaign,
    clearCampaign
  } = useCampaignStore();
  
  const { playerProfiles, isLoading: profilesLoading } = usePlayerProfiles(campaignId);
  const isLoading = inventoriesLoading || profilesLoading;

  const isDM = campaign?.dmId === user?.uid;

  const [showAddItem, setShowAddItem] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, position: null, item: null, playerId: null, actions: [] });
  const [itemToEdit, setItemToEdit] = useState(null);
  const [splittingItem, setSplittingItem] = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const [editingSettings, setEditingSettings] = useState(null);
  const [cellSizes, setCellSizes] = useState({});
  const [showCompendium, setShowCompendium] = useState(false);
  const [activeTrade, setActiveTrade] = useState(null);
  const [showEquipped, setShowEquipped] = useState({});
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);

  const gridRefs = useRef({});

  useEffect(() => {
    fetchCampaign(campaignId);
    return () => {
      clearCampaign();
    };
  }, [campaignId, fetchCampaign, clearCampaign]);

  const containerStructureSignature = useMemo(() => {
    return Object.values(inventories)
        .flatMap(inv => Object.values(inv.containers || {}))
        .map(c => `${c.id}-${c.gridWidth}-${c.gridHeight}`)
        .join(',');
  }, [inventories]);

  const orderedAndVisibleInventories = useMemo(() => {
    if (!user || !inventories || Object.keys(inventories).length === 0) return [];

    if (!isDM) {
        // If the user is a player, only return their own inventory data.
        const myInventory = inventories[user.uid];
        return myInventory ? [[user.uid, myInventory]] : [];
    }
    
    // If the user is the DM, use the existing layout and visibility logic.
    if (!campaign?.layout) {
      return Object.entries(inventories);
    }
    const { order = [], visible = {} } = campaign.layout;
    const ordered = order
        .map(playerId => ([playerId, inventories[playerId]]))
        .filter(entry => entry[1]); // Ensure player data exists
    
    return ordered.filter(([playerId]) => visible[playerId] ?? true);

  }, [campaign, inventories, user, isDM]);

  /**
   * Sets the active trade, which triggers the Trade component to be rendered.
   * @param {object} trade - The trade object.
   */
  const handleTradeStarted = (trade) => {
    setActiveTrade(trade);
  };

  const toggleEquipped = (playerId) => {
    setShowEquipped(prev => ({ ...prev, [playerId]: !(prev[playerId] ?? false) }));
  };
  useEffect(() => {
    if (!user || !campaignId) return;

    /**
     * Listens for a trade to become 'active' after the current user (as playerB) accepts an invitation.
     * When an accepted trade is detected, it opens the trade window.
     */
    const tradesRef = collection(db, 'trades');
    
    // Create a query that looks for trades in this campaign where:
    // 1. The current user is the one being invited (playerB).
    // 2. The trade has just become 'active'.
    const q = query(
      tradesRef,
      where('campaignId', '==', campaignId),
      where('playerB', '==', user.uid),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If a trade matching this query appears, it means we just accepted an invitation.
      if (!snapshot.empty) {
        const tradeDoc = snapshot.docs[0];
        // Set this as the active trade, which will open the trade window UI.
        setActiveTrade({ id: tradeDoc.id, ...tradeDoc.data() });
      }
    });

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [campaignId, user]);

  useEffect(() => {
    const observers = [];
    
    /**
     * Measures the dimensions of each inventory grid element whenever the component mounts
     * or the container structure changes. The calculated cell size is used to render
     * the drag overlay for items at the correct dimensions.
     */
    Object.entries(gridRefs.current).forEach(([containerId, gridElement]) => {
      if (gridElement) {
        const measure = () => {
          let containerData;
          for (const inv of Object.values(inventories)) {
            if (inv.containers && inv.containers[containerId]) {
              containerData = inv.containers[containerId];
              break;
            }
          }

          if (containerData) {
            setCellSizes(prev => ({
              ...prev,
              [containerId]: {
                width: gridElement.offsetWidth / containerData.gridWidth,
                height: gridElement.offsetHeight / containerData.gridHeight,
              }
            }));
          }
        };

        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(gridElement);
        measure();
        
        observers.push({ element: gridElement, observer: resizeObserver });
      }
    });

    return () => {
      observers.forEach(({ element, observer }) => {
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [containerStructureSignature, inventories]);

  /**
   * Handles the right-click event on an item to display a context menu.
   * It constructs a list of available actions (e.g., Rotate, Split, Edit, Delete)
   * based on the item's properties and the user's permissions (DM or owner).
   * @param {React.MouseEvent} event - The mouse event.
   * @param {object} item - The item that was right-clicked.
   * @param {string} playerId - The ID of the owner of the item.
   * @param {('grid'|'tray')} source - The location of the item.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleContextMenu = (event, item, playerId, source, containerId) => {
    event.preventDefault();

    // Prevent the "ghost click" that immediately closes the menu on mobile.
    // When a long press ends (touchend), mobile browsers fire a synthetic click event.
    // This prevents that click from happening, so our "click-outside" handler doesn't close the menu.
    const preventGhostClick = (e) => {
      e.preventDefault();
      event.currentTarget.removeEventListener('touchend', preventGhostClick);
    };
    event.currentTarget.addEventListener('touchend', preventGhostClick);
    
    const isDM = campaign?.dmId === user?.uid;
    const availableActions = [];
    const isPlayerDM = campaign?.dmId === playerId;

    // Equip/Unequip is only for non-DM players
    if (!isPlayerDM) {
      if (source === 'equipped') {
        availableActions.push({
          label: 'Unequip',
          onClick: () => handleUnequipItem(item, playerId),
        });
      } else {
        availableActions.push({ label: 'Equip', onClick: () => handleEquipItem(item, playerId, source, containerId) });
      }
    }

    if (isDM && item.magicProperties && !item.magicPropertiesVisible) {
      availableActions.push({
        label: 'Reveal Magic Properties',
        onClick: () => handleRevealMagicProperties(item, playerId, source, containerId),
      });
    }

    // if (source === 'grid' && !item.stackable)
    if (source === 'grid') {
        availableActions.push({ 
            label: 'Rotate', 
            onClick: () => handleRotateItem(item, playerId, containerId) 
        });
    }

    if (isDM) {
      const allPlayerIds = campaign?.players || [];
      const otherPlayers = allPlayerIds.filter(id => id !== playerId);
      if (otherPlayers.length > 0) {
        availableActions.push({
          label: 'Send to...',
          submenu: otherPlayers.map(targetId => ({
            label: inventories[targetId]?.characterName || playerProfiles[targetId]?.displayName || targetId,
            onClick: () => handleSendItem(item, source, playerId, targetId, containerId, isPlayerDM),
          })),
        });
      }
    }

    if (item.stackable && item.quantity > 1) {
      availableActions.push({ label: 'Split Stack', onClick: () => handleStartSplit(item, playerId, containerId) });
    }
    if (isDM || user.uid === playerId) {
      availableActions.push({ 
        label: 'Edit Item', 
        onClick: () => handleStartEdit(item, playerId, containerId),
      });
      availableActions.push({ 
        label: 'Duplicate Item', 
        onClick: () => handleDuplicateItem(item, playerId),
      });
      availableActions.push({
        label: 'Delete Item',
        onClick: () => handleDeleteItem(item, playerId, source, containerId),
      });
    }

    const position = {
      x: event.touches ? event.touches[0].clientX : event.clientX,
      y: event.touches ? event.touches[0].clientY : event.clientY,
    };

    setContextMenu({
      visible: true,
      position: position,
      actions: availableActions,
    });
  };

  const handleEquipItem = async (item, playerId, source, containerId) => {
    if (!item || !playerId || !source) return;

    const originalInventories = inventories;
    const newInventories = JSON.parse(JSON.stringify(originalInventories));
    const playerInv = newInventories[playerId];
    if (!playerInv) return;

    // 1. Remove from source optimistically
    let itemRemoved = false;
    if (source === 'grid') {
      const container = playerInv.containers?.[containerId];
      if (container?.gridItems) {
        const itemIndex = container.gridItems.findIndex(i => i.id === item.id);
        if (itemIndex > -1) {
          container.gridItems.splice(itemIndex, 1);
          itemRemoved = true;
        }
      }
    } else { // source === 'tray'
      if (playerInv.trayItems) {
        const itemIndex = playerInv.trayItems.findIndex(i => i.id === item.id);
        if (itemIndex > -1) {
          playerInv.trayItems.splice(itemIndex, 1);
          itemRemoved = true;
        }
      }
    }

    if (!itemRemoved) {
      toast.error("Item to equip not found.");
      return;
    }

    // 2. Add to equippedItems optimistically
    const { x, y, ...equippedItem } = item;
    if (!playerInv.equippedItems) playerInv.equippedItems = [];
    playerInv.equippedItems.push(equippedItem);

    setInventoriesOptimistic(newInventories);

    const batch = writeBatch(db);
    const playerInvRef = doc(db, "campaigns", campaignId, "inventories", playerId);
    if (source === 'grid') {
      const containerRef = doc(playerInvRef, "containers", containerId);
      batch.update(containerRef, { gridItems: playerInv.containers[containerId].gridItems });
    } else {
      batch.update(playerInvRef, { trayItems: playerInv.trayItems });
    }
    batch.update(playerInvRef, { equippedItems: playerInv.equippedItems });

    try {
      await batch.commit();
      toast.success(`${item.name} equipped.`);
    } catch (error) {
      toast.error("Failed to equip item. Reverting changes.");
      console.error("Firestore batch write failed:", error);
      setInventoriesOptimistic(originalInventories);
    }
  };

  const handleUnequipItem = async (item, playerId) => {
    if (!item || !playerId) return;

    const originalInventories = inventories;
    const newInventories = JSON.parse(JSON.stringify(originalInventories));
    const playerInv = newInventories[playerId];

    // 1. Remove from equippedItems
    const itemIndex = playerInv.equippedItems?.findIndex(i => i.id === item.id);
    if (itemIndex === -1 || !playerInv.equippedItems) {
      toast.error("Item to unequip not found.");
      return;
    }
    playerInv.equippedItems.splice(itemIndex, 1);

    // 2. Add back to inventory (find slot or add to tray)
    let placed = false;
    const { x, y, ...itemToPlace } = item; // Strip coordinates just in case
    if (playerInv.containers) {
      for (const container of Object.values(playerInv.containers)) {
        if (!container.gridItems) container.gridItems = [];
        const availableSlot = findFirstAvailableSlot(container.gridItems, itemToPlace, container.gridWidth, container.gridHeight);
        if (availableSlot) {
          container.gridItems.push({ ...itemToPlace, ...availableSlot });
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      if (!playerInv.trayItems) playerInv.trayItems = [];
      playerInv.trayItems.push(itemToPlace);
    }

    setInventoriesOptimistic(newInventories);

    const batch = writeBatch(db);
    const playerInvRef = doc(db, "campaigns", campaignId, "inventories", playerId);

    batch.update(playerInvRef, {
      equippedItems: playerInv.equippedItems,
      trayItems: playerInv.trayItems,
    });

    if (playerInv.containers) {
      Object.values(playerInv.containers).forEach(container => {
        const containerRef = doc(playerInvRef, 'containers', container.id);
        batch.update(containerRef, { gridItems: container.gridItems });
      });
    }

    try {
      await batch.commit();
      toast.success(`${item.name} unequipped.`);
    } catch (error) {
      toast.error("Failed to unequip item. Reverting changes.");
      console.error("Firestore batch write failed:", error);
      setInventoriesOptimistic(originalInventories);
    }
  };

  /**
   * Sets the state to show the 'Split Stack' modal for a given item.
   * @param {object} item - The stackable item to be split.
   * @param {string} playerId - The ID of the item's owner.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleStartSplit = (item, playerId, containerId) => {
    setSplittingItem({ item, playerId, containerId });
  };

  /**
   * Reveals the hidden magic properties of an item to the player by setting
   * its `magicPropertiesVisible` flag to true in Firestore.
   * @param {object} item - The item to update.
   * @param {string} playerId - The ID of the item's owner.
   * @param {('grid'|'tray')} source - The location of the item.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleRevealMagicProperties = async (item, playerId, source, containerId) => {
    if (!item || !playerId || !source) return;

    const updatedItem = { ...item, magicPropertiesVisible: true };

    // Case 1: The item is in a container (either grid or a DM's tray)
    if (containerId && containerId !== 'tray') {
        const containerDocRef = doc(db, "campaigns", campaignId, "inventories", playerId, "containers", containerId);
        const currentContainer = inventories[playerId]?.containers?.[containerId];
        if (!currentContainer) return;

        let updatePayload = {};
        if (source === 'grid') {
            updatePayload.gridItems = currentContainer.gridItems.map(i => i.id === item.id ? updatedItem : i);
        } else { // This handles the DM's container tray
            updatePayload.trayItems = currentContainer.trayItems.map(i => i.id === item.id ? updatedItem : i);
        }
        await updateDoc(containerDocRef, updatePayload);
    
    // Case 2: The item is in the player's main "Floor/Ground" tray
    } else if (source === 'tray') {
        const playerInvRef = doc(db, "campaigns", campaignId, "inventories", playerId);
        const playerInv = inventories[playerId];
        if (!playerInv?.trayItems) return;

        const updatedTrayItems = playerInv.trayItems.map(i => i.id === item.id ? updatedItem : i);
        await updateDoc(playerInvRef, { trayItems: updatedTrayItems });
    }
    toast.success(`Revealed properties for ${item.name}.`);
  };

  /**
   * Deletes an item from an inventory.
   * @param {object} item - The item to delete.
   * @param {string} playerId - The ID of the item's owner.
   * @param {('grid'|'tray')} source - The location of the item.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleDeleteItem = async (item, playerId, source, containerId) => {
    if (!item || !playerId || !source) return;

    // The logic handles both container items and main tray items.
    
    // Case 1: The item is in a container (either grid or a DM's tray)
    if (containerId && containerId !== 'tray') {
        const containerDocRef = doc(db, "campaigns", campaignId, "inventories", playerId, "containers", containerId);
        const currentContainer = inventories[playerId]?.containers?.[containerId];
        if (!currentContainer) return;

        let updatePayload = {};
        if (source === 'grid') {
            updatePayload.gridItems = currentContainer.gridItems.filter(i => i.id !== item.id);
        } else { // This handles the DM's container tray
            updatePayload.trayItems = currentContainer.trayItems.filter(i => i.id !== item.id);
        }
        await updateDoc(containerDocRef, updatePayload);
    
    // Case 2: The item is in the player's main "Floor/Ground" tray
    } else if (source === 'tray') {
        const playerInvRef = doc(db, "campaigns", campaignId, "inventories", playerId);
        const playerInv = inventories[playerId];
        if (!playerInv?.trayItems) return;

        const updatedTrayItems = playerInv.trayItems.filter(i => i.id !== item.id);
        await updateDoc(playerInvRef, { trayItems: updatedTrayItems });
    }
    toast.success(`Deleted ${item.name}.`);
  };

  /**
   * Sets the state to show the 'Add Item' modal in edit mode for a specific item.
   * @param {object} item - The item to be edited.
   * @param {string} playerId - The ID of the item's owner.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleStartEdit = (item, playerId, containerId) => {
    if (!item) return;
    setItemToEdit({ item, playerId, containerId });
    setShowAddItem(true);
  };

  /**
   * Handles both creating a new item and updating an existing one.
   * It determines the target player and location (grid or tray) and performs
   * the necessary Firestore operations, including collision detection for edits.
   * @param {object} itemData - The data for the new or updated item.
   * @param {string} [targetPlayerId] - The ID of the player to receive the item (used when adding from compendium).
   */
  const handleAddItem = async (itemData, targetPlayerId) => {
    let finalPlayerId;

    if (itemToEdit) {
      // Case 1: We are editing an existing item. The owner is fixed.
      finalPlayerId = itemToEdit.playerId;
    } else if (targetPlayerId && isDM) {
      // Case 2: The DM is adding an item from the compendium to a specific player.
      finalPlayerId = targetPlayerId;
    } else {
      // Case 3: A player is creating a new item for themselves, OR the DM is creating one for themself.
      finalPlayerId = user.uid;
    }

    if (!campaignId || !finalPlayerId) {
      toast.error("Could not determine the target player.");
      return;
    }

    const playerInventory = inventories[finalPlayerId];
    const isTargetDM = campaign?.dmId === finalPlayerId;

    // --- Item Editing Logic ---
    if (itemToEdit) {
      const { item: originalItem, containerId } = itemToEdit;
      
      // Check if the item is in a grid (and not the DM's special tray)
      if (containerId && containerId !== 'tray' && !isTargetDM) {
        
        // --- Logic for items in a container's grid (with size checks) ---
        const container = playerInventory.containers[containerId];
        const otherItems = container.gridItems.filter(i => i.id !== originalItem.id);
        const updatedItem = { ...originalItem, ...itemData };

        const canStayInPlace = !outOfBounds(updatedItem.x, updatedItem.y, updatedItem, container.gridWidth, container.gridHeight) &&
                               !otherItems.some(other => onOtherItem(updatedItem.x, updatedItem.y, updatedItem, other));

        let finalGridItems;
        let finalTrayItems = [...(playerInventory.trayItems || [])];

        if (canStayInPlace) {
            finalGridItems = container.gridItems.map(i => i.id === originalItem.id ? updatedItem : i);
            toast.success(`Updated ${itemData.name}.`);
        } else {
            const newSlot = findFirstAvailableSlot(otherItems, updatedItem, container.gridWidth, container.gridHeight);
            if (newSlot) {
                finalGridItems = [...otherItems, { ...updatedItem, ...newSlot }];
                toast.success(`${itemData.name} was updated and moved to a new slot.`);
            } else {
                const { x, y, ...trayItem } = updatedItem;
                finalGridItems = otherItems; // Remove from grid
                finalTrayItems.push(trayItem);
                toast.error(`No space for the new size. Moved ${itemData.name} to the tray.`);
            }
        }

        const batch = writeBatch(db);
        const playerInvRef = doc(db, 'campaigns', campaignId, 'inventories', finalPlayerId);
        const containerRef = doc(playerInvRef, 'containers', containerId);
        batch.update(containerRef, { gridItems: finalGridItems });
        batch.update(playerInvRef, { trayItems: finalTrayItems });
        await batch.commit();

      } else {
        // --- Logic for items in a tray (no size checks needed) ---
        const isDMItem = isTargetDM && containerId;
        if (isDMItem) {
            // DM's items are in a container's tray
            const container = playerInventory.containers[containerId];
            const updatedTrayItems = (container.trayItems || []).map(i => i.id === originalItem.id ? { ...i, ...itemData } : i);
            const containerDocRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId, "containers", containerId);
            await updateDoc(containerDocRef, { trayItems: updatedTrayItems });
        } else {
            // Player's items are in the main tray
            const updatedTrayItems = (playerInventory.trayItems || []).map(i => i.id === originalItem.id ? { ...i, ...itemData } : i);
            const playerInvRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId);
            await updateDoc(playerInvRef, { trayItems: updatedTrayItems });
        }
        toast.success(`Updated ${itemData.name}.`);
      }
    }  
    // --- Item Creation Logic ---
    else {
      const originalInventories = inventories;
      const newInventories = JSON.parse(JSON.stringify(inventories));
      const targetInv = newInventories[finalPlayerId];
      let firestorePromise;

      if (isTargetDM) {
        // If the target is the DM, add to their first container's tray.
        const defaultContainer = Object.values(targetInv.containers || {})[0];
        if (!defaultContainer) {
          toast.error("DM has no containers to add items to!");
          return;
        }
        if (!defaultContainer.trayItems) defaultContainer.trayItems = [];
        defaultContainer.trayItems.push(itemData);
        
        const containerDocRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId, "containers", defaultContainer.id);
        firestorePromise = updateDoc(containerDocRef, { trayItems: defaultContainer.trayItems });

      } else {
        // If the target is a player, add to their main shared tray.
        if (!targetInv.trayItems) targetInv.trayItems = [];
        targetInv.trayItems.push(itemData);

        const inventoryDocRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId);
        firestorePromise = setDoc(inventoryDocRef, { trayItems: targetInv.trayItems }, { merge: true });
      }
      
      setInventoriesOptimistic(newInventories);
      
      try {
        await firestorePromise;
        const targetName = playerInventory?.characterName || playerProfiles[finalPlayerId]?.displayName;
        toast.success(`Added ${itemData.name} to ${targetName}'s inventory.`);
      } catch (error) {
        toast.error("Failed to add item. Reverting changes.");
        console.error("Firestore write failed:", error);
        setInventoriesOptimistic(originalInventories);
      }
    }

    setItemToEdit(null);
  };

  /**
   * Splits a stack of items into two. The new stack is placed in the first available
   * grid slot or, if none is available, in the container's tray.
   * @param {number} splitAmount - The quantity for the new stack.
   */
  const handleSplitStack = async (splitAmount) => {
    if (!splittingItem) return;

    const { item: originalItem, playerId, containerId } = splittingItem;
    const amount = parseInt(splitAmount, 10);

    if (isNaN(amount) || amount <= 0 || amount >= originalItem.quantity) return;

    const container = inventories[playerId].containers[containerId];
    const containerDocRef = doc(db, "campaigns", campaignId, "inventories", playerId, "containers", containerId);

    const updatedOriginalItem = { ...originalItem, quantity: originalItem.quantity - amount };
    const newItem = { ...originalItem, id: crypto.randomUUID(), quantity: amount };

    const itemsForCollisionCheck = container.gridItems.map(i => i.id === originalItem.id ? updatedOriginalItem : i);
    const availableSlot = findFirstAvailableSlot(itemsForCollisionCheck, newItem, container.gridWidth, container.gridHeight);

    let finalGridItems = itemsForCollisionCheck;
    let finalTrayItems = [...(container.trayItems || [])];

    if (availableSlot) {
      finalGridItems.push({ ...newItem, ...availableSlot });
    } else {
      const { x, y, ...trayItem } = newItem;
      finalTrayItems.push(trayItem);
    }
    
    const originalItemInGrid = container.gridItems.some(i => i.id === originalItem.id);
    if(originalItemInGrid) {
        finalGridItems = finalGridItems.map(i => i.id === originalItem.id ? updatedOriginalItem : i)
    } else {
        finalTrayItems = finalTrayItems.map(i => i.id === originalItem.id ? updatedOriginalItem : i)
    }

    await updateDoc(containerDocRef, {
      gridItems: finalGridItems,
      trayItems: finalTrayItems,
    });
    setSplittingItem(null);
  };

  /**
   * Handles the start of a drag-and-drop operation.
   * It captures the item being dragged and calculates its dimensions for the drag overlay.
   * @param {object} event - The drag start event from dnd-kit.
   */
  const handleDragStart = (event) => {
    const { active } = event;
    const item = active.data.current?.item;
    const source = active.data.current?.source;
    const containerId = active.data.current?.containerId;

    if (!item) return;

    let dimensions = { width: 80, height: 80 }; // Default size for tray items

    if (source === 'grid' && containerId && gridRefs.current[containerId]) {
      const gridElement = gridRefs.current[containerId];
      const ownerId = active.data.current?.ownerId;
      const container = inventories[ownerId]?.containers?.[containerId];
      
      if (container) {
        const cellSize = {
          width: gridElement.offsetWidth / container.gridWidth,
          height: gridElement.offsetHeight / container.gridHeight,
        };
        dimensions = {
          width: item.w * cellSize.width,
          height: item.h * cellSize.height,
        };
      }
    }

    setActiveItem({ item, dimensions });
  };

  /**
   * Resets the active item state when a drag operation is cancelled.
   */
  const handleDragCancel = () => {
    setActiveItem(null);
  };

  /**
   * Handles the end of a drag-and-drop operation. This is the core logic for
   * moving items, stacking items, and transferring items between players. It updates
   * the local state optimistically and then commits the changes to Firestore in a batch.
   * @param {object} event - The drag end event from dnd-kit.
   */
  const handleDragEnd = async (event) => {
    setActiveItem(null);
    const { active, over } = event;

    if (!over) return;

    // --- 1. Get Data ---
    const item = active.data.current?.item;
    const startPlayerId = active.data.current?.ownerId;
    const startContainerId = active.data.current?.containerId;
    const startSource = active.data.current?.source;

    let endPlayerId, endContainerId, endDestination;
    if (over.data.current?.item) {
        endPlayerId = over.data.current.ownerId;
        endContainerId = over.data.current.containerId;
        endDestination = over.data.current.source;
    } else {
        const endIdParts = over.id.toString().split('|');
        endPlayerId = endIdParts[0];
        endContainerId = endIdParts[1];
        endDestination = endIdParts[2];
    }
    if (!item || !startPlayerId || !endPlayerId) return;

    const newInventories = JSON.parse(JSON.stringify(inventories));
    
    // --- 2. Stacking Logic ---
    const passiveItem = over.data.current?.item;
    if (item && passiveItem && item.id !== passiveItem.id && passiveItem.stackable && item.name === passiveItem.name && item.type === passiveItem.type) {
        
        const maxStack = passiveItem.maxStack || 20;
        const roomInStack = maxStack - passiveItem.quantity;
        const amountToTransfer = Math.min(item.quantity, roomInStack);

        if (amountToTransfer <= 0) {
            toast.error("Stack is already full.");
            return;
        }

        const remainingQuantity = item.quantity - amountToTransfer;

        // Update target item's quantity
        const endPlayerInv = newInventories[endPlayerId];
        const isEndDM = endPlayerInv.characterName === "DM";
        if (endDestination === 'grid') {
            endPlayerInv.containers[endContainerId].gridItems.find(i => i.id === passiveItem.id).quantity += amountToTransfer;
        } else {
            const targetTray = isEndDM ? endPlayerInv.containers[endContainerId].trayItems : endPlayerInv.trayItems;
            targetTray.find(i => i.id === passiveItem.id).quantity += amountToTransfer;
        }

        // Update source item (remove or decrease quantity)
        const startPlayerInv = newInventories[startPlayerId];
        const isStartDM = startPlayerInv.characterName === "DM";
        if (remainingQuantity <= 0) {
            if (startSource === 'grid') {
                startPlayerInv.containers[startContainerId].gridItems = startPlayerInv.containers[startContainerId].gridItems.filter(i => i.id !== item.id);
            } else {
                if (isStartDM) {
                    startPlayerInv.containers[startContainerId].trayItems = startPlayerInv.containers[startContainerId].trayItems.filter(i => i.id !== item.id);
                } else {
                    startPlayerInv.trayItems = startPlayerInv.trayItems.filter(i => i.id !== item.id);
                }
            }
        } else {
            if (startSource === 'grid') {
                startPlayerInv.containers[startContainerId].gridItems.find(i => i.id === item.id).quantity = remainingQuantity;
            } else {
                const sourceTray = isStartDM ? startPlayerInv.containers[startContainerId].trayItems : startPlayerInv.trayItems;
                sourceTray.find(i => i.id === item.id).quantity = remainingQuantity;
            }
        }
        
        setInventoriesOptimistic(newInventories);

        // Save to Firestore
        const batch = writeBatch(db);
        const sourceInvRef = doc(db, 'campaigns', campaignId, 'inventories', startPlayerId);
        const targetInvRef = doc(db, 'campaigns', campaignId, 'inventories', endPlayerId);

        batch.update(sourceInvRef, { trayItems: newInventories[startPlayerId].trayItems });
        Object.values(newInventories[startPlayerId].containers).forEach(c => batch.update(doc(sourceInvRef, 'containers', c.id), { gridItems: c.gridItems, trayItems: c.trayItems }));
        
        if (startPlayerId !== endPlayerId) {
            batch.update(targetInvRef, { trayItems: newInventories[endPlayerId].trayItems });
            Object.values(newInventories[endPlayerId].containers).forEach(c => batch.update(doc(targetInvRef, 'containers', c.id), { gridItems: c.gridItems, trayItems: c.trayItems }));
        }

        try {
            await batch.commit();
            toast.success(`Stacked ${amountToTransfer} ${item.name}.`);
        } catch (error) {
            toast.error("Failed to stack items. Reverting.");
            console.error("Firestore batch write failed:", error);
            setInventoriesOptimistic(inventories); // Revert on failure
        }
        return; // End the function here
    }


    // --- 3. Movement Logic ---
    let movedItem = null;
    const startPlayerInv = newInventories[startPlayerId];
    const endPlayerInv = newInventories[endPlayerId];
    if (!startPlayerInv || !endPlayerInv) return;

    const isStartDM = startPlayerInv.characterName === 'DM';
    const isEndDM = endPlayerInv.characterName === 'DM';

    // Remove from source
    if (startSource === 'grid') {
        const sourceContainer = startPlayerInv.containers?.[startContainerId];
        if (!sourceContainer?.gridItems) return;
        const itemIndex = sourceContainer.gridItems.findIndex(i => i.id === item.id);
        if (itemIndex > -1) [movedItem] = sourceContainer.gridItems.splice(itemIndex, 1);
    } else if (startSource === 'equipped') {
        if (!startPlayerInv.equippedItems) return;
        const itemIndex = startPlayerInv.equippedItems.findIndex(i => i.id === item.id);
        if (itemIndex > -1) [movedItem] = startPlayerInv.equippedItems.splice(itemIndex, 1);
    } else {
        const sourceTray = isStartDM ? startPlayerInv.containers?.[startContainerId]?.trayItems : startPlayerInv.trayItems;
        if (!sourceTray) return;
        const itemIndex = sourceTray.findIndex(i => i.id === item.id);
        if (itemIndex > -1) [movedItem] = sourceTray.splice(itemIndex, 1);
    }
    if (!movedItem) return;

    // Add to destination
    if (endDestination === 'grid') {
        const endContainer = endPlayerInv.containers?.[endContainerId];
        if (!endContainer) return;
        const gridElement = gridRefs.current[endContainerId];
        if (!gridElement) return;
        const { gridWidth, gridHeight } = endContainer;
        const cellSize = { width: gridElement.offsetWidth / gridWidth, height: gridElement.offsetHeight / gridHeight };
        const rect = gridElement.getBoundingClientRect();
        const dropX = active.rect.current.translated.left - rect.left;
        const dropY = active.rect.current.translated.top - rect.top;
        let finalPos = { x: Math.round(dropX / cellSize.width), y: Math.round(dropY / cellSize.height) };
        if (outOfBounds(finalPos.x, finalPos.y, movedItem, gridWidth, gridHeight) || endContainer.gridItems.some(other => onOtherItem(finalPos.x, finalPos.y, movedItem, other))) {
            finalPos = findFirstAvailableSlot(endContainer.gridItems, movedItem, gridWidth, gridHeight);
        }
        if (finalPos) {
            endContainer.gridItems.push({ ...movedItem, ...finalPos });
        } else {
            // No space in grid, move to source player's tray
            toast.error("No space in destination!");
            const sourceTray = isStartDM ? startPlayerInv.containers[startContainerId].trayItems : startPlayerInv.trayItems;
            sourceTray.push(movedItem);
        }
    } else { // 'tray' or 'equipped'
        const { x, y, ...trayItem } = movedItem;
        if (endDestination === 'equipped') {
            if (!endPlayerInv.equippedItems) endPlayerInv.equippedItems = [];
            endPlayerInv.equippedItems.push(trayItem);
        } else if (isEndDM) {
            const destContainer = endPlayerInv.containers?.[endContainerId];
            if (!destContainer) return;
            if (!destContainer.trayItems) destContainer.trayItems = [];
            destContainer.trayItems.push(trayItem);
        } else { // player tray
            if (!endPlayerInv.trayItems) endPlayerInv.trayItems = [];
            endPlayerInv.trayItems.push(trayItem);
        }
    }

    setInventoriesOptimistic(newInventories);

    // 4. The final save logic
    const batch = writeBatch(db);
    const finalSourceInventory = newInventories[startPlayerId];
    const finalEndInventory = newInventories[endPlayerId];

    // Update Source Player
    const sourcePlayerInvRef = doc(db, "campaigns", campaignId, "inventories", startPlayerId);
    batch.update(sourcePlayerInvRef, { 
        trayItems: finalSourceInventory.trayItems || [],
        equippedItems: finalSourceInventory.equippedItems || [],
    });
    Object.values(finalSourceInventory.containers).forEach(container => {
        const containerRef = doc(sourcePlayerInvRef, 'containers', container.id);
        // Ensure all fields are arrays before committing
        batch.update(containerRef, { 
            gridItems: container.gridItems || [],
            trayItems: container.trayItems || [] 
        });
    });
    
    if (startPlayerId !== endPlayerId) {
        // Update Destination Player
        const endPlayerInvRef = doc(db, "campaigns", campaignId, "inventories", endPlayerId);
        batch.update(endPlayerInvRef, { 
            trayItems: finalEndInventory.trayItems || [],
            equippedItems: finalEndInventory.equippedItems || [],
        });
        Object.values(finalEndInventory.containers).forEach(container => {
            const containerRef = doc(endPlayerInvRef, 'containers', container.id);
            batch.update(containerRef, { 
                gridItems: container.gridItems || [],
                trayItems: container.trayItems || []
            });
        });
    }
    
    try {
        await batch.commit();
    } catch (error) {
        toast.error("Failed to move item. Reverting changes.");
        console.error("Firestore batch write failed:", error);
        setInventoriesOptimistic(inventories); // Revert on failure
    }
  };

  /**
   * (DM-only) Sends an item from a source player's inventory to a target player's tray.
   * @param {object} item - The item to send.
   * @param {('grid'|'tray')} source - The original location of the item.
   * @param {string} sourcePlayerId - The ID of the player sending the item.
   * @param {string} targetPlayerId - The ID of the player receiving the item.
   * @param {string} sourceContainerId - The ID of the container the item is coming from.
   */
  const handleSendItem = async (item, source, sourcePlayerId, targetPlayerId, sourceContainerId, isSourcePlayerDM) => {

    if (!item || !source || !sourcePlayerId || !targetPlayerId) {
        return;
    }

    const originalInventories = inventories;
    const newInventories = JSON.parse(JSON.stringify(inventories));
    
    const sourceInventory = newInventories[sourcePlayerId];
    const targetInventory = newInventories[targetPlayerId];

    if (!sourceInventory) {
        return;
    }

    // Check Equipped Items
    if (sourceInventory.equippedItems) {
        sourceInventory.equippedItems = sourceInventory.equippedItems.filter(i => i.id !== item.id);
    }

    // Check Tray
    if (sourceInventory.trayItems) {
         sourceInventory.trayItems = sourceInventory.trayItems.filter(i => i.id !== item.id);
    }

    // Check Containers
    if (sourceInventory.containers) {
        Object.values(sourceInventory.containers).forEach(container => {
            if (container.gridItems) {
                container.gridItems = container.gridItems.filter(i => i.id !== item.id);
            }
            if (container.trayItems) {
                container.trayItems = container.trayItems.filter(i => i.id !== item.id);    
            }
        });
    }
    
    // Add to Target
    const { x, y, ...itemForTray } = item;
    const isTargetDM = campaign?.dmId === targetPlayerId;

    if (isTargetDM) {
      const targetContainer = Object.values(targetInventory.containers || {})[0];
      if (targetContainer) {
          if (!targetContainer.trayItems) targetContainer.trayItems = [];
          targetContainer.trayItems.push(itemForTray);
      }
    } else {
      if (!targetInventory.trayItems) targetInventory.trayItems = [];
      targetInventory.trayItems.push(itemForTray);
    }

    setInventoriesOptimistic(newInventories);

    // Save to Firestore
    const batch = writeBatch(db);
    const sourcePlayerInvRef = doc(db, "campaigns", campaignId, "inventories", sourcePlayerId);
    const targetPlayerInvRef = doc(db, "campaigns", campaignId, "inventories", targetPlayerId);

    // Log the payload we are about to save
    console.log("Saving Source Updates:", {
        trayItems: newInventories[sourcePlayerId].trayItems,
        equippedItems: newInventories[sourcePlayerId].equippedItems
    });

    // Update ALL fields to ensure the removal persists
    batch.update(sourcePlayerInvRef, { 
        trayItems: newInventories[sourcePlayerId].trayItems || [],
        equippedItems: newInventories[sourcePlayerId].equippedItems || [] 
    });
    if (newInventories[sourcePlayerId].containers) {
        Object.values(newInventories[sourcePlayerId].containers).forEach(c => {
            batch.update(doc(sourcePlayerInvRef, 'containers', c.id), { 
                gridItems: c.gridItems || [], 
                trayItems: c.trayItems || [] 
            });
        });
    }
    
    // UPDATE TARGET
    batch.update(targetPlayerInvRef, { 
        trayItems: newInventories[targetPlayerId].trayItems || [],
        equippedItems: newInventories[targetPlayerId].equippedItems || [] 
    });
    if (newInventories[targetPlayerId].containers) {
        Object.values(newInventories[targetPlayerId].containers).forEach(c => {
            batch.update(doc(targetPlayerInvRef, 'containers', c.id), { 
                gridItems: c.gridItems || [], 
                trayItems: c.trayItems || []
            });
        });
    }

    try {
      await batch.commit();
      const targetName = targetInventory.characterName || playerProfiles[targetPlayerId]?.displayName;
      toast.success(`Sent ${item.name} to ${targetName}.`);
    } catch (error) {
      toast.error("Failed to send item.");
      setInventoriesOptimistic(originalInventories);
    }
  };

  /**
   * Creates a duplicate of an item and places it in the owner's main tray.
   * @param {object} item - The item to duplicate.
   * @param {string} playerId - The ID of the item's owner.
   */
  const handleDuplicateItem = async (item, playerId) => {
    if (!item || !playerId) return;

    const originalInventories = inventories;
    const newInventories = JSON.parse(JSON.stringify(inventories));
    const playerInv = newInventories[playerId];
    if (!playerInv) return;

    const { x, y, ...itemForTray } = item;
    const newItem = {
      ...itemForTray,
      id: crypto.randomUUID(),
    };

    const isPlayerDM = campaign?.dmId === playerId;
    let firestorePromise;

    if (isPlayerDM) {
        const container = Object.values(playerInv.containers || {})[0];
        if (!container) {
            toast.error("DM has no containers to add items to!");
            return;
        }
        if (!container.trayItems) container.trayItems = [];
        container.trayItems.push(newItem);
        const containerRef = doc(db, 'campaigns', campaignId, 'inventories', playerId, 'containers', container.id);
        firestorePromise = updateDoc(containerRef, { trayItems: container.trayItems });
    } else {
        if (!playerInv.trayItems) playerInv.trayItems = [];
        playerInv.trayItems.push(newItem);
        const playerInvRef = doc(db, 'campaigns', campaignId, 'inventories', playerId);
        firestorePromise = updateDoc(playerInvRef, { trayItems: playerInv.trayItems });
    }

    setInventoriesOptimistic(newInventories);

    try {
        await firestorePromise;
        toast.success(`Duplicated ${item.name}.`);
    } catch (error) {
        toast.error("Failed to duplicate item. Reverting.");
        console.error("Firestore write failed:", error);
        setInventoriesOptimistic(originalInventories);
    }
  };

  /**
   * Rotates an item in a grid by swapping its width and height.
   * It performs collision checks to see if the item can stay in place. If not, it
   * attempts to find a new available slot or moves the item to the tray if no space is found.
   * @param {object} item - The grid item to rotate.
   * @param {string} playerId - The ID of the item's owner.
   * @param {string} containerId - The ID of the container holding the item.
   */
  const handleRotateItem = async (item, playerId, containerId) => {
    if (!item || !playerId || !containerId) return;

    const newInventories = JSON.parse(JSON.stringify(inventories));
    const inventory = newInventories[playerId];
    const container = inventory?.containers?.[containerId];
    if (!container) return;

    const rotatedItem = { ...item, w: item.h, h: item.w };
    const otherItems = container.gridItems.filter(i => i.id !== item.id);

    const canStayInPlace = !outOfBounds(rotatedItem.x, rotatedItem.y, rotatedItem, container.gridWidth, container.gridHeight) &&
                           !otherItems.some(other => onOtherItem(rotatedItem.x, rotatedItem.y, rotatedItem, other));

    if (canStayInPlace) {
      container.gridItems = container.gridItems.map(i => i.id === item.id ? rotatedItem : i);
      toast.success(`Rotated ${item.name}.`);
    } else {
      const availableSlot = findFirstAvailableSlot(otherItems, rotatedItem, container.gridWidth, container.gridHeight);
      if (availableSlot) {
        container.gridItems = [...otherItems, { ...rotatedItem, ...availableSlot }];
        toast.success(`Rotated ${item.name} and moved it to a new slot.`);
      } else {
        const { x, y, ...trayItem } = rotatedItem;
        container.gridItems = otherItems;
        if (!inventory.trayItems) inventory.trayItems = [];
        inventory.trayItems.push(trayItem);
        toast.error(`No space to rotate ${item.name}. Moved it to the tray.`);
      }
    }

    const batch = writeBatch(db);
    const playerDocRef = doc(db, 'campaigns', campaignId, 'inventories', playerId);
    
    // THIS IS THE FIX: Ensure all fields are arrays before saving.
    batch.update(playerDocRef, { trayItems: inventory.trayItems || [] });
    
    Object.values(inventory.containers).forEach(c => {
        const containerRef = doc(playerDocRef, 'containers', c.id);
        batch.update(containerRef, { 
            gridItems: c.gridItems || [],
            trayItems: c.trayItems || []
        });
    });

    await batch.commit();
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A drag will only start after the pointer has moved by 8 pixels.
      // This allows for a long press to occur without triggering a drag.
      activationConstraint: {
        distance: 8,
      },
    }),
    // The TouchSensor is removed to prevent conflicts with long-press gestures.
    // The PointerSensor handles touch inputs perfectly and activates on distance
    // rather than a delay, which is ideal for this use case.
  );

  if (isLoading) {
    return <Spinner />;
  }

  if (!isLoading && Object.keys(inventories).length === 0) {
    return (
      <div className="text-center text-text-muted mt-16 p-4">
        <h2 className="text-2xl font-bold text-text-base">
          This Campaign Is Empty
        </h2>
        <p className="mt-2">
          No player inventories have been created here yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center flex-grow">
      {/* --- Modals --- */}
      {activeTrade && (
        <Trade
          tradeId={activeTrade.id}
          onClose={() => setActiveTrade(null)}
          user={user}
          playerProfiles={playerProfiles}
          inventories={inventories}
          campaign={campaign}
        />
      )}

      <TradeNotifications campaignId={campaignId} inventories={inventories} />

      {isTrading && (
        <StartTrade
          onClose={() => setIsTrading(false)}
          campaign={{id: campaignId, ...campaign}}
          user={user}
          playerProfiles={playerProfiles}
          inventories={inventories}
          onTradeStarted={handleTradeStarted}
        />
      )}
      
      {showCompendium && (
        <AddFromCompendium
          onClose={() => setShowCompendium(false)}
          players={Object.keys(inventories)}
          dmId={campaign?.dmId}
          inventories={inventories}
          playerProfiles={playerProfiles}
          onAddItem={handleAddItem}
          user={user}
        />
      )}

      {editingSettings && (
        <InventorySettings
          onClose={() => setEditingSettings(null)}
          campaignId={campaignId}
          userId={editingSettings.playerId}
          currentSettings={editingSettings.currentSettings}
          isDMInventory={editingSettings.isDMInventory}
        />
      )}

      {showLayoutSettings && (
        <CampaignLayout
          campaign={{ id: campaignId, ...campaign }}
          inventories={inventories}
          playerProfiles={playerProfiles}
          onClose={() => setShowLayoutSettings(false)}
        />
      )}

      {splittingItem && (
        <SplitStack
          item={splittingItem.item}
          onClose={() => setSplittingItem(null)}
          onSplit={(splitAmount) => {
            handleSplitStack(splitAmount);
          }}
        />
      )}

      {showAddItem && (
        <AddItem 
          onAddItem={handleAddItem} 
          onClose={() => {
            setShowAddItem(false);
            setItemToEdit(null);
          }}
          isDM={campaign?.dmId === user?.uid}
          itemToEdit={itemToEdit}
        />
      )}

      {contextMenu.visible && (
        <ContextMenu
          menuPosition={contextMenu.position}
          actions={contextMenu.actions}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        collisionDetection={pointerWithin}
        dropAnimation={{
            duration: 150,
            easing: 'cubic-bezier(0.18, 1, 0.4, 1)',
        }}
      >
        {/* Main Content Area */}
        <div className="w-full h-full flex flex-col flex-grow min-w-0 relative">
          {isDM && (
            <div className="w-full max-w-4xl flex justify-end mb-4 px-4 pt-4 mx-auto">
                <button 
                    onClick={() => setShowLayoutSettings(true)} 
                    className="bg-surface hover:bg-surface/80 text-text-base font-bold py-2 px-4 rounded transition-colors text-sm"
                >
                    Manage Campaign
                </button>
            </div>
          )}
          <div className="w-full flex-grow overflow-auto p-4 space-y-8 pb-24 overscroll-contain max-w-4xl mx-auto">
            {orderedAndVisibleInventories.map(([playerId, inventoryData]) => (
              <PlayerInventory
                key={playerId}
                playerId={playerId}
                inventoryData={inventoryData}
                campaign={campaign}
                playerProfiles={playerProfiles}
                user={user}
                setEditingSettings={setEditingSettings}
                cellSizes={cellSizes}
                gridRefs={gridRefs}
                onContextMenu={handleContextMenu}
                onToggleEquipped={() => toggleEquipped(playerId)}
                isEquippedVisible={showEquipped[playerId] ?? false}
              />
            ))}
          </div>
          {/* --- Floating Action Buttons --- */}
          <div className="fixed z-10 bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2">
            <button
              onClick={() => setShowCompendium(true)}
              className="bg-surface/80 backdrop-blur-sm border border-primary/50 text-primary hover:bg-primary hover:text-background rounded-full p-3 sm:p-4 shadow-lg transition-all"
              aria-label="Add Item from Compendium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v11.494m-5.747-5.747H17.747" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
            <button
              onClick={() => setShowAddItem(true)}
              className="bg-surface/80 backdrop-blur-sm border border-primary/50 text-primary hover:bg-primary hover:text-background rounded-full p-3 sm:p-4 shadow-lg transition-all"
              aria-label="Create New Item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        <DragOverlay>
          {activeItem ? (
            <div
              style={{
                width: activeItem.dimensions.width,
                height: activeItem.dimensions.height,
              }}
              className={`${getColorForItemType(activeItem.item.type)} rounded-lg text-text-base font-bold p-1 text-center text-xs sm:text-sm flex items-center justify-center shadow-2xl scale-105`}
            >
              {activeItem.item.name}
              {activeItem.item.stackable && activeItem.item.quantity > 1 && (
                <span className="absolute bottom-0 right-1 text-lg font-black" style={{ WebkitTextStroke: '1px black' }}>
                  {activeItem.item.quantity}
                </span>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
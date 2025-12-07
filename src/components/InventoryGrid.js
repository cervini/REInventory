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
import Wallet from './Wallet';
import { parseCostToCp, deductCurrency } from '../utils/currencyUtils';

/**
 * Renders the complete inventory for a single player.
 */
const PlayerInventory = ({
  playerId, inventoryData, campaign, playerProfiles, user,
  setEditingSettings, cellSizes, gridRefs, onContextMenu, onToggleEquipped, isEquippedVisible,
  isLootPile = false
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

  // Dynamic classes: If it's a loot pile, remove the card styling (border/shadow/bg)
  // so it blends into the yellow parent container.
  const containerClasses = isLootPile 
    ? "overflow-hidden" 
    : "bg-surface rounded-lg shadow-lg shadow-accent/10 border border-accent/20 overflow-hidden";

  return (
    <div className={containerClasses}>
      
      {/* 1. HIDE HEADER FOR LOOT PILE (No Name, Wallet, or Weight) */}
      {!isLootPile && (
        <div className="w-full p-2 text-left bg-surface/80 flex flex-wrap justify-between items-center border-b border-surface/50 gap-2">
            <h2 className="text-xl font-bold text-accent font-fantasy tracking-wider truncate">
            {inventoryData.characterName || playerProfiles[playerId]?.displayName}
            </h2>
            <div className="flex items-center space-x-2 flex-shrink-0">
            <Wallet 
                campaignId={campaign.id}
                inventoryId={playerId}
                currency={inventoryData.currency}
                canEdit={isMyInventory || isPlayerDM} 
            />
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
                >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-muted" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                    <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
                </button>
            )}
            </div>
        </div>
      )}
      
      {/* Collapsible Equipped Items Tray */}
      {!isPlayerDM && !isLootPile && (
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

      {/* Main Content (Containers + Tray) */}
      <div className={isLootPile ? "" : "bg-background/50"}>
        <div className="p-2 space-y-4">
          
          {/* Grids (Used by players) */}
          {!isPlayerDM && !isLootPile && (
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
          )}

          {/* Tray (Used by everyone) */}
          <div className="mt-2">
              {/* 2. CHANGE TRAY LABEL: Hide 'Floor/Ground' for loot pile */}
              {!isLootPile && (
                  <h3 className="font-bold font-fantasy text-text-muted p-2 mt-2">Floor / Ground</h3>
              )}
              
              <div className={`rounded-lg p-2 border shadow-inner ${isLootPile ? 'bg-black/20 border-yellow-900/30' : 'bg-background/50 border-accent/10'}`}>
                <ItemTray
                    items={inventoryData.trayItems || []}
                    containerId="tray" 
                    onContextMenu={onContextMenu}
                    playerId={playerId}
                    isViewerDM={isViewerDM}
                    emptyMessage={isLootPile ? "Empty" : "There is nothing on the ground."}
                />
              </div>
          </div>
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
    clearCampaign,
    createLootPile,
    toggleLootPileVisibility,
    createMerchant,
    deleteMerchant,
    updateCurrency,
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
  const [isLootExpanded, setIsLootExpanded] = useState(true);

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

  // Group inventories by type
  const { lootPileData, merchantData, playerInventories } = useMemo(() => {
    const all = inventories || {};
    const loot = all['public-loot'];
    
    const merchants = Object.values(all)
        .filter(inv => inv.isMerchant)
        .sort((a, b) => a.characterName.localeCompare(b.characterName));

    const players = Object.fromEntries(
        Object.entries(all).filter(([id, inv]) => id !== 'public-loot' && !inv.isMerchant)
    );

    return { lootPileData: loot, merchantData: merchants, playerInventories: players };
  }, [inventories]);

  const orderedAndVisibleInventories = useMemo(() => {
    if (!user || Object.keys(playerInventories).length === 0) return [];

    // If I'm a player, only show ME
    if (!isDM) {
        const myInventory = playerInventories[user.uid];
        return myInventory ? [[user.uid, myInventory]] : [];
    }
    
    // If no custom layout exists, show all players unsorted
    if (!campaign?.layout) {
      return Object.entries(playerInventories);
    }

    const { order = [], visible = {} } = campaign.layout;

    // Map the saved order to the actual player data
    const ordered = order
        .map(playerId => ([playerId, playerInventories[playerId]]))
        .filter(entry => entry[1]); // Remove empty entries (e.g. if a player left or if it was the loot pile ID)
    
    // Note: If you want to show new players who aren't in the 'order' array yet,
    // you would append them here. For now, we keep your existing logic:
    
    return ordered.filter(([playerId]) => visible[playerId] ?? true);

  }, [campaign, playerInventories, user, isDM]);

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

  // --- RENAME LOOT PILE HANDLER ---
  const handleUpdateLootName = async (newName) => {
    if (!campaignId || !newName.trim()) return;
    try {
        const lootRef = doc(db, 'campaigns', campaignId, 'inventories', 'public-loot');
        await updateDoc(lootRef, { characterName: newName });
    } catch (error) {
        toast.error("Failed to rename loot pile");
    }
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

  useEffect(() => {
      if (!isLoading && inventories && !inventories['public-loot'] && isDM) {
          createLootPile(campaignId);
      }
  }, [inventories, isLoading, isDM, campaignId, createLootPile]);

  const handleContextMenu = (event, item, playerId, source, containerId) => {
    event.preventDefault();

    // Prevent the "ghost click" on mobile
    const preventGhostClick = (e) => {
      e.preventDefault();
      event.currentTarget.removeEventListener('touchend', preventGhostClick);
    };
    event.currentTarget.addEventListener('touchend', preventGhostClick);
    
    // --- CONTEXT CHECKS ---
    const targetInventory = inventories[playerId];
    const isDM = campaign?.dmId === user?.uid;
    const isPlayerDM = campaign?.dmId === playerId;
    const isLootPile = playerId === 'public-loot';
    const isMerchant = targetInventory?.isMerchant || false; // <--- Check for Merchant

    // Permission Logic: 
    // You can edit if: (It's your own inventory AND not restricted) OR (You are the DM)
    // Note: Players are never the owner of a merchant or loot pile, so this naturally blocks them.
    const canEdit = (user.uid === playerId && !isLootPile && !isMerchant) || isDM;

    const availableActions = [];

    // --- ACTIONS ---

    // 1. Equip / Unequip
    // Block this for DM's inventory, Loot Piles, AND Merchants
    if (!isPlayerDM && !isLootPile && !isMerchant) {
      if (source === 'equipped') {
        availableActions.push({
          label: 'Unequip',
          onClick: () => handleUnequipItem(item, playerId),
        });
      } else {
        availableActions.push({ 
          label: 'Equip', 
          onClick: () => handleEquipItem(item, playerId, source, containerId) 
        });
      }
    }

    // 2. Reveal Magic (DM Only)
    if (isDM && item.magicProperties && !item.magicPropertiesVisible) {
      availableActions.push({
        label: 'Reveal Magic Properties',
        onClick: () => handleRevealMagicProperties(item, playerId, source, containerId),
      });
    }

    // 3. Rotate (Grid Items Only)
    if (source === 'grid') {
        availableActions.push({ 
            label: 'Rotate', 
            onClick: () => handleRotateItem(item, playerId, containerId) 
        });
    }

    // 4. Send To... (DM Only)
    if (isDM) {
      const allPlayerIds = campaign?.players || [];
      const otherPlayers = allPlayerIds.filter(id => id !== playerId);
      
      if (otherPlayers.length > 0) {
        availableActions.push({
          label: 'Send to...',
          submenu: otherPlayers.map(targetId => ({
            // Show Character Name -> Profile Name -> ID
            label: inventories[targetId]?.characterName || playerProfiles[targetId]?.displayName || targetId,
            onClick: () => handleSendItem(item, source, playerId, targetId, containerId, isPlayerDM),
          })),
        });
      }
    }
    
    // 5. Split Stack (Requires Edit Permission)
    if (canEdit && item.stackable && item.quantity > 1) {
      availableActions.push({ 
        label: 'Split Stack', 
        onClick: () => handleStartSplit(item, playerId, containerId) 
      });
    }

    // 6. Administrative Actions (Requires Edit Permission)
    if (canEdit) {
        // DM gets full access. Players get access only to their own stuff.
        // We added a redundant check here just to be safe with the layout.
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
    }

    // --- RENDER ---
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
    } else { 
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

    const itemIndex = playerInv.equippedItems?.findIndex(i => i.id === item.id);
    if (itemIndex === -1 || !playerInv.equippedItems) {
      toast.error("Item to unequip not found.");
      return;
    }
    playerInv.equippedItems.splice(itemIndex, 1);

    let placed = false;
    const { x, y, ...itemToPlace } = item; 
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

    if (containerId && containerId !== 'tray') {
        const containerDocRef = doc(db, "campaigns", campaignId, "inventories", playerId, "containers", containerId);
        const currentContainer = inventories[playerId]?.containers?.[containerId];
        if (!currentContainer) return;

        let updatePayload = {};
        if (source === 'grid') {
            updatePayload.gridItems = currentContainer.gridItems.map(i => i.id === item.id ? updatedItem : i);
        } else { 
            updatePayload.trayItems = currentContainer.trayItems.map(i => i.id === item.id ? updatedItem : i);
        }
        await updateDoc(containerDocRef, updatePayload);
    
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

    if (containerId && containerId !== 'tray') {
        const containerDocRef = doc(db, "campaigns", campaignId, "inventories", playerId, "containers", containerId);
        const currentContainer = inventories[playerId]?.containers?.[containerId];
        if (!currentContainer) return;

        let updatePayload = {};
        if (source === 'grid') {
            updatePayload.gridItems = currentContainer.gridItems.filter(i => i.id !== item.id);
        } else { 
            updatePayload.trayItems = currentContainer.trayItems.filter(i => i.id !== item.id);
        }
        await updateDoc(containerDocRef, updatePayload);
    
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

    let dimensions = { width: 80, height: 80 }; 

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

        const endPlayerInv = newInventories[endPlayerId];
        const isEndDM = endPlayerInv.characterName === "DM";
        if (endDestination === 'grid') {
            endPlayerInv.containers[endContainerId].gridItems.find(i => i.id === passiveItem.id).quantity += amountToTransfer;
        } else {
            const targetTray = isEndDM ? endPlayerInv.containers[endContainerId].trayItems : endPlayerInv.trayItems;
            targetTray.find(i => i.id === passiveItem.id).quantity += amountToTransfer;
        }

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
            setInventoriesOptimistic(inventories); 
        }
        return; 
    }

    // --- MERCHANT LOGIC (Buying) ---
    const sourceInv = inventories[startPlayerId];
    if (sourceInv?.isMerchant && startPlayerId !== endPlayerId) {
        // We are dragging FROM a merchant TO someone else
        const costInCp = parseCostToCp(item.cost);
        const playerWallet = inventories[endPlayerId]?.currency || { gp: 0, sp: 0, cp: 0 };

        if (costInCp > 0) {
            // Check affordability
            const newWallet = deductCurrency(playerWallet, costInCp);
            
            if (!newWallet) {
                toast.error(`You cannot afford this item! Cost: ${item.cost}`);
                setActiveItem(null); // Cancel drag visual
                return; // STOP the drag
            }

            // Execute Payment
            // Note: We use optimistic updates for the item, but let's fire the wallet update now
            updateCurrency(campaignId, endPlayerId, newWallet);
            toast.success(`Bought for ${item.cost}.`);
        }
    }

    let movedItem = null;
    const startPlayerInv = newInventories[startPlayerId];
    const endPlayerInv = newInventories[endPlayerId];
    if (!startPlayerInv || !endPlayerInv) return;

    const isStartDM = startPlayerInv.characterName === 'DM';
    const isEndDM = endPlayerInv.characterName === 'DM';

    if (endPlayerId === 'public-loot' && !isDM) {
        toast.error("Only the DM can add items to the Loot Pile.");
        return;
    }

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
            toast.error("No space in destination!");
            const sourceTray = isStartDM ? startPlayerInv.containers[startContainerId].trayItems : startPlayerInv.trayItems;
            sourceTray.push(movedItem);
        }
    } else { 
        const { x, y, ...trayItem } = movedItem;
        if (endDestination === 'equipped') {
            if (!endPlayerInv.equippedItems) endPlayerInv.equippedItems = [];
            endPlayerInv.equippedItems.push(trayItem);
        } else if (isEndDM) {
            const destContainer = endPlayerInv.containers?.[endContainerId];
            if (!destContainer) return;
            if (!destContainer.trayItems) destContainer.trayItems = [];
            destContainer.trayItems.push(trayItem);
        } else { 
            if (!endPlayerInv.trayItems) endPlayerInv.trayItems = [];
            endPlayerInv.trayItems.push(trayItem);
        }
    }

    setInventoriesOptimistic(newInventories);

    const batch = writeBatch(db);
    const finalSourceInventory = newInventories[startPlayerId];
    const finalEndInventory = newInventories[endPlayerId];

    const sourcePlayerInvRef = doc(db, "campaigns", campaignId, "inventories", startPlayerId);
    batch.update(sourcePlayerInvRef, { 
        trayItems: finalSourceInventory.trayItems || [],
        equippedItems: finalSourceInventory.equippedItems || [],
    });
    Object.values(finalSourceInventory.containers).forEach(container => {
        const containerRef = doc(sourcePlayerInvRef, 'containers', container.id);
        batch.update(containerRef, { 
            gridItems: container.gridItems || [],
            trayItems: container.trayItems || [] 
        });
    });
    
    if (startPlayerId !== endPlayerId) {
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
        setInventoriesOptimistic(inventories); 
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
    if (!item || !source || !sourcePlayerId || !targetPlayerId) return;

    const originalInventories = inventories;
    const newInventories = JSON.parse(JSON.stringify(inventories));
    
    const sourceInventory = newInventories[sourcePlayerId];
    const targetInventory = newInventories[targetPlayerId];

    if (!sourceInventory || !targetInventory) {
        toast.error("Source or target inventory not found.");
        return;
    }

    // --- 1. Remove from Source ---
    if (sourceInventory.equippedItems) {
        sourceInventory.equippedItems = sourceInventory.equippedItems.filter(i => i.id !== item.id);
    }
    if (sourceInventory.trayItems) {
         sourceInventory.trayItems = sourceInventory.trayItems.filter(i => i.id !== item.id);
    }
    if (sourceInventory.containers) {
        Object.values(sourceInventory.containers).forEach(container => {
            if (container.gridItems) container.gridItems = container.gridItems.filter(i => i.id !== item.id);
            if (container.trayItems) container.trayItems = container.trayItems.filter(i => i.id !== item.id);    
        });
    }
    
    // --- 2. Add to Target ---
    const { x, y, ...itemForTray } = item;
    
    // SIMPLIFIED: Always send to the main tray (Floor/Ground), whether it's a Player or DM.
    if (!targetInventory.trayItems) targetInventory.trayItems = [];
    targetInventory.trayItems.push(itemForTray);

    // Optimistic Update
    setInventoriesOptimistic(newInventories);

    // --- 3. Save to Firestore ---
    const batch = writeBatch(db);
    const sourcePlayerInvRef = doc(db, "campaigns", campaignId, "inventories", sourcePlayerId);
    const targetPlayerInvRef = doc(db, "campaigns", campaignId, "inventories", targetPlayerId);

    // Update Source
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
    
    // Update Target (We only need to update the main doc since we pushed to trayItems)
    batch.update(targetPlayerInvRef, { 
        trayItems: newInventories[targetPlayerId].trayItems || [],
        equippedItems: newInventories[targetPlayerId].equippedItems || [] 
    });
    
    try {
      await batch.commit();
      const targetName = targetInventory.characterName || playerProfiles[targetPlayerId]?.displayName;
      toast.success(`Sent ${item.name} to ${targetName}.`);
    } catch (error) {
      console.error("Failed to send item:", error);
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

            {/* --- LOOT PILE SECTION --- */}
            {lootPileData && (isDM || lootPileData.isVisibleToPlayers) && (
              <div className="mb-8 border-4 border-yellow-900/30 rounded-xl overflow-hidden shadow-2xl bg-black/20 transition-all duration-300">
                
                {/* Header with Controls */}
                <div className="bg-yellow-900/80 p-3 flex items-center justify-between border-b border-yellow-900/50 select-none">
                    
                    {/* Left: Title & Status */}
                    <div className="flex items-center gap-3">
                        {isDM ? (
                            <input 
                                type="text" 
                                defaultValue={lootPileData.characterName} 
                                onBlur={(e) => handleUpdateLootName(e.target.value)}
                                onKeyDown={(e) => { if(e.key === 'Enter') e.target.blur() }}
                                className="bg-transparent border-none text-2xl font-fantasy text-amber-100 tracking-widest drop-shadow-md focus:ring-0 focus:outline-none placeholder-amber-100/50 w-full max-w-sm"
                                placeholder="The Loot Pile"
                            />
                        ) : (
                            <h2 className="text-2xl font-fantasy text-amber-100 tracking-widest drop-shadow-md">
                                {lootPileData.characterName}
                            </h2>
                        )}
                        
                        {isDM && (
                            <span className={`hidden sm:inline-block text-xs px-2 py-0.5 rounded-full border ${lootPileData.isVisibleToPlayers ? 'bg-green-900/50 border-green-500 text-green-200' : 'bg-red-900/50 border-red-500 text-red-200'}`}>
                                {lootPileData.isVisibleToPlayers ? 'Visible' : 'Hidden'}
                            </span>
                        )}
                    </div>

                    {/* Right: Buttons */}
                    <div className="flex items-center gap-2">
                        {/* DM Global Toggle (Eye) */}
                        {isDM && (
                            <button
                                onClick={() => toggleLootPileVisibility(campaignId, lootPileData.isVisibleToPlayers)}
                                className="p-2 text-amber-200 hover:text-white hover:bg-yellow-800/50 rounded-lg transition-colors"
                                title={lootPileData.isVisibleToPlayers ? "Hide from players" : "Show to players"}
                            >
                                {lootPileData.isVisibleToPlayers ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                      <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                      <path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L7.759 4.577a11.217 11.217 0 014.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113z" />
                                      <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0115.75 12zM12.53 15.713l-4.243-4.244a3.75 3.75 0 004.243 4.243z" />
                                      <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 00-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 016.75 12z" />
                                    </svg>
                                )}
                            </button>
                        )}
                        
                        {/* Local Collapse Toggle (Chevron) */}
                        <button
                            onClick={() => setIsLootExpanded(!isLootExpanded)}
                            className="p-2 text-amber-200 hover:text-white hover:bg-yellow-800/50 rounded-lg transition-colors"
                            title={isLootExpanded ? "Collapse" : "Expand"}
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className={`w-6 h-6 transition-transform duration-300 ${isLootExpanded ? 'rotate-180' : ''}`}
                            >
                                <path fillRule="evenodd" d="M11.47 7.72a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 01-1.06-1.06l7.5-7.5z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
                
                {/* Collapsible Content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isLootExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <PlayerInventory
                        playerId="public-loot"
                        inventoryData={lootPileData}
                        campaign={campaign}
                        playerProfiles={{}} 
                        user={user}
                        setEditingSettings={() => {}} // Disable settings
                        cellSizes={cellSizes}
                        gridRefs={gridRefs}
                        onContextMenu={handleContextMenu}
                        onToggleEquipped={() => {}}
                        isEquippedVisible={false}
                        isLootPile={true} // <--- Important: Activate loot pile styling
                    />
                </div>
              </div>
            )}

            {/* --- MERCHANT SECTION --- */}
            {merchantData.length > 0 && (
                <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {merchantData.map(merchant => (
                        <div key={merchant.ownerId} className="border-4 border-slate-700/50 rounded-xl overflow-hidden shadow-2xl bg-black/20">
                            <div className="bg-slate-800/90 p-3 text-center border-b border-slate-600/50 flex justify-between items-center">
                                <h2 className="text-xl font-fantasy text-slate-200 tracking-widest drop-shadow-md">
                                    {merchant.characterName} (Shop)
                                </h2>
                                {isDM && (
                                    <button 
                                        onClick={() => {
                                            if (window.confirm(`Delete shop "${merchant.characterName}"? Items inside will be lost.`)) {
                                                deleteMerchant(campaignId, merchant.ownerId);
                                            }
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                                        title="Delete Shop"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                            <PlayerInventory
                                playerId={merchant.ownerId}
                                inventoryData={merchant}
                                campaign={campaign}
                                playerProfiles={{}}
                                user={user}
                                setEditingSettings={() => {}}
                                cellSizes={cellSizes}
                                gridRefs={gridRefs}
                                onContextMenu={handleContextMenu}
                                onToggleEquipped={() => {}}
                                isEquippedVisible={false}
                                isLootPile={true} // Reuse the "clean" styling
                            />
                        </div>
                    ))}
                </div>
            )}

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
            {/* Add Merchant Button (DM Only) */}
            {isDM && (
                <button
                  onClick={() => {
                      const name = prompt("Enter Shop Name (e.g. 'Village Smithy'):");
                      if (name) createMerchant(campaignId, name);
                  }}
                  className="bg-surface/80 backdrop-blur-sm border border-amber-600/50 text-amber-500 hover:bg-amber-600 hover:text-white rounded-full p-3 sm:p-4 shadow-lg transition-all"
                  aria-label="Create Merchant"
                  title="Create New Shop"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                </button>
            )}
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
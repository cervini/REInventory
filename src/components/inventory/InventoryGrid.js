import React, { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { doc, updateDoc, writeBatch, setDoc, runTransaction, arrayUnion } from "firebase/firestore";
import { db } from '../../firebase';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors, pointerWithin } from '@dnd-kit/core';
import PlayerInventory from './PlayerInventory';
import LootPileSection from './LootPileSection';
import MerchantSection from './MerchantSection';
import InventoryActions from './InventoryActions';
import { findFirstAvailableSlot, onOtherItem, outOfBounds } from '../../utils/gridUtils';
import AddItem from '../items/AddItem';
import ContextMenu from '../ui/ContextMenu';
import SplitStack from './SplitStack';
import Spinner from '../ui/Spinner';
import InventorySettings from './InventorySettings';
import { getColorForItemType } from '../../utils/itemUtils';
import AddFromCompendium from '../compendium/AddFromCompendium';
import { useCampaignStore } from '../../stores/useCampaignStore';
import { usePlayerProfiles } from '../../hooks/usePlayerProfiles';
import CampaignLayout from '../campaign/CampaignLayout';
import { parseCostToCp, deductCurrency } from '../../utils/currencyUtils';
import './InventoryGrid.css';

export default function InventoryGrid({ campaignId, user, userProfile }) {

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
  const [showEquipped, setShowEquipped] = useState({});
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [isLootExpanded, setIsLootExpanded] = useState(true);
  const [restoringDMInventory, setRestoringDMInventory] = useState(false);

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

    const unlisted = Object.entries(playerInventories)
      .filter(([playerId]) => !order.includes(playerId));

    return [...ordered, ...unlisted].filter(([playerId]) => visible[playerId] ?? true);

  }, [campaign, playerInventories, user, isDM]);

  const toggleEquipped = (playerId) => {
    setShowEquipped(prev => ({ ...prev, [playerId]: !(prev[playerId] ?? false) }));
  };

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
      finalPlayerId = itemToEdit.playerId;
    } else if (targetPlayerId && isDM) {
      finalPlayerId = targetPlayerId;
    } else {
      finalPlayerId = user.uid;
    }

    if (!campaignId || !finalPlayerId) {
      toast.error("Could not determine the target player.");
      return;
    }

    const playerInventory = inventories[finalPlayerId];
    if (!playerInventory) {
      toast.error("Target inventory not found.");
      return;
    }

    const isTargetDM = campaign?.dmId === finalPlayerId;

    // --- 1. EDIT EXISTING ITEM ---
    if (itemToEdit) {
      const { item: originalItem, containerId } = itemToEdit;

      // CASE A: Item is EQUIPPED
      if (containerId === 'equipped') {
        const { x, y, ...itemForEquip } = { ...originalItem, ...itemData };
        const updatedEquippedItems = (playerInventory.equippedItems || []).map(i => i.id === originalItem.id ? itemForEquip : i);

        const playerInvRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId);
        await updateDoc(playerInvRef, { equippedItems: updatedEquippedItems });
        toast.success(`Updated ${itemData.name}.`);
      }

      // CASE B: Item is in a GRID (Standard Player Container)
      else if (containerId && containerId !== 'tray' && !isTargetDM) {

        // SAFEGUARD: Check if container exists
        const container = playerInventory.containers?.[containerId];
        if (!container) {
          console.error("Critical Error: Container not found during edit.", { containerId, finalPlayerId });
          toast.error("Error: Container not found. Try refreshing.");
          return;
        }

        const otherItems = (container.gridItems || []).filter(i => i.id !== originalItem.id);
        const updatedItem = { ...originalItem, ...itemData };

        const canStayInPlace = !outOfBounds(updatedItem.x, updatedItem.y, updatedItem, container.gridWidth, container.gridHeight) &&
          !otherItems.some(other => onOtherItem(updatedItem.x, updatedItem.y, updatedItem, other));

        let finalGridItems;
        let finalTrayItems = [...(playerInventory.trayItems || [])];

        if (canStayInPlace) {
          finalGridItems = (container.gridItems || []).map(i => i.id === originalItem.id ? updatedItem : i);
          toast.success(`Updated ${itemData.name}.`);
        } else {
          const newSlot = findFirstAvailableSlot(otherItems, updatedItem, container.gridWidth, container.gridHeight);
          if (newSlot) {
            finalGridItems = [...otherItems, { ...updatedItem, ...newSlot }];
            toast.success(`Updated ${itemData.name} and moved.`);
          } else {
            const { x, y, ...trayItem } = updatedItem;
            finalGridItems = otherItems;
            finalTrayItems.push(trayItem);
            toast.error(`Moved ${itemData.name} to tray.`);
          }
        }

        const batch = writeBatch(db);
        const playerInvRef = doc(db, 'campaigns', campaignId, 'inventories', finalPlayerId);
        const containerRef = doc(playerInvRef, 'containers', containerId);
        batch.update(containerRef, { gridItems: finalGridItems });
        batch.update(playerInvRef, { trayItems: finalTrayItems });
        await batch.commit();

      }

      // CASE C: Item is in a TRAY (Main tray or DM Container)
      else {
        const isSpecificContainer = containerId && containerId !== 'tray';

        if (isTargetDM && isSpecificContainer) {
          // Update item inside a specific DM container
          const container = playerInventory.containers?.[containerId];
          if (!container) {
            toast.error("DM Container not found.");
            return;
          }
          const updatedTrayItems = (container.trayItems || []).map(i => i.id === originalItem.id ? { ...i, ...itemData } : i);
          const containerDocRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId, "containers", containerId);
          await updateDoc(containerDocRef, { trayItems: updatedTrayItems });
        } else {
          // Update item in the Main Tray
          const updatedTrayItems = (playerInventory.trayItems || []).map(i => i.id === originalItem.id ? { ...i, ...itemData } : i);
          const playerInvRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId);
          await updateDoc(playerInvRef, { trayItems: updatedTrayItems });
        }
        toast.success(`Updated ${itemData.name}.`);
      }
    }
    // --- 2. CREATE NEW ITEM ---
    else {
      const originalInventories = inventories;
      const newInventories = JSON.parse(JSON.stringify(inventories));
      const targetInv = newInventories[finalPlayerId];

      // Unified Logic: Always add to the main 'trayItems'
      if (!targetInv.trayItems) targetInv.trayItems = [];
      targetInv.trayItems.push(itemData);

      const inventoryDocRef = doc(db, "campaigns", campaignId, "inventories", finalPlayerId);
      const firestorePromise = setDoc(inventoryDocRef, { trayItems: targetInv.trayItems }, { merge: true });

      setInventoriesOptimistic(newInventories);

      try {
        await firestorePromise;
        const targetName = playerInventory?.characterName || playerProfiles[finalPlayerId]?.displayName;
        toast.success(`Added ${itemData.name} to ${targetName}.`);
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
    if (originalItemInGrid) {
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
    if (active.data.current?.type === 'container') {
      return;
    }
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
    const { active, over, delta } = event;

    if (active.data.current?.type === 'container') {
      const activePlayerId = active.data.current.playerId;
      const containerData = active.data.current.container;
      const playerInventory = inventories[activePlayerId];

      if (playerInventory && playerInventory.containers[containerData.id]) {
        let newX = (containerData.x || 0) + delta.x;
        let newY = (containerData.y || 0) + delta.y;

        // Bounds checking
        const canvasElement = document.getElementById(`canvas-${activePlayerId}`);
        let maxX = window.innerWidth;
        let maxY = 2000;
        if (canvasElement) {
          // Approximate container width/height padding so they don't get completely hidden
          maxX = canvasElement.offsetWidth - 100;
          maxY = canvasElement.offsetHeight - 50;
        }

        if (newX < -50 || newY < -50 || newX > maxX || newY > maxY) {
          newX = 0;
          newY = 0;
          toast("Container sent back to top-left to prevent it from being lost.");
        }

        const containerRef = doc(db, 'campaigns', campaignId, 'inventories', activePlayerId, 'containers', containerData.id);

        try {
          const newInventories = JSON.parse(JSON.stringify(inventories));
          newInventories[activePlayerId].containers[containerData.id].x = newX;
          newInventories[activePlayerId].containers[containerData.id].y = newY;
          setInventoriesOptimistic(newInventories);

          await updateDoc(containerRef, { x: newX, y: newY });
        } catch (err) {
          toast.error("Failed to save container position.");
          setInventoriesOptimistic(inventories);
        }
      }
      return;
    }

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
    useSensor(TouchSensor, {
      // This allows mobile users to swipe to scroll.
      // A drag will only start if they press and hold for 250ms.
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleRestoreDMInventory = async () => {
    setRestoringDMInventory(true);
    try {
      const inventoryRef = doc(db, 'campaigns', campaignId, 'inventories', user.uid);
      const backpackRef = doc(inventoryRef, 'containers', 'backpack');
      const campaignRef = doc(db, 'campaigns', campaignId);
      const created = await runTransaction(db, async (transaction) => {
        if ((await transaction.get(inventoryRef)).exists()) return false;

        transaction.set(inventoryRef, {
          characterName: 'DM',
          ownerId: user.uid,
          trayItems: [],
          currency: { gp: 0, sp: 0, cp: 0 },
        });
        transaction.set(backpackRef, {
          name: 'Backpack',
          gridItems: [],
          gridWidth: 10,
          gridHeight: 5,
          trackWeight: true,
        });
        transaction.update(campaignRef, {
          players: arrayUnion(user.uid),
          'layout.order': arrayUnion(user.uid),
          [`layout.visible.${user.uid}`]: true,
        });
        return true;
      });
      if (!created) {
        toast.error('DM inventory already exists. Refresh to load it.');
      } else {
        toast.success('DM inventory created.');
      }
    } catch (error) {
      console.error('Failed to create DM inventory:', error);
      toast.error(error.code === 'permission-denied'
        ? 'Permission denied. Restore DM membership in Firestore before retrying.'
        : 'Unable to create DM inventory.');
    } finally {
      setRestoringDMInventory(false);
    }
  };

  if (isLoading) {
    return <Spinner />;
  }

  if (!isLoading && Object.keys(inventories).length === 0) {
    return (
      <div className="inventory-grid__empty">
        <h2 className="inventory-grid__empty-title">
          This Campaign Is Empty
        </h2>
        <p className="inventory-grid__empty-description">
          No player inventories have been created here yet.
        </p>
        {isDM && (
          <button
            type="button"
            onClick={handleRestoreDMInventory}
            disabled={restoringDMInventory}
            className="inventory-grid__restore-button"
          >
            {restoringDMInventory ? 'Creating...' : 'Restore DM Inventory'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="inventory-grid">
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
        <div className="inventory-grid__main">
          {isDM && (
            <div className="inventory-grid__campaign-toolbar">
              <button
                onClick={() => setShowLayoutSettings(true)}
                className="inventory-grid__campaign-button"
              >
                Manage Campaign
              </button>
            </div>
          )}
          <div className="inventory-grid__sections">

            {/* --- LOOT PILE SECTION --- */}
            {lootPileData && (isDM || lootPileData.isVisibleToPlayers) && (
              <LootPileSection
                lootPileData={lootPileData}
                isDM={isDM}
                isExpanded={isLootExpanded}
                onUpdateName={handleUpdateLootName}
                onToggleVisibility={() => toggleLootPileVisibility(campaignId, lootPileData.isVisibleToPlayers)}
                onToggleExpanded={() => setIsLootExpanded(!isLootExpanded)}
                campaign={campaign}
                user={user}
                cellSizes={cellSizes}
                gridRefs={gridRefs}
                onContextMenu={handleContextMenu}
              />
            )}

            {/* --- MERCHANT SECTION --- */}
            {merchantData.length > 0 && (
              <MerchantSection
                merchants={merchantData}
                isDM={isDM}
                onDeleteMerchant={(merchant) => {
                  if (window.confirm(`Delete shop "${merchant.characterName}"? Items inside will be lost.`)) {
                    deleteMerchant(campaignId, merchant.ownerId);
                  }
                }}
                campaign={campaign}
                user={user}
                cellSizes={cellSizes}
                gridRefs={gridRefs}
                onContextMenu={handleContextMenu}
              />
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
          <InventoryActions
            isDM={isDM}
            onOpenCompendium={() => setShowCompendium(true)}
            onAddItem={() => setShowAddItem(true)}
            onCreateMerchant={() => {
              const name = prompt("Enter Shop Name (e.g. 'Village Smithy'):");
              if (name) createMerchant(campaignId, name);
            }}
          />
        </div>
        <DragOverlay>
          {activeItem ? (
            <div
              style={{
                width: activeItem.dimensions.width,
                height: activeItem.dimensions.height,
              }}
              className={`${getColorForItemType(activeItem.item.type)} inventory-grid__drag-preview`}
            >
              {activeItem.item.name}
              {activeItem.item.stackable && activeItem.item.quantity > 1 && (
                <span className="inventory-grid__drag-quantity" style={{ WebkitTextStroke: '1px black' }}>
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
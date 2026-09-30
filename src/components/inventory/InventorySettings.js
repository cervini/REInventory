import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { doc, writeBatch, getDoc, getDocs, collection } from "firebase/firestore";
import { calculateCarryingCapacity } from '../../utils/dndUtils';
import CollapsibleSection from '../ui/CollapsibleSection';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './InventorySettings.css';

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;
const sizeOptions = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function SortableContainerItem({ 
  container, 
  onContainerChange, 
  onDeleteContainer, 
  onMoveUp, 
  onMoveDown, 
  isFirst, 
  isLast,
  isDMInventory 
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: container.id });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="inventory-settings__container"
    >
      <div className="inventory-settings__container-header">
        <div className="inventory-settings__container-name-group">
          {/* Drag Handle */}
          <div 
            {...attributes} 
            {...listeners} 
            className="inventory-settings__drag-handle"
            title="Drag to Reorder"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="inventory-settings__icon" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </div>
          
          <input 
            type="text"
            value={container.name}
            onChange={(e) => onContainerChange(container.id, 'name', e.target.value)}
            className="inventory-settings__container-name"
          />
        </div>

        <div className="inventory-settings__reorder">
          {/* Move Up Button */}
          <button 
            type="button" 
            onClick={onMoveUp} 
            disabled={isFirst}
            className="inventory-settings__reorder-button"
            title="Move Up"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="inventory-settings__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Move Down Button */}
          <button 
            type="button" 
            onClick={onMoveDown} 
            disabled={isLast}
            className="inventory-settings__reorder-button"
            title="Move Down"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="inventory-settings__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Delete Button */}
          <button 
            type="button" 
            onClick={() => onDeleteContainer(container.id)} 
            className="inventory-settings__delete-container"
            title="Delete Container"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="inventory-settings__icon" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="inventory-settings__row">
        <div className="inventory-settings__half">
          <label className="inventory-settings__label">Grid Width</label>
          <input 
            type="number" 
            min="1" 
            value={container.gridWidth} 
            onChange={(e) => onContainerChange(container.id, 'gridWidth', parseInt(e.target.value, 10) || 1)} 
            className="inventory-settings__input" 
          />
        </div>
        <div className="inventory-settings__half">
          <label className="inventory-settings__label">Grid Height</label>
          <input 
            type="number" 
            min="1" 
            value={container.gridHeight} 
            onChange={(e) => onContainerChange(container.id, 'gridHeight', parseInt(e.target.value, 10) || 1)} 
            className="inventory-settings__input" 
          />
        </div>
      </div>

      {!isDMInventory && (
        <div className="inventory-settings__weight-toggle">
          <input 
            id={`track-${container.id}`} 
            type="checkbox" 
            checked={container.trackWeight ?? true}
            onChange={(e) => onContainerChange(container.id, 'trackWeight', e.target.checked)} 
            className="inventory-settings__checkbox" 
          />
          <label htmlFor={`track-${container.id}`} className="inventory-settings__checkbox-label">Track weight for this container</label>
        </div>
      )}
    </div>
  );
}

export default function InventorySettings({ onClose, campaignId, userId, currentSettings, isDMInventory }) {
  const [characterName, setCharacterName] = useState(currentSettings.characterName || '');
  const [weightUnit, setWeightUnit] = useState(currentSettings.weightUnit || 'lbs');
  // State for containers now tracks edits, additions, and deletions, sorted by order
  const [containers, setContainers] = useState(() => {
    const list = Object.values(currentSettings.containers || {});
    return list.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  });
  const [containersToDelete, setContainersToDelete] = useState([]);
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState(currentSettings.strength || 10);
  // States for the automatic weight
  const [size, setSize] = useState(currentSettings.size || 'Medium');
  const [useCalculatedWeight, setUseCalculatedWeight] = useState(currentSettings.useCalculatedWeight ?? false);
  // State for the manual weight input field
  const [manualMaxWeight, setManualMaxWeight] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setContainers((items) => {
        const oldIndex = items.findIndex(c => c.id === active.id);
        const newIndex = items.findIndex(c => c.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMoveContainer = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= containers.length) return;
    setContainers(prev => {
      const list = [...prev];
      const temp = list[index];
      list[index] = list[newIndex];
      list[newIndex] = temp;
      return list;
    });
  };

  /**
   * Updates a specific field of a container in the local state.
   * @param {string} containerId - The ID of the container to update.
   * @param {string} field - The name of the property to update (e.g., 'name', 'gridWidth').
   * @param {*} value - The new value for the field.
   */
  const handleContainerChange = (containerId, field, value) => {
    setContainers(prev => 
      prev.map(c => c.id === containerId ? { ...c, [field]: value } : c)
    );
  };

  /**
   * Adds a new, temporary container object to the local `containers` state.
   * This new container is flagged with `isNew: true` to be identified during the save process.
   */
  // Function to add a new, temporary container to the UI
  const handleAddNewContainer = () => {
    const newContainer = {
      id: `new-${Date.now()}`, // Temporary ID for the key
      name: "New Container",
      gridWidth: 10,
      gridHeight: 5,
      trackWeight: true,
      gridItems: [],
      trayItems: [], 
      x: containers.length * 20, // Offset new containers slightly
      y: containers.length * 20,
      isNew: true, // Flag to identify new containers
    };
    setContainers(prev => [...prev, newContainer]);
  };

  // Function to mark a container for deletion
  /**
   * Marks a container for deletion. It removes the container from the local UI state
   * and, if it's an existing container (not a new one), adds its ID to a separate
   * list to be deleted from Firestore on save.
   * @param {string} containerId - The ID of the container to delete.
   */
  const handleDeleteContainer = (containerId) => {
    if (!window.confirm("Are you sure you want to delete this container and all items within it? This cannot be undone.")) {
        return;
    }
    setContainers(prev => prev.filter(c => c.id !== containerId));
    // If it's not a newly added container, add its ID to the list for deletion from Firestore
    if (!containerId.startsWith('new-')) {
        setContainersToDelete(prev => [...prev, containerId]);
    }
  };

  /**
   * Saves all character and inventory settings to Firestore using a batched write.
   * This includes updating the character name and weight, creating new containers,
   * updating existing ones, and deleting marked containers.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    let finalMaxWeightLbs;
    // for DM fields are set to default as they don't really matter
    if (!isDMInventory) {
        if (useCalculatedWeight) {
            finalMaxWeightLbs = calculateCarryingCapacity(strength, size);
        } else {
            const inputValue = parseFloat(manualMaxWeight);
            finalMaxWeightLbs = weightUnit === 'kg' ? inputValue * KG_TO_LBS : inputValue;
        }
    } else {
        finalMaxWeightLbs = currentSettings.totalMaxWeight || 0;
    }


    const batch = writeBatch(db);
    const inventoryDocRef = doc(db, 'campaigns', campaignId, 'inventories', userId);

    batch.update(inventoryDocRef, { 
      characterName: characterName.trim(),
      totalMaxWeight: finalMaxWeightLbs,
      weightUnit: weightUnit,
      strength: Number(strength),
      size: size,
      useCalculatedWeight: useCalculatedWeight,
    });

    if (!isDMInventory) {
        containers.forEach((container, index) => {
            const isNew = container.isNew;
            const containerRef = isNew 
                ? doc(inventoryDocRef, 'containers', crypto.randomUUID()) 
                : doc(inventoryDocRef, 'containers', container.id);
            
            const containerData = {
                name: container.name,
                gridWidth: container.gridWidth,
                gridHeight: container.gridHeight,
                trackWeight: container.trackWeight ?? true, // 'true' if trackWeight undefined
                gridItems: container.gridItems || [],
                trayItems: container.trayItems || [],
                x: container.x ?? (index * 20),
                y: container.y ?? (index * 20),
                order: index,
            };

            if (isNew) {
                batch.set(containerRef, containerData);
            } else {
                batch.update(containerRef, containerData);
            }
        });
        
        for (const containerId of containersToDelete) {
            const containerRef = doc(inventoryDocRef, 'containers', containerId);
            batch.delete(containerRef);
        }
    }

    try {
      await batch.commit();
      toast.success("Inventory settings updated!");
      onClose();
    } catch (err) {
      toast.error("Unable to update inventory settings.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles the logic for a player to permanently leave a campaign.
   * It deletes the player's entire inventory (including all containers and items),
   * removes them from the campaign's player list and layout, and then reloads the page.
   * A confirmation dialog is shown before proceeding.
   */
  const handleLeaveCampaign = async () => {
      if (isDMInventory) {
        toast.error("The DM cannot leave their own campaign.");
        return;
      }
        if (!window.confirm("Are you sure you want to leave this campaign? Your inventory will be permanently deleted.")) {
            return;
        }
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const campaignDocRef = doc(db, 'campaigns', campaignId);
            const campaignSnap = await getDoc(campaignDocRef);
            const campaignData = campaignSnap.data();

            // 1. Delete the user's inventory and containers
            const inventoryRef = doc(db, 'campaigns', campaignId, 'inventories', userId);
            const containersRef = collection(inventoryRef, 'containers');
            const containersSnap = await getDocs(containersRef);
            containersSnap.forEach(doc => batch.delete(doc.ref));
            batch.delete(inventoryRef);

            // 2. Update the campaign document to remove the user
            const newPlayers = campaignData.players.filter(p => p !== userId);
            const newOrder = (campaignData.layout?.order || []).filter(p => p !== userId);
            const newVisible = Object.fromEntries(
              Object.entries(campaignData.layout?.visible || {}).filter(([id]) => newPlayers.includes(id))
            );

            batch.update(campaignDocRef, {
                players: newPlayers,
                'layout.order': newOrder,
                'layout.visible': newVisible,
            });

            await batch.commit();
            toast.success("You have left the campaign.");
            // Force a reload to go back to the campaign selection screen
            window.location.reload();

        } catch (error) {
            toast.error("Failed to leave campaign.");
            console.error(error);
            setLoading(false);
        }
  };

  return (
    <div className="inventory-settings" onClick={onClose}>
      <div className="inventory-settings__dialog" onClick={e => e.stopPropagation()}>
        <h3 className="inventory-settings__title">
          Character & Inventory Settings
        </h3>
        <form onSubmit={handleSave} className="inventory-settings__form">
          {/* Character Name --- */}
          <div>
            <label className="inventory-settings__label">Character Name</label>
            <input type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} className="inventory-settings__input" />
          </div>
          
          <CollapsibleSection title="Weight Settings" defaultOpen={false}>
            {/* Character Stats --- */}
            {!isDMInventory && (
                <div className="inventory-settings__weight-stats">
                  <div className="inventory-settings__row">
                    <div className="inventory-settings__half">
                      <label className="inventory-settings__label">Strength Score</label>
                      <input type="number" value={strength} onChange={(e) => setStrength(e.target.value)} className="inventory-settings__input" />
                      </div>
                    <div className="inventory-settings__half">
                      <label className="inventory-settings__label">Character Size</label>
                      <select value={size} onChange={(e) => setSize(e.target.value)} className="inventory-settings__input">
                              {sizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
                  </div>
                    <div className="inventory-settings__weight-toggle">
                      <input id="useCalculatedWeight" type="checkbox" checked={useCalculatedWeight} onChange={(e) => setUseCalculatedWeight(e.target.checked)} className="inventory-settings__checkbox" />
                      <label htmlFor="useCalculatedWeight" className="inventory-settings__checkbox-label">Automatically calculate max weight from stats (5e rules)</label>
                  </div>
              </div>
            )}

            {/* --- Max Weight Section (now conditional) --- */}
            {!isDMInventory && (
              <div className={`inventory-settings__weight-row ${useCalculatedWeight ? 'inventory-settings__weight-row--calculated' : ''}`}>
                  <div className="inventory-settings__grow">
                    <label className="inventory-settings__label">Total Max Weight</label>
                    <input 
                      type="number" 
                      value={useCalculatedWeight ? calculateCarryingCapacity(strength, size) * (weightUnit === 'kg' ? LBS_TO_KG : 1) : manualMaxWeight} 
                      onChange={(e) => setManualMaxWeight(e.target.value)}
                      disabled={useCalculatedWeight}
                      className="inventory-settings__input inventory-settings__input--calculated" 
                    />
                  </div>
                  <div>
                    <label className="inventory-settings__label">Unit</label>
                    <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value)} className="inventory-settings__input">
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Container Management Section */}
          <CollapsibleSection title="Container Management" defaultOpen={false}>
            {!isDMInventory && (
              <div className="inventory-settings__container-section">
                <h4 className="inventory-settings__container-title">Containers</h4>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={containers.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    <div className="inventory-settings__container-list">
                      {containers.map((container, index) => (
                        <SortableContainerItem
                          key={container.id}
                          container={container}
                          onContainerChange={handleContainerChange}
                          onDeleteContainer={handleDeleteContainer}
                          onMoveUp={() => handleMoveContainer(index, -1)}
                          onMoveDown={() => handleMoveContainer(index, 1)}
                          isFirst={index === 0}
                          isLast={index === containers.length - 1}
                          isDMInventory={isDMInventory}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button type="button" onClick={handleAddNewContainer} className="inventory-settings__add-container">
                  + Add New Container
                </button>
              </div>
            )}
          </CollapsibleSection>
          <CollapsibleSection title="Danger Zone" defaultOpen={false}>
            {!isDMInventory && (
                <div className="inventory-settings__danger">
                  <p className="inventory-settings__danger-description">Leaving the campaign will permanently delete your character and their inventory for this campaign.</p>
                    <button 
                        type="button" 
                        onClick={handleLeaveCampaign} 
                        disabled={loading} 
                        className="inventory-settings__leave"
                    >
                      {loading ? 'Leaving...' : 'Leave Campaign'}
                    </button>
                </div>
            )}
          </CollapsibleSection>
          
          <div className="inventory-settings__actions">
            <button type="button" onClick={onClose} disabled={loading} className="inventory-settings__button inventory-settings__button--cancel">Cancel</button>
            <button type="submit" disabled={loading} className="inventory-settings__button inventory-settings__button--save">
              {loading ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
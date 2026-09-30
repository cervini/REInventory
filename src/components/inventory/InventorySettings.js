import React, { useId, useRef, useState } from 'react';
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { doc, writeBatch, getDoc, getDocs, collection } from "firebase/firestore";
import { calculateCarryingCapacity } from '../../utils/dndUtils';
import CollapsibleSection from '../ui/CollapsibleSection';
import useDialog from '../../hooks/useDialog';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './InventorySettings.css';

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 1 / LBS_TO_KG;
const sizeOptions = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function SortableContainerItem({ 
  container, 
  onContainerChange, 
  onDeleteContainer, 
  onMoveUp, 
  onMoveDown, 
  isFirst, 
  isLast,
  isDMInventory,
  disabled
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: container.id, disabled });
  const fieldId = useId();
  
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
            aria-label={`Reorder ${container.name}`}
          >
            <Bars3Icon className="inventory-settings__icon" aria-hidden="true" />
          </div>
          
          <input 
            type="text"
            required
            aria-label={`Bag name: ${container.name}`}
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
            aria-label={`Move ${container.name} up`}
          >
            <ChevronUpIcon className="inventory-settings__icon" aria-hidden="true" />
          </button>

          {/* Move Down Button */}
          <button 
            type="button" 
            onClick={onMoveDown} 
            disabled={isLast}
            className="inventory-settings__reorder-button"
            title="Move Down"
            aria-label={`Move ${container.name} down`}
          >
            <ChevronDownIcon className="inventory-settings__icon" aria-hidden="true" />
          </button>

          {/* Delete Button */}
          <button 
            type="button" 
            onClick={() => onDeleteContainer(container.id)} 
            className="inventory-settings__delete-container"
            title="Delete Container"
            aria-label={`Delete ${container.name}`}
          >
            <TrashIcon className="inventory-settings__icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="inventory-settings__row">
        <div className="inventory-settings__half">
          <label htmlFor={`${fieldId}-width`} className="inventory-settings__label">Width (cells)</label>
          <input 
            id={`${fieldId}-width`}
            type="number" 
            min="1" 
            step="1"
            required
            value={container.gridWidth} 
            onChange={(e) => onContainerChange(container.id, 'gridWidth', e.target.value)}
            className="inventory-settings__input" 
          />
        </div>
        <div className="inventory-settings__half">
          <label htmlFor={`${fieldId}-height`} className="inventory-settings__label">Height (cells)</label>
          <input 
            id={`${fieldId}-height`}
            type="number" 
            min="1" 
            step="1"
            required
            value={container.gridHeight} 
            onChange={(e) => onContainerChange(container.id, 'gridHeight', e.target.value)}
            className="inventory-settings__input" 
          />
        </div>
      </div>

      {!isDMInventory && (
        <div className="inventory-settings__weight-toggle">
          <input 
            id={`${fieldId}-track`}
            type="checkbox" 
            checked={container.trackWeight ?? true}
            onChange={(e) => onContainerChange(container.id, 'trackWeight', e.target.checked)} 
            className="inventory-settings__checkbox" 
          />
          <label htmlFor={`${fieldId}-track`} className="inventory-settings__checkbox-label">Count carried weight</label>
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
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const requestInProgress = useRef(false);
  const formId = useId();
  const loading = pendingAction !== null;
  const [strength, setStrength] = useState(currentSettings.strength ?? 10);
  // States for the automatic weight
  const [size, setSize] = useState(currentSettings.size || 'Medium');
  const [useCalculatedWeight, setUseCalculatedWeight] = useState(currentSettings.useCalculatedWeight ?? false);
  // State for the manual weight input field
  const [manualMaxWeight, setManualMaxWeight] = useState(String((currentSettings.totalMaxWeight ?? 0) * (currentSettings.weightUnit === 'kg' ? LBS_TO_KG : 1)));
  const handleClose = () => {
    if (requestInProgress.current) return;
    if (pendingDelete) setPendingDelete(null);
    else if (confirmLeave) setConfirmLeave(false);
    else onClose();
  };
  const dialogRef = useDialog({ onClose: handleClose, busy: loading });
  const changeWeightUnit = nextUnit => {
    if (manualMaxWeight !== '') setManualMaxWeight(String(Number(manualMaxWeight) * (weightUnit === 'kg' ? KG_TO_LBS : 1) * (nextUnit === 'kg' ? LBS_TO_KG : 1)));
    setWeightUnit(nextUnit);
  };

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
      id: `new-${crypto.randomUUID()}`,
      name: "New bag",
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
    setPendingDelete(containerId);
  };

  const confirmDeleteContainer = () => {
    const containerId = pendingDelete;
    if (!containerId) return;
    setContainers(prev => prev.filter(c => c.id !== containerId));
    // If it's not a newly added container, add its ID to the list for deletion from Firestore
    if (!containerId.startsWith('new-')) {
        setContainersToDelete(prev => [...prev, containerId]);
    }
      setPendingDelete(null);
  };

  /**
   * Saves all character and inventory settings to Firestore using a batched write.
   * This includes updating the character name and weight, creating new containers,
   * updating existing ones, and deleting marked containers.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    if (requestInProgress.current || !e.currentTarget.reportValidity()) return;
    setError('');
    if (!characterName.trim() || (!isDMInventory && !useCalculatedWeight && (manualMaxWeight === '' || !Number.isFinite(Number(manualMaxWeight)) || Number(manualMaxWeight) < 0))) {
      setError('Enter a name and a valid carrying capacity.');
      return;
    }
    if (!isDMInventory && containers.some(container => !container.name.trim() || ![container.gridWidth, container.gridHeight].every(value => Number.isInteger(Number(value)) && Number(value) >= 1))) {
      setError('Each bag needs a name and positive whole-number dimensions.');
      return;
    }
    if (!isDMInventory && containers.some(container => (container.gridItems || []).some(item => item.x + item.w > Number(container.gridWidth) || item.y + item.h > Number(container.gridHeight)))) {
      setError('A bag cannot be smaller than the items currently placed inside it.');
      return;
    }
    requestInProgress.current = true;
    setPendingAction('save');

    try {
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
              name: container.name.trim(),
              gridWidth: Number(container.gridWidth),
              gridHeight: Number(container.gridHeight),
                trackWeight: container.trackWeight ?? true, // 'true' if trackWeight undefined
                order: index,
            };

            if (isNew) {
              batch.set(containerRef, { ...containerData, gridItems: [], trayItems: [], x: container.x ?? (index * 20), y: container.y ?? (index * 20) });
            } else {
                batch.update(containerRef, containerData);
            }
        });
        
        for (const containerId of containersToDelete) {
            const containerRef = doc(inventoryDocRef, 'containers', containerId);
            batch.delete(containerRef);
        }
    }

      await batch.commit();
      toast.success("Inventory settings updated!");
      onClose();
    } catch (err) {
      setError('Could not save settings. Your changes are still here; please try again.');
      console.error(err);
    } finally {
      requestInProgress.current = false;
      setPendingAction(null);
    }
  };

  /**
   * Handles the logic for a player to permanently leave a campaign.
   * It deletes the player's entire inventory (including all containers and items),
   * removes them from the campaign's player list and layout, and then reloads the page.
   * A confirmation dialog is shown before proceeding.
   */
  const handleLeaveCampaign = async () => {
      if (requestInProgress.current || !confirmLeave) return;
      if (isDMInventory) {
        toast.error("The DM cannot leave their own campaign.");
        return;
      }
        requestInProgress.current = true;
        setPendingAction('leave');
        setError('');
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
          setError('Could not leave the campaign. Please try again.');
            console.error(error);
        } finally {
          requestInProgress.current = false;
          setPendingAction(null);
        }
  };

  return (
    <div className="inventory-settings" onClick={event => { if (event.target === event.currentTarget) handleClose(); }}>
      <div ref={dialogRef} className="inventory-settings__dialog" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} aria-busy={loading} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="inventory-settings__header">
          <h2 id={`${formId}-title`} className="inventory-settings__title">{isDMInventory ? 'DM Workspace Settings' : 'Character Settings'}</h2>
          <button type="button" onClick={handleClose} disabled={loading} className="inventory-settings__close" aria-label="Close character settings" title="Close"><XMarkIcon className="inventory-settings__icon" aria-hidden="true" /></button>
        </div>
        <form onSubmit={handleSave} className="inventory-settings__form">
          <div className="inventory-settings__content">
          <fieldset disabled={loading} className="inventory-settings__fields">
          {/* Character Name --- */}
          <div>
            <label htmlFor={`${formId}-name`} className="inventory-settings__label">{isDMInventory ? 'Workspace name' : 'Character name'}</label>
            <input id={`${formId}-name`} data-dialog-autofocus required type="text" value={characterName} onChange={(e) => setCharacterName(e.target.value)} className="inventory-settings__input" />
          </div>
          
          {!isDMInventory && <section className="inventory-settings__section" aria-labelledby={`${formId}-capacity`}>
            <h3 id={`${formId}-capacity`} className="inventory-settings__container-title">Carrying capacity</h3>
            <div className="inventory-settings__weight-toggle">
              <input id={`${formId}-calculate`} type="checkbox" checked={useCalculatedWeight} onChange={event => setUseCalculatedWeight(event.target.checked)} className="inventory-settings__checkbox" />
              <label htmlFor={`${formId}-calculate`} className="inventory-settings__checkbox-label">Calculate from strength and size</label>
            </div>
            {/* Character Stats --- */}
            {useCalculatedWeight && (
                <div className="inventory-settings__weight-stats">
                  <div className="inventory-settings__row">
                    <div className="inventory-settings__half">
                      <label htmlFor={`${formId}-strength`} className="inventory-settings__label">Strength score</label>
                      <input id={`${formId}-strength`} type="number" min="0" step="1" required value={strength} onChange={(e) => setStrength(e.target.value)} className="inventory-settings__input" />
                      </div>
                    <div className="inventory-settings__half">
                      <label htmlFor={`${formId}-size`} className="inventory-settings__label">Character size</label>
                      <select id={`${formId}-size`} value={size} onChange={(e) => setSize(e.target.value)} className="inventory-settings__input">
                              {sizeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                      </div>
                  </div>
              </div>
            )}

            {/* --- Max Weight Section (now conditional) --- */}
            {!isDMInventory && (
              <div className="inventory-settings__weight-row">
                  <div className="inventory-settings__grow">
                    <label htmlFor={`${formId}-maximum`} className="inventory-settings__label">Maximum weight</label>
                    <input 
                      id={`${formId}-maximum`}
                      type="number" 
                      min="0"
                      step="any"
                      required={!useCalculatedWeight}
                      value={useCalculatedWeight ? (calculateCarryingCapacity(strength, size) * (weightUnit === 'kg' ? LBS_TO_KG : 1)).toFixed(2) : manualMaxWeight}
                      onChange={(e) => setManualMaxWeight(e.target.value)}
                      readOnly={useCalculatedWeight}
                      className="inventory-settings__input inventory-settings__input--calculated" 
                    />
                  </div>
                  <div>
                    <label htmlFor={`${formId}-unit`} className="inventory-settings__label">Weight unit</label>
                    <select id={`${formId}-unit`} value={weightUnit} onChange={(e) => changeWeightUnit(e.target.value)} className="inventory-settings__input">
                      <option value="lbs">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
              </div>
            )}
          </section>}

          {/* Container Management Section */}
          {!isDMInventory && <section className="inventory-settings__section" aria-labelledby={`${formId}-bags`}>
            {!isDMInventory && (
              <div className="inventory-settings__container-section">
                <div className="inventory-settings__bags-heading"><h3 id={`${formId}-bags`} className="inventory-settings__container-title">Bags <span className="inventory-settings__count">{containers.length}</span></h3><button type="button" onClick={handleAddNewContainer} className="inventory-settings__add-container"><PlusIcon className="inventory-settings__icon" aria-hidden="true" />Add bag</button></div>
                {pendingDelete && <div role="alert" className="inventory-settings__confirmation"><p>Delete {containers.find(container => container.id === pendingDelete)?.name}? Its items will be permanently deleted when you save.</p><div className="inventory-settings__confirmation-actions"><button type="button" onClick={() => setPendingDelete(null)} className="inventory-settings__button inventory-settings__button--cancel">Keep bag</button><button type="button" onClick={confirmDeleteContainer} className="inventory-settings__button inventory-settings__button--danger">Delete bag</button></div></div>}
                {containers.length === 0 && <p className="inventory-settings__empty">No bags.</p>}
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
                          disabled={loading}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </section>}
          {!isDMInventory && <CollapsibleSection title="Campaign membership" defaultOpen={false}>
            {!isDMInventory && (
                <div className="inventory-settings__danger">
                  <p className="inventory-settings__danger-description">Leaving the campaign will permanently delete your character and their inventory for this campaign.</p>
                    {confirmLeave && <div role="alert" className="inventory-settings__confirmation"><p>Leave this campaign and permanently delete this character, all bags, and all items?</p><div className="inventory-settings__confirmation-actions"><button type="button" onClick={() => setConfirmLeave(false)} className="inventory-settings__button inventory-settings__button--cancel">Keep character</button><button type="button" onClick={handleLeaveCampaign} className="inventory-settings__button inventory-settings__button--danger">{pendingAction === 'leave' ? 'Leaving...' : 'Leave campaign'}</button></div></div>}
                    {!confirmLeave && <button
                        type="button" 
                        onClick={() => setConfirmLeave(true)}
                        disabled={loading} 
                        className="inventory-settings__leave"
                    >
                      Leave campaign
                    </button>}
                </div>
            )}
          </CollapsibleSection>}
          </fieldset>
          </div>
          {error && <p role="alert" className="inventory-settings__error">{error}</p>}
          
          <div className="inventory-settings__actions">
            <button type="button" onClick={handleClose} disabled={loading} className="inventory-settings__button inventory-settings__button--cancel">Cancel</button>
            <button type="submit" disabled={loading || !!pendingDelete || confirmLeave} className="inventory-settings__button inventory-settings__button--save">
              {pendingAction === 'save' ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
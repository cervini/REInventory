import React, { useState, useEffect, useRef, useId } from 'react';
import useDialog from '../../hooks/useDialog';
import IconPicker from '../icons/IconPicker';
import DynamicIcon from '../icons/DynamicIcon';
import CollapsibleSection from '../ui/CollapsibleSection';
import * as SolidIcons from '@heroicons/react/24/solid';
import './AddItem.css';

const itemTypes = ['Weapon', 'Armor', 'Potion', 'Magic', 'Ammunition', 'Tool', 'Treasure', 'Gear', 'Other'];

export default function AddItem({ onAddItem, onClose, itemToEdit, isDM }) {
  
  const isEditMode = !!itemToEdit;
  const itemBeingEdited = isEditMode ? itemToEdit.item : null;

  // --- Form State ---
  const [name, setName] = useState(isEditMode ? itemBeingEdited.name : '');
  const [w, setW] = useState(isEditMode ? itemBeingEdited.w : 1);
  const [h, setH] = useState(isEditMode ? itemBeingEdited.h : 1);
  const [type, setType] = useState(isEditMode ? itemBeingEdited.type : 'Gear');
  const [stackable, setStackable] = useState(isEditMode ? itemBeingEdited.stackable ?? false : false);
  const [maxStack, setMaxStack] = useState(isEditMode ? itemBeingEdited.maxStack ?? 20 : 20);
  const [quantity, setQuantity] = useState(isEditMode ? itemBeingEdited.quantity ?? 1 : 1);
  const [cost, setCost] =useState(isEditMode ? itemBeingEdited.cost ?? '' : '');
  const [weight, setWeight] = useState(isEditMode ? itemBeingEdited.weight ?? '' : '');
  const [description, setDescription] = useState(isEditMode ? itemBeingEdited.description ?? '' : '');
  const [rarity, setRarity] = useState(itemBeingEdited?.rarity || 'Common');
  const [magicProperties, setMagicProperties] = useState(isEditMode ? itemBeingEdited.magicProperties ?? '' : '');
  const [attunement, setAttunement] = useState(itemBeingEdited?.attunement || 'No');
  const [damage, setDamage] = useState(String(itemBeingEdited?.weaponStats?.damage ?? ''));
  const [damageType, setDamageType] = useState(itemBeingEdited?.weaponStats?.damageType || '');
  const [properties, setProperties] = useState(itemBeingEdited?.weaponStats?.properties || '');
  const [armorClass, setArmorClass] = useState(String(itemBeingEdited?.armorStats?.armorClass ?? ''));
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(isEditMode ? itemToEdit.item.icon : null);
  const [armorType, setArmorType] = useState(itemBeingEdited?.armorStats?.armorType || 'Light');
  const [stealthDisadvantage, setStealthDisadvantage] = useState(isEditMode ? itemBeingEdited.armorStats?.stealthDisadvantage ?? false : false);
  const [strengthRequirement, setStrengthRequirement] = useState(itemBeingEdited?.armorStats?.strengthRequirement ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestInProgress = useRef(false);
  const newItemId = useRef(null);
  const formId = useId();

  const handleClose = () => {
    if (!requestInProgress.current) onClose();
  };
  const dialogRef = useDialog({ onClose: handleClose, busy: saving, suspended: showIconPicker });

  useEffect(() => {
    if (isEditMode) return;
    const magicBonusMatch = name.match(/\s*\+(\d)$/);
    if (magicBonusMatch && magicBonusMatch[1]) {
        const bonus = parseInt(magicBonusMatch[1], 10);
        if (bonus > 0) {
            if (bonus === 1) setRarity('Uncommon');
            else if (bonus === 2) setRarity('Rare');
            else if (bonus === 3) setRarity('Very Rare');
            else if (bonus === 4) setRarity('Legendary');
            else if (bonus >= 5) setRarity('Artifact');

            if (type === 'Weapon') {
                // Usiamo una funzione che riceve lo stato precedente ('prevDamage')
                setDamage(prevDamage => {
                    const baseDamageMatch = prevDamage.match(/(\d+d\d+)/);
                    return (baseDamageMatch && baseDamageMatch[1]) ? `${baseDamageMatch[1]} + ${bonus}` : prevDamage;
                });
            }
            else if (type === 'Armor') {
                // Usiamo una funzione che riceve lo stato precedente ('prevArmorClass')
                setArmorClass(prevArmorClass => {
                    const baseACMatch = prevArmorClass.match(/(\d+)/);
                    if (baseACMatch && baseACMatch[1]) {
                        const baseAC = parseInt(baseACMatch[1], 10);
                        return prevArmorClass.replace(String(baseAC), String(baseAC + bonus));
                    }
                    return prevArmorClass;
                });
            }
        }
    }
  }, [name, type, isEditMode]);

  /**
   * Handles the form submission for creating or editing a compendium item.
   * It prevents the default form action, validates required fields, constructs
   * the item data object (including conditional stats for weapons/armor),
   * and then calls the onAddItem callback before closing the form.
   * @param {React.FormEvent} e - The form submission event.
   * @returns {void}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (requestInProgress.current) return;
    setError('');
    if (!e.currentTarget.reportValidity() || !name.trim() || ![w, h, quantity, ...(stackable ? [maxStack] : [])].every(value => Number.isInteger(Number(value)) && Number(value) >= 1)) {
      setError('Enter an item name, positive whole-number dimensions, and valid quantities.');
      return;
    }
    
    // Create the data object with all the fields
    const itemData = {
        name: name.trim(),
        w: parseInt(w, 10),
        h: parseInt(h, 10),
        type,
        stackable,
        maxStack: stackable ? parseInt(maxStack, 10) : null,
        quantity: parseInt(quantity, 10),
        cost,
        weight,
        description,
        rarity,
        magicProperties,
        magicPropertiesVisible: isEditMode ? itemBeingEdited.magicPropertiesVisible ?? false : false,
        attunement,
        icon: selectedIcon ? selectedIcon : null,
    };

    if (type === 'Weapon') {
      itemData.weaponStats = { 
        damage, 
        damageType, 
        properties 
      };
    }

    if (type === 'Armor') {
      itemData.armorStats = { 
        armorClass, 
        armorType, 
        stealthDisadvantage, 
        strengthRequirement: Number(strengthRequirement) || 0 
      };
    }

    requestInProgress.current = true;
    setSaving(true);
    try {
      const result = await onAddItem(isEditMode ? itemData : {
          id: newItemId.current || (newItemId.current = crypto.randomUUID()),
          ...itemData,
          x: 0,
          y: 0,
        });
      if (result === false) {
        setError('Could not save this item. Your changes are still here; please try again.');
      } else onClose();
    } catch (err) {
      setError('Could not save this item. Your changes are still here; please try again.');
    } finally {
      requestInProgress.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="add-item" onClick={event => { if (event.target === event.currentTarget) handleClose(); }}>
      
      {/* IconPicker modal */}
      {showIconPicker && (
        <IconPicker
          onSelectIcon={(iconName) => {
            setSelectedIcon(iconName);
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
        />
      )}

      <div ref={dialogRef} className="add-item__dialog" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} aria-busy={saving} tabIndex={-1} inert={showIconPicker || undefined} onClick={e => e.stopPropagation()}>
        <div className="add-item__header">
          <h2 className="add-item__title" id={`${formId}-title`}>{isEditMode ? 'Edit Item' : 'Add New Item'}</h2>
          <button type="button" onClick={handleClose} disabled={saving} className="add-item__close" aria-label="Close item editor" title="Close">
            <SolidIcons.XMarkIcon aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="add-item__form">
          <div className="add-item__content">
          <fieldset disabled={saving} className="add-item__fields">
          <div className="add-item__identity">
            <div className="add-item__identity-name">
              <label htmlFor={`${formId}-name`} className="add-item__label">Item name</label>
              <input id={`${formId}-name`} data-dialog-autofocus type="text" required value={name} onChange={(e) => setName(e.target.value)} className="add-item__name" />
            </div>
            <div className="add-item__icon-row">
              <button type="button" onClick={() => setShowIconPicker(true)} className="add-item__icon-picker" aria-label={selectedIcon ? 'Change item icon' : 'Choose item icon'} title={selectedIcon ? 'Change icon' : 'Choose icon'}>
                {selectedIcon ? <DynamicIcon iconName={selectedIcon} className="add-item__selected-icon" /> : <SolidIcons.PhotoIcon aria-hidden="true" />}
              </button>
              {selectedIcon && <button type="button" onClick={() => setSelectedIcon(null)} className="add-item__icon-remove" aria-label="Remove item icon" title="Remove icon"><SolidIcons.XMarkIcon aria-hidden="true" /></button>}
            </div>
          </div>

          <section className="add-item__section" aria-labelledby={`${formId}-details`}>
            <h3 id={`${formId}-details`} className="add-item__section-title">Item details</h3>
            <div className="add-item__row">
              <div className="add-item__half">
                <label htmlFor={`${formId}-type`} className="add-item__label">Type</label>
                <select id={`${formId}-type`} value={type} onChange={event => setType(event.target.value)} className="add-item__field">{itemTypes.map(itemType => <option key={itemType}>{itemType}</option>)}</select>
              </div>
              <div className="add-item__half">
                <label htmlFor={`${formId}-rarity`} className="add-item__label">Rarity</label>
                <select id={`${formId}-rarity`} value={rarity} onChange={event => setRarity(event.target.value)} className="add-item__field">{['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'].map(value => <option key={value}>{value}</option>)}</select>
              </div>
            </div>

            {/* Section 2: Gameplay Attributes */}
            <fieldset className="add-item__row add-item__row--bottom">
              {isDM && (
                <div className="add-item__half">
                  <label htmlFor={`${formId}-cost`} className="add-item__label">Cost</label>
                  <input id={`${formId}-cost`} type="text" placeholder="15 gp" value={cost} onChange={(e) => setCost(e.target.value)} className="add-item__field" />
                </div>
              )}
              <div className={isDM ? 'add-item__half' : 'add-item__full'}>
                <label htmlFor={`${formId}-weight`} className="add-item__label">Weight</label>
                <input id={`${formId}-weight`} type="text" placeholder="3 lbs" value={weight} onChange={(e) => setWeight(e.target.value)} className="add-item__field" />
              </div>
            </fieldset>

            <fieldset>
              <label htmlFor={`${formId}-description`} className="add-item__label">Description</label>
              <textarea id={`${formId}-description`} value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="add-item__field" />
            </fieldset>
            <div className="add-item__checkbox-col"><input id={`${formId}-attunement`} type="checkbox" checked={attunement === 'Yes'} onChange={event => setAttunement(event.target.checked ? 'Yes' : 'No')} className="add-item__checkbox" /><label htmlFor={`${formId}-attunement`} className="add-item__checkbox-label">Requires attunement</label></div>
          </section>

          <section className="add-item__section" aria-labelledby={`${formId}-inventory`}>
            <h3 id={`${formId}-inventory`} className="add-item__section-title">Inventory</h3>
            {/* Section 3: Grid Properties */}
            <fieldset className="add-item__row">
              <div className="add-item__half">
                <label htmlFor={`${formId}-width`} className="add-item__label">Width (cells)</label>
                <input id={`${formId}-width`} type="number" min="1" step="1" required value={w} onChange={(e) => setW(e.target.value)} className="add-item__field" />
              </div>
              <div className="add-item__half">
                <label htmlFor={`${formId}-height`} className="add-item__label">Height (cells)</label>
                <input id={`${formId}-height`} type="number" min="1" step="1" required value={h} onChange={(e) => setH(e.target.value)} className="add-item__field" />
              </div>
            </fieldset>

            <div className="add-item__checkbox-col"><input id={`${formId}-stackable`} type="checkbox" checked={stackable} onChange={event => setStackable(event.target.checked)} disabled={isEditMode} className="add-item__checkbox" /><label htmlFor={`${formId}-stackable`} className="add-item__checkbox-label">Stackable</label></div>
            <div className="add-item__row">
              <div className="add-item__half"><label htmlFor={`${formId}-quantity`} className="add-item__label">Quantity</label><input id={`${formId}-quantity`} type="number" min="1" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} disabled={!stackable && !isEditMode} className="add-item__field" /></div>
              {stackable && <div className="add-item__half"><label htmlFor={`${formId}-stack`} className="add-item__label">Maximum stack</label><input id={`${formId}-stack`} type="number" min="1" step="1" required value={maxStack} onChange={event => setMaxStack(event.target.value)} className="add-item__field" /></div>}
            </div>
          </section>

          {isDM && (
            <CollapsibleSection title="Magic Properties (DM Only)">
              <fieldset>
                <label htmlFor={`${formId}-magic`} className="add-item__label">Hidden properties</label>
                <textarea id={`${formId}-magic`} value={magicProperties} onChange={(e) => setMagicProperties(e.target.value)} rows="3" className="add-item__field" />
              </fieldset>
            </CollapsibleSection>
          )}

        {/* Conditional weapon fields */}
        {type === 'Weapon' && (
          <CollapsibleSection title="Weapon Stats" defaultOpen={true}>
            <fieldset>
              <div className="add-item__row">
                <div className="add-item__third">
                  <label htmlFor={`${formId}-damage`} className="add-item__label">Damage</label>
                  <input id={`${formId}-damage`} type="text" placeholder="1d8" value={damage} onChange={(e) => setDamage(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__third">
                  <label htmlFor={`${formId}-damage-type`} className="add-item__label">Damage type</label>
                  <input id={`${formId}-damage-type`} type="text" placeholder="Slashing" value={damageType} onChange={(e) => setDamageType(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__third">
                  <label htmlFor={`${formId}-properties`} className="add-item__label">Properties</label>
                  <input id={`${formId}-properties`} type="text" placeholder="Versatile" value={properties} onChange={(e) => setProperties(e.target.value)} className="add-item__field" />
                </div>
              </div>
            </fieldset>
          </CollapsibleSection>
        )}

        {/* Conditional armor fields */}
        {type === 'Armor' && (
          <CollapsibleSection title="Armor Stats" defaultOpen={true}>
            <fieldset className="add-item__armor">
              <div className="add-item__row">
                <div className="add-item__half">
                  <label htmlFor={`${formId}-ac`} className="add-item__label">Armor class (AC)</label>
                  <input id={`${formId}-ac`} type="text" placeholder="14 + Dex (max 2)" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__half">
                  <label htmlFor={`${formId}-armor-type`} className="add-item__label">Armor type</label>
                    <select id={`${formId}-armor-type`} value={armorType} onChange={(e) => setArmorType(e.target.value)} className="add-item__field">
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                    <option value="Shield">Shield</option>
                  </select>
                </div>
              </div>
              <div className="add-item__row add-item__row--bottom">
                  <div className="add-item__half">
                  <label htmlFor={`${formId}-strength`} className="add-item__label">Strength requirement</label>
                  <input id={`${formId}-strength`} type="number" min="0" step="1" value={strengthRequirement} onChange={(e) => setStrengthRequirement(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__half add-item__checkbox-col">
                    <input id={`${formId}-stealth`} type="checkbox" checked={stealthDisadvantage} onChange={(e) => setStealthDisadvantage(e.target.checked)} className="add-item__checkbox" />
                    <label htmlFor={`${formId}-stealth`} className="add-item__checkbox-label">Stealth disadvantage</label>
                </div>
              </div>
            </fieldset>
          </CollapsibleSection>
        )}

        </fieldset>
        </div>
        {error && <p role="alert" className="add-item__error">{error}</p>}
        <div className="add-item__actions">
          <button type="button" onClick={handleClose} disabled={saving} className="add-item__button add-item__button--cancel">Cancel</button>
          <button type="submit" disabled={saving} className="add-item__button add-item__button--submit">
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
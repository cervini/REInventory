import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getColorForItemType } from '../../utils/itemUtils';
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
  const [rarity, setRarity] = useState(isEditMode ? itemBeingEdited.rarity : 'Common');
  const [magicProperties, setMagicProperties] = useState(isEditMode ? itemBeingEdited.magicProperties ?? '' : '');
  const [attunement, setAttunement] = useState(isEditMode ? itemBeingEdited.attunement : 'No');
  const [damage, setDamage] = useState(isEditMode ? itemBeingEdited.weaponStats?.damage : '');
  const [damageType, setDamageType] = useState(isEditMode ? itemBeingEdited.weaponStats?.damageType : '');
  const [properties, setProperties] = useState(isEditMode ? itemBeingEdited.weaponStats?.properties : '');
  const [armorClass, setArmorClass] = useState(isEditMode ? itemBeingEdited.armorStats?.armorClass : '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(isEditMode ? itemToEdit.item.icon : null);
  const [armorType, setArmorType] = useState(isEditMode ? itemBeingEdited.armorStats?.armorType : 'Light');
  const [stealthDisadvantage, setStealthDisadvantage] = useState(isEditMode ? itemBeingEdited.armorStats?.stealthDisadvantage ?? false : false);
  const [strengthRequirement, setStrengthRequirement] = useState(isEditMode ? itemBeingEdited.armorStats?.strengthRequirement : 0);

  useEffect(() => {
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
  }, [name, type]); // listen to item name and type changes

  /**
   * Handles the form submission for creating or editing a compendium item.
   * It prevents the default form action, validates required fields, constructs
   * the item data object (including conditional stats for weapons/armor),
   * and then calls the onAddItem callback before closing the form.
   * @param {React.FormEvent} e - The form submission event.
   * @returns {void}
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || w <= 0 || h <= 0) {
      toast.error("Please fill out all fields correctly.");
      return;
    }
    
    // Create the data object with all the fields
    const itemData = {
        name,
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

    if (isEditMode) {
      onAddItem(itemData);
    } else {
      onAddItem({
        id: crypto.randomUUID(),
        ...itemData,
        x: 0,
        y: 0,
      });
    }
    
    onClose();
  };

  return (
    <div className="add-item" onClick={onClose}>
      
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

      <div className="add-item__dialog" onClick={e => e.stopPropagation()}>
        <h3 className="add-item__title">
          {isEditMode ? 'Edit Item' : 'Add New Item'}
        </h3>
        <form onSubmit={handleSubmit} className="add-item__form">
          
          {/* Section 1: Core Info */}
          <fieldset>
            <label className="add-item__label">Item Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="add-item__name" />
          </fieldset>

          <CollapsibleSection title="Core Details" defaultOpen={false}>
            <fieldset>
              <label className="add-item__label">Type</label>
              <div className="add-item__types">
                {itemTypes.map(itemType => (
                  <button 
                    type="button" 
                    key={itemType} 
                    onClick={() => setType(itemType)}
                    className={`add-item__type ${type === itemType ? 'add-item__type--selected' : ''}`}
                  >
                    <div className="add-item__type-content">
                      <div className={`add-item__swatch ${getColorForItemType(itemType)}`}></div>
                      <span>{itemType}</span>
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Section 2: Gameplay Attributes */}
            <fieldset className="add-item__row add-item__row--bottom">
              {isDM && (
                <div className="add-item__half">
                  <label className="add-item__label">Cost</label>
                  <input type="text" placeholder="e.g., 15gp" value={cost} onChange={(e) => setCost(e.target.value)} className="add-item__field add-item__field--focus add-item__field--animated" />
                </div>
              )}
              <div className={isDM ? 'add-item__half' : 'add-item__full'}>
                <label className="add-item__label">Weight</label>
                <input type="text" placeholder="e.g., 3 lbs" value={weight} onChange={(e) => setWeight(e.target.value)} className="add-item__field add-item__field--focus add-item__field--animated" />
              </div>
            </fieldset>

            <fieldset className="add-item__row add-item__row--bottom">
              <div className="add-item__third add-item__checkbox-col">
                <input id="stackable" type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} disabled={isEditMode} className="add-item__checkbox" />
                <label htmlFor="stackable" className="add-item__checkbox-label">Stackable</label>
              </div>
              <div className="add-item__third">
                <label className="add-item__label">Quantity</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!stackable && !isEditMode} className="add-item__field add-item__field--focus add-item__field--animated add-item__field--disabled" />
              </div>
              {stackable && (
                <div className="add-item__third">
                  <label className="add-item__label">Max Stack</label>
                  <input type="number" min="1" value={maxStack} onChange={(e) => setMaxStack(e.target.value)} className="add-item__field add-item__field--focus" />
                </div>
              )}
            </fieldset>

            <fieldset className="add-item__row add-item__row--bottom">
              <div className="add-item__half">
                <label className="add-item__label">Rarity</label>
                <select 
                  value={rarity} 
                  onChange={(e) => setRarity(e.target.value)}
                  className="add-item__field add-item__field--focus"
                >
                  {['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="add-item__half add-item__checkbox-col">
                <input id="attunement" type="checkbox" checked={attunement === 'Yes'} onChange={(e) => setAttunement(e.target.checked ? 'Yes' : 'No')} className="add-item__checkbox" />
                <label htmlFor="attunement" className="add-item__checkbox-label">Requires Attunement</label>
              </div>
            </fieldset>
            
            <fieldset>
              <label className="add-item__label">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="add-item__field add-item__field--focus add-item__field--animated"></textarea>
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection title="Grid & Display">
            {/* Section 3: Grid Properties */}
            <fieldset className="add-item__row">
              <div className="add-item__third">
                <label className="add-item__label">Width</label>
                <input type="number" min="1" value={w} onChange={(e) => setW(e.target.value)} className="add-item__field add-item__field--focus add-item__field--animated" />
              </div>
              <div className="add-item__third">
                <label className="add-item__label">Height</label>
                <input type="number" min="1" value={h} onChange={(e) => setH(e.target.value)} className="add-item__field add-item__field--focus add-item__field--animated" />
              </div>
            </fieldset>

            <fieldset>
              <label className="add-item__label">Item Icon</label>
              <div className="add-item__icon-row">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="add-item__icon-picker"
                >
                  {selectedIcon ? (
                    <div className="add-item__icon-preview">
                      <DynamicIcon iconName={selectedIcon} className="add-item__selected-icon" />
                    </div>
                  ) : (
                    'Choose Icon'
                  )}
                </button>
                {selectedIcon && (
                  <button
                    type="button"
                    onClick={() => setSelectedIcon(null)}
                    className="add-item__icon-remove"
                    title="Remove Icon"
                  >
                    <SolidIcons.XMarkIcon className="add-item__remove-icon" />
                  </button>
                )}
              </div>
            </fieldset>
          </CollapsibleSection>

          {isDM && (
            <CollapsibleSection title="Magic Properties (DM Only)">
              <fieldset>
                <textarea value={magicProperties} onChange={(e) => setMagicProperties(e.target.value)} rows="3" className="add-item__field add-item__field--focus add-item__field--animated" placeholder="This description is hidden from players until revealed."></textarea>
              </fieldset>
            </CollapsibleSection>
          )}

        {/* Conditional weapon fields */}
        {type === 'Weapon' && (
          <CollapsibleSection title="Weapon Stats" defaultOpen={true}>
            <fieldset>
              <div className="add-item__row">
                <div className="add-item__third">
                  <label className="add-item__label">Damage</label>
                  <input type="text" placeholder="e.g., 1d8" value={damage} onChange={(e) => setDamage(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__third">
                  <label className="add-item__label">Damage Type</label>
                  <input type="text" placeholder="e.g., Slashing" value={damageType} onChange={(e) => setDamageType(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__third">
                  <label className="add-item__label">Properties</label>
                  <input type="text" placeholder="e.g., Versatile" value={properties} onChange={(e) => setProperties(e.target.value)} className="add-item__field" />
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
                  <label className="add-item__label">Armor Class (AC)</label>
                  <input type="text" placeholder="e.g., 14 + Dex (max 2)" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__half">
                  <label className="add-item__label">Armor Type</label>
                    <select value={armorType} onChange={(e) => setArmorType(e.target.value)} className="add-item__field">
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                    <option value="Shield">Shield</option>
                  </select>
                </div>
              </div>
              <div className="add-item__row add-item__row--bottom">
                  <div className="add-item__half">
                  <label className="add-item__label">Strength Requirement</label>
                  <input type="number" min="0" value={strengthRequirement} onChange={(e) => setStrengthRequirement(e.target.value)} className="add-item__field" />
                </div>
                <div className="add-item__half add-item__checkbox-col">
                    <input id="stealthDisadvantage" type="checkbox" checked={stealthDisadvantage} onChange={(e) => setStealthDisadvantage(e.target.checked)} className="add-item__checkbox" />
                    <label htmlFor="stealthDisadvantage" className="add-item__checkbox-label">Stealth Disadvantage</label>
                </div>
              </div>
            </fieldset>
          </CollapsibleSection>
        )}

        {/* Action Buttons */}
        <div className="add-item__actions">
          <button type="button" onClick={onClose} className="add-item__button add-item__button--cancel">Cancel</button>
          <button type="submit" className="add-item__button add-item__button--submit">
            {isEditMode ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
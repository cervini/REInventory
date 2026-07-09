import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getColorForItemType } from '../utils/itemUtils';
import IconPicker from './ui/IconPicker';
import DynamicIcon from './ui/DynamicIcon';
import CollapsibleSection from './ui/CollapsibleSection';
import * as SolidIcons from '@heroicons/react/24/solid';

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
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-20 backdrop-blur-sm" onClick={onClose}>
      
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

      <div className="bg-gradient-to-b from-surface to-background border border-accent/20 p-6 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-6 font-fantasy text-accent text-center">
          {isEditMode ? 'Edit Item' : 'Add New Item'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-2">
          
          {/* Section 1: Core Info */}
          <fieldset>
            <label className="block text-sm font-bold mb-2 text-text-muted">Item Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" />
          </fieldset>

          <CollapsibleSection title="Core Details" defaultOpen={false}>
            <fieldset>
              <label className="block text-sm font-bold mb-2 text-text-muted">Type</label>
              <div className="flex flex-wrap gap-2">
                {itemTypes.map(itemType => (
                  <button 
                    type="button" 
                    key={itemType} 
                    onClick={() => setType(itemType)}
                    className={`px-3 py-1 rounded-full text-sm border-2 ${type === itemType ? 'border-accent text-accent' : 'border-surface/50 text-text-muted'} transition-all`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${getColorForItemType(itemType)}`}></div>
                      <span>{itemType}</span>
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Section 2: Gameplay Attributes */}
            <fieldset className="flex items-end space-x-4">
              {isDM && (
                <div className="w-1/2">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Cost</label>
                  <input type="text" placeholder="e.g., 15gp" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" />
                </div>
              )}
              <div className={isDM ? "w-1/2" : "w-full"}>
                <label className="block text-sm font-bold mb-2 text-text-muted">Weight</label>
                <input type="text" placeholder="e.g., 3 lbs" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" />
              </div>
            </fieldset>

            <fieldset className="flex items-end space-x-4">
              <div className="w-1/3 flex items-center pb-2">
                <input id="stackable" type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} disabled={isEditMode} className="w-4 h-4 text-primary bg-background border-surface/50 rounded focus:ring-accent" />
                <label htmlFor="stackable" className="ml-2 text-sm font-medium text-text-muted">Stackable</label>
              </div>
              <div className="w-1/3">
                <label className="block text-sm font-bold mb-2 text-text-muted">Quantity</label>
                <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!stackable && !isEditMode} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200 disabled:opacity-50" />
              </div>
              {stackable && (
                <div className="w-1/3">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Max Stack</label>
                  <input type="number" min="1" value={maxStack} onChange={(e) => setMaxStack(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent" />
                </div>
              )}
            </fieldset>

            <fieldset className="flex items-end space-x-4">
              <div className="w-1/2">
                <label className="block text-sm font-bold mb-2 text-text-muted">Rarity</label>
                <select 
                  value={rarity} 
                  onChange={(e) => setRarity(e.target.value)}
                  className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="w-1/2 flex items-center pb-2">
                <input id="attunement" type="checkbox" checked={attunement === 'Yes'} onChange={(e) => setAttunement(e.target.checked ? 'Yes' : 'No')} className="w-4 h-4 text-primary bg-background border-surface/50 rounded focus:ring-accent" />
                <label htmlFor="attunement" className="ml-2 text-sm font-medium text-text-muted">Requires Attunement</label>
              </div>
            </fieldset>
            
            <fieldset>
              <label className="block text-sm font-bold mb-2 text-text-muted">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200"></textarea>
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection title="Grid & Display">
            {/* Section 3: Grid Properties */}
            <fieldset className="flex space-x-4">
              <div className="w-1/3">
                <label className="block text-sm font-bold mb-2 text-text-muted">Width</label>
                <input type="number" min="1" value={w} onChange={(e) => setW(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" />
              </div>
              <div className="w-1/3">
                <label className="block text-sm font-bold mb-2 text-text-muted">Height</label>
                <input type="number" min="1" value={h} onChange={(e) => setH(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" />
              </div>
            </fieldset>

            <fieldset>
              <label className="block text-sm font-bold mb-2 text-text-muted">Item Icon</label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(true)}
                  className="w-full p-2 bg-background border border-surface/50 rounded-md flex items-center justify-center hover:bg-accent hover:text-background transition-colors"
                >
                  {selectedIcon ? (
                    <div className="w-8 h-8 flex items-center justify-center">
                      <DynamicIcon iconName={selectedIcon} className="max-w-full max-h-full" />
                    </div>
                  ) : (
                    'Choose Icon'
                  )}
                </button>
                {selectedIcon && (
                  <button
                    type="button"
                    onClick={() => setSelectedIcon(null)}
                    className="p-2 bg-destructive/80 hover:bg-destructive text-text-base rounded-md flex-shrink-0 flex items-center justify-center transition-colors"
                    title="Remove Icon"
                  >
                    <SolidIcons.XMarkIcon className="w-8 h-8" />
                  </button>
                )}
              </div>
            </fieldset>
          </CollapsibleSection>

          {isDM && (
            <CollapsibleSection title="Magic Properties (DM Only)">
              <fieldset>
                <textarea value={magicProperties} onChange={(e) => setMagicProperties(e.target.value)} rows="3" className="w-full p-2 bg-background border border-surface/50 rounded-md focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-200" placeholder="This description is hidden from players until revealed."></textarea>
              </fieldset>
            </CollapsibleSection>
          )}

        {/* Conditional weapon fields */}
        {type === 'Weapon' && (
          <CollapsibleSection title="Weapon Stats" defaultOpen={true}>
            <fieldset>
              <div className="flex space-x-4">
                <div className="w-1/3">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Damage</label>
                  <input type="text" placeholder="e.g., 1d8" value={damage} onChange={(e) => setDamage(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md" />
                </div>
                <div className="w-1/3">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Damage Type</label>
                  <input type="text" placeholder="e.g., Slashing" value={damageType} onChange={(e) => setDamageType(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md" />
                </div>
                <div className="w-1/3">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Properties</label>
                  <input type="text" placeholder="e.g., Versatile" value={properties} onChange={(e) => setProperties(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md" />
                </div>
              </div>
            </fieldset>
          </CollapsibleSection>
        )}

        {/* Conditional armor fields */}
        {type === 'Armor' && (
          <CollapsibleSection title="Armor Stats" defaultOpen={true}>
            <fieldset className="space-y-4">
              <div className="flex space-x-4">
                <div className="w-1/2">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Armor Class (AC)</label>
                  <input type="text" placeholder="e.g., 14 + Dex (max 2)" value={armorClass} onChange={(e) => setArmorClass(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md" />
                </div>
                <div className="w-1/2">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Armor Type</label>
                    <select value={armorType} onChange={(e) => setArmorType(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md">
                    <option value="Light">Light</option>
                    <option value="Medium">Medium</option>
                    <option value="Heavy">Heavy</option>
                    <option value="Shield">Shield</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-4 items-end">
                  <div className="w-1/2">
                  <label className="block text-sm font-bold mb-2 text-text-muted">Strength Requirement</label>
                  <input type="number" min="0" value={strengthRequirement} onChange={(e) => setStrengthRequirement(e.target.value)} className="w-full p-2 bg-background border border-surface/50 rounded-md" />
                </div>
                <div className="w-1/2 flex items-center pb-2">
                    <input id="stealthDisadvantage" type="checkbox" checked={stealthDisadvantage} onChange={(e) => setStealthDisadvantage(e.target.checked)} className="w-4 h-4 text-primary bg-background border-surface/50 rounded focus:ring-accent" />
                    <label htmlFor="stealthDisadvantage" className="ml-2 text-sm font-medium text-text-muted">Stealth Disadvantage</label>
                </div>
              </div>
            </fieldset>
          </CollapsibleSection>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-4">
          <button type="button" onClick={onClose} className="bg-surface hover:bg-surface/80 text-text-base font-bold py-2 px-4 rounded transition-colors duration-200">Cancel</button>
          <button type="submit" className="bg-primary hover:bg-accent hover:text-background text-text-base font-bold py-2 px-4 rounded transition-colors duration-200">
            {isEditMode ? 'Save Changes' : 'Create Item'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
}
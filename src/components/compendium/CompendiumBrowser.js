import React, { useId, useState } from 'react';
import { ArrowPathIcon, BookOpenIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import DynamicIcon from '../icons/DynamicIcon';
import Spinner from '../ui/Spinner';
import { getColorForItemType, itemTypeOptions } from '../../utils/itemUtils';
import './Compendium.css';

const rarities = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

export default function CompendiumBrowser({ entries, selectedKey, onSelect, isLoading, errors = [], onRetry, disabled = false, isViewerDM = false, children }) {
  const fieldId = useId();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [rarity, setRarity] = useState('');
  const filtered = entries.filter(({ item }) =>
    String(item.name || '').toLowerCase().includes(search.trim().toLowerCase()) &&
    (!type || item.type === type) && (!rarity || (item.rarity || 'Common') === rarity)
  ).sort((first, second) => String(first.item.name || '').localeCompare(String(second.item.name || '')));
  const selected = entries.find(entry => entry.key === selectedKey);
  const item = selected?.item;
  const resetFilters = () => { setSearch(''); setType(''); setRarity(''); };

  return (
    <div className="compendium-browser">
      <div className="compendium-browser__filters">
        <label className="compendium-browser__search" htmlFor={`${fieldId}-search`}>
          <MagnifyingGlassIcon aria-hidden="true" />
          <input id={`${fieldId}-search`} data-dialog-autofocus type="search" aria-label="Search items" placeholder="Search items" value={search} onChange={event => setSearch(event.target.value)} disabled={disabled} />
        </label>
        <label className="compendium-browser__filter" htmlFor={`${fieldId}-type`}>Type
          <select id={`${fieldId}-type`} value={type} onChange={event => setType(event.target.value)} disabled={disabled}>
            <option value="">All types</option>
            {itemTypeOptions.map(option => <option key={option.type}>{option.type}</option>)}
          </select>
        </label>
        <label className="compendium-browser__filter" htmlFor={`${fieldId}-rarity`}>Rarity
          <select id={`${fieldId}-rarity`} value={rarity} onChange={event => setRarity(event.target.value)} disabled={disabled}>
            <option value="">All rarities</option>
            {rarities.map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <button type="button" className="compendium__icon-button" aria-label="Clear filters" title="Clear filters" onClick={resetFilters} disabled={disabled || !(search || type || rarity)}><XMarkIcon aria-hidden="true" /></button>
      </div>
      {errors.filter(Boolean).length > 0 && <div className="compendium-browser__error" role="alert"><p>{errors.filter(Boolean).join(' ')}</p><button type="button" className="compendium__button" onClick={onRetry} disabled={disabled || isLoading}><ArrowPathIcon aria-hidden="true" />Retry</button></div>}
      <p className="compendium-browser__count" role="status">{isLoading ? 'Loading items...' : `${filtered.length} of ${entries.length} items`}</p>
      <div className="compendium-browser__layout">
        <div className="compendium-browser__list" aria-label="Compendium items" aria-busy={isLoading}>
          {isLoading ? <Spinner /> : filtered.length ? filtered.map(entry => (
            <button type="button" key={entry.key} className="compendium-browser__item" aria-pressed={selectedKey === entry.key} disabled={disabled} onClick={() => onSelect(entry)}>
              <span className={`compendium-browser__icon ${getColorForItemType(entry.item.type)}`}>{entry.item.icon ? <DynamicIcon iconName={entry.item.icon} /> : <BookOpenIcon aria-hidden="true" />}</span>
              <span className="compendium-browser__item-text"><strong>{entry.item.name || 'Unnamed item'}</strong><span>{entry.item.type || 'Other'} · {entry.item.rarity || 'Common'} · {entry.source}</span></span>
              <span className="compendium-browser__dimensions">{entry.item.w || 1}×{entry.item.h || 1}</span>
            </button>
          )) : <div className="compendium-browser__empty"><BookOpenIcon aria-hidden="true" /><p>{entries.length ? 'No matching items.' : errors.some(Boolean) ? 'Items are unavailable.' : 'No items in this collection yet.'}</p>{entries.length > 0 && <button type="button" className="compendium__button" onClick={resetFilters} disabled={disabled}>Clear filters</button>}</div>}
        </div>
        {item && <section className="compendium-browser__details" aria-label="Item details">
          <div className="compendium-browser__detail-heading"><span className={`compendium-browser__icon ${getColorForItemType(item.type)}`}>{item.icon ? <DynamicIcon iconName={item.icon} /> : <BookOpenIcon aria-hidden="true" />}</span><div><h2>{item.name || 'Unnamed item'}</h2><p>{item.type || 'Other'} · {item.rarity || 'Common'} · {selected.source}</p></div></div>
          <dl className="compendium-browser__facts">
            <div><dt>Size</dt><dd>{item.w || 1}×{item.h || 1}</dd></div><div><dt>Weight</dt><dd>{item.weight || 'Not specified'}</dd></div>
            <div><dt>Cost</dt><dd>{item.cost || 'Not specified'}</dd></div><div><dt>Attunement</dt><dd>{item.attunement || 'No'}</dd></div>
          </dl>
          {item.description && <p className="compendium-browser__description">{item.description}</p>}
          {item.weaponStats?.damage && <p>Damage: {item.weaponStats.damage} {item.weaponStats.damageType}</p>}
          {item.weaponStats?.properties && <p>Properties: {item.weaponStats.properties}</p>}
          {item.armorStats?.armorClass && <p>Armor class: {item.armorStats.armorClass}</p>}
          {item.armorStats?.armorType && <p>Armor type: {item.armorStats.armorType}</p>}
          {item.armorStats?.strengthRequirement > 0 && <p>Strength required: {item.armorStats.strengthRequirement}</p>}
          {item.armorStats?.stealthDisadvantage && <p>Disadvantage on Stealth checks</p>}
          {item.magicProperties && (isViewerDM || item.magicPropertiesVisible) && <p className="compendium-browser__description">{item.magicProperties}</p>}
          {children}
        </section>}
      </div>
    </div>
  );
}
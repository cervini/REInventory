import React from 'react';
import { BookOpenIcon, BuildingStorefrontIcon, PlusIcon } from '@heroicons/react/24/outline';
import './InventoryGrid.css';

export default function InventoryActions({ isDM, onOpenCompendium, onAddItem, onCreateMerchant }) {
  return (
    <div className="inventory-grid__tools" role="group" aria-label="Inventory tools">
      <button
        type="button"
        onClick={onOpenCompendium}
        className="inventory-grid__tool"
        aria-label="Add Item from Compendium"
        title="Add item from compendium"
      >
        <BookOpenIcon className="inventory-grid__tool-icon" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onAddItem}
        className="inventory-grid__tool inventory-grid__tool--primary"
        aria-label="Create New Item"
        title="Create new item"
      >
        <PlusIcon className="inventory-grid__tool-icon" aria-hidden="true" />
      </button>
      {isDM && (
        <button type="button" onClick={onCreateMerchant} className="inventory-grid__tool" aria-label="Create Merchant" title="Create merchant">
          <BuildingStorefrontIcon className="inventory-grid__tool-icon" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
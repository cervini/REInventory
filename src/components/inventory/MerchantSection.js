import React, { useId } from 'react';
import { BuildingStorefrontIcon, TrashIcon } from '@heroicons/react/24/outline';
import PlayerInventory from './PlayerInventory';
import './InventoryGrid.css';

export default function MerchantSection({
  merchants, isDM, onDeleteMerchant, campaign, user, cellSizes, gridRefs, onContextMenu
}) {
  const sectionId = useId();
  return (
    <section className="inventory-grid__shops" aria-label="Merchants">
      {merchants.map(merchant => {
        const itemCount = (merchant.trayItems || []).reduce((total, item) => total + (Number(item.quantity) || 1), 0);
        return <article key={merchant.ownerId} className="inventory-grid__shop" aria-labelledby={`${sectionId}-${merchant.ownerId}`}>
          <div className="inventory-grid__shop-header">
            <div className="inventory-grid__loot-heading">
              <BuildingStorefrontIcon className="inventory-grid__section-icon" aria-hidden="true" />
              <div className="inventory-grid__section-heading">
                <h3 id={`${sectionId}-${merchant.ownerId}`} className="inventory-grid__shop-title">{merchant.characterName || 'Unnamed merchant'}</h3>
                <p className="inventory-grid__section-meta"><span>Merchant</span><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></p>
              </div>
            </div>
            {isDM && (
              <button
                type="button"
                onClick={() => onDeleteMerchant(merchant)}
                className="inventory-grid__shop-delete"
                title="Delete Shop"
                aria-label={`Delete ${merchant.characterName || 'merchant'}`}
              >
                <TrashIcon className="inventory-grid__shop-delete-icon" aria-hidden="true" />
              </button>
            )}
          </div>
          <PlayerInventory
            playerId={merchant.ownerId}
            inventoryData={merchant}
            campaign={campaign}
            playerProfiles={{}}
            user={user}
            setEditingSettings={() => { }}
            cellSizes={cellSizes}
            gridRefs={gridRefs}
            onContextMenu={onContextMenu}
            onToggleEquipped={() => { }}
            isEquippedVisible={false}
            isLootPile={true}
          />
        </article>;
      })}
    </section>
  );
}
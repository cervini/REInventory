import React, { useId } from 'react';
import { ArchiveBoxIcon, ChevronUpIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import PlayerInventory from './PlayerInventory';
import './InventoryGrid.css';

export default function LootPileSection({
  lootPileData, isDM, isExpanded, onUpdateName, onToggleVisibility, onToggleExpanded,
  campaign, user, cellSizes, gridRefs, onContextMenu
}) {
  const panelId = useId();
  const name = lootPileData.characterName || 'Party loot';
  const itemCount = (lootPileData.trayItems || []).reduce((total, item) => total + (Number(item.quantity) || 1), 0);
  const saveName = event => {
    const nextName = event.currentTarget.value.trim();
    event.currentTarget.value = nextName || name;
    if (nextName && nextName !== name) onUpdateName(nextName);
  };

  return (
    <section className="inventory-grid__loot" aria-label={name}>
      <div className="inventory-grid__loot-header">
        <div className="inventory-grid__loot-heading">
          <ArchiveBoxIcon className="inventory-grid__section-icon" aria-hidden="true" />
          <div className="inventory-grid__section-heading">
            {isDM ? (
              <input
                type="text"
                defaultValue={name}
                onBlur={saveName}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    event.stopPropagation();
                    event.currentTarget.value = name;
                    event.currentTarget.blur();
                  }
                }}
                aria-label="Loot pile name"
                title="Loot pile name"
                className="inventory-grid__loot-title inventory-grid__loot-title--input"
                placeholder="Party loot"
              />
            ) : (
              <h3 className="inventory-grid__loot-title">{name}</h3>
            )}
            <p className="inventory-grid__section-meta">
              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
              {isDM && (
                <span role="status" id={`${panelId}-visibility`} className={`inventory-grid__loot-status${lootPileData.isVisibleToPlayers ? ' inventory-grid__loot-status--visible' : ''}`}>
                  {lootPileData.isVisibleToPlayers ? 'Visible to players' : 'Hidden from players'}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="inventory-grid__loot-actions">
          {isDM && (
            <button
              type="button"
              onClick={onToggleVisibility}
              className="inventory-grid__loot-action"
              aria-label="Visible to players"
              aria-pressed={!!lootPileData.isVisibleToPlayers}
              aria-describedby={`${panelId}-visibility`}
              title={lootPileData.isVisibleToPlayers ? "Hide from players" : "Show to players"}
            >
              {lootPileData.isVisibleToPlayers ? (
                <EyeIcon className="inventory-grid__loot-action-icon" aria-hidden="true" />
              ) : (
                <EyeSlashIcon className="inventory-grid__loot-action-icon" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleExpanded}
            className="inventory-grid__loot-action"
            aria-label={isExpanded ? 'Collapse loot' : 'Expand loot'}
            aria-expanded={isExpanded}
            aria-controls={panelId}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <ChevronUpIcon
              className={`inventory-grid__loot-action-icon inventory-grid__loot-chevron${isExpanded ? ' inventory-grid__loot-chevron--expanded' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div id={panelId} className="inventory-grid__loot-content" hidden={!isExpanded}>
        {isExpanded && <PlayerInventory
          playerId="public-loot"
          inventoryData={lootPileData}
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
        />}
      </div>
    </section>
  );
}
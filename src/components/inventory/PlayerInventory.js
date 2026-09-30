import React, { useMemo } from 'react';
import { Cog6ToothIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import DraggableContainerCard from './DraggableContainerCard';
import ItemTray from './ItemTray';
import Wallet from './Wallet';
import WeightCounter from './WeightCounter';
import './InventoryGrid.css';

export default function PlayerInventory({
  playerId, inventoryData, campaign, playerProfiles, user,
  setEditingSettings, cellSizes, gridRefs, onContextMenu, onToggleEquipped, isEquippedVisible,
  isLootPile = false
}) {
  // We use optional chaining (?.) to prevent errors if inventoryData is not ready.
  const containers = useMemo(() => {
    const list = Object.values(inventoryData?.containers || {});
    return list.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  }, [inventoryData]);
  const isViewerDM = campaign?.dmId === user.uid;

  const totalWeightLbs = useMemo(() => {
    if (!inventoryData) return 0;
    const containerGridItems = containers
      .filter(c => c.trackWeight ?? true)
      .flatMap(c => c.gridItems || []);
    const equippedItems = inventoryData.equippedItems || [];

    // Items on the floor/ground (playerTrayItems) should not count towards encumbrance.
    // Only items in containers and equipped items affect the character's weight.
    const allItems = [...containerGridItems, ...equippedItems];
    return allItems.reduce((total, item) => {
      const weightValue = parseFloat(item.weight);
      if (!isNaN(weightValue)) {
        return total + (weightValue * (item.quantity || 1));
      }
      return total;
    }, 0);
  }, [inventoryData, containers]);

  // The conditional return now correctly happens AFTER all hooks are called.
  if (!inventoryData) return null;

  const isPlayerDM = campaign?.dmId === playerId;
  const isMyInventory = user.uid === inventoryData.ownerId;
  const characterName = inventoryData.characterName || playerProfiles[playerId]?.displayName || 'Unnamed character';

  return (
    <section className={`inventory-grid__player-inventory${isLootPile ? '' : ' inventory-grid__player-inventory--regular'}`} aria-label={isLootPile ? undefined : `${characterName} inventory`}>

      {/* 1. HIDE HEADER FOR LOOT PILE (No Name, Wallet, or Weight) */}
      {!isLootPile && (
        <div className="inventory-grid__player-header">
          <h3 className="inventory-grid__player-name">{characterName}</h3>
          <div className="inventory-grid__player-actions">
            {!isPlayerDM && (
              <Wallet
                campaignId={campaign.id}
                inventoryId={playerId}
                currency={inventoryData.currency}
                canEdit={isMyInventory}
              />
            )}
            {!isPlayerDM && (
              <WeightCounter
                currentWeight={totalWeightLbs}
                maxWeight={inventoryData.totalMaxWeight || 0}
                unit={inventoryData.weightUnit || 'lbs'}
              />
            )}
            {!isPlayerDM && (
              <button
                type="button"
                onClick={onToggleEquipped}
                className="inventory-grid__player-action"
                aria-label={isEquippedVisible ? 'Hide equipped items' : 'Show equipped items'}
                aria-expanded={isEquippedVisible}
                aria-controls={`equipped-${playerId}`}
                title={isEquippedVisible ? 'Hide equipped items' : 'Show equipped items'}
              >
                <ShieldCheckIcon className="inventory-grid__player-action-icon" aria-hidden="true" />
              </button>
            )}
            {isMyInventory && !isPlayerDM && (
              <button
                type="button"
                onClick={() => setEditingSettings({
                  playerId: playerId,
                  currentSettings: inventoryData,
                  isDMInventory: isPlayerDM
                })}
                className="inventory-grid__player-action"
                aria-label={`Inventory settings for ${characterName}`}
                title="Inventory settings"
              >
                <Cog6ToothIcon className="inventory-grid__player-action-icon" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Equipped Items Tray */}
      {!isPlayerDM && !isLootPile && (
        <div id={`equipped-${playerId}`} className={`inventory-grid__equipped${isEquippedVisible ? ' inventory-grid__equipped--visible' : ''}`}>
          <div className="inventory-grid__equipped-content">
            <h4 className="inventory-grid__equipped-title">Equipped</h4>
            <div className="inventory-grid__tray">
              <ItemTray
                items={inventoryData.equippedItems || []}
                containerId="equipped"
                onContextMenu={onContextMenu}
                playerId={playerId}
                isViewerDM={isViewerDM}
                emptyMessage="No items equipped."
                source="equipped"
                layout="horizontal"
                disabled={!isEquippedVisible}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content (Containers + Tray) */}
      <div className={isLootPile ? '' : 'inventory-grid__player-content'}>
        <div className="inventory-grid__player-sections">

          {/* Grids (Used by players) */}
          {!isPlayerDM && !isLootPile && (
            <div id={`canvas-${playerId}`} className="inventory-grid__canvas">
              {containers.map((container) => (
                <DraggableContainerCard
                  key={container.id}
                  container={container}
                  playerId={playerId}
                  isViewerDM={isViewerDM}
                  onContextMenu={onContextMenu}
                  cellSizes={cellSizes}
                  gridRefs={gridRefs}
                  isDraggable={!isLootPile && (isMyInventory || isViewerDM)}
                />
              ))}
            </div>
          )}

          {/* Tray (Used by everyone) */}
          <div className="inventory-grid__floor">
            {/* 2. CHANGE TRAY LABEL: Hide 'Floor/Ground' for loot pile */}
            {!isLootPile && (
              <h4 className="inventory-grid__floor-title">Floor / Ground</h4>
            )}

            <div className={`inventory-grid__tray${isLootPile ? ' inventory-grid__tray--loot' : ''}`}>
              <ItemTray
                items={inventoryData.trayItems || []}
                containerId="tray"
                onContextMenu={onContextMenu}
                playerId={playerId}
                isViewerDM={isViewerDM}
                emptyMessage={isLootPile ? "Empty" : "There is nothing on the ground."}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
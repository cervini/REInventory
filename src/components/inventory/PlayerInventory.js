import React, { useMemo } from 'react';
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

  return (
    <div className={`inventory-grid__player-inventory${isLootPile ? '' : ' inventory-grid__player-inventory--regular'}`}>

      {/* 1. HIDE HEADER FOR LOOT PILE (No Name, Wallet, or Weight) */}
      {!isLootPile && (
        <div className="inventory-grid__player-header">
          <h2 className="inventory-grid__player-name">
            {inventoryData.characterName || playerProfiles[playerId]?.displayName}
          </h2>
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
                onClick={onToggleEquipped}
                className="inventory-grid__player-action"
                title="Toggle Equipped Items"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="inventory-grid__player-action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.602-3.751m-.228-1.12A12.001 12.001 0 0012 2.75c-2.652 0-5.115 1.02-6.974 2.722" />
                </svg>
              </button>
            )}
            {isMyInventory && !isPlayerDM && (
              <button
                onClick={() => setEditingSettings({
                  playerId: playerId,
                  currentSettings: inventoryData,
                  isDMInventory: isPlayerDM
                })}
                className="inventory-grid__player-action"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="inventory-grid__player-action-icon inventory-grid__player-action-icon--small" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                  <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Equipped Items Tray */}
      {!isPlayerDM && !isLootPile && (
        <div className={`inventory-grid__equipped${isEquippedVisible ? ' inventory-grid__equipped--visible' : ''}`}>
          <div className="inventory-grid__equipped-content">
            <h3 className="inventory-grid__equipped-title">Equipped</h3>
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
              <h3 className="inventory-grid__floor-title">Floor / Ground</h3>
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
    </div>
  );
}